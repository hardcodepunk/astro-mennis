import {
  DeployWebhookError,
  MAX_CALLBACK_BODY_BYTES,
  boundedText,
  jsonResponse,
  readBoundedBody,
  readDeployStatusEnvironment,
  safeWorkflowUrl,
  secretsMatch,
} from "./_lib/sanity-deploy-core.mjs"
import {createSanityStatusStore} from "./_lib/sanity-status-store.mjs"

const allowedStates = new Set(["claim", "requested", "failed"])
const eventKeyPattern = /^[a-f0-9]{64}$/
const claimIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function deploymentStatusStore(config) {
  return createSanityStatusStore({
    projectId: config.projectId,
    dataset: config.dataset,
    token: config.statusToken,
  })
}

function parseCallbackBody(rawBody) {
  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    throw new DeployWebhookError(400, "invalid_json", "Request body must be valid JSON")
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new DeployWebhookError(400, "invalid_payload", "Request body must be a JSON object")
  }
  if (
    !allowedStates.has(body.state) ||
    typeof body.claimId !== "string" ||
    !claimIdPattern.test(body.claimId)
  ) {
    throw new DeployWebhookError(400, "invalid_payload", "Callback payload is invalid")
  }
  if (
    body.eventKey !== undefined &&
    (typeof body.eventKey !== "string" || !eventKeyPattern.test(body.eventKey))
  ) {
    throw new DeployWebhookError(400, "invalid_payload", "Callback payload is invalid")
  }
  if (body.state !== "claim" && body.eventKey === undefined) {
    throw new DeployWebhookError(400, "invalid_payload", "Callback payload is invalid")
  }
  return body
}

function callbackPatch(body, now) {
  const workflowUrl = safeWorkflowUrl(body.workflowUrl)

  if (body.state === "requested") {
    const deployJobId = boundedText(body.deployJobId, 128)
    if (!deployJobId || !/^[A-Za-z0-9_-]+$/.test(deployJobId)) {
      throw new DeployWebhookError(400, "invalid_payload", "deployJobId is invalid")
    }
    return {
      patch: {
        set: {
          status: "requested",
          dispatchState: "vercel-requested",
          message:
            "Vercel accepted the deploy-hook request. Use the linked workflow or Vercel dashboard to confirm when it is live.",
          deployJobId,
          deploymentRequestedAt: new Date(now()).toISOString(),
          ...(workflowUrl ? {workflowUrl} : {}),
        },
        unset: ["lastError"],
      },
      allowedDispatchStates: ["workflow-claimed", "vercel-requested"],
    }
  }

  const lastError = boundedText(body.message) || "The deployment workflow failed."
  return {
    patch: {
      set: {
        status: "failed",
        dispatchState: "deployment-failed",
        message: "The deployment workflow needs attention. Open the linked workflow for details.",
        lastError,
        ...(workflowUrl ? {workflowUrl} : {}),
      },
    },
    allowedDispatchStates: ["workflow-claimed", "deployment-failed"],
  }
}

function claimResponse(result) {
  if (result.updated && result.eventKey) {
    return jsonResponse(200, {updated: true, eventKey: result.eventKey})
  }
  if (result.decision === "stale") {
    return jsonResponse(409, {
      updated: false,
      reason: "stale",
      ...(result.eventKey ? {eventKey: result.eventKey} : {}),
    })
  }
  const reason = result.decision === "leased" || result.decision === "quiet"
    ? result.decision
    : "no-work"
  return jsonResponse(202, {
    updated: false,
    reason,
    ...(result.eventKey ? {eventKey: result.eventKey} : {}),
  })
}

export async function handleDeployStatusRequest(
  request,
  {environment = process.env, now = Date.now, statusStoreFactory = deploymentStatusStore} = {},
) {
  if (request.method !== "POST") {
    return new Response(null, {status: 405, headers: {allow: "POST"}})
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim()
  if (contentType !== "application/json") {
    return jsonResponse(415, {updated: false, code: "unsupported_media_type"})
  }

  let config
  try {
    config = readDeployStatusEnvironment(environment)
  } catch (error) {
    process.stderr.write(`Deployment status callback configuration error: ${error.message}\n`)
    return jsonResponse(503, {updated: false, code: "configuration_error"})
  }

  const authorization = request.headers.get("authorization")
  const receivedSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined
  if (!secretsMatch(receivedSecret, config.callbackSecret)) {
    return jsonResponse(401, {updated: false, code: "unauthorized"})
  }

  try {
    const body = parseCallbackBody(await readBoundedBody(request, MAX_CALLBACK_BODY_BYTES))
    const statusStore = statusStoreFactory(config)

    if (body.state === "claim") {
      const result = await statusStore.claimLatest({
        expectedEventKey: body.eventKey,
        claimId: body.claimId,
        nowMs: now(),
        workflowUrl: safeWorkflowUrl(body.workflowUrl),
      })
      return claimResponse(result)
    }

    const transition = callbackPatch(body, now)
    const result = await statusStore.updateClaimed(
      body.eventKey,
      body.claimId,
      transition.patch,
      {allowedDispatchStates: transition.allowedDispatchStates},
    )

    if (!result.updated) {
      return jsonResponse(409, {updated: false, reason: result.reason})
    }
    return jsonResponse(200, {updated: true, eventKey: result.eventKey})
  } catch (error) {
    if (error instanceof DeployWebhookError) {
      return jsonResponse(error.status, {updated: false, code: error.code})
    }
    process.stderr.write(`Deployment status callback failed safely: ${error.message}\n`)
    return jsonResponse(503, {updated: false, code: "status_unavailable"})
  }
}

export function POST(request) {
  return handleDeployStatusRequest(request)
}
