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
  baseURI = "https://example.test/"
  thumbnailItems = []

  querySelectorAll(selector) {
    return selector === "[data-thumbnail-card]" ? this.thumbnailItems : []
  }
}

class FakeWindow extends EventTarget {
  PointerEvent = class {}
  innerHeight = 800
  innerWidth = 1_200
  mediaQueries = new Map()

  requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 0)
  cancelAnimationFrame = clearTimeout

  setTimeout(callback, delay) {
    return setTimeout(callback, delay)
  }

  clearTimeout(timer) {
    clearTimeout(timer)
  }

  matchMedia(query) {
    if (!this.mediaQueries.has(query)) {
      const result = new EventTarget()
      result.matches = query.includes("hover: hover") || query.includes("min-width")
      this.mediaQueries.set(query, result)
    }
    return this.mediaQueries.get(query)
  }
}

class FakeIntersectionObserver {
  observe() {}
  disconnect() {}
}

class FakeClassList {
  values = new Set()

  add(value) {
    this.values.add(value)
  }

  remove(value) {
    this.values.delete(value)
  }

  contains(value) {
    return this.values.has(value)
  }
}

class FakeSource extends EventTarget {
  attributes = new Map()

  constructor(src) {
    super()
    this.attributes.set("data-src", src)
    this.attributes.set("type", "video/webm")
    this.dataset = new Proxy({}, {
      deleteProperty: (_, property) => {
        this.attributes.delete(`data-${String(property).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`)
        return true
      },
      get: (_, property) =>
        this.attributes.get(`data-${String(property).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`),
      set: (_, property, value) => {
        this.attributes.set(
          `data-${String(property).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`,
          String(value),
        )
        return true
      },
    })
  }

  get src() {
    return this.attributes.get("src") ?? ""
  }

  set src(value) {
    this.attributes.set("src", value)
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null
  }

  setAttribute(name, value) {
    this.attributes.set(name, value)
  }

  hasAttribute(name) {
    return this.attributes.has(name)
  }

  removeAttribute(name) {
    this.attributes.delete(name)
  }
}

class FakeVideo extends EventTarget {
  autoplay = false
  currentSrc = ""
  currentTime = 0
  defaultMuted = false
  ended = false
  muted = false
  paused = true
  playsInline = false
  preload = "none"
  readyState = 0
  sources = []
  attributes = new Map()
  playCalls = 0
  pauseCalls = 0
  playImplementation = () => Promise.resolve()

  constructor(sourceUrl = "/preview.webm") {
    super()
    this.sources = [new FakeSource(sourceUrl)]
  }

  canPlayType() {
    return "probably"
  }

  load() {}

  pause() {
    this.pauseCalls += 1
    this.paused = true
  }

  play() {
    this.playCalls += 1
    return this.playImplementation()
  }

  querySelectorAll(selector) {
    if (selector === "source[data-src], source[src]") return this.sources
    if (selector === "source[data-src]:not([src]):not([data-autoplay-source-failed])") {
      return this.sources.filter(source =>
        source.hasAttribute("data-src") &&
        !source.hasAttribute("src") &&
        !source.hasAttribute("data-autoplay-source-failed"),
      )
    }
    if (selector === "source[data-src][src]") {
      return this.sources.filter(source =>
        source.hasAttribute("data-src") && source.hasAttribute("src"),
      )
    }
    return []
  }

  setAttribute(name, value) {
    this.attributes.set(name, value)
  }
}

class FakeContainer extends EventTarget {
  classList = new FakeClassList()
  dataset = {}

  constructor(video, autoplay) {
    super()
    this.video = video
    this.dataset.autoplay = autoplay ? "true" : "false"
  }

  querySelector(selector) {
    return selector === "video" ? this.video : null
  }
}

class FakeThumbnailItem extends EventTarget {
  hover = false
  focused = false

  constructor(video, { autoplay = true, top = 0 } = {}) {
    super()
    this.container = new FakeContainer(video, autoplay)
    this.rect = {
      bottom: top + 100,
      height: 100,
      left: 0,
      right: 100,
      top,
      width: 100,
    }
  }

