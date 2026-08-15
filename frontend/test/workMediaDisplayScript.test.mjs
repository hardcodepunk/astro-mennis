import assert from "node:assert/strict"
import test from "node:test"

const youtubeState = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
}

class FakeClassList {
  values = new Set()

  constructor(...values) {
    values.filter(Boolean).forEach(value => this.values.add(value))
  }

  add(...values) {
    values.forEach(value => this.values.add(value))
  }

  remove(...values) {
    values.forEach(value => this.values.delete(value))
  }

  contains(value) {
    return this.values.has(value)
  }

  toggle(value, force) {
    const enabled = force ?? !this.values.has(value)
    if (enabled) this.values.add(value)
    else this.values.delete(value)
    return enabled
  }
}

class FakeElement extends EventTarget {
  attributes = new Map()
  children = []
  classList = new FakeClassList()
  dataset = {}
  _hidden = false
  parentElement = null
  style = {}
  textContent = ""
  frame = null

  constructor(name = "element") {
    super()
    this.name = name
    this.tagName = name.toUpperCase()
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

  append(...nodes) {
    for (const node of nodes) {
      node.remove?.()
      node.parentElement = this
      node.frame = node.frame ?? this.frame
      this.children.push(node)
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentElement = null
    this.children = []
    this.append(...nodes)
  }

  remove() {
    if (!this.parentElement) return
    const index = this.parentElement.children.indexOf(this)
    if (index >= 0) this.parentElement.children.splice(index, 1)
    this.parentElement = null
  }

  closest(selector) {
    if (selector === "[data-yt-frame]" && this.frame) return this.frame
    if (selector === "[data-yt-embed]" && this.dataset.ytVideoId) return this
    return this.parentElement?.closest(selector) ?? null
  }

  contains(node) {
    return node === this || this.children.some(child => child.contains(node))
  }

  querySelector(selector) {
    if (selector === "iframe") {
      return this.children.find(child => child.name === "iframe") ?? null
    }
    return null
  }

  querySelectorAll() {
    return []
  }

  focus() {
    if (!this.hidden && !this.hasAttribute("inert")) fakeDocument.activeElement = this
  }
}

class FakeFrame extends FakeElement {
  constructor(label, videoId = "dQw4w9WgXcQ") {
    super("frame")
    this.overlay = new FakeElement("button")
    this.status = new FakeElement("status")
    this.retry = new FakeElement("button")
    this.embed = new FakeElement("div")

    this.retry.hidden = true
    this.embed.dataset.ytTitle = label
    this.embed.dataset.ytRatio = "9:16"
    this.embed.dataset.ytVideoId = videoId
    this.embed.setAttribute("inert", "")
    this.embed.setAttribute("aria-hidden", "true")

    for (const element of [this.overlay, this.status, this.retry, this.embed]) {
      element.frame = this
      element.parentElement = this
      this.children.push(element)
    }
  }

  get iframe() {
    return this.embed.querySelector("iframe")
  }

  querySelector(selector) {
    if (selector === "[data-yt-overlay]") return this.overlay
    if (selector === "[data-yt-status]") return this.status
    if (selector === "[data-yt-retry]") return this.retry
    if (selector === "[data-yt-embed]") return this.embed
    if (selector === "iframe") return this.iframe
    return null
  }
}

class FakeSlide extends FakeElement {
  constructor(frame, title = "") {
    super("article")
    this.frame = frame
    this.title = new FakeElement("h2")
    this.title.textContent = title
  }

  querySelector(selector) {
    if (selector === "[data-yt-frame]") return this.frame
    if (selector === ".yt-slide__title") return this.title
    return null
  }

  getBoundingClientRect() {
    return { width: 320 }
  }
}

class FakeRail extends FakeElement {
  clientWidth = 320
  scrollLeft = 0
  scrollToCalls = []

  constructor(slides, { landscape = false } = {}) {
    super("rail")
    this.slides = slides
    this.scrollWidth = slides.length * 320 + Math.max(0, slides.length - 1) * 18
    this.classList = new FakeClassList(landscape ? "yt-rail--landscape" : "")
  }

  querySelector(selector) {
    return selector === "[data-yt-slide]" ? (this.slides[0] ?? null) : null
  }

  scrollBy({ left }) {
    const max = Math.max(0, this.scrollWidth - this.clientWidth)
    this.scrollLeft = Math.min(max, Math.max(0, this.scrollLeft + left))
  }

  scrollTo(options) {
    this.scrollToCalls.push({ ...options })
    const max = Math.max(0, this.scrollWidth - this.clientWidth)
    this.scrollLeft = Math.min(max, Math.max(0, options.left))
  }
}

class FakeRoot extends FakeElement {
  constructor(
    frames,
    { withRail = false, withNav = false, withPagination = false, landscape = false } = {},
  ) {
    super("root")
    this.frames = frames
    this.slides = frames.map((frame, index) => new FakeSlide(frame, `Cut ${index + 1}`))
    this.rail = withRail ? new FakeRail(this.slides, { landscape }) : null
    this.prev = withNav ? new FakeElement("button") : null
    this.next = withNav ? new FakeElement("button") : null
    this.dots = withPagination ? frames.map(() => new FakeElement("button")) : []
    this.paginationStatus = withPagination ? new FakeElement("p") : null
  }

  querySelectorAll(selector) {
    if (selector === "[data-yt-embed]") return this.frames.map(frame => frame.embed)
    if (selector === "[data-yt-slide]") return this.slides
    if (selector === "[data-yt-dot]") return this.dots
    return []
  }

  querySelector(selector) {
    if (selector === "[data-yt-rail]") return this.rail
    if (selector === "[data-yt-prev]") return this.prev
    if (selector === "[data-yt-next]") return this.next
    if (selector === "[data-yt-pagination-status]") return this.paginationStatus
    return null
  }
}

class FakeDocument extends EventTarget {
  activeElement = null
  readyState = "loading"
  documentElement = new FakeElement("html")
  body = new FakeElement("body")
  head = new FakeElement("head")

  constructor() {
    super()
    this.activeElement = this.body
  }

  createElement(name) {
    return new FakeElement(name)
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
  location = new URL("https://example.test/projects/demo")
  nextAnimationFrameId = 1
  animationFrames = new Map()
  nextTimeoutId = 1
  reduceMotion = false
  timeouts = new Map()

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
  resetAsync() {
    this.timeouts.clear()
    this.animationFrames.clear()
    this.reduceMotion = false
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
  matchMedia(query) {
    return {
      matches: query === "(prefers-reduced-motion: reduce)" && this.reduceMotion,
    }
  }
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

class FakeNativePlayer {
  state = youtubeState.unstarted
  currentTime = 0
  duration = 60
  playCalls = 0
  pauseCalls = 0
  destroyCalls = 0

  constructor(iframe, options) {
    this.iframe = iframe
    this.options = options
  }

  playVideo() {
    this.playCalls += 1
  }

  pauseVideo() {
    this.pauseCalls += 1
    this.state = youtubeState.paused
  }

  destroy() {
    this.destroyCalls += 1
    this.iframe.remove()
  }

  getPlayerState() {
    return this.state
  }

  getCurrentTime() {
    return this.currentTime
  }

  getDuration() {
    return this.duration
  }

  getIframe() {
    return this.iframe
  }

  emitReady(target = this) {
    this.options.events.onReady({ target })
  }

  emitState(state, target = this) {
    this.state = state
    this.options.events.onStateChange({ target, data: state })
  }

  emitError(code, target = this) {
    this.options.events.onError({ target, data: code })
  }

  emitAutoplayBlocked(target = this) {
    this.options.events.onAutoplayBlocked({ target })
  }
}

const fakeDocument = new FakeDocument()
const fakeWindow = new FakeWindow()
fakeWindow.document = fakeDocument

Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument })
Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow })
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { maxTouchPoints: 1, platform: "iPhone", userAgent: "Mobile Safari" },
})
Object.defineProperty(globalThis, "Element", { configurable: true, value: FakeElement })
Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: FakeElement })
Object.defineProperty(globalThis, "HTMLIFrameElement", { configurable: true, value: FakeElement })
Object.defineProperty(globalThis, "Node", { configurable: true, value: FakeElement })
Object.defineProperty(globalThis, "IntersectionObserver", {
  configurable: true,
  value: FakeIntersectionObserver,
})
Object.defineProperty(globalThis, "getComputedStyle", {
  configurable: true,
  value: () => ({ gap: "18px" }),
})

