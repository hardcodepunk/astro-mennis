export type PlaybackIntentSession = {
  activationRequestId: number | null
  wantsPlayback: boolean
}

export type PlaybackIntentResult<T> = {
  requestId: number
  superseded: T[]
}

export class PlaybackIntentCoordinator<T extends PlaybackIntentSession> {
  #generation = 0
  #latest: T | null = null
  readonly #getSessions: () => Iterable<T>

  constructor(getSessions: () => Iterable<T>) {
    this.#getSessions = getSessions
  }

  record(session: T, wantsPlayback: boolean): PlaybackIntentResult<T> {
    this.#generation += 1
    const superseded: T[] = []

    for (const other of this.#getSessions()) {
      if (other === session) continue
      if (other.activationRequestId !== null || other.wantsPlayback) superseded.push(other)
      other.activationRequestId = null
      other.wantsPlayback = false
    }

    session.activationRequestId = this.#generation
    session.wantsPlayback = wantsPlayback
    this.#latest = session

    return { requestId: this.#generation, superseded }
  }

  cancel(session: T) {
    session.wantsPlayback = false
  }

  clear(session: T) {
    session.wantsPlayback = false
    session.activationRequestId = null

    if (this.#latest === session) {
      this.#generation += 1
      this.#latest = null
    }
  }

  isCurrent(session: T, requestId = session.activationRequestId) {
    return (
      requestId !== null &&
      this.#latest === session &&
      session.activationRequestId === requestId &&
      requestId === this.#generation
    )
  }

  isWinning(session: T, requestId = session.activationRequestId) {
    return session.wantsPlayback && this.isCurrent(session, requestId)
  }

  acceptsProviderPlayback(session: T) {
    return this.isWinning(session)
  }

  handleProviderPlayback(session: T, reject: () => void) {
    if (this.acceptsProviderPlayback(session)) return true
    reject()
    return false
  }

  dispose() {
    this.#generation += 1
    this.#latest = null

    for (const session of this.#getSessions()) {
      session.activationRequestId = null
      session.wantsPlayback = false
    }
  }
}

export type PlaybackAcknowledgementScheduler = {
  set(callback: () => void, delay: number): number
  clear(timeoutId: number): void
}

export class PlaybackAcknowledgementLease {
  #timeoutId: number | null = null
  readonly #scheduler: PlaybackAcknowledgementScheduler
  readonly #timeout: number

  constructor(scheduler: PlaybackAcknowledgementScheduler, timeout = 4_000) {
    this.#scheduler = scheduler
    this.#timeout = timeout
  }

  arm(onTimeout: () => void) {
    this.clear()
    this.#timeoutId = this.#scheduler.set(() => {
      this.#timeoutId = null
      onTimeout()
    }, this.#timeout)
  }

  acknowledge() {
    this.clear()
  }

  clear() {
    if (this.#timeoutId === null) return
    this.#scheduler.clear(this.#timeoutId)
    this.#timeoutId = null
  }
}

export type WorkMediaFeedbackState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "error"
  | "unavailable"

export function feedbackAfterSupersession(
  state: WorkMediaFeedbackState,
  activated: boolean,
): WorkMediaFeedbackState | null {
  if (state !== "loading" && state !== "ready") return null
  return activated ? "playing" : "idle"
}

export function feedbackAfterVisibilityPause(
  state: WorkMediaFeedbackState,
): WorkMediaFeedbackState {
  return state === "error" || state === "unavailable" ? state : "playing"
}

export type PlayerShortcutContext = {
  key: string
  repeatedKey: boolean
  modified: boolean
  eventWithinPlayer: boolean
  focusedIsEditable: boolean
  focusedIsSeek: boolean
  focusedIsButtonOrMenuitem: boolean
}

export class PlyrKeyRepeatTracker {
  #lastKey: string | null = null

  press(key: string) {
    const repeated = key === this.#lastKey
    this.#lastKey = key
    return repeated
  }

  release() {
    this.#lastKey = null
  }
}

export function shouldRecordPlayerShortcut(context: PlayerShortcutContext) {
  if (context.repeatedKey || context.modified || !context.eventWithinPlayer) return false

  const isSpace = context.key === " "
  if (context.key !== "k" && !isSpace) return false
  if (context.focusedIsEditable && !context.focusedIsSeek) return false
  if (isSpace && context.focusedIsButtonOrMenuitem) return false
  return true
}

export type PlaybackAcknowledgementEvent = "waiting" | "pause" | "playing"

export function playbackAcknowledgementAction(
  event: PlaybackAcknowledgementEvent,
  awaitingInitialPlaying: boolean,
): "renew" | "acknowledge" | "ignore" {
  if (event === "playing") return "acknowledge"
  if (event === "pause") return "renew"
  return awaitingInitialPlaying ? "renew" : "ignore"
}

type AttributeTarget = {
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

export type WorkMediaFeedbackElements = {
  overlay: AttributeTarget
  status: { textContent: string | null }
  retry: { hidden: boolean | string }
  fallback: { hidden: boolean | string }
}

export function renderWorkMediaFeedback(
  elements: WorkMediaFeedbackElements,
  mediaTitle: string,
  state: WorkMediaFeedbackState,
) {
  const { overlay, status, retry, fallback } = elements
  overlay.removeAttribute("aria-busy")
  overlay.removeAttribute("aria-disabled")

  retry.hidden = state !== "error"
  if (state !== "error" && state !== "unavailable") fallback.hidden = true

  switch (state) {
    case "loading":
      overlay.setAttribute("aria-label", `Loading ${mediaTitle}`)
      overlay.setAttribute("aria-busy", "true")
      overlay.setAttribute("aria-disabled", "true")
      status.textContent = `Loading ${mediaTitle}…`
      break
    case "ready":
      overlay.setAttribute("aria-label", `Play ${mediaTitle}`)
      status.textContent = `Ready: ${mediaTitle}. Press Play to start.`
      break
    case "error":
      overlay.setAttribute("aria-label", `Retry loading ${mediaTitle}`)
      status.textContent = `Could not load ${mediaTitle}. Retry or watch it on YouTube.`
      fallback.hidden = false
      break
    case "unavailable":
      overlay.setAttribute("aria-label", `${mediaTitle} unavailable`)
      overlay.setAttribute("aria-disabled", "true")
      status.textContent = `Could not play ${mediaTitle}. Watch it on YouTube.`
      fallback.hidden = false
      break
    case "idle":
    case "playing":
      overlay.setAttribute("aria-label", `Play ${mediaTitle}`)
      status.textContent = ""
      break
  }
}