  getBoundingClientRect() {
    return this.rect
  }

  matches(selector) {
    if (selector === ":hover") return this.hover
    if (selector === ":focus-within") return this.focused
    return false
  }

  querySelector(selector) {
    return selector === "[data-thumbnail-video]" ? this.container : null
  }
}

const fakeDocument = new FakeDocument()
const fakeWindow = new FakeWindow()

Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument })
Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow })
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} })
Object.defineProperty(globalThis, "IntersectionObserver", {
  configurable: true,
  value: FakeIntersectionObserver,
})
Object.defineProperty(fakeWindow, "IntersectionObserver", {
  configurable: true,
  value: FakeIntersectionObserver,
})
Object.defineProperty(globalThis, "HTMLMediaElement", {
  configurable: true,
  value: { HAVE_CURRENT_DATA: 2 },
})

const { makeAutoplayController } = await import("../src/scripts/videoAutoplay.ts")

await test("times out a play request that emits play but never starts playing", async () => {
  const video = new FakeVideo()
  let exhausted = 0
  let controller
  video.playImplementation = () => {
    video.paused = false
    queueMicrotask(() => video.dispatchEvent(new Event("play")))
    return new Promise(() => {})
  }
  controller = makeAutoplayController(video, {
    onExhausted: () => {
      exhausted += 1
      controller.stop()
    },
    playStartTimeoutMs: 25,
  })

  controller.start()
  await sleep(45)

  assert.equal(exhausted, 1)
  assert.equal(video.pauseCalls, 1)
})

await test("cancels the play-start lease when the play promise fulfills", async () => {
  const video = new FakeVideo()
  let exhausted = 0
  let played = 0
  let resolvePlay
  video.playImplementation = () => new Promise(resolve => { resolvePlay = resolve })
  const controller = makeAutoplayController(video, {
    onExhausted: () => { exhausted += 1 },
    onPlay: () => { played += 1 },
    playStartTimeoutMs: 35,
  })

  controller.start()
  await sleep(10)
  video.paused = false
  resolvePlay()
  await flushMicrotasks()
  await sleep(40)

  assert.equal(played, 1)
  assert.equal(exhausted, 0)
  controller.stop()
})

await test("ignores a stale playing event after a new generation starts", async () => {
  const video = new FakeVideo()
  let exhausted = 0
  let controller
  video.playImplementation = () => new Promise(() => {})
  controller = makeAutoplayController(video, {
    onExhausted: () => {
      exhausted += 1
      controller.stop()
    },
    playStartTimeoutMs: 25,
  })

  controller.start()
  video.paused = false
  controller.stop()
  video.playImplementation = () => new Promise(() => {})
  controller.start()
  video.dispatchEvent(new Event("playing"))
  await sleep(40)

  assert.equal(exhausted, 1)
})

await test("retries a hung controller through the default play-start lease", async context => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"] })
  const video = new FakeVideo()
  video.playImplementation = () => {
    video.paused = false
    return new Promise(() => {})
  }
  const controller = makeAutoplayController(video, {
    maxAttempts: 1,
  })
  controller.start()
  context.mock.timers.tick(12_000)
  assert.equal(video.pauseCalls, 1)

  video.playImplementation = () => {
    video.paused = false
    return Promise.resolve()
  }
  video.dispatchEvent(new Event("loadeddata"))
  await flushMicrotasks()
  assert.equal(video.playCalls, 2)
  controller.stop()
})

await test("pauses the play-start lease while the document is hidden", async () => {
  const video = new FakeVideo()
  let exhausted = 0
  let controller
  video.playImplementation = () => new Promise(() => {})
  controller = makeAutoplayController(video, {
    onExhausted: () => {
      exhausted += 1
      controller.stop()
    },
    playStartTimeoutMs: 30,
  })

  controller.start()
  await sleep(10)
  fakeDocument.hidden = true
  fakeDocument.dispatchEvent(new Event("visibilitychange"))
  await sleep(35)
  assert.equal(exhausted, 0)

  fakeDocument.hidden = false
  fakeDocument.dispatchEvent(new Event("visibilitychange"))
  await sleep(30)
  assert.equal(exhausted, 1)
})