const { initWorkMediaRoot } = await import("../src/scripts/workMediaDisplayScript.ts")

const flushMicrotasks = async () => {
  await new Promise(resolve => queueMicrotask(resolve))
  await new Promise(resolve => queueMicrotask(resolve))
}

const click = element => {
  element.dispatchEvent(new Event("click", { cancelable: true }))
}

const createRuntime = ({ loadYouTubeApi = () => Promise.resolve() } = {}) => {
  const players = []
  const calls = []
  return {
    players,
    calls,
    loadYouTubeApi,
    createPlayer(iframe, options) {
      const player = new FakeNativePlayer(iframe, options)
      players.push(player)
      calls.push({ iframe, options })
      return player
    },
  }
}

test("native YouTube uses a no-cookie iframe with normal controls and transfers focus", async () => {
  fakeWindow.resetAsync()
  const frame = new FakeFrame("project film", "aqz-KE-bpKQ")
  const root = new FakeRoot([frame])
  const runtime = createRuntime()
  const cleanup = initWorkMediaRoot(root, runtime)
  assert.equal(frame.dataset.ytFeedbackState, "idle")

  frame.overlay.focus()
  click(frame.overlay)
  await flushMicrotasks()
  assert.equal(frame.dataset.ytFeedbackState, "loading")

  assert.equal(runtime.players.length, 1)
  const player = runtime.players[0]
  const iframe = player.getIframe()
  const iframeUrl = new URL(iframe.src)
  assert.equal(iframeUrl.origin, "https://www.youtube-nocookie.com")
  assert.equal(iframeUrl.pathname, "/embed/aqz-KE-bpKQ")
  assert.equal(iframeUrl.searchParams.get("controls"), "1")
  assert.equal(iframeUrl.searchParams.get("playsinline"), "1")
  assert.equal(iframeUrl.searchParams.get("enablejsapi"), "1")
  assert.equal(iframeUrl.searchParams.get("rel"), "0")
  assert.equal(iframeUrl.searchParams.get("origin"), "https://example.test")
  assert.equal(iframeUrl.searchParams.get("widget_referrer"), "https://example.test")
  assert.equal(iframe.title, "project film")
  assert.match(iframe.allow, /autoplay/)
  assert.equal(iframe.allowFullscreen, true)
  assert.equal(iframe.referrerPolicy, "strict-origin-when-cross-origin")
  assert.equal(frame.overlay.getAttribute("aria-busy"), "true")

  player.emitReady()

  assert.equal(frame.overlay.hidden, true)
  assert.equal(frame.embed.hasAttribute("inert"), false)
  assert.equal(iframe.hasAttribute("inert"), false)
  assert.equal(fakeDocument.activeElement, iframe)
  assert.equal(player.playCalls, 1)

  player.emitState(youtubeState.playing)
  assert.equal(frame.status.textContent, "")
  assert.equal(frame.dataset.ytFeedbackState, "playing")
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)

  cleanup()
})

