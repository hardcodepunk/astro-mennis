import assert from "node:assert/strict"
import test from "node:test"

class FakeElement extends EventTarget {
  attributes = new Map()
  dataset = {}
  _hidden = false
  style = {}
  textContent = ""
  playerContainer = null
  frame = null

  constructor(name = "element") {
    super()
    this.name = name
  }

  get hidden() {
    return this._hidden
  }

  set hidden(value) {
    this._hidden = Boolean(value)
    if (this._hidden && fakeDocument.activeElement === this) {
      fakeDocument.activeElement = fakeDocument.body
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value))
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null
  }

  removeAttribute(name) {
    this.attributes.delete(name)
  }

  hasAttribute(name) {
    return this.attributes.has(name)
  }

  toggleAttribute(name, force) {
    const enabled = force ?? !this.attributes.has(name)
    if (enabled) this.attributes.set(name, "")
    else this.attributes.delete(name)
    return enabled
  }

  closest(selector) {
    if (selector === "[data-yt-frame]") return this.frame
    if (selector === ".plyr") return this.playerContainer
    return null
  }

  contains(node) {
    return node === this
  }

  matches(selector) {
    if (selector === '[data-plyr="seek"]') return this.getAttribute("data-plyr") === "seek"
    if (selector === "input, textarea, select, [contenteditable]") {
      return ["input", "textarea", "select"].includes(this.name) || this.hasAttribute("contenteditable")
    }
    if (selector === 'button, [role^="menuitem"]') {
      return this.name === "button" || this.getAttribute("role")?.startsWith("menuitem")
    }
    return false
  }

  focus() {
    fakeDocument.activeElement = this
  }

  canPlayType() {
    return ""
  }
}

class FakeFrame extends FakeElement {
  constructor(label) {
    super("frame")
    this.overlay = new FakeElement("button")
    this.status = new FakeElement("status")
    this.retry = new FakeElement("button")
    this.fallback = new FakeElement("a")
    this.embed = new FakeElement("embed")
    this.container = new FakeElement("player")
    this.playControl = new FakeElement("button")

    this.embed.dataset.ytTitle = label
    this.embed.dataset.ytRatio = "9:16"
    this.embed.frame = this
    this.playControl.playerContainer = this.container
    this.container.contains = node => node === this.container || node === this.playControl
    this.overlay.frame = this
    this.retry.frame = this
  }

  querySelector(selector) {
    if (selector === "[data-yt-overlay]") return this.overlay
    if (selector === "[data-yt-status]") return this.status
    if (selector === "[data-yt-retry]") return this.retry
    if (selector === "[data-yt-fallback]") return this.fallback
    if (selector === ".plyr") return this.container
    if (selector === '.plyr__controls [data-plyr="play"]') return this.playControl
    if (selector === "iframe") return null
    return null
  }

  querySelectorAll(selector) {
    return selector === '[data-plyr="play"]' ? [this.playControl] : []
  }

  contains(node) {
    return [
      this,
      this.overlay,
      this.status,
      this.retry,
      this.fallback,
      this.embed,
      this.container,
      this.playControl,
    ].includes(node)
  }
}

class FakeSlide extends FakeElement {
  constructor(frame) {
    super("slide")
    this.frame = frame
  }

  querySelector(selector) {
    return selector === "[data-yt-frame]" ? this.frame : null
  }
}

class FakeRail extends FakeElement {
  clientWidth = 320
  scrollLeft = 0
  scrollWidth = 640

  constructor(slides) {
    super("rail")
    this.slides = slides
  }

  querySelector(selector) {
    return selector === "[data-yt-slide]" ? (this.slides[0] ?? null) : null
  }

  scrollBy({ left }) {
    this.scrollLeft += left
  }
}

class FakeRoot extends FakeElement {
  constructor(frames, { withRail = false } = {}) {
    super("root")
    this.frames = frames
    this.slides = frames.map(frame => new FakeSlide(frame))
    this.rail = withRail ? new FakeRail(this.slides) : null
  }

  querySelectorAll(selector) {
    if (selector === "[data-yt-embed]") return this.frames.map(frame => frame.embed)
    if (selector === "[data-yt-slide]") return this.slides
    return []
  }

  querySelector(selector) {
    if (selector === "[data-yt-rail]") return this.rail
    return null
  }
}

