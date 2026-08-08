import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import test from "node:test"

import {encodeSignatureHeader} from "@sanity/webhook"

import {dispatchContentDeployment} from "../api/_lib/github-dispatch.mjs"
import {
  DeployWebhookError,
  MAX_CALLBACK_BODY_BYTES,
  MAX_RECENT_EVENT_KEYS,
  MAX_WEBHOOK_BODY_BYTES,
  parseVerifiedSanityEvent,
  planEventReservation,
  readBoundedBody,
} from "../api/_lib/sanity-deploy-core.mjs"
import {
  POST as sanityDeployPost,
  handleSanityDeployRequest,
} from "../api/sanity-deploy.mjs"
import {
  POST as deployStatusPost,
  handleDeployStatusRequest,
} from "../api/sanity-deploy-status.mjs"

const nowMs = Date.parse("2026-08-06T12:00:00.000Z")
const webhookSecret = "sanity-webhook-secret-that-is-at-least-32-characters"
const callbackSecret = "status-callback-secret-that-is-at-least-32-characters"
const environment = {
  SANITY_WEBHOOK_SECRET: webhookSecret,
  SANITY_WEBHOOK_PROJECT_ID: "454gxa26",
  SANITY_WEBHOOK_DATASET: "production",
  SANITY_DEPLOY_STATUS_TOKEN: "sanity-status-token-at-least-20-chars",
  GITHUB_DISPATCH_TOKEN: "github-dispatch-token-at-least-20-chars",
  GITHUB_REPOSITORY: "hardcodepunk/astro-mennis",
  SANITY_DEPLOY_STATUS_CALLBACK_SECRET: callbackSecret,
}

function payload(overrides = {}) {
  return {
    projectId: "454gxa26",
    dataset: "production",
    documentId: "1ab9f470-e64c-4f5b-af2b-ad2dfa06e229",
    documentType: "work",
    operation: "update",
    eventId: "revision-1",
    transactionTime: "2026-08-06T11:59:59.000Z",
    ...overrides,
  }
}

async function signedRequest({
  body = payload(),
  signatureBody,
  signatureTime = nowMs,
  headers = {},
} = {}) {
  const rawBody = JSON.stringify(body)
  const signature = await encodeSignatureHeader(
    signatureBody ?? rawBody,
    signatureTime,
    webhookSecret,
  )
  return new Request("https://www.demennis.be/api/sanity-deploy", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "delivery-key-1",
      "sanity-webhook-signature": signature,
      "sanity-project-id": "454gxa26",
      "sanity-dataset": "production",
      "sanity-document-id": body.documentId,
      "sanity-operation": body.operation,
      "sanity-transaction-id": "transaction-1",
      "sanity-transaction-time": body.transactionTime,
      ...headers,
    },
    body: rawBody,
  })
}

async function verifiedEvent(request) {
  return parseVerifiedSanityEvent({
    rawBody: await request.text(),
    headers: request.headers,
    config: {
      webhookSecret,
      projectId: "454gxa26",
      dataset: "production",
    },
    now: () => nowMs,
  })
}

function applyPatch(status, patch) {
  const next = {...status, ...patch.set}
  for (const field of patch.unset ?? []) delete next[field]
  return next
}

function streamedRequest(chunks, {headers = {}, onCancel} = {}) {
  const remainingChunks = chunks.map((chunk) =>
    typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk,
  )
  return new Request("https://www.demennis.be/api/test", {
    method: "POST",
    headers,
    body: new ReadableStream(
      {
        pull(controller) {
          const chunk = remainingChunks.shift()
          if (chunk) {
            controller.enqueue(chunk)
          } else {
            controller.close()
          }
        },
        cancel(reason) {
          onCancel?.(reason)
        },
      },
      {highWaterMark: 0},
    ),
    duplex: "half",
  })
}

test("Vercel discovers the .mjs entries as importable POST handlers", () => {
  assert.equal(typeof sanityDeployPost, "function")
  assert.equal(typeof deployStatusPost, "function")
})

test("stops reading a chunked request as soon as its byte limit is exceeded", async () => {
  let cancelReason
  const request = streamedRequest(["12345678", "abcdefgh", "must-not-be-read"], {
    onCancel(reason) {
      cancelReason = reason
    },
  })

  await assert.rejects(() => readBoundedBody(request, 10), (error) => {
    assert.equal(error.code, "body_too_large")
    return true
  })
  assert.equal(cancelReason, "Request body is too large")
})