test("only the latest facade request is allowed to activate", async () => {
  fakeWindow.resetAsync()
  const firstFrame = new FakeFrame("video 1 of 2", "first-video")
  const secondFrame = new FakeFrame("video 2 of 2", "second-video")
  const root = new FakeRoot([firstFrame, secondFrame])
  const runtime = createRuntime()
  const cleanup = initWorkMediaRoot(root, runtime)

  firstFrame.overlay.focus()
  click(firstFrame.overlay)
  await flushMicrotasks()
  const firstPlayer = runtime.players[0]

  secondFrame.overlay.focus()
  click(secondFrame.overlay)
  await flushMicrotasks()
  const secondPlayer = runtime.players[1]

  firstPlayer.emitReady()
  assert.equal(firstPlayer.playCalls, 0)
  assert.equal(firstFrame.overlay.hidden, false)
  assert.equal(firstFrame.embed.hasAttribute("inert"), true)

  secondPlayer.emitReady()
  assert.equal(secondPlayer.playCalls, 1)
  assert.equal(secondFrame.overlay.hidden, true)
  assert.equal(fakeDocument.activeElement, secondPlayer.getIframe())

  secondPlayer.emitState(youtubeState.playing)
  firstPlayer.emitState(youtubeState.buffering)
  assert.equal(secondPlayer.pauseCalls, 0)

  cleanup()
})

