import assert from "node:assert/strict"
import test from "node:test"

import {
  PlaybackAcknowledgementLease,
  PlaybackIntentCoordinator,
  feedbackAfterSupersession,
  feedbackAfterVisibilityPause,
  renderWorkMediaFeedback,
} from "../src/scripts/workMediaPlayerState.ts"

const makeSession = name => ({
  name,
  activationRequestId: null,
  wantsPlayback: false,
})

test("delayed provider events cannot supersede a newer reel intent", () => {
  const first = makeSession("first")
  const second = makeSession("second")
  const sessions = [first, second]
  const coordinator = new PlaybackIntentCoordinator(() => sessions)

  coordinator.record(first, true)
  assert.equal(coordinator.acceptsProviderPlayback(first), true)

  coordinator.record(second, true)
  assert.equal(coordinator.acceptsProviderPlayback(first), false)
  assert.equal(coordinator.acceptsProviderPlayback(second), true)

  let stalePlayerPauseCalls = 0
  const acceptedStaleEvent = coordinator.handleProviderPlayback(first, () => {
    stalePlayerPauseCalls += 1
  })
  assert.equal(acceptedStaleEvent, false)
  assert.equal(stalePlayerPauseCalls, 1)

  let winningPlayerPauseCalls = 0
  const acceptedWinningEvent = coordinator.handleProviderPlayback(second, () => {
    winningPlayerPauseCalls += 1
  })
  assert.equal(acceptedWinningEvent, true)
  assert.equal(winningPlayerPauseCalls, 0)
  assert.equal(coordinator.acceptsProviderPlayback(second), true)
})

test("explicit pause and replay intents reject acknowledgements from older generations", () => {
  const session = makeSession("reel")
  const coordinator = new PlaybackIntentCoordinator(() => [session])

  const firstPlay = coordinator.record(session, true).requestId
  coordinator.record(session, false)
  assert.equal(coordinator.isWinning(session, firstPlay), false)
  assert.equal(coordinator.acceptsProviderPlayback(session), false)

  const secondPlay = coordinator.record(session, true).requestId
  assert.notEqual(secondPlay, firstPlay)
  assert.equal(coordinator.isWinning(session, firstPlay), false)
  assert.equal(coordinator.isWinning(session, secondPlay), true)
})

test("clearing a stale session does not invalidate a newer request", () => {
  const first = makeSession("first")
  const second = makeSession("second")
  const coordinator = new PlaybackIntentCoordinator(() => [first, second])

  coordinator.record(first, true)
  const secondRequest = coordinator.record(second, true).requestId
  coordinator.clear(first)

  assert.equal(coordinator.isWinning(second, secondRequest), true)
})

test("disposing the coordinator invalidates every pending intent", () => {
  const first = makeSession("first")
  const second = makeSession("second")
  const coordinator = new PlaybackIntentCoordinator(() => [first, second])

  coordinator.record(first, true)
  coordinator.dispose()

  assert.equal(coordinator.acceptsProviderPlayback(first), false)
  assert.equal(first.activationRequestId, null)
  assert.equal(second.activationRequestId, null)
  assert.equal(first.wantsPlayback, false)
  assert.equal(second.wantsPlayback, false)
})

test("playback acknowledgement lease times out only unacknowledged requests", () => {
  let nextTimeoutId = 0
  const pending = new Map()
  const scheduler = {
    set(callback) {
      nextTimeoutId += 1
      pending.set(nextTimeoutId, callback)
      return nextTimeoutId
    },
    clear(timeoutId) {
      pending.delete(timeoutId)
    },
  }
  const fire = timeoutId => {
    const callback = pending.get(timeoutId)
    pending.delete(timeoutId)
    callback?.()
  }
  const lease = new PlaybackAcknowledgementLease(scheduler, 4_000)
  let timeoutCalls = 0

  lease.arm(() => {
    timeoutCalls += 1
  })
  lease.acknowledge()
  fire(1)
  assert.equal(timeoutCalls, 0)

  lease.arm(() => {
    timeoutCalls += 1
  })
  fire(2)
  assert.equal(timeoutCalls, 1)
  assert.equal(pending.size, 0)
})