class FakeDocument extends EventTarget {
  activeElement = null
  readyState = "loading"
  documentElement = new FakeElement("html")
  body = new FakeElement("body")
  head = { append() {} }

  constructor() {
    super()
    this.activeElement = this.body
  }

  createElement(name) {
    const element = new FakeElement(name)
    element.playsInline = false
    element.textTracks = []
    return element
  }

  querySelectorAll() {
    return []
  }

  querySelector() {
    return null
  }
}

class FakeWindow {
  CSS = undefined
  URL = URL
  document = null
  innerHeight = 800
  innerWidth = 1_200
  location = new URL("https://example.test/")
  nextAnimationFrameId = 1
  animationFrames = new Map()
  nextTimeoutId = 1
  timeouts = new Map()
  localStorage = {
    getItem: () => null,
    removeItem() {},
    setItem() {},
  }

  addEventListener() {}
  removeEventListener() {}
  clearTimeout(timeoutId) {
    this.timeouts.delete(timeoutId)
  }
  setTimeout(callback, delay) {
    const timeoutId = this.nextTimeoutId++
    this.timeouts.set(timeoutId, { callback, delay })
    return timeoutId
  }
  pendingTimeoutCount(delay) {
    return [...this.timeouts.values()].filter(timeout => timeout.delay === delay).length
  }
  flushTimeouts(delay) {
    const pending = [...this.timeouts.entries()].filter(([, timeout]) => timeout.delay === delay)
    pending.forEach(([timeoutId]) => this.timeouts.delete(timeoutId))
    pending.forEach(([, timeout]) => timeout.callback())
  }
  resetTimeouts() {
    this.timeouts.clear()
    this.animationFrames.clear()
  }
  requestAnimationFrame(callback) {
    const animationFrameId = this.nextAnimationFrameId++
    this.animationFrames.set(animationFrameId, callback)
    return animationFrameId
  }
  flushAnimationFrames() {
    const callbacks = [...this.animationFrames.values()]
    this.animationFrames.clear()
    callbacks.forEach(callback => callback(0))
  }
  matchMedia() {
    return { matches: false }
  }
}

class FakeMutationObserver {
  observe() {}
  disconnect() {}
}

class FakeIntersectionObserver {
  static instances = []

  constructor(callback) {
    this.callback = callback
    this.targets = new Set()
    FakeIntersectionObserver.instances.push(this)
  }

  observe(target) {
    this.targets.add(target)
  }

  disconnect() {
    this.targets.clear()
  }

  emit(target, intersectionRatio) {
    assert.equal(this.targets.has(target), true)
    this.callback([
      {
        target,
        intersectionRatio,
        isIntersecting: intersectionRatio > 0,
      },
    ])
  }
}

class FakePlayer {
  handlers = new Map()
  playing = false
  currentTime = 0
  duration = 60
  errorOnPlay = false
  playCalls = 0
  pauseCalls = 0
  destroyCalls = 0

  constructor(options) {
    this.options = options
  }

  on(eventName, listener) {
    if (!this.handlers.has(eventName)) this.handlers.set(eventName, new Set())
    this.handlers.get(eventName).add(listener)
  }

  off(eventName, listener) {
    this.handlers.get(eventName)?.delete(listener)
  }

  emit(eventName) {
    if (eventName === "playing" || eventName === "play") this.playing = true
    if (eventName === "pause" || eventName === "ended") this.playing = false
    for (const listener of [...(this.handlers.get(eventName) ?? [])]) listener()
  }

  play() {
    this.playCalls += 1
    this.emit("play")
    if (this.errorOnPlay) this.emit("error")
  }

  pause() {
    this.pauseCalls += 1
    this.emit("pause")
  }

  toggleControls() {}

  destroy() {
    this.destroyCalls += 1
  }
}

const fakeDocument = new FakeDocument()
const fakeWindow = new FakeWindow()
fakeWindow.document = fakeDocument

Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument })
Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow })
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { maxTouchPoints: 0, platform: "test", userAgent: "test" },
})
Object.defineProperty(globalThis, "Element", { configurable: true, value: FakeElement })
Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: FakeElement })
Object.defineProperty(globalThis, "Node", { configurable: true, value: FakeElement })
Object.defineProperty(globalThis, "MutationObserver", {
  configurable: true,
  value: FakeMutationObserver,
})
Object.defineProperty(globalThis, "IntersectionObserver", {
  configurable: true,
  value: FakeIntersectionObserver,
})

