export const DEPLOYMENT_CLAIM_LEASE_MS = 12 * 60 * 1000
export const DEPLOYMENT_QUIET_PERIOD_MS = 60 * 1000

const claimableDispatchStates = new Set([
  "pending",
  "github-dispatched",
  "github-failed",
  "deployment-failed",
])

const claimFields = ["claimId", "claimedAt"]

function currentEventKey(status) {
  return typeof status?.latestEventKey === "string" && /^[a-f0-9]{64}$/.test(status.latestEventKey)
    ? status.latestEventKey
    : undefined
}

function leaseIsActive(status, nowMs) {
  const claimedAtMs = Date.parse(status?.claimedAt ?? "")
  return Number.isFinite(claimedAtMs) && nowMs - claimedAtMs < DEPLOYMENT_CLAIM_LEASE_MS
}

function quietPeriodIsActive(status, nowMs) {
  const receivedAtMs = Date.parse(status?.receivedAt ?? "")
  return Number.isFinite(receivedAtMs) && nowMs - receivedAtMs < DEPLOYMENT_QUIET_PERIOD_MS
}

function acquiredClaimPatch({claimId, nowMs, workflowUrl}) {
  return {
    set: {
      status: "requesting",
      dispatchState: "workflow-claimed",
      claimId,
      claimedAt: new Date(nowMs).toISOString(),
      message: "The quiet period ended. GitHub is requesting a production deployment.",
      ...(workflowUrl ? {workflowUrl} : {}),
    },
    unset: ["lastError"],
  }
}

export function clearDeploymentClaim(patch) {
  return {
    ...patch,
    unset: [...new Set([...(patch.unset ?? []), ...claimFields])],
  }
}

export function planDeploymentClaim(
  status,
  {expectedEventKey, claimId, nowMs, workflowUrl},
) {
  const eventKey = currentEventKey(status)
  if (!eventKey) {
    return {
      decision: expectedEventKey ? "stale" : "no-work",
      updated: false,
    }
  }

  if (expectedEventKey && expectedEventKey !== eventKey) {
    return {decision: "stale", updated: false, eventKey}
  }

  if (status.dispatchState === "workflow-claimed") {
    if (leaseIsActive(status, nowMs)) {
      return status.claimId === claimId
        ? {decision: "claimed", updated: true, eventKey}
        : {decision: "leased", updated: false, eventKey}
    }
    return {
      decision: "claimed",
      updated: true,
      eventKey,
      patch: acquiredClaimPatch({claimId, nowMs, workflowUrl}),
    }
  }

  if (!claimableDispatchStates.has(status.dispatchState)) {
    return {decision: "no-work", updated: false, eventKey}
  }
  if (
    status.dispatchState !== "deployment-failed" &&
    quietPeriodIsActive(status, nowMs)
  ) {
    return {decision: "quiet", updated: false, eventKey}
  }

  return {
    decision: "claimed",
    updated: true,
    eventKey,
    patch: acquiredClaimPatch({claimId, nowMs, workflowUrl}),
  }
}

export function checkDeploymentClaimOwner(
  status,
  {eventKey, claimId, allowedDispatchStates},
) {
  const latestEventKey = currentEventKey(status)
  if (!latestEventKey || latestEventKey !== eventKey) {
    return {updated: false, reason: "stale", eventKey: latestEventKey}
  }
  if (status.claimId !== claimId) {
    return {updated: false, reason: "owner", eventKey: latestEventKey}
  }
  if (!allowedDispatchStates.includes(status.dispatchState)) {
    return {updated: false, reason: "state", eventKey: latestEventKey}
  }
  return {updated: true, eventKey: latestEventKey}
}