test("superseding an activated loading reel clears its live feedback", () => {
  assert.equal(feedbackAfterSupersession("loading", true), "playing")
  assert.equal(feedbackAfterSupersession("ready", true), "playing")
  assert.equal(feedbackAfterSupersession("loading", false), "idle")
  assert.equal(feedbackAfterSupersession("unavailable", true), null)
})

test("visibility pauses preserve provider failure feedback states", () => {
  assert.equal(feedbackAfterVisibilityPause("unavailable"), "unavailable")
  assert.equal(feedbackAfterVisibilityPause("error"), "error")
  assert.equal(feedbackAfterVisibilityPause("loading"), "playing")
})

class FakeAttributeTarget {
  attributes = new Map()

  setAttribute(name, value) {
    this.attributes.set(name, value)
  }

  removeAttribute(name) {
    this.attributes.delete(name)
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null
  }
}

const makeFeedbackElements = () => ({
  overlay: new FakeAttributeTarget(),
  status: { textContent: "" },
  retry: { hidden: true },
})

test("loading feedback is announced and guards repeated activation", () => {
  const elements = makeFeedbackElements()

  renderWorkMediaFeedback(elements, "reel 1 of 3", "loading")

  assert.equal(elements.overlay.getAttribute("aria-label"), "Loading reel 1 of 3")
  assert.equal(elements.overlay.getAttribute("aria-busy"), "true")
  assert.equal(elements.overlay.getAttribute("aria-disabled"), "true")
  assert.equal(elements.status.textContent, "Loading reel 1 of 3…")
  assert.equal(elements.retry.hidden, true)
})

test("SDK failure feedback exposes Retry without a custom provider fallback", () => {
  const elements = makeFeedbackElements()
  renderWorkMediaFeedback(elements, "project video", "loading")

  renderWorkMediaFeedback(elements, "project video", "error")

  assert.equal(elements.overlay.getAttribute("aria-label"), "Retry loading project video")
  assert.equal(elements.overlay.getAttribute("aria-busy"), null)
  assert.equal(elements.overlay.getAttribute("aria-disabled"), null)
  assert.equal(elements.status.textContent, "Could not load project video. Retry.")
  assert.equal(elements.retry.hidden, false)
})

test("provider failure leaves its message to the native YouTube player", () => {
  const elements = makeFeedbackElements()

  renderWorkMediaFeedback(elements, "project video", "unavailable")

  assert.equal(elements.overlay.getAttribute("aria-label"), "project video unavailable")
  assert.equal(elements.overlay.getAttribute("aria-disabled"), "true")
  assert.equal(elements.overlay.getAttribute("tabindex"), "-1")
  assert.equal(elements.status.textContent, "YouTube could not play project video.")
  assert.equal(elements.retry.hidden, true)
})

test("only unavailable feedback removes the inert overlay from tab order", () => {
  const elements = makeFeedbackElements()

  for (const state of ["idle", "loading", "ready", "playing", "error"]) {
    renderWorkMediaFeedback(elements, "project video", "unavailable")
    assert.equal(elements.overlay.getAttribute("tabindex"), "-1")

    renderWorkMediaFeedback(elements, "project video", state)
    assert.equal(elements.overlay.getAttribute("tabindex"), null)
  }
})

test("ready and playing feedback clear busy state without removing the live region", () => {
  const elements = makeFeedbackElements()
  renderWorkMediaFeedback(elements, "project video", "idle")
  assert.equal(elements.overlay.getAttribute("aria-label"), "Play project video on YouTube")

  renderWorkMediaFeedback(elements, "project video", "loading")

  renderWorkMediaFeedback(elements, "project video", "ready")
  assert.equal(elements.overlay.getAttribute("aria-label"), "Play project video on YouTube")
  assert.equal(elements.overlay.getAttribute("aria-disabled"), null)
  assert.equal(elements.status.textContent, "Ready: project video. Press Play to start.")
  assert.equal(elements.retry.hidden, true)

  renderWorkMediaFeedback(elements, "project video", "playing")
  assert.equal(elements.overlay.getAttribute("aria-label"), "Play project video on YouTube")
  assert.equal(elements.status.textContent, "")
})