const { initWorkMediaRoot } = await import("../src/scripts/workMediaDisplayScript.ts")

const flushMicrotasks = async () => {
  await new Promise(resolve => queueMicrotask(resolve))
  await new Promise(resolve => queueMicrotask(resolve))
}

test("production media wiring activates the latest reel, rejects stale play, and cleans up", async () => {
  fakeWindow.resetTimeouts()
  const firstFrame = new FakeFrame("reel 1 of 2")
  const secondFrame = new FakeFrame("reel 2 of 2")
  const root = new FakeRoot([firstFrame, secondFrame])
  const players = new Map()
  const runtime = {
    loadYouTubeApi: () => Promise.resolve(),
    createPlayer(embed, options) {
      const player = new FakePlayer(options)
      players.set(embed, player)
      return player
    },
  }

  initWorkMediaRoot(root, runtime)

  firstFrame.overlay.focus()
  firstFrame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
  assert.equal(firstFrame.overlay.getAttribute("aria-busy"), "true")
  await flushMicrotasks()
  const firstPlayer = players.get(firstFrame.embed)
  firstPlayer.emit("ready")
  firstPlayer.emit("playing")

  assert.equal(firstFrame.overlay.hidden, true)
  assert.equal(fakeDocument.activeElement, firstFrame.playControl)
  assert.equal(firstFrame.status.textContent, "")

  secondFrame.overlay.focus()
  secondFrame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
  await flushMicrotasks()
  const secondPlayer = players.get(secondFrame.embed)
  secondPlayer.emit("ready")
  secondPlayer.emit("playing")

  const firstPausesAfterSwitch = firstPlayer.pauseCalls
  const secondPausesBeforeStaleEvent = secondPlayer.pauseCalls
  firstPlayer.emit("play")

  assert.equal(firstPlayer.pauseCalls, firstPausesAfterSwitch + 1)
  assert.equal(secondPlayer.pauseCalls, secondPausesBeforeStaleEvent)
  assert.equal(secondPlayer.playing, true)
  assert.equal(fakeDocument.activeElement, secondFrame.playControl)

  firstPlayer.emit("error")
  assert.equal(firstFrame.status.textContent, "")
  assert.equal(firstFrame.fallback.hidden, true)

  secondPlayer.options.listeners.play()
  secondPlayer.pause()
  secondFrame.playControl.focus()
  secondPlayer.emit("error")
  assert.equal(secondFrame.overlay.hidden, false)
  assert.equal(secondFrame.overlay.getAttribute("aria-disabled"), "true")
  assert.equal(secondFrame.container.hasAttribute("inert"), true)
  assert.equal(secondFrame.retry.hidden, true)
  assert.equal(secondFrame.fallback.hidden, false)
  assert.equal(fakeDocument.activeElement, secondFrame.fallback)

  secondPlayer.emit("ended")
  assert.equal(secondFrame.overlay.getAttribute("aria-disabled"), "true")
  assert.equal(secondFrame.status.textContent, "Could not play reel 2 of 2. Watch it on YouTube.")
  assert.equal(secondFrame.fallback.hidden, false)
  assert.equal(fakeDocument.activeElement, secondFrame.fallback)

  firstFrame.playControl.focus()
  const staleUnavailablePlay = firstPlayer.options.listeners.play()
  assert.equal(staleUnavailablePlay, false)
  assert.equal(firstFrame.overlay.hidden, false)
  assert.equal(firstFrame.overlay.getAttribute("aria-disabled"), "true")
  assert.equal(firstFrame.fallback.hidden, false)
  assert.equal(fakeDocument.activeElement, firstFrame.fallback)

  fakeDocument.dispatchEvent(new Event("astro:before-swap"))
  assert.equal(firstPlayer.destroyCalls, 1)
  assert.equal(secondPlayer.destroyCalls, 1)
  assert.equal(root.dataset.workHeroInited, undefined)
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)

  const playerCountAfterCleanup = players.size
  firstFrame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
  await flushMicrotasks()
  assert.equal(players.size, playerCountAfterCleanup)
})