await test("ignores a late settlement from an expired play attempt", async () => {
  const video = new FakeVideo()
  let resolveFirst
  let played = 0
  video.playImplementation = () => {
    video.paused = false
    return new Promise(resolve => { resolveFirst = resolve })
  }
  const controller = makeAutoplayController(video, {
    maxAttempts: 2,
    onPlay: () => { played += 1 },
    playStartTimeoutMs: 20,
  })

  controller.start()
  await sleep(30)
  video.playImplementation = () => {
    video.paused = false
    return new Promise(() => {})
  }
  video.dispatchEvent(new Event("loadeddata"))
  await flushMicrotasks()
  assert.equal(video.playCalls, 2)

  resolveFirst()
  await flushMicrotasks()
  assert.equal(played, 0)

  await sleep(30)
  assert.equal(video.pauseCalls, 2)
  video.playImplementation = () => {
    video.paused = false
    return Promise.resolve()
  }
  video.dispatchEvent(new Event("loadeddata"))
  await flushMicrotasks()
  assert.equal(video.playCalls, 3)
  assert.equal(played, 1)
  controller.stop()
})

await test("trusted gestures retry play exhaustion without reviving failed sources", async () => {
  let activeVideos = 0
  let maximumActiveVideos = 0
  const videos = [new FakeVideo("/one.webm"), new FakeVideo("/two.webm"), new FakeVideo("/three.webm")]
  const failedVideo = new FakeVideo("/broken.webm")

  const setPlaying = (video, playing) => {
    if (video.paused === !playing) return
    video.paused = !playing
    activeVideos += playing ? 1 : -1
    maximumActiveVideos = Math.max(maximumActiveVideos, activeVideos)
  }

  const denyTopVideos = () => {
    videos.slice(0, 2).forEach(video => {
      video.playImplementation = () => Promise.reject(new Error("autoplay denied"))
    })
  }
  const allowTopVideos = () => {
    videos.slice(0, 2).forEach(video => {
      video.playImplementation = () => {
        setPlaying(video, true)
        return Promise.resolve()
      }
    })
  }
  const exhaustTopVideos = async () => {
    for (let retry = 0; retry < 8; retry += 1) {
      videos[0].dispatchEvent(new Event("loadeddata"))
      videos[1].dispatchEvent(new Event("loadeddata"))
      await flushMicrotasks()
    }
    await flushMicrotasks()
  }
  const restartAndExhaustTopVideos = async () => {
    denyTopVideos()
    fakeDocument.hidden = true
    fakeDocument.dispatchEvent(new Event("visibilitychange"))
    fakeDocument.hidden = false
    fakeDocument.dispatchEvent(new Event("visibilitychange"))
    await flushMicrotasks()
    await exhaustTopVideos()
  }
  denyTopVideos()
  videos[2].playImplementation = () => {
    setPlaying(videos[2], true)
    return Promise.resolve()
  }
  videos.concat(failedVideo).forEach(video => {
    video.pause = () => {
      video.pauseCalls += 1
      if (!video.paused) setPlaying(video, false)
    }
  })

  fakeDocument.thumbnailItems = [
    new FakeThumbnailItem(videos[0], { top: 0 }),
    new FakeThumbnailItem(videos[1], { top: 120 }),
    new FakeThumbnailItem(videos[2], { top: 240 }),
    new FakeThumbnailItem(failedVideo, { autoplay: false, top: 360 }),
  ]
  fakeDocument.dispatchEvent(new Event("DOMContentLoaded"))
  await flushMicrotasks()
  await exhaustTopVideos()

  assert.equal(videos[2].playCalls, 1)
  videos.slice(0, 2).forEach(video => {
    video.playImplementation = () => new Promise(() => {})
  })
  const callsBeforeFocus = videos.slice(0, 2).map(video => video.playCalls)
  fakeWindow.dispatchEvent(new Event("focus"))
  assert.deepEqual(
    videos.slice(0, 2).map(video => video.playCalls),
    callsBeforeFocus,
  )
  fakeWindow.dispatchEvent(new Event("click"))
  fakeWindow.dispatchEvent(new Event("keydown"))
  fakeWindow.dispatchEvent(eventWithProperties("pointerdown", { pointerType: "mouse" }))
  assert.deepEqual(
    videos.slice(0, 2).map(video => video.playCalls),
    callsBeforeFocus,
  )
  fakeWindow.dispatchEvent(new Event("online"))
  assert.deepEqual(
    videos.slice(0, 2).map(video => video.playCalls),
    callsBeforeFocus,
  )

  const failedSource = failedVideo.sources[0]
  failedSource.src = failedSource.getAttribute("data-src")
  failedSource.dispatchEvent(new Event("error"))
  assert.equal(failedSource.hasAttribute("data-autoplay-source-failed"), true)
  assert.equal(failedSource.hasAttribute("src"), false)

  allowTopVideos()
  const callsBeforeTouch = videos.slice(0, 2).map(video => video.playCalls)
  fakeWindow.dispatchEvent(pointerEvent("pointerdown", "touch"))
  assert.deepEqual(
    videos.slice(0, 2).map(video => video.playCalls),
    callsBeforeTouch,
  )

  fakeWindow.dispatchEvent(pointerEvent("pointerup", "touch"))
  assert.deepEqual(
    videos.slice(0, 2).map(video => video.playCalls),
    callsBeforeTouch.map(calls => calls + 1),
  )

  await restartAndExhaustTopVideos()
  allowTopVideos()
  const callsBeforeMouse = videos.slice(0, 2).map(video => video.playCalls)
  fakeWindow.dispatchEvent(pointerEvent("pointerdown", "mouse"))
  assert.deepEqual(
    videos.slice(0, 2).map(video => video.playCalls),
    callsBeforeMouse.map(calls => calls + 1),
  )

  await restartAndExhaustTopVideos()
  allowTopVideos()
  const callsBeforeKeyboard = videos.slice(0, 2).map(video => video.playCalls)
  const escapeEvent = trustedEvent("keydown", { key: "Escape" })
  fakeWindow.dispatchEvent(escapeEvent)
  assert.deepEqual(
    videos.slice(0, 2).map(video => video.playCalls),
    callsBeforeKeyboard,
  )

  const enterEvent = trustedEvent("keydown", { key: "Enter" })
  fakeWindow.dispatchEvent(enterEvent)
  assert.deepEqual(
    videos.slice(0, 2).map(video => video.playCalls),
    callsBeforeKeyboard.map(calls => calls + 1),
  )

  await restartAndExhaustTopVideos()
  allowTopVideos()
  const callsBeforeClick = videos.slice(0, 2).map(video => video.playCalls)
  fakeWindow.dispatchEvent(trustedEvent("click"))
  assert.deepEqual(
    videos.slice(0, 2).map(video => video.playCalls),
    callsBeforeClick.map(calls => calls + 1),
  )

  assert.equal(failedSource.hasAttribute("data-autoplay-source-failed"), true)
  assert.equal(failedSource.hasAttribute("src"), false)
  assert.ok(maximumActiveVideos <= 2)

  fakeDocument.dispatchEvent(new Event("astro:before-swap"))
  const callsAfterCleanup = videos.slice(0, 2).map(video => video.playCalls)
  fakeWindow.dispatchEvent(pointerEvent("pointerdown", "mouse"))
  fakeWindow.dispatchEvent(enterEvent)
  assert.deepEqual(
    videos.slice(0, 2).map(video => video.playCalls),
    callsAfterCleanup,
  )
  fakeDocument.thumbnailItems = []
})