test("does not trust a falsely low Content-Length", async () => {
  const request = streamedRequest(["12345678", "abcdefgh"], {
    headers: {"content-length": "1"},
  })

  await assert.rejects(() => readBoundedBody(request, 10), (error) => {
    assert.equal(error.code, "body_too_large")
    return true
  })
})

test("rejects an oversized declared length before reading the body", async () => {
  let cancelled = false
  const request = streamedRequest(["must-not-be-read"], {
    headers: {"content-length": "11"},
    onCancel() {
      cancelled = true
    },
  })

  await assert.rejects(() => readBoundedBody(request, 10), (error) => {
    assert.equal(error.code, "body_too_large")
    return true
  })
  assert.equal(cancelled, false)
})

test("validates Content-Length syntax", async () => {
  for (const contentLength of ["-1", "1.5", "0x10", "1, 1", "not-a-number"]) {
    const request = streamedRequest(["x"], {headers: {"content-length": contentLength}})
    await assert.rejects(() => readBoundedBody(request, 10), (error) => {
      assert.equal(error.code, "invalid_content_length")
      return true
    })
  }
})

test("counts split multibyte text by transport bytes", async () => {
  const euroBytes = new TextEncoder().encode("€")
  const chunks = [...euroBytes].map((byte) => Uint8Array.of(byte))

  assert.equal(await readBoundedBody(streamedRequest(chunks), euroBytes.byteLength), "€")
  await assert.rejects(
    () => readBoundedBody(streamedRequest(chunks), euroBytes.byteLength - 1),
    (error) => {
      assert.equal(error.code, "body_too_large")
      return true
    },
  )
})

test("webhook rejects an oversized stream before reserving or dispatching", async () => {
  let storeCreated = false
  let dispatched = false
  const request = streamedRequest([new Uint8Array(MAX_WEBHOOK_BODY_BYTES + 1)], {
    headers: {"content-type": "application/json"},
  })
  const response = await handleSanityDeployRequest(request, {
    environment,
    statusStoreFactory() {
      storeCreated = true
    },
    async dispatch() {
      dispatched = true
    },
  })

  assert.equal(response.status, 413)
  assert.equal((await response.json()).code, "body_too_large")
  assert.equal(storeCreated, false)
  assert.equal(dispatched, false)
})

test("authenticated callback rejects an oversized stream before opening its store", async () => {
  let storeCreated = false
  const request = streamedRequest([new Uint8Array(MAX_CALLBACK_BODY_BYTES + 1)], {
    headers: {
      authorization: `Bearer ${callbackSecret}`,
      "content-type": "application/json",
    },
  })
  const response = await handleDeployStatusRequest(request, {
    environment,
    statusStoreFactory() {
      storeCreated = true
    },
  })

  assert.equal(response.status, 413)
  assert.equal((await response.json()).code, "body_too_large")
  assert.equal(storeCreated, false)
})

test("workflow never treats a non-updating 202 claim as permission to deploy", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/cms-content-deploy.yml", import.meta.url),
    "utf8",
  )
  const claimStart = workflow.indexOf("- name: Claim the latest content event")
  const deployStart = workflow.indexOf("- name: Trigger the Vercel deploy hook", claimStart)
  const claimStep = workflow.slice(claimStart, deployStart)

  assert.match(claimStep, /status_code.*== "202".*claimed=false/s)
  assert.match(claimStep, /status_code.*== "200"/s)
  assert.match(claimStep, /response\.updated !== true/)
  assert.doesNotMatch(claimStep, /200.*\|\|.*202/)
})

test("workflow only records deploy-hook acceptance after an updated 200 response", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/cms-content-deploy.yml", import.meta.url),
    "utf8",
  )
  const statusStart = workflow.indexOf("- name: Record the accepted deploy request")
  const failureStart = workflow.indexOf("- name: Record a safe failure state", statusStart)
  const statusStep = workflow.slice(statusStart, failureStart)

  assert.match(statusStep, /status_code.*== "200"/s)
  assert.match(statusStep, /response\.updated !== true/)
  assert.doesNotMatch(statusStep, /200.*\|\|.*202/)
})