test("only a focused visible native replay can take ownership after switching", async () => {
  fakeWindow.resetAsync()
  const firstFrame = new FakeFrame("video 1 of 2", "first-video")
  const secondFrame = new FakeFrame("video 2 of 2", "second-video")
  const root = new FakeRoot([firstFrame, secondFrame], { withRail: true })
  const runtime = createRuntime()
  const cleanup = initWorkMediaRoot(root, runtime)
  const observer = FakeIntersectionObserver.instances.at(-1)

  observer.emit(root.slides[0], 1)
  observer.emit(root.slides[1], 0)
  click(firstFrame.overlay)
  await flushMicrotasks()
  const firstPlayer = runtime.players[0]
  firstPlayer.emitReady()
  firstPlayer.emitState(youtubeState.playing)

  observer.emit(root.slides[0], 0)
  observer.emit(root.slides[1], 1)
  click(secondFrame.overlay)
  await flushMicrotasks()
  const secondPlayer = runtime.players[1]
  secondPlayer.emitReady()
  secondPlayer.emitState(youtubeState.playing)

  // Intersection callbacks can report the arriving slide before the departing one.
  // A stale PLAYING event from the newly visible, non-winning player must not
  // steal ownership unless focus proves the visitor used its native controls.
  observer.emit(root.slides[0], 1)
  const firstPausesBeforeReplay = firstPlayer.pauseCalls
  const secondPausesBeforeReplay = secondPlayer.pauseCalls
  firstPlayer.emitState(youtubeState.playing)

  assert.equal(firstPlayer.pauseCalls, firstPausesBeforeReplay + 1)
  assert.equal(secondPlayer.pauseCalls, secondPausesBeforeReplay)

  // No PAUSED provider event is emitted between the rejected stale signal and
  // this real replay gesture, preserving the original return-to-slide flow.
  firstPlayer.getIframe().focus()
  firstPlayer.emitState(youtubeState.playing)

  assert.equal(firstPlayer.pauseCalls, firstPausesBeforeReplay + 1)
  assert.equal(secondPlayer.pauseCalls, secondPausesBeforeReplay + 1)
  assert.equal(firstFrame.overlay.hidden, true)
  assert.equal(firstFrame.status.textContent, "")

  cleanup()
})

test("a hidden native PLAYING event is rejected", async () => {
  fakeWindow.resetAsync()
  const firstFrame = new FakeFrame("video 1 of 2", "first-video")
  const secondFrame = new FakeFrame("video 2 of 2", "second-video")
  const root = new FakeRoot([firstFrame, secondFrame], { withRail: true })
  const runtime = createRuntime()
  const cleanup = initWorkMediaRoot(root, runtime)
  const observer = FakeIntersectionObserver.instances.at(-1)

  observer.emit(root.slides[0], 1)
  observer.emit(root.slides[1], 0)
  click(firstFrame.overlay)
  await flushMicrotasks()
  const firstPlayer = runtime.players[0]
  firstPlayer.emitReady()
  firstPlayer.emitState(youtubeState.playing)

  observer.emit(root.slides[0], 0)
  const pausesBeforeHiddenPlay = firstPlayer.pauseCalls
  firstPlayer.emitState(youtubeState.playing)

  assert.equal(firstPlayer.pauseCalls, pausesBeforeHiddenPlay + 1)
  assert.equal(firstFrame.status.textContent, "")
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)

  cleanup()
})

test("autoplay blocking leaves the consumed native player ready for one-tap playback", async () => {
  fakeWindow.resetAsync()
  const frame = new FakeFrame("project film")
  const root = new FakeRoot([frame])
  const runtime = createRuntime()
  const cleanup = initWorkMediaRoot(root, runtime)

  frame.overlay.focus()
  click(frame.overlay)
  await flushMicrotasks()
  const player = runtime.players[0]
  player.emitReady()
  player.emitAutoplayBlocked()

  assert.equal(frame.overlay.hidden, true)
  assert.equal(frame.embed.hasAttribute("inert"), false)
  assert.equal(player.getIframe().hasAttribute("inert"), false)
  assert.equal(frame.status.textContent, "Ready: project film. Press Play to start.")
  assert.equal(frame.dataset.ytFeedbackState, "ready")
  assert.equal(fakeDocument.activeElement, player.getIframe())
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)

  cleanup()
})