test("the feedback scrollport exposes a working retry control", async () => {
  fakeWindow.resetTimeouts()
  const frame = new FakeFrame("project video")
  const root = new FakeRoot([frame])
  const players = new Map()
  let loadAttempts = 0
  const runtime = {
    loadYouTubeApi() {
      loadAttempts += 1
      return loadAttempts < 3 ? Promise.reject(new Error("offline")) : Promise.resolve()
    },
    createPlayer(embed, options) {
      const player = new FakePlayer(options)
      players.set(embed, player)
      return player
    },
  }
  const originalWarn = console.warn
  console.warn = () => undefined
  let cleanup

  try {
    cleanup = initWorkMediaRoot(root, runtime)
    frame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
    await flushMicrotasks()

    assert.equal(frame.retry.hidden, false)
    assert.equal(frame.fallback.hidden, false)
    assert.equal(frame.status.textContent, "Could not load project video. Retry or watch it on YouTube.")

    frame.retry.focus()
    frame.retry.dispatchEvent(new Event("click", { cancelable: true }))
    assert.equal(frame.retry.hidden, true)
    assert.equal(fakeDocument.activeElement, frame.overlay)
    await flushMicrotasks()

    assert.equal(frame.retry.hidden, false)
    assert.equal(fakeDocument.activeElement, frame.retry)

    frame.retry.dispatchEvent(new Event("click", { cancelable: true }))
    assert.equal(frame.retry.hidden, true)
    assert.equal(fakeDocument.activeElement, frame.overlay)
    await flushMicrotasks()

    const player = players.get(frame.embed)
    player.emit("ready")
    player.emit("playing")

    assert.equal(loadAttempts, 3)
    assert.equal(fakeDocument.activeElement, frame.playControl)
    assert.equal(frame.fallback.hidden, true)
  } finally {
    cleanup?.()
    console.warn = originalWarn
  }
})

test("retry does not reclaim focus after the user moves away", async () => {
  fakeWindow.resetTimeouts()
  const frame = new FakeFrame("project video")
  const root = new FakeRoot([frame])
  let loadAttempts = 0
  let resolveRetry
  let player
  const runtime = {
    loadYouTubeApi() {
      loadAttempts += 1
      if (loadAttempts === 1) return Promise.reject(new Error("offline"))
      return new Promise(resolve => {
        resolveRetry = resolve
      })
    },
    createPlayer(_embed, options) {
      player = new FakePlayer(options)
      return player
    },
  }
  const originalWarn = console.warn
  console.warn = () => undefined
  let cleanup

  try {
    cleanup = initWorkMediaRoot(root, runtime)
    frame.overlay.focus()
    frame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
    await flushMicrotasks()
    assert.equal(fakeDocument.activeElement, frame.retry)

    frame.retry.dispatchEvent(new Event("click", { cancelable: true }))
    assert.equal(fakeDocument.activeElement, frame.overlay)
    fakeDocument.activeElement = fakeDocument.body
    resolveRetry()
    await flushMicrotasks()
    player.emit("ready")

    assert.equal(fakeDocument.activeElement, fakeDocument.body)
  } finally {
    cleanup?.()
    console.warn = originalWarn
  }
})

test("stalled player readiness exposes a focus-preserving retry", async () => {
  fakeWindow.resetTimeouts()
  const frame = new FakeFrame("project video")
  const root = new FakeRoot([frame])
  let player
  const originalWarn = console.warn
  console.warn = () => undefined
  let cleanup

  try {
    cleanup = initWorkMediaRoot(root, {
      loadYouTubeApi: () => Promise.resolve(),
      createPlayer(_embed, options) {
        player = new FakePlayer(options)
        return player
      },
    })

    frame.overlay.focus()
    frame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
    await flushMicrotasks()
    assert.equal(fakeWindow.pendingTimeoutCount(15_000), 1)
    assert.equal(frame.status.textContent, "Loading project video…")

    fakeWindow.flushTimeouts(15_000)
    assert.equal(frame.retry.hidden, false)
    assert.equal(frame.fallback.hidden, false)
    assert.equal(frame.status.textContent, "Could not load project video. Retry or watch it on YouTube.")
    assert.equal(fakeDocument.activeElement, frame.retry)

    frame.retry.dispatchEvent(new Event("click", { cancelable: true }))
    assert.equal(fakeWindow.pendingTimeoutCount(15_000), 1)
    assert.equal(frame.status.textContent, "Loading project video…")
    assert.equal(fakeDocument.activeElement, frame.overlay)

    player.emit("ready")
    assert.equal(fakeWindow.pendingTimeoutCount(15_000), 0)
    player.emit("playing")
    assert.equal(frame.fallback.hidden, true)
    assert.equal(frame.status.textContent, "")
    assert.equal(fakeDocument.activeElement, frame.playControl)
  } finally {
    cleanup?.()
    console.warn = originalWarn
  }
})

