import {createClient} from "@sanity/client"

import {
  DEPLOYMENT_STATUS_DOCUMENT_ID,
  planEventReservation,
} from "./sanity-deploy-core.mjs"
import {
  checkDeploymentClaimOwner,
  clearDeploymentClaim,
  planDeploymentClaim,
} from "./sanity-deploy-lease.mjs"

const MAX_CONFLICT_RETRIES = 5

function isConflict(error) {
  return error?.statusCode === 409 || error?.response?.statusCode === 409
}

async function commitRevisionPatch(client, status, patch) {
  let builder = client.patch(DEPLOYMENT_STATUS_DOCUMENT_ID).ifRevisionId(status._rev)
  if (patch.set && Object.keys(patch.set).length) builder = builder.set(patch.set)
  if (patch.unset?.length) builder = builder.unset(patch.unset)
  return builder.commit()
}

async function retryConflicts(operation) {
  let latestConflict
  for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (!isConflict(error)) throw error
      latestConflict = error
    }
  }
  throw latestConflict ?? new Error("Deployment status update conflicted too many times")
}

export function createSanityStatusStore({projectId, dataset, token, client: providedClient}) {
  const client =
    providedClient ??
    createClient({
      projectId,
      dataset,
      token,
      apiVersion: "2026-08-06",
      useCdn: false,
      perspective: "raw",
    })

  const ensureDocument = () =>
    client.createIfNotExists({
      _id: DEPLOYMENT_STATUS_DOCUMENT_ID,
      _type: "deploymentStatus",
      status: "idle",
      message: "Waiting for the first verified content event.",
      recentEventKeys: [],
    })

  const loadDocument = () => client.getDocument(DEPLOYMENT_STATUS_DOCUMENT_ID)

  const loadRequiredDocument = async () => {
    const status = await loadDocument()
    if (!status) throw new Error("Deployment status document is unavailable")
    return status
  }

  return Object.freeze({
    async reserveEvent(event) {
      await ensureDocument()
      return retryConflicts(async () => {
        const status = await loadRequiredDocument()
        const plan = planEventReservation(status, event)
        if (!plan.patch) return plan
        const patch = clearDeploymentClaim(plan.patch)
        await commitRevisionPatch(client, status, patch)
        return {...plan, patch}
      })
    },

    async updateLatest(eventKey, patch, {allowedDispatchStates} = {}) {
      return retryConflicts(async () => {
        const status = await loadRequiredDocument()
        if (status.latestEventKey !== eventKey) {
          return {updated: false, reason: "stale"}
        }
        if (!allowedDispatchStates && status.claimId) {
          return {updated: false, reason: "state"}
        }
        if (allowedDispatchStates && !allowedDispatchStates.includes(status.dispatchState)) {
          return {updated: false, reason: "state"}
        }
        await commitRevisionPatch(client, status, patch)
        return {updated: true}
      })
    },

    async claimLatest({expectedEventKey, claimId, nowMs, workflowUrl}) {
      return retryConflicts(async () => {
        const status = await loadDocument()
        const plan = planDeploymentClaim(status, {
          expectedEventKey,
          claimId,
          nowMs,
          workflowUrl,
        })
        if (!plan.patch) return plan
        await commitRevisionPatch(client, status, plan.patch)
        return plan
      })
    },

    async updateClaimed(eventKey, claimId, patch, {allowedDispatchStates}) {
      return retryConflicts(async () => {
        const status = await loadDocument()
        const ownership = checkDeploymentClaimOwner(status, {
          eventKey,
          claimId,
          allowedDispatchStates,
        })
        if (!ownership.updated) return ownership
        await commitRevisionPatch(client, status, patch)
        return ownership
      })
    },
  })
}
