import assert from "node:assert/strict"
import test from "node:test"

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const flushMicrotasks = () => new Promise(resolve => queueMicrotask(resolve))

const eventWithProperties = (type, properties = {}) => {
  const event = new Event(type)
  Object.entries(properties).forEach(([property, value]) => {
    Object.defineProperty(event, property, { value })
  })
  return event
}

const trustedEvent = (type, properties = {}) => {
  const event = eventWithProperties(type, properties)
  Object.defineProperty(event, "isTrusted", { value: true })
  return event
}

const pointerEvent = (type, pointerType, trusted = true) => {
  const eventFactory = trusted ? trustedEvent : eventWithProperties
  return eventFactory(type, { pointerType })
}

class FakeDocument extends EventTarget {
  body = { contains: () => true }
  documentElement = { clientHeight: 800, clientWidth: 1_200 }
  hidden = false
  readyState = "loading"
  aboutVideos = []

  querySelectorAll(selector) {
    if (selector === "[data-about-autoplay-video]") return this.aboutVideos
    return []
  }
}

class FakeWindow extends EventTarget {
  PointerEvent = class {}
  innerHeight = 800
  innerWidth = 1_200
  mediaQueries = new Map()

  setTimeout(callback, delay) {
    return setTimeout(callback, delay)
  }

  clearTimeout(timer) {
    clearTimeout(timer)
  }

  matchMedia(query) {
    if (!this.mediaQueries.has(query)) {
      const result = new EventTarget()
      result.matches = false
      this.mediaQueries.set(query, result)
    }
    return this.mediaQueries.get(query)
  }
}

class FakeVideo extends EventTarget {
  currentTime = 0
  defaultMuted = false
  ended = false
  muted = false
  paused = true
  playsInline = false
  readyState = 0
  playCalls = 0
  pauseCalls = 0
  playImplementation = () => Promise.resolve()
  attributes = new Map()

  play() {
    this.playCalls += 1
    return this.playImplementation()
  }

  pause() {
    this.pauseCalls += 1
    this.paused = true
  }

  querySelectorAll() {
    return []
  }

  setAttribute(name, value) {
    this.attributes.set(name, value)
  }
}

const fakeDocument = new FakeDocument()
const fakeWindow = new FakeWindow()

Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument })
Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow })
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} })
Object.defineProperty(globalThis, "HTMLMediaElement", {
  configurable: true,
  value: { HAVE_CURRENT_DATA: 2 },
})

await import("../src/scripts/videoAutoplay.ts")

const bootAndExhaustGenericVideo = async (video, bootEvent) => {
  video.playImplementation = () => Promise.reject(new Error("autoplay denied"))
  fakeDocument.aboutVideos = [video]
  fakeDocument.dispatchEvent(new Event(bootEvent))

  await sleep(150)
  for (let retry = 0; retry < 12; retry += 1) {
    video.dispatchEvent(new Event("loadeddata"))
    await flushMicrotasks()
  }
  await flushMicrotasks()
}

await test("generic pointer listeners require trusted activation and clean up", async () => {
  const video = new FakeVideo()
  await bootAndExhaustGenericVideo(video, "DOMContentLoaded")

  assert.equal(video.autoplay, true)
  assert.equal(video.muted, true)
  assert.equal(video.defaultMuted, true)
  assert.equal(video.playsInline, true)

  const callsAfterExhaustion = video.playCalls
  fakeWindow.dispatchEvent(pointerEvent("pointerdown", "mouse", false))
  fakeWindow.dispatchEvent(pointerEvent("pointerup", "touch", false))
  fakeWindow.dispatchEvent(pointerEvent("pointerup", "pen", false))
  fakeWindow.dispatchEvent(new Event("click"))
  fakeWindow.dispatchEvent(eventWithProperties("keydown", { key: "Enter" }))
  assert.equal(video.playCalls, callsAfterExhaustion)

  fakeWindow.dispatchEvent(pointerEvent("pointerdown", "touch"))
  fakeWindow.dispatchEvent(pointerEvent("pointerup", "mouse"))
  assert.equal(video.playCalls, callsAfterExhaustion)

  fakeWindow.dispatchEvent(pointerEvent("pointerdown", "mouse"))
  assert.equal(video.playCalls, callsAfterExhaustion + 1)
  await flushMicrotasks()

  fakeWindow.dispatchEvent(pointerEvent("pointerup", "touch"))
  assert.equal(video.playCalls, callsAfterExhaustion + 2)
  await flushMicrotasks()

  fakeWindow.dispatchEvent(pointerEvent("pointerup", "pen"))
  assert.equal(video.playCalls, callsAfterExhaustion + 3)
  await flushMicrotasks()

  fakeWindow.dispatchEvent(trustedEvent("click"))
  assert.equal(video.playCalls, callsAfterExhaustion + 4)
  await flushMicrotasks()

  fakeWindow.dispatchEvent(trustedEvent("keydown", { key: "Escape" }))
  fakeWindow.dispatchEvent(trustedEvent("keydown", { key: "Enter", ctrlKey: true }))
  fakeWindow.dispatchEvent(trustedEvent("keydown", { key: "Enter", altKey: true }))
  fakeWindow.dispatchEvent(trustedEvent("keydown", { key: "Enter", metaKey: true }))
  fakeWindow.dispatchEvent(trustedEvent("keydown", { key: "Enter", isComposing: true }))
  assert.equal(video.playCalls, callsAfterExhaustion + 4)

  fakeWindow.dispatchEvent(trustedEvent("keydown", { key: "Enter" }))
  assert.equal(video.playCalls, callsAfterExhaustion + 5)
  await flushMicrotasks()

  video.paused = false
  const pausesBeforeCleanup = video.pauseCalls
  fakeDocument.dispatchEvent(new Event("astro:before-swap"))
  assert.equal(video.pauseCalls, pausesBeforeCleanup + 1)

  const callsAfterCleanup = video.playCalls
  fakeWindow.dispatchEvent(pointerEvent("pointerdown", "mouse"))
  fakeWindow.dispatchEvent(trustedEvent("click"))
  fakeWindow.dispatchEvent(trustedEvent("keydown", { key: "Enter" }))
  assert.equal(video.playCalls, callsAfterCleanup)
  fakeDocument.aboutVideos = []
})

await test("generic legacy listeners require trusted activation and clean up", async () => {
  fakeWindow.PointerEvent = undefined
  const video = new FakeVideo()
  await bootAndExhaustGenericVideo(video, "astro:after-swap")

  const callsAfterExhaustion = video.playCalls
  fakeWindow.dispatchEvent(new Event("mousedown"))
  fakeWindow.dispatchEvent(new Event("touchend"))
  assert.equal(video.playCalls, callsAfterExhaustion)

  fakeWindow.dispatchEvent(trustedEvent("mousedown"))
  assert.equal(video.playCalls, callsAfterExhaustion + 1)
  await flushMicrotasks()

  fakeWindow.dispatchEvent(trustedEvent("touchend"))
  assert.equal(video.playCalls, callsAfterExhaustion + 2)
  await flushMicrotasks()

  fakeDocument.dispatchEvent(new Event("astro:before-swap"))
  const callsAfterCleanup = video.playCalls
  fakeWindow.dispatchEvent(trustedEvent("mousedown"))
  fakeWindow.dispatchEvent(trustedEvent("touchend"))
  assert.equal(video.playCalls, callsAfterCleanup)
  fakeDocument.aboutVideos = []
  fakeWindow.PointerEvent = class {}
})