test("native BUFFERING acknowledges initial playback without a later forced pause", async () => {
  fakeWindow.resetAsync()
  const frame = new FakeFrame("project film")
  const root = new FakeRoot([frame])
  const runtime = createRuntime()
  const cleanup = initWorkMediaRoot(root, runtime)

  click(frame.overlay)
  await flushMicrotasks()
  const player = runtime.players[0]
  player.emitReady()
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 1)

  player.emitState(youtubeState.buffering)
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)
  const pausesAfterBuffering = player.pauseCalls

  fakeWindow.flushTimeouts(4_000)
  assert.equal(player.pauseCalls, pausesAfterBuffering)
  assert.equal(frame.overlay.hidden, true)
  assert.equal(frame.embed.hasAttribute("inert"), false)

  cleanup()
})

test("an API load failure exposes a focus-preserving retry", async () => {
  fakeWindow.resetAsync()
  const frame = new FakeFrame("project film")
  const root = new FakeRoot([frame])
  let loadAttempts = 0
  const runtime = createRuntime({
    loadYouTubeApi() {
      loadAttempts += 1
      return loadAttempts === 1 ? Promise.reject(new Error("offline")) : Promise.resolve()
    },
  })
  const originalWarn = console.warn
  console.warn = () => undefined
  let cleanup

  try {
    cleanup = initWorkMediaRoot(root, runtime)
    frame.overlay.focus()
    click(frame.overlay)
    await flushMicrotasks()

    assert.equal(frame.retry.hidden, false)
    assert.equal(frame.overlay.hidden, false)
    assert.equal(frame.dataset.ytFeedbackState, "error")
    assert.equal(frame.status.textContent, "Could not load project film. Retry.")
    assert.equal(fakeDocument.activeElement, frame.retry)

    click(frame.retry)
    await flushMicrotasks()
    assert.equal(loadAttempts, 2)
    assert.equal(runtime.players.length, 1)

    const player = runtime.players[0]
    player.emitReady()
    assert.equal(frame.retry.hidden, true)
    assert.equal(fakeDocument.activeElement, player.getIframe())
  } finally {
    cleanup?.()
    console.warn = originalWarn
  }
})

test("a readiness timeout recreates the player and ignores stale ready", async () => {
  fakeWindow.resetAsync()
  const frame = new FakeFrame("project film")
  const root = new FakeRoot([frame])
  const runtime = createRuntime()
  const originalWarn = console.warn
  console.warn = () => undefined
  let cleanup

  try {
    cleanup = initWorkMediaRoot(root, runtime)
    frame.overlay.focus()
    click(frame.overlay)
    await flushMicrotasks()
    const stalePlayer = runtime.players[0]
    assert.equal(fakeWindow.pendingTimeoutCount(15_000), 1)

    fakeWindow.flushTimeouts(15_000)
    assert.equal(stalePlayer.destroyCalls, 1)
    assert.equal(frame.iframe, null)
    assert.equal(frame.embed.hasAttribute("inert"), true)
    assert.equal(frame.embed.getAttribute("aria-hidden"), "true")
    assert.equal(frame.overlay.hidden, false)
    assert.equal(frame.dataset.ytFeedbackState, "error")
    assert.equal(frame.retry.hidden, false)
    assert.equal(frame.querySelector("[data-yt-fallback]"), null)
    assert.equal(frame.status.textContent, "Could not load project film. Retry.")
    assert.equal(fakeDocument.activeElement, frame.retry)

    click(frame.retry)
    await flushMicrotasks()
    const currentPlayer = runtime.players[1]
    assert.notEqual(currentPlayer, stalePlayer)
    stalePlayer.emitReady()
    assert.equal(stalePlayer.playCalls, 0)
    assert.equal(currentPlayer.playCalls, 0)

    currentPlayer.emitReady()
    assert.equal(currentPlayer.playCalls, 1)
    assert.equal(frame.overlay.hidden, true)
    assert.equal(fakeDocument.activeElement, currentPlayer.getIframe())
  } finally {
    cleanup?.()
    console.warn = originalWarn
  }
})

