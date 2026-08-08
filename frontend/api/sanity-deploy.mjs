import {dispatchContentDeployment} from "./_lib/github-dispatch.mjs"
import {
  DeployWebhookError,
  MAX_WEBHOOK_BODY_BYTES,
  jsonResponse,
  parseVerifiedSanityEvent,
  readBoundedBody,
  readSanityDeployEnvironment,
} from "./_lib/sanity-deploy-core.mjs"
import {createSanityStatusStore} from "./_lib/sanity-status-store.mjs"

function deploymentStatusStore(config) {
  return createSanityStatusStore({
    projectId: config.projectId,
    dataset: config.dataset,
    token: config.statusToken,
  })
}

export async function handleSanityDeployRequest(
  request,
  {
    environment = process.env,
    now = Date.now,
    statusStoreFactory = deploymentStatusStore,
    dispatch = dispatchContentDeployment,
  } = {},
) {
  if (request.method !== "POST") {
    return new Response(null, {status: 405, headers: {allow: "POST"}})
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim()
  if (contentType !== "application/json") {
    return jsonResponse(415, {accepted: false, code: "unsupported_media_type"})
  }

  let config
  try {
    config = readSanityDeployEnvironment(environment)
  } catch (error) {
    process.stderr.write(`Sanity deploy webhook configuration error: ${error.message}\n`)
    return jsonResponse(503, {accepted: false, code: "configuration_error"})
  }

  try {
    const rawBody = await readBoundedBody(request, MAX_WEBHOOK_BODY_BYTES)
    const event = await parseVerifiedSanityEvent({
      rawBody,
      headers: request.headers,
      config,
      now,
    })
    const statusStore = statusStoreFactory(config)
    const reservation = await statusStore.reserveEvent(event)

    if (reservation.decision === "duplicate" || reservation.decision === "stale") {
      return jsonResponse(202, {
        accepted: true,
        queued: false,
        reason: reservation.decision,
      })
    }

    try {
      await dispatch({
        repository: config.githubRepository,
        token: config.githubToken,
        event,
      })
    } catch {
      await statusStore.updateLatest(event.eventKey, {
        set: {
          status: "failed",
          message: "GitHub did not accept the deployment request. The webhook will retry.",
          dispatchState: "github-failed",
          lastError: "GitHub repository dispatch failed.",
        },
      })
      return jsonResponse(502, {accepted: false, code: "github_dispatch_failed"})
    }

    try {
      await statusStore.updateLatest(
        event.eventKey,
        {set: {dispatchState: "github-dispatched"}},
        {allowedDispatchStates: ["pending", "github-dispatched"]},
      )
    } catch (error) {
      process.stderr.write(`Deployment was dispatched but status recording failed: ${error.message}\n`)
    }

    return jsonResponse(202, {accepted: true, queued: true})
  } catch (error) {
    if (error instanceof DeployWebhookError) {
      return jsonResponse(error.status, {accepted: false, code: error.code})
    }
    process.stderr.write(`Sanity deploy webhook failed safely: ${error.message}\n`)
    return jsonResponse(503, {accepted: false, code: "status_unavailable"})
  }
}

export function POST(request) {
  return handleSanityDeployRequest(request)
}