test("provider failure before the next frame transfers focus to the fallback", async () => {
  fakeWindow.resetTimeouts()
  const frame = new FakeFrame("project video")
  const root = new FakeRoot([frame])
  let player
  const cleanup = initWorkMediaRoot(root, {
    loadYouTubeApi: () => Promise.resolve(),
    createPlayer(_embed, options) {
      player = new FakePlayer(options)
      return player
    },
  })

  frame.overlay.focus()
  frame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
  await flushMicrotasks()
  player.errorOnPlay = true
  player.emit("ready")

  assert.equal(frame.overlay.getAttribute("aria-disabled"), "true")
  assert.equal(frame.fallback.hidden, false)
  assert.equal(fakeDocument.activeElement, frame.fallback)
  fakeWindow.flushAnimationFrames()
  assert.equal(fakeDocument.activeElement, frame.fallback)

  cleanup()
})

test("rebuffering, delayed replay endings, and natural completion reconcile", async () => {
  fakeWindow.resetTimeouts()
  const frame = new FakeFrame("project video")
  const root = new FakeRoot([frame])
  let player
  const cleanup = initWorkMediaRoot(root, {
    loadYouTubeApi: () => Promise.resolve(),
    createPlayer(_embed, options) {
      player = new FakePlayer(options)
      return player
    },
  })

  frame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
  await flushMicrotasks()
  player.emit("ready")
  fakeWindow.flushAnimationFrames()
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 1)

  player.emit("playing")
  fakeWindow.flushAnimationFrames()
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)
  player.emit("waiting")
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)

  player.emit("pause")
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)
  await flushMicrotasks()
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 1)
  assert.equal(frame.status.textContent, "Loading project video…")
  player.emit("playing")
  fakeWindow.flushAnimationFrames()
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)

  player.currentTime = player.duration
  player.emit("pause")
  player.emit("ended")
  await flushMicrotasks()
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)
  assert.equal(frame.status.textContent, "")

  player.options.listeners.play()
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 1)
  player.emit("timeupdate")
  player.emit("playing")
  player.emit("timeupdate")
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 1)
  assert.equal(frame.status.textContent, "Loading project video…")
  fakeWindow.flushAnimationFrames()
  player.emit("pause")
  player.currentTime = 0
  player.emit("timeupdate")
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 1)
  assert.equal(frame.status.textContent, "Loading project video…")
  player.currentTime = player.duration
  player.emit("ended")
  await flushMicrotasks()
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 1)
  assert.equal(frame.status.textContent, "Loading project video…")
  player.currentTime = 0
  player.emit("playing")
  player.currentTime = 2
  player.emit("timeupdate")
  assert.equal(player.playing, true)
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)
  fakeWindow.flushAnimationFrames()

  player.currentTime = player.duration
  player.emit("pause")
  player.emit("ended")
  await flushMicrotasks()
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)
  assert.equal(frame.status.textContent, "")
  assert.equal(player.playing, false)

  cleanup()
})

test("a near-end resume completes naturally without a polling tick", async () => {
  fakeWindow.resetTimeouts()
  const frame = new FakeFrame("project video")
  const root = new FakeRoot([frame])
  let player
  const cleanup = initWorkMediaRoot(root, {
    loadYouTubeApi: () => Promise.resolve(),
    createPlayer(_embed, options) {
      player = new FakePlayer(options)
      return player
    },
  })

  frame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
  await flushMicrotasks()
  player.emit("ready")
  player.emit("playing")
  player.currentTime = 59.9

  player.options.listeners.play()
  player.pause()
  player.options.listeners.play()
  player.emit("playing")
  player.currentTime = player.duration
  player.emit("pause")
  player.emit("ended")
  await flushMicrotasks()

  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)
  assert.equal(frame.status.textContent, "")
  assert.equal(player.playing, false)

  cleanup()
})