test("known provider errors keep native UI while unknown errors restore Retry and poster", async () => {
  fakeWindow.resetAsync()
  const unavailableFrame = new FakeFrame("unavailable film", "removed-video")
  const retryableFrame = new FakeFrame("retryable film", "temporary-error")
  const root = new FakeRoot([unavailableFrame, retryableFrame])
  const runtime = createRuntime()
  const originalWarn = console.warn
  console.warn = () => undefined
  let cleanup

  try {
    cleanup = initWorkMediaRoot(root, runtime)
    unavailableFrame.overlay.focus()
    click(unavailableFrame.overlay)
    await flushMicrotasks()
    const unavailablePlayer = runtime.players[0]
    unavailablePlayer.emitReady()
    const unavailableIframe = unavailablePlayer.getIframe()
    unavailablePlayer.emitError(100)

    assert.equal(unavailablePlayer.destroyCalls, 0)
    assert.equal(unavailableFrame.iframe, unavailableIframe)
    assert.equal(unavailableIframe.parentElement, unavailableFrame.embed)
    assert.equal(unavailableFrame.embed.hasAttribute("inert"), false)
    assert.equal(unavailableFrame.embed.hasAttribute("aria-hidden"), false)
    assert.equal(unavailableIframe.hasAttribute("inert"), false)
    assert.equal(unavailableIframe.hasAttribute("aria-hidden"), false)
    assert.equal(unavailableFrame.overlay.hidden, true)
    assert.equal(unavailableFrame.overlay.getAttribute("aria-disabled"), "true")
    assert.equal(unavailableFrame.overlay.getAttribute("tabindex"), "-1")
    assert.equal(unavailableFrame.dataset.ytFeedbackState, "unavailable")
    assert.equal(unavailableFrame.retry.hidden, true)
    assert.equal(unavailableFrame.querySelector("[data-yt-fallback]"), null)
    assert.equal(unavailableFrame.status.textContent, "YouTube could not play unavailable film.")
    assert.equal(fakeDocument.activeElement, unavailableIframe)

    unavailablePlayer.emitReady()
    assert.equal(unavailableFrame.iframe, unavailableIframe)
    assert.equal(unavailableFrame.embed.hasAttribute("inert"), false)
    assert.equal(unavailableIframe.hasAttribute("inert"), false)
    assert.equal(unavailableFrame.overlay.hidden, true)
    assert.equal(unavailableFrame.dataset.ytFeedbackState, "unavailable")
    assert.equal(unavailableFrame.status.textContent, "YouTube could not play unavailable film.")
    assert.equal(fakeDocument.activeElement, unavailableIframe)

    unavailablePlayer.emitAutoplayBlocked()
    assert.equal(unavailableFrame.iframe, unavailableIframe)
    assert.equal(unavailableFrame.embed.hasAttribute("inert"), false)
    assert.equal(unavailableIframe.hasAttribute("inert"), false)
    assert.equal(unavailableFrame.overlay.hidden, true)
    assert.equal(unavailableFrame.dataset.ytFeedbackState, "unavailable")
    assert.equal(unavailableFrame.status.textContent, "YouTube could not play unavailable film.")
    assert.equal(fakeDocument.activeElement, unavailableIframe)

    retryableFrame.overlay.focus()
    click(retryableFrame.overlay)
    await flushMicrotasks()
    const retryablePlayer = runtime.players[1]
    retryablePlayer.emitReady()
    retryablePlayer.emitError(999)

    assert.equal(retryablePlayer.destroyCalls, 1)
    assert.equal(retryableFrame.iframe, null)
    assert.equal(retryableFrame.embed.hasAttribute("inert"), true)
    assert.equal(retryableFrame.embed.getAttribute("aria-hidden"), "true")
    assert.equal(retryableFrame.overlay.hidden, false)
    assert.equal(retryableFrame.overlay.getAttribute("tabindex"), null)
    assert.equal(retryableFrame.dataset.ytFeedbackState, "error")
    assert.equal(retryableFrame.retry.hidden, false)
    assert.equal(retryableFrame.querySelector("[data-yt-fallback]"), null)
    assert.equal(retryableFrame.status.textContent, "Could not load retryable film. Retry.")
    assert.equal(fakeDocument.activeElement, retryableFrame.retry)
  } finally {
    cleanup?.()
    console.warn = originalWarn
  }
})