test("documented Sanity projection retains id and type for delete events", async () => {
  const guide = await readFile(
    new URL("../../docs/cms-deployments.md", import.meta.url),
    "utf8",
  )

  assert.match(guide, /coalesce\(after\(\)\._id, before\(\)\._id\)/)
  assert.match(guide, /coalesce\(after\(\)\._type, before\(\)\._type\)/)
  assert.match(guide, /"eventId": coalesce\(after\(\)\._rev, before\(\)\._rev\)/)
  assert.match(guide, /"transactionTime": now\(\)/)
  assert.match(
    guide,
    /coalesce\(after\(\)\._type, before\(\)\._type\) in \[/,
  )
})

test("derives identity and order from the verified Sanity body", async () => {
  const event = await verifiedEvent(await signedRequest())

  assert.match(event.eventKey, /^[a-f0-9]{64}$/)
  assert.equal(event.eventId, "revision-1")
  assert.equal(event.documentType, "work")
  assert.equal(event.operation, "update")
  assert.equal(event.transactionTime, "2026-08-06T11:59:59.000Z")
})

test("unsigned delivery identity headers cannot change the signed event identity", async () => {
  const original = await verifiedEvent(await signedRequest())
  const tampered = await verifiedEvent(
    await signedRequest({
      headers: {
        "idempotency-key": "attacker-selected-delivery-key",
        "sanity-transaction-id": "attacker-selected-transaction",
      },
    }),
  )

  assert.equal(tampered.eventKey, original.eventKey)
  assert.equal(tampered.eventId, original.eventId)
})

test("rejects a transaction-time header that conflicts with the signed event time", async () => {
  const request = await signedRequest({
    headers: {"sanity-transaction-time": "2026-08-06T12:04:59.000Z"},
  })

  await assert.rejects(
    () => verifiedEvent(request),
    (error) => {
      assert.equal(error.code, "invalid_transaction_time")
      return true
    },
  )
})

test("signed revision identity changes the event key", async () => {
  const original = await verifiedEvent(await signedRequest())
  const changed = await verifiedEvent(await signedRequest({body: payload({eventId: "revision-2"})}))

  assert.notEqual(changed.eventKey, original.eventKey)
})

test("rejects a body changed after signing", async () => {
  const signedBody = JSON.stringify(payload({documentType: "category"}))
  const request = await signedRequest({signatureBody: signedBody})

  await assert.rejects(() => verifiedEvent(request), (error) => {
    assert.ok(error instanceof DeployWebhookError)
    assert.equal(error.code, "invalid_signature")
    return true
  })
})

test("rejects a correctly signed event from another dataset", async () => {
  const request = await signedRequest({body: payload({dataset: "staging"})})

  await assert.rejects(() => verifiedEvent(request), (error) => {
    assert.equal(error.code, "wrong_content_source")
    return true
  })
})

test("rejects signatures outside the replay window", async () => {
  const request = await signedRequest({signatureTime: nowMs - 5 * 60 * 1000 - 1})

  await assert.rejects(() => verifiedEvent(request), (error) => {
    assert.equal(error.code, "expired_signature")
    return true
  })
})

test("deduplicates dispatched deliveries and ignores older transactions", async () => {
  const event = await verifiedEvent(await signedRequest())
  const accepted = planEventReservation({}, event)
  const dispatchedStatus = {
    ...accepted.patch.set,
    dispatchState: "github-dispatched",
  }

  assert.equal(accepted.decision, "accepted")
  assert.equal(planEventReservation(dispatchedStatus, event).decision, "duplicate")
  assert.equal(
    planEventReservation(dispatchedStatus, {
      ...event,
      eventKey: "b".repeat(64),
      transactionTime: "2026-08-06T11:59:58.000Z",
    }).decision,
    "stale",
  )
})

test("bounds retained signed event keys", async () => {
  const event = await verifiedEvent(await signedRequest())
  const status = {
    recentEventKeys: Array.from({length: MAX_RECENT_EVENT_KEYS}, (_, index) =>
      index.toString(16).padStart(64, "0"),
    ),
  }
  const plan = planEventReservation(status, event)

  assert.equal(plan.patch.set.recentEventKeys.length, MAX_RECENT_EVENT_KEYS)
  assert.equal(plan.patch.set.recentEventKeys[0], event.eventKey)
})

test("recovers when dispatch failure status could not be recorded", async () => {
  let status = {}
  let dispatchAttempts = 0
  let failStatusUpdate = true
  const store = {
    async reserveEvent(event) {
      const plan = planEventReservation(status, event)
      if (plan.patch) status = applyPatch(status, plan.patch)
      return plan
    },
    async updateLatest(eventKey, patch, options) {
      assert.equal(eventKey, status.latestEventKey)
      if (failStatusUpdate) throw new Error("simulated status outage")
      if (patch.set?.dispatchState === "github-dispatched") {
        assert.deepEqual(options?.allowedDispatchStates, ["pending", "github-dispatched"])
      }
      status = applyPatch(status, patch)
      return {updated: true}
    },
  }
  const dependencies = {
    environment,
    now: () => nowMs,
    statusStoreFactory: () => store,
    async dispatch() {
      dispatchAttempts += 1
      if (dispatchAttempts === 1) throw new Error("simulated GitHub failure")
    },
  }

  const firstResponse = await handleSanityDeployRequest(await signedRequest(), dependencies)
  assert.equal(firstResponse.status, 503)
  assert.equal(status.dispatchState, "pending")

  failStatusUpdate = false
  const retryResponse = await handleSanityDeployRequest(await signedRequest(), dependencies)
  assert.equal(retryResponse.status, 202)
  assert.equal(dispatchAttempts, 2)
  assert.equal(status.dispatchState, "github-dispatched")

  const duplicateResponse = await handleSanityDeployRequest(await signedRequest(), dependencies)
  assert.equal(duplicateResponse.status, 202)
  assert.equal((await duplicateResponse.json()).reason, "duplicate")
  assert.equal(dispatchAttempts, 2)
})

test("dispatches only to the configured GitHub repository", async () => {
  let receivedUrl
  let receivedOptions
  const event = await verifiedEvent(await signedRequest())

  await dispatchContentDeployment({
    repository: "hardcodepunk/astro-mennis",
    token: "token",
    event,
    async fetchImplementation(url, options) {
      receivedUrl = url
      receivedOptions = options
      return new Response(null, {status: 204})
    },
  })

  assert.equal(
    receivedUrl,
    "https://api.github.com/repos/hardcodepunk/astro-mennis/dispatches",
  )
  assert.equal(JSON.parse(receivedOptions.body).client_payload.event_key, event.eventKey)
  assert.equal(receivedOptions.redirect, "error")
})

test("status callback requires its bearer secret", async () => {
  const response = await handleDeployStatusRequest(
    new Request("https://www.demennis.be/api/sanity-deploy-status", {
      method: "POST",
      headers: {"content-type": "application/json", authorization: "Bearer wrong"},
      body: JSON.stringify({eventKey: "a".repeat(64), state: "claim"}),
    }),
    {environment},
  )

  assert.equal(response.status, 401)
})

test("status callback rejects stale workflow claims", async () => {
  let capturedClaim
  const request = new Request("https://www.demennis.be/api/sanity-deploy-status", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${callbackSecret}`,
    },
    body: JSON.stringify({
      eventKey: "a".repeat(64),
      claimId: "run-1",
      state: "claim",
      workflowUrl: "https://github.com/hardcodepunk/astro-mennis/actions/runs/1",
    }),
  })
  const response = await handleDeployStatusRequest(request, {
    environment,
    statusStoreFactory: () => ({
      async claimLatest(claim) {
        capturedClaim = claim
        return {decision: "stale", updated: false, eventKey: "b".repeat(64)}
      },
    }),
  })

  assert.equal(response.status, 409)
  assert.equal(capturedClaim.expectedEventKey, "a".repeat(64))
  assert.equal(capturedClaim.claimId, "run-1")
})

test("records deploy-hook acceptance without claiming deployment success", async () => {
  let capturedPatch
  const request = new Request("https://www.demennis.be/api/sanity-deploy-status", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${callbackSecret}`,
    },
    body: JSON.stringify({
      eventKey: "a".repeat(64),
      claimId: "run-1",
      state: "requested",
      deployJobId: "vercel-job-1",
      workflowUrl: "https://github.com/hardcodepunk/astro-mennis/actions/runs/1",
    }),
  })
  const response = await handleDeployStatusRequest(request, {
    environment,
    now: () => nowMs,
    statusStoreFactory: () => ({
      async updateClaimed(eventKey, claimId, patch, options) {
        assert.equal(eventKey, "a".repeat(64))
        assert.equal(claimId, "run-1")
        assert.deepEqual(options.allowedDispatchStates, ["workflow-claimed", "vercel-requested"])
        capturedPatch = patch
        return {updated: true, eventKey}
      },
    }),
  })

  assert.equal(response.status, 200)
  assert.equal(capturedPatch.set.status, "requested")
  assert.equal(capturedPatch.set.dispatchState, "vercel-requested")
  assert.match(capturedPatch.set.message, /confirm when it is live/)
  assert.notEqual(capturedPatch.set.status, "succeeded")
})