test("a confirmed replay stays confirmed after seeking to its baseline", async () => {
  fakeWindow.resetTimeouts()
  const frame = new FakeFrame("project video")
  const root = new FakeRoot([frame])
  let player
  const cleanup = initWorkMediaRoot(root, {
    loadYouTubeApi: () => Promise.resolve(),
    createPlayer(_embed, options) {
      player = new FakePlayer(options)
      return player
    },
  })

  frame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
  await flushMicrotasks()
  player.emit("ready")
  player.emit("playing")
  player.currentTime = 10

  player.options.listeners.play()
  player.pause()
  player.options.listeners.play()
  player.emit("playing")
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 1)

  player.currentTime = 10.1
  player.emit("timeupdate")
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)
  assert.equal(frame.status.textContent, "")

  player.currentTime = 10
  player.emit("playing")
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)
  assert.equal(frame.status.textContent, "")

  cleanup()
})

test("playing below the visibility threshold cannot leave loading feedback", async () => {
  fakeWindow.resetTimeouts()
  const frame = new FakeFrame("reel 1 of 1")
  const root = new FakeRoot([frame], { withRail: true })
  let player
  const cleanup = initWorkMediaRoot(root, {
    loadYouTubeApi: () => Promise.resolve(),
    createPlayer(_embed, options) {
      player = new FakePlayer(options)
      return player
    },
  })
  const observer = FakeIntersectionObserver.instances.at(-1)

  observer.emit(root.slides[0], 0.5)
  frame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
  await flushMicrotasks()
  player.emit("ready")
  assert.equal(frame.status.textContent, "Ready: reel 1 of 1. Press Play to start.")

  player.options.listeners.play()
  assert.equal(frame.overlay.getAttribute("aria-busy"), "true")
  assert.equal(frame.status.textContent, "Loading reel 1 of 1…")
  player.emit("playing")

  assert.equal(frame.overlay.getAttribute("aria-busy"), null)
  assert.equal(frame.status.textContent, "")
  assert.equal(player.playing, false)
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)

  cleanup()
})

test("an activated privacy facade stays consumed after leaving and returning to its slide", async () => {
  fakeWindow.resetTimeouts()
  const firstFrame = new FakeFrame("video 1 of 2")
  const secondFrame = new FakeFrame("video 2 of 2")
  const root = new FakeRoot([firstFrame, secondFrame], { withRail: true })
  const players = new Map()
  const cleanup = initWorkMediaRoot(root, {
    loadYouTubeApi: () => Promise.resolve(),
    createPlayer(embed, options) {
      const player = new FakePlayer(options)
      players.set(embed, player)
      return player
    },
  })
  const observer = FakeIntersectionObserver.instances.at(-1)

  observer.emit(root.slides[0], 1)
  observer.emit(root.slides[1], 0)
  firstFrame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
  await flushMicrotasks()
  const firstPlayer = players.get(firstFrame.embed)
  firstPlayer.emit("ready")
  firstPlayer.emit("playing")
  assert.equal(firstFrame.overlay.hidden, true)

  observer.emit(root.slides[0], 0)
  observer.emit(root.slides[1], 1)
  secondFrame.overlay.dispatchEvent(new Event("click", { cancelable: true }))
  await flushMicrotasks()
  const secondPlayer = players.get(secondFrame.embed)
  secondPlayer.emit("ready")
  secondPlayer.emit("playing")

  observer.emit(root.slides[1], 0)
  observer.emit(root.slides[0], 1)
  assert.equal(firstFrame.overlay.hidden, true)
  assert.equal(secondFrame.overlay.hidden, true)

  const firstPausesBeforeSurfaceReplay = firstPlayer.pauseCalls
  assert.equal(firstPlayer.options.clickToPlay, true)
  const surfaceReplayAllowed = firstPlayer.options.listeners.play()
  assert.notEqual(surfaceReplayAllowed, false)
  firstPlayer.play()
  firstPlayer.emit("playing")
  firstPlayer.currentTime = 1
  firstPlayer.emit("timeupdate")

  assert.equal(firstPlayer.playing, true)
  assert.equal(firstPlayer.pauseCalls, firstPausesBeforeSurfaceReplay)
  assert.equal(firstFrame.status.textContent, "")

  cleanup()
})