test("leaving the visibility threshold pauses native playback without loading feedback", async () => {
  fakeWindow.resetAsync()
  const frame = new FakeFrame("reel 1 of 1")
  const root = new FakeRoot([frame], { withRail: true })
  const runtime = createRuntime()
  const cleanup = initWorkMediaRoot(root, runtime)
  const observer = FakeIntersectionObserver.instances.at(-1)

  observer.emit(root.slides[0], 1)
  click(frame.overlay)
  await flushMicrotasks()
  const player = runtime.players[0]
  player.emitReady()
  player.emitState(youtubeState.playing)
  const pauseCallsBeforeLeaving = player.pauseCalls

  observer.emit(root.slides[0], 0.5)

  assert.equal(player.pauseCalls, pauseCallsBeforeLeaving + 1)
  assert.equal(frame.status.textContent, "")
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)

  cleanup()
})

test("an activated reel locks below 70% visibility and unlocks when it returns", async () => {
  fakeWindow.resetAsync()
  const frame = new FakeFrame("reel 1 of 1")
  const root = new FakeRoot([frame], { withRail: true })
  const runtime = createRuntime()
  const cleanup = initWorkMediaRoot(root, runtime)
  const observer = FakeIntersectionObserver.instances.at(-1)

  observer.emit(root.slides[0], 1)
  click(frame.overlay)
  await flushMicrotasks()
  const player = runtime.players[0]
  player.emitReady()
  player.emitState(youtubeState.playing)
  const iframe = player.getIframe()

  assert.equal(frame.embed.hasAttribute("inert"), false)
  assert.equal(iframe.hasAttribute("inert"), false)

  observer.emit(root.slides[0], 0.69)
  assert.equal(frame.embed.hasAttribute("inert"), true)
  assert.equal(frame.embed.getAttribute("aria-hidden"), "true")
  assert.equal(iframe.hasAttribute("inert"), true)
  assert.equal(iframe.getAttribute("aria-hidden"), "true")

  observer.emit(root.slides[0], 0.7)
  assert.equal(frame.embed.hasAttribute("inert"), false)
  assert.equal(frame.embed.hasAttribute("aria-hidden"), false)
  assert.equal(iframe.hasAttribute("inert"), false)
  assert.equal(iframe.hasAttribute("aria-hidden"), false)

  cleanup()
})

test("ready activation below 70% stays locked and unlocks without stealing focus", async () => {
  fakeWindow.resetAsync()
  const frame = new FakeFrame("reel 1 of 1")
  const root = new FakeRoot([frame], { withRail: true })
  const runtime = createRuntime()
  const cleanup = initWorkMediaRoot(root, runtime)
  const observer = FakeIntersectionObserver.instances.at(-1)

  observer.emit(root.slides[0], 0.5)
  frame.overlay.focus()
  click(frame.overlay)
  await flushMicrotasks()
  const player = runtime.players[0]
  const iframe = player.getIframe()
  player.emitReady()

  assert.equal(frame.overlay.hidden, true)
  assert.equal(frame.embed.hasAttribute("inert"), true)
  assert.equal(frame.embed.getAttribute("aria-hidden"), "true")
  assert.equal(iframe.hasAttribute("inert"), true)
  assert.equal(iframe.getAttribute("aria-hidden"), "true")
  assert.notEqual(fakeDocument.activeElement, iframe)
  assert.equal(player.playCalls, 0)

  observer.emit(root.slides[0], 0.7)
  assert.equal(frame.embed.hasAttribute("inert"), false)
  assert.equal(frame.embed.hasAttribute("aria-hidden"), false)
  assert.equal(iframe.hasAttribute("inert"), false)
  assert.equal(iframe.hasAttribute("aria-hidden"), false)
  assert.notEqual(fakeDocument.activeElement, iframe)

  cleanup()
})

