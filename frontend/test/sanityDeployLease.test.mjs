import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import test from "node:test"

import {
  DEPLOYMENT_CLAIM_LEASE_MS,
  DEPLOYMENT_QUIET_PERIOD_MS,
  checkDeploymentClaimOwner,
  clearDeploymentClaim,
  planDeploymentClaim,
} from "../api/_lib/sanity-deploy-lease.mjs"
import {createSanityStatusStore} from "../api/_lib/sanity-status-store.mjs"
import {handleDeployStatusRequest} from "../api/sanity-deploy-status.mjs"

const eventKey = "a".repeat(64)
const nowMs = Date.parse("2026-08-06T12:00:00.000Z")
const callbackSecret = "status-callback-secret-that-is-at-least-32-characters"
const environment = {
  SANITY_WEBHOOK_PROJECT_ID: "454gxa26",
  SANITY_WEBHOOK_DATASET: "production",
  SANITY_DEPLOY_STATUS_TOKEN: "sanity-status-token-at-least-20-chars",
  SANITY_DEPLOY_STATUS_CALLBACK_SECRET: callbackSecret,
}

function callbackRequest(body) {
  return new Request("https://www.demennis.be/api/sanity-deploy-status", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${callbackSecret}`,
    },
    body: JSON.stringify(body),
  })
}

function memoryClient(initialDocument) {
  let document = initialDocument ? structuredClone(initialDocument) : undefined
  let revision = 1
  const commits = []

  return {
    commits,
    currentDocument: () => structuredClone(document),
    async createIfNotExists(value) {
      if (!document) document = {...structuredClone(value), _rev: `rev-${revision}`}
      return structuredClone(document)
    },
    async getDocument() {
      return structuredClone(document)
    },
    patch() {
      const mutation = {set: {}, unset: []}
      const builder = {
        ifRevisionId(value) {
          mutation.revision = value
          return builder
        },
        set(value) {
          mutation.set = structuredClone(value)
          return builder
        },
        unset(value) {
          mutation.unset = [...value]
          return builder
        },
        async commit() {
          if (!document || document._rev !== mutation.revision) {
            const error = new Error("conflict")
            error.statusCode = 409
            throw error
          }
          const next = {...document, ...mutation.set}
          for (const field of mutation.unset) delete next[field]
          revision += 1
          next._rev = `rev-${revision}`
          document = next
          commits.push(structuredClone(mutation))
          return structuredClone(document)
        },
      }
      return builder
    },
  }
}

test("a watchdog atomically claims the authoritative latest event", async () => {
  const client = memoryClient({
    _id: "deploymentStatus",
    _rev: "rev-1",
    latestEventKey: eventKey,
    dispatchState: "github-dispatched",
    receivedAt: new Date(nowMs - DEPLOYMENT_QUIET_PERIOD_MS).toISOString(),
  })
  const store = createSanityStatusStore({client})

  const result = await store.claimLatest({
    claimId: "run-1",
    nowMs,
    workflowUrl: "https://github.com/hardcodepunk/astro-mennis/actions/runs/1",
  })

  assert.equal(result.updated, true)
  assert.equal(result.eventKey, eventKey)
  assert.equal(client.commits.length, 1)
  assert.equal(client.commits[0].revision, "rev-1")
  assert.equal(client.currentDocument().claimId, "run-1")
  assert.equal(client.currentDocument().dispatchState, "workflow-claimed")
})

test("an active claim is exclusive but idempotent for its owner", () => {
  const status = {
    latestEventKey: eventKey,
    dispatchState: "workflow-claimed",
    claimId: "run-1",
    claimedAt: new Date(nowMs).toISOString(),
  }

  const ownerRetry = planDeploymentClaim(status, {claimId: "run-1", nowMs})
  const competingRun = planDeploymentClaim(status, {claimId: "run-2", nowMs})

  assert.deepEqual(ownerRetry, {decision: "claimed", updated: true, eventKey})
  assert.equal(competingRun.decision, "leased")
  assert.equal(competingRun.updated, false)
})

test("concurrent claim attempts produce exactly one owner", async () => {
  const client = memoryClient({
    _id: "deploymentStatus",
    _rev: "rev-1",
    latestEventKey: eventKey,
    dispatchState: "github-dispatched",
    receivedAt: new Date(nowMs - DEPLOYMENT_QUIET_PERIOD_MS).toISOString(),
  })
  const store = createSanityStatusStore({client})

  const results = await Promise.all([
    store.claimLatest({claimId: "run-1", nowMs}),
    store.claimLatest({claimId: "run-2", nowMs}),
  ])

  assert.equal(results.filter((result) => result.updated).length, 1)
  assert.equal(results.filter((result) => result.decision === "leased").length, 1)
  assert.equal(client.commits.length, 1)
})

test("a canceled run becomes reclaimable when its twelve-minute lease expires", () => {
  const status = {
    latestEventKey: eventKey,
    dispatchState: "workflow-claimed",
    claimId: "canceled-run",
    claimedAt: new Date(nowMs).toISOString(),
  }
  const result = planDeploymentClaim(status, {
    claimId: "watchdog-run",
    nowMs: nowMs + DEPLOYMENT_CLAIM_LEASE_MS,
  })

  assert.equal(result.updated, true)
  assert.equal(result.patch.set.claimId, "watchdog-run")
  assert.equal(result.patch.set.claimedAt, "2026-08-06T12:12:00.000Z")
})

test("an expired owner must reacquire through a revision-guarded patch", () => {
  const status = {
    latestEventKey: eventKey,
    dispatchState: "workflow-claimed",
    claimId: "run-1",
    claimedAt: new Date(nowMs).toISOString(),
  }
  const result = planDeploymentClaim(status, {
    claimId: "run-1",
    nowMs: nowMs + DEPLOYMENT_CLAIM_LEASE_MS,
  })

  assert.equal(result.updated, true)
  assert.equal(result.patch.set.claimId, "run-1")
  assert.equal(result.patch.set.claimedAt, "2026-08-06T12:12:00.000Z")
})

test("the watchdog retries an event whose previous deployment workflow failed", () => {
  const result = planDeploymentClaim(
    {
      latestEventKey: eventKey,
      dispatchState: "deployment-failed",
      claimId: "failed-run",
      claimedAt: new Date(nowMs).toISOString(),
    },
    {claimId: "watchdog-run", nowMs},
  )

  assert.equal(result.updated, true)
  assert.equal(result.patch.set.claimId, "watchdog-run")
  assert.equal(result.patch.set.dispatchState, "workflow-claimed")
})

test("all claim sources atomically honor the latest event's quiet period", () => {
  const status = {
    latestEventKey: eventKey,
    dispatchState: "pending",
    receivedAt: new Date(nowMs - 1_000).toISOString(),
  }
  const tooSoon = planDeploymentClaim(status, {claimId: "watchdog-run", nowMs})
  const afterQuietPeriod = planDeploymentClaim(status, {
    claimId: "watchdog-run",
    nowMs: nowMs + DEPLOYMENT_QUIET_PERIOD_MS - 1_000,
  })

  assert.deepEqual(tooSoon, {
    decision: "quiet",
    updated: false,
    eventKey,
  })
  assert.equal(afterQuietPeriod.updated, true)
  assert.equal(afterQuietPeriod.patch.set.claimId, "watchdog-run")
})

test("a watchdog treats a missing status document as benign no-work", async () => {
  const client = memoryClient()
  const store = createSanityStatusStore({client})

  const result = await store.claimLatest({claimId: "watchdog-run", nowMs})

  assert.deepEqual(result, {decision: "no-work", updated: false})
  assert.equal(client.commits.length, 0)
})

test("only the current claim owner can finish the current event", () => {
  const status = {
    latestEventKey: eventKey,
    dispatchState: "workflow-claimed",
    claimId: "run-1",
  }

  assert.equal(
    checkDeploymentClaimOwner(status, {
      eventKey,
      claimId: "run-2",
      allowedDispatchStates: ["workflow-claimed"],
    }).reason,
    "owner",
  )
  assert.equal(
    checkDeploymentClaimOwner(status, {
      eventKey: "b".repeat(64),
      claimId: "run-1",
      allowedDispatchStates: ["workflow-claimed"],
    }).reason,
    "stale",
  )
})

test("reserving a new event clears every prior claim field", () => {
  const patch = clearDeploymentClaim({unset: ["lastError"]})

  assert.deepEqual(patch.unset, ["lastError", "claimId", "claimedAt"])
})

test("the status store clears a prior owner when it reserves newer content", async () => {
  const client = memoryClient({
    _id: "deploymentStatus",
    _rev: "rev-1",
    latestEventKey: eventKey,
    recentEventKeys: [eventKey],
    transactionTime: "2026-08-06T11:59:00.000Z",
    dispatchState: "workflow-claimed",
    claimId: "old-run",
    claimedAt: "2026-08-06T11:59:30.000Z",
  })
  const store = createSanityStatusStore({client})

  await store.reserveEvent({
    eventKey: "b".repeat(64),
    eventId: "revision-2",
    transactionTime: "2026-08-06T12:00:00.000Z",
    receivedAt: "2026-08-06T12:00:01.000Z",
    documentId: "work-2",
    documentType: "work",
    operation: "update",
  })

  assert.equal(client.currentDocument().dispatchState, "pending")
  assert.equal(client.currentDocument().claimId, undefined)
  assert.equal(client.currentDocument().claimedAt, undefined)
  assert.ok(client.commits[0].unset.includes("claimId"))
  assert.ok(client.commits[0].unset.includes("claimedAt"))
})

test("a same-event delivery retry preserves the original quiet-period age", async () => {
  const originalReceivedAt = new Date(nowMs - 2 * DEPLOYMENT_QUIET_PERIOD_MS).toISOString()
  const originalTransactionTime = "2026-08-06T11:58:00.000Z"
  const client = memoryClient({
    _id: "deploymentStatus",
    _rev: "rev-1",
    latestEventKey: eventKey,
    recentEventKeys: [eventKey],
    receivedAt: originalReceivedAt,
    transactionTime: originalTransactionTime,
    dispatchState: "github-failed",
  })
  const store = createSanityStatusStore({client})

  const reservation = await store.reserveEvent({
    eventKey,
    eventId: "revision-1",
    transactionTime: new Date(nowMs).toISOString(),
    receivedAt: new Date(nowMs).toISOString(),
    documentId: "work-1",
    documentType: "work",
    operation: "update",
  })
  const claim = await store.claimLatest({claimId: "watchdog-run", nowMs})

  assert.equal(reservation.decision, "retry")
  assert.equal(client.commits[0].set.receivedAt, originalReceivedAt)
  assert.equal(client.commits[0].set.transactionTime, originalTransactionTime)
  assert.equal(claim.updated, true)
})

test("the claim callback returns the watchdog's authoritative event key", async () => {
  let receivedClaim
  const response = await handleDeployStatusRequest(
    callbackRequest({state: "claim", claimId: "watchdog-run"}),
    {
      environment,
      now: () => nowMs,
      statusStoreFactory: () => ({
        async claimLatest(claim) {
          receivedClaim = claim
          return {decision: "claimed", updated: true, eventKey}
        },
      }),
    },
  )

  assert.equal(response.status, 200)
  assert.equal(receivedClaim.expectedEventKey, undefined)
  assert.deepEqual(await response.json(), {updated: true, eventKey})
})

test("the callback reports leases and quiet periods as 202 and owner mismatches as 409", async () => {
  const leasedResponse = await handleDeployStatusRequest(
    callbackRequest({state: "claim", claimId: "watchdog-run"}),
    {
      environment,
      now: () => nowMs,
      statusStoreFactory: () => ({
        async claimLatest() {
          return {decision: "leased", updated: false, eventKey}
        },
      }),
    },
  )
  const ownerResponse = await handleDeployStatusRequest(
    callbackRequest({state: "failed", claimId: "old-run", eventKey}),
    {
      environment,
      statusStoreFactory: () => ({
        async updateClaimed() {
          return {updated: false, reason: "owner", eventKey}
        },
      }),
    },
  )
  const quietResponse = await handleDeployStatusRequest(
    callbackRequest({state: "claim", claimId: "watchdog-run"}),
    {
      environment,
      now: () => nowMs,
      statusStoreFactory: () => ({
        async claimLatest() {
          return {decision: "quiet", updated: false, eventKey}
        },
      }),
    },
  )

  assert.equal(leasedResponse.status, 202)
  assert.equal((await leasedResponse.json()).reason, "leased")
  assert.equal(quietResponse.status, 202)
  assert.equal((await quietResponse.json()).reason, "quiet")
  assert.equal(ownerResponse.status, 409)
  assert.equal((await ownerResponse.json()).reason, "owner")
})

test("the callback rejects missing or non-string claim owners", async () => {
  for (const claimId of [undefined, 123, true]) {
    const body = {state: "claim"}
    if (claimId !== undefined) body.claimId = claimId
    const response = await handleDeployStatusRequest(callbackRequest(body), {environment})

    assert.equal(response.status, 400)
    assert.equal((await response.json()).code, "invalid_payload")
  }
})

test("the workflow schedules recovery and fences every terminal callback", async () => {
  const [workflow, guide] = await Promise.all([
    readFile(
      new URL("../../.github/workflows/cms-content-deploy.yml", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../../docs/cms-deployments.md", import.meta.url), "utf8"),
  ])

  assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /timeout-minutes: 10/)
  assert.match(workflow, /permissions: \{\}/)
  assert.match(workflow, /if: vars\.CMS_DEPLOY_ENABLED == 'true'/)
  assert.match(
    workflow,
    /- name: Wait for a quiet content window\n\s+if: github\.event_name == 'repository_dispatch'/,
  )
  assert.match(workflow, /CLAIM_ID: \$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/)
  assert.match(workflow, /claimed_event_key.*response\.eventKey/s)
  assert.match(workflow, /claimed_event_key" == "\$EVENT_KEY"/)
  assert.equal((workflow.match(/claimId: process\.env\.CLAIM_ID/g) ?? []).length, 3)
  assert.match(guide, /CMS_DEPLOY_ENABLED` to `true`/)
  assert.match(guide, /12-minute claim/)
  assert.match(guide, /15-minute watchdog/)
  assert.match(guide, /at least once, not exactly once/)
})
