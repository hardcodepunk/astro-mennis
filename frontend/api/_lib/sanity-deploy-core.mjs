import {createHash, timingSafeEqual} from "node:crypto"

import {
  SIGNATURE_HEADER_NAME,
  decodeSignatureHeader,
  isValidSignature,
} from "@sanity/webhook"

export const DEPLOYMENT_STATUS_DOCUMENT_ID = "deploymentStatus"
export const MAX_RECENT_EVENT_KEYS = 50
export const MAX_WEBHOOK_BODY_BYTES = 64 * 1024
export const MAX_CALLBACK_BODY_BYTES = 16 * 1024
export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

const allowedDocumentTypes = new Set([
  "seo",
  "siteSettings",
  "bioWithPreview",
  "contactPage",
  "logoMarquee",
  "work",
  "category",
])
const allowedOperations = new Set(["create", "update", "delete"])

export class DeployWebhookError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = "DeployWebhookError"
    this.status = status
    this.code = code
  }
}

function requiredEnvironmentValue(environment, name, minimumLength = 1) {
  const value = environment[name]?.trim()
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} is missing or invalid`)
  }
  return value
}

function validateProjectId(value) {
  if (!/^[a-z0-9]+$/.test(value)) throw new Error("SANITY_WEBHOOK_PROJECT_ID is invalid")
  return value
}

function validateDataset(value) {
  if (!/^[a-z0-9](?:[-_a-z0-9]{0,62}[a-z0-9])?$/.test(value)) {
    throw new Error("SANITY_WEBHOOK_DATASET is invalid")
  }
  return value
}

function validateRepository(value) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error("GITHUB_REPOSITORY is invalid")
  }
  return value
}

export function readSanityDeployEnvironment(environment) {
  return Object.freeze({
    webhookSecret: requiredEnvironmentValue(environment, "SANITY_WEBHOOK_SECRET", 32),
    projectId: validateProjectId(
      requiredEnvironmentValue(environment, "SANITY_WEBHOOK_PROJECT_ID"),
    ),
    dataset: validateDataset(requiredEnvironmentValue(environment, "SANITY_WEBHOOK_DATASET")),
    webhookId: environment.SANITY_WEBHOOK_ID?.trim() || undefined,
    statusToken: requiredEnvironmentValue(environment, "SANITY_DEPLOY_STATUS_TOKEN", 20),
    githubToken: requiredEnvironmentValue(environment, "GITHUB_DISPATCH_TOKEN", 20),
    githubRepository: validateRepository(
      requiredEnvironmentValue(environment, "GITHUB_REPOSITORY"),
    ),
  })
}

export function readDeployStatusEnvironment(environment) {
  return Object.freeze({
    projectId: validateProjectId(
      requiredEnvironmentValue(environment, "SANITY_WEBHOOK_PROJECT_ID"),
    ),
    dataset: validateDataset(requiredEnvironmentValue(environment, "SANITY_WEBHOOK_DATASET")),
    statusToken: requiredEnvironmentValue(environment, "SANITY_DEPLOY_STATUS_TOKEN", 20),
    callbackSecret: requiredEnvironmentValue(
      environment,
      "SANITY_DEPLOY_STATUS_CALLBACK_SECRET",
      32,
    ),
  })
}

function headerValue(headers, name) {
  const value = typeof headers.get === "function" ? headers.get(name) : headers[name.toLowerCase()]
  if (Array.isArray(value)) {
    throw new DeployWebhookError(400, "duplicate_header", `${name} must appear once`)
  }
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function requiredHeader(headers, name) {
  const value = headerValue(headers, name)
  if (!value) throw new DeployWebhookError(400, "missing_header", `${name} is required`)
  return value
}

function parseJsonObject(rawBody) {
  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    throw new DeployWebhookError(400, "invalid_json", "Request body must be valid JSON")
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new DeployWebhookError(400, "invalid_payload", "Request body must be a JSON object")
  }
  return payload
}

function validTransactionTime(value, nowMs) {
  if (typeof value !== "string") {
    throw new DeployWebhookError(
      400,
      "invalid_transaction_time",
      "Signed transactionTime is invalid",
    )
  }
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || timestamp > nowMs + SIGNATURE_MAX_AGE_MS) {
    throw new DeployWebhookError(
      400,
      "invalid_transaction_time",
      "Signed transactionTime is invalid",
    )
  }
  return new Date(timestamp).toISOString()
}

function validEventId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new DeployWebhookError(400, "invalid_event_id", "Signed eventId is invalid")
  }
  return value
}

function validDocumentId(value) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) ||
    value.startsWith("drafts.") ||
    value.startsWith("versions.")
  ) {
    throw new DeployWebhookError(400, "invalid_document_id", "documentId is invalid")
  }
  return value
}

function eventKey({projectId, dataset, eventId, documentId, documentType, operation}) {
  return createHash("sha256")
    .update(JSON.stringify([projectId, dataset, eventId, documentId, documentType, operation]))
    .digest("hex")
}

export async function parseVerifiedSanityEvent({rawBody, headers, config, now = Date.now}) {
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
    throw new DeployWebhookError(413, "body_too_large", "Request body is too large")
  }

  const signature = requiredHeader(headers, SIGNATURE_HEADER_NAME)
  if (!(await isValidSignature(rawBody, signature, config.webhookSecret))) {
    throw new DeployWebhookError(401, "invalid_signature", "Webhook signature is invalid")
  }

  const nowMs = now()
  const signatureTimestamp = decodeSignatureHeader(signature).timestamp
  if (Math.abs(nowMs - signatureTimestamp) > SIGNATURE_MAX_AGE_MS) {
    throw new DeployWebhookError(401, "expired_signature", "Webhook signature is too old")
  }

  const payload = parseJsonObject(rawBody)
  const headerProjectId = requiredHeader(headers, "sanity-project-id")
  const headerDataset = requiredHeader(headers, "sanity-dataset")
  if (
    headerProjectId !== config.projectId ||
    headerDataset !== config.dataset ||
    payload.projectId !== config.projectId ||
    payload.dataset !== config.dataset
  ) {
    throw new DeployWebhookError(403, "wrong_content_source", "Content source is not allowed")
  }

  if (config.webhookId) {
    const receivedWebhookId = requiredHeader(headers, "sanity-webhook-id")
    if (receivedWebhookId !== config.webhookId) {
      throw new DeployWebhookError(403, "wrong_webhook", "Webhook id is not allowed")
    }
  }

  const operation = payload.operation
  if (
    !allowedOperations.has(operation) ||
    requiredHeader(headers, "sanity-operation") !== operation
  ) {
    throw new DeployWebhookError(400, "invalid_operation", "Content operation is invalid")
  }

  if (!allowedDocumentTypes.has(payload.documentType)) {
    throw new DeployWebhookError(400, "invalid_document_type", "Content type is not deployable")
  }

  const documentId = validDocumentId(payload.documentId)
  if (requiredHeader(headers, "sanity-document-id") !== documentId) {
    throw new DeployWebhookError(400, "invalid_document_id", "Document id metadata does not match")
  }

  const signedEventId = validEventId(payload.eventId)
  const signedTransactionTime = validTransactionTime(payload.transactionTime, nowMs)
  const headerTransactionTime = validTransactionTime(
    requiredHeader(headers, "sanity-transaction-time"),
    nowMs,
  )
  if (headerTransactionTime !== signedTransactionTime) {
    throw new DeployWebhookError(
      400,
      "invalid_transaction_time",
      "Transaction time metadata does not match the signed payload",
    )
  }

  return Object.freeze({
    eventKey: eventKey({
      projectId: payload.projectId,
      dataset: payload.dataset,
      eventId: signedEventId,
      documentId,
      documentType: payload.documentType,
      operation,
    }),
    eventId: signedEventId,
    transactionTime: signedTransactionTime,
    documentId,
    documentType: payload.documentType,
    operation,
    receivedAt: new Date(nowMs).toISOString(),
  })
}

function recentEventKeys(status) {
  if (!Array.isArray(status?.recentEventKeys)) return []
  return status.recentEventKeys.filter((key) => typeof key === "string")
}

function queuedPatch(status, event, retry) {
  const previousKeys = recentEventKeys(status)
  const keys = retry
    ? previousKeys
    : [event.eventKey, ...previousKeys.filter((key) => key !== event.eventKey)].slice(
        0,
        MAX_RECENT_EVENT_KEYS,
      )
  const receivedAt = retry && Number.isFinite(Date.parse(status?.receivedAt ?? ""))
    ? status.receivedAt
    : event.receivedAt
  const transactionTime = retry && Number.isFinite(Date.parse(status?.transactionTime ?? ""))
    ? status.transactionTime
    : event.transactionTime

  return {
    set: {
      status: "queued",
      message: "Content changed. Waiting for a quiet period before requesting deployment.",
      receivedAt,
      transactionTime,
      eventId: event.eventId,
      documentId: event.documentId,
      documentType: event.documentType,
      operation: event.operation,
      latestEventKey: event.eventKey,
      recentEventKeys: keys,
      dispatchState: "pending",
    },
    unset: [
      "workflowUrl",
      "deployJobId",
      "deploymentRequestedAt",
      "lastError",
    ],
  }
}

export function planEventReservation(status, event) {
  const keys = recentEventKeys(status)
  if (keys.includes(event.eventKey)) {
    const retry =
      status.latestEventKey === event.eventKey &&
      (status.dispatchState === "pending" || status.dispatchState === "github-failed")
    return retry
      ? {decision: "retry", patch: queuedPatch(status, event, true)}
      : {decision: "duplicate"}
  }

  const latestTime = Date.parse(status?.transactionTime ?? "")
  const incomingTime = Date.parse(event.transactionTime)
  if (Number.isFinite(latestTime) && incomingTime < latestTime) {
    return {decision: "stale"}
  }

  return {decision: "accepted", patch: queuedPatch(status, event, false)}
}

export function secretsMatch(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string") return false
  const receivedBytes = Buffer.from(received)
  const expectedBytes = Buffer.from(expected)
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  )
}

export function boundedText(value, maximumLength = 500) {
  if (typeof value !== "string") return undefined
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
  return normalized ? normalized.slice(0, maximumLength) : undefined
}

export function safeWorkflowUrl(value) {
  const normalized = boundedText(value, 500)
  if (!normalized) return undefined
  let url
  try {
    url = new URL(normalized)
  } catch {
    return undefined
  }
  return url.protocol === "https:" && url.hostname === "github.com" ? url.href : undefined
}

export function jsonResponse(status, body) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  })
}

export async function readBoundedBody(request, maximumBytes) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    throw new TypeError("maximumBytes must be a non-negative safe integer")
  }

  const contentLengthHeader = request.headers.get("content-length")
  if (contentLengthHeader !== null) {
    if (!/^\d+$/.test(contentLengthHeader)) {
      throw new DeployWebhookError(
        400,
        "invalid_content_length",
        "Content-Length must be a decimal byte count",
      )
    }
    if (BigInt(contentLengthHeader) > BigInt(maximumBytes)) {
      throw new DeployWebhookError(413, "body_too_large", "Request body is too large")
    }
  }

  if (!request.body) return ""

  const decoder = new TextDecoder()
  const reader = request.body.getReader()
  let bytesRead = 0
  let rawBody = ""

  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) break

      bytesRead += value.byteLength
      if (bytesRead > maximumBytes) {
        await reader.cancel("Request body is too large").catch(() => undefined)
        throw new DeployWebhookError(413, "body_too_large", "Request body is too large")
      }
      rawBody += decoder.decode(value, {stream: true})
    }
    rawBody += decoder.decode()
  } finally {
    reader.releaseLock()
  }

  return rawBody
}