test("landscape navigation and dots follow the active slide before the final scroll pixels", () => {
  fakeWindow.resetAsync()
  const root = new FakeRoot(
    [new FakeFrame("video 1 of 2"), new FakeFrame("video 2 of 2")],
    { withRail: true, withNav: true, withPagination: true, landscape: true },
  )
  const cleanup = initWorkMediaRoot(root)

  assert.equal(root.prev.hidden, true)
  assert.equal(root.next.hidden, false)
  assert.equal(root.dots[0].classList.contains("is-active"), true)
  assert.equal(root.dots[1].classList.contains("is-active"), false)
  assert.equal(root.paginationStatus.textContent, "Video 1 of 2: Cut 1")

  root.next.focus()
  root.rail.scrollLeft = 200
  root.rail.dispatchEvent(new Event("scroll"))
  assert.equal(root.prev.hidden, false)
  assert.equal(root.next.hidden, true)
  assert.equal(fakeDocument.activeElement, root.prev)
  assert.equal(root.dots[0].classList.contains("is-active"), false)
  assert.equal(root.dots[1].classList.contains("is-active"), true)
  assert.equal(root.paginationStatus.textContent, "Video 2 of 2: Cut 2")

  root.rail.scrollLeft = 100
  root.rail.dispatchEvent(new Event("scroll"))
  assert.equal(root.prev.hidden, true)
  assert.equal(root.next.hidden, false)
  assert.equal(fakeDocument.activeElement, root.next)

  cleanup()
})

test("pagination dots jump directly to a slide and keep focus while scroll state catches up", () => {
  fakeWindow.resetAsync()
  const root = new FakeRoot(
    [
      new FakeFrame("video 1 of 3"),
      new FakeFrame("video 2 of 3"),
      new FakeFrame("video 3 of 3"),
    ],
    { withRail: true, withNav: true, withPagination: true, landscape: true },
  )
  const cleanup = initWorkMediaRoot(root)

  assert.equal(root.dots[0].classList.contains("is-active"), true)
  assert.equal(root.dots[0].getAttribute("aria-current"), "true")
  assert.equal(root.dots[1].hasAttribute("aria-current"), false)
  assert.equal(root.dots[2].hasAttribute("aria-current"), false)

  root.dots[2].focus()
  click(root.dots[2])

  assert.deepEqual(root.rail.scrollToCalls, [{ left: 676, behavior: "smooth" }])
  assert.equal(fakeDocument.activeElement, root.dots[2])

  root.rail.dispatchEvent(new Event("scroll"))
  assert.equal(root.dots[0].classList.contains("is-active"), false)
  assert.equal(root.dots[0].hasAttribute("aria-current"), false)
  assert.equal(root.dots[2].classList.contains("is-active"), true)
  assert.equal(root.dots[2].getAttribute("aria-current"), "true")
  assert.equal(root.paginationStatus.textContent, "Video 3 of 3: Cut 3")
  assert.equal(fakeDocument.activeElement, root.dots[2])

  cleanup()
  const scrollCallsAfterCleanup = root.rail.scrollToCalls.length
  click(root.dots[0])
  assert.equal(root.rail.scrollToCalls.length, scrollCallsAfterCleanup)
})

test("pagination dots use instant scrolling when reduced motion is requested", () => {
  fakeWindow.resetAsync()
  fakeWindow.reduceMotion = true
  const root = new FakeRoot(
    [new FakeFrame("video 1 of 2"), new FakeFrame("video 2 of 2")],
    { withRail: true, withPagination: true, landscape: true },
  )
  const cleanup = initWorkMediaRoot(root)

  root.dots[1].focus()
  click(root.dots[1])

  assert.deepEqual(root.rail.scrollToCalls, [{ left: 338, behavior: "auto" }])
  assert.equal(fakeDocument.activeElement, root.dots[1])

  cleanup()
})

test("Astro cleanup destroys native players, timers, and activation listeners", async () => {
  fakeWindow.resetAsync()
  const frame = new FakeFrame("project film")
  const root = new FakeRoot([frame])
  const runtime = createRuntime()

  initWorkMediaRoot(root, runtime)
  click(frame.overlay)
  await flushMicrotasks()
  const player = runtime.players[0]
  player.emitReady()
  player.emitState(youtubeState.playing)

  fakeDocument.dispatchEvent(new Event("astro:before-swap"))

  assert.equal(player.destroyCalls, 1)
  assert.equal(root.dataset.workHeroInited, undefined)
  assert.equal(frame.dataset.ytFeedbackState, undefined)
  assert.equal(frame.overlay.getAttribute("tabindex"), null)
  assert.equal(fakeWindow.pendingTimeoutCount(4_000), 0)
  assert.equal(fakeWindow.pendingTimeoutCount(15_000), 0)

  click(frame.overlay)
  await flushMicrotasks()
  assert.equal(runtime.players.length, 1)
})
