const MAX_AUTOPLAY_ATTEMPTS = 6
const MAX_THUMBNAIL_PLAYERS = 2
const THUMBNAIL_PLAY_THRESHOLD = 0.25

let didInitAutoplayScripts = false

function prepareVideo(video: HTMLVideoElement) {
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.setAttribute("muted", "")
  video.setAttribute("playsinline", "")
  video.setAttribute("webkit-playsinline", "")
}

function makeAutoplayController(
  video: HTMLVideoElement,
  callbacks: {
    hydrate?: () => void
    onPlay?: () => void
    onStop?: () => void
    maxAttempts?: number
    resetOnStop?: boolean
  } = {},
) {
  let startRequested = false
  let retryScheduled = false
  let requestGeneration = 0
  let playPendingGeneration: number | undefined
  let retryCleanup: (() => void) | undefined
  let didMarkPlaying = false
  let attempts = 0

  const {
    hydrate,
    onPlay,
    onStop,
    maxAttempts = MAX_AUTOPLAY_ATTEMPTS,
    resetOnStop = false,
  } = callbacks

  const clearRetry = () => {
    const cleanup = retryCleanup
    retryCleanup = undefined
    retryScheduled = false
    cleanup?.()
  }

  const markPlaying = () => {
    if (!startRequested) return
    attempts = 0
    playPendingGeneration = undefined
    clearRetry()
    if (!didMarkPlaying) {
      didMarkPlaying = true
      onPlay?.()
    }
  }

  const scheduleRetry = (generation: number) => {
    if (!startRequested || generation !== requestGeneration) return
    if (attempts >= maxAttempts) return
    if (retryScheduled) return

    attempts += 1
    retryScheduled = true
    const delay = video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ? 180 : 600
    const retry = () => {
      clearRetry()
      if (!startRequested || generation !== requestGeneration) return
      tryStart(generation)
    }
    const timer = window.setTimeout(retry, delay)

    retryCleanup = () => {
      window.clearTimeout(timer)
      video.removeEventListener("loadeddata", retry)
      video.removeEventListener("canplay", retry)
    }

    video.addEventListener("loadeddata", retry)
    video.addEventListener("canplay", retry)
  }

  const tryStart = (generation: number) => {
    if (!startRequested || generation !== requestGeneration) return
    if (!document.body.contains(video)) return

    hydrate?.()
    prepareVideo(video)

    if (!video.paused && !video.ended) {
      markPlaying()
      return
    }

    if (playPendingGeneration === generation) return
    playPendingGeneration = generation
    video.play().then(() => {
      if (playPendingGeneration === generation) playPendingGeneration = undefined
      if (!startRequested || generation !== requestGeneration) return
      markPlaying()
    }).catch(() => {
      if (playPendingGeneration === generation) playPendingGeneration = undefined
      scheduleRetry(generation)
    })
  }

  video.addEventListener("playing", markPlaying)
  video.addEventListener("play", markPlaying)

  return {
    start() {
      if (startRequested) {
        tryStart(requestGeneration)
        return
      }

      startRequested = true
      requestGeneration += 1
      didMarkPlaying = false
      attempts = 0
      const generation = requestGeneration
      tryStart(generation)
      window.setTimeout(() => tryStart(generation), 120)
    },

    stop() {
      startRequested = false
      requestGeneration += 1
      playPendingGeneration = undefined
      didMarkPlaying = false
      attempts = 0
      clearRetry()
      if (!video.paused) video.pause()
      if (resetOnStop) {
        try {
          video.currentTime = 0
        } catch {
          // ignore
        }
      }
      onStop?.()
    },

    startNow() {
      if (!startRequested) {
        startRequested = true
        requestGeneration += 1
        didMarkPlaying = false
        attempts = 0
      }
      tryStart(requestGeneration)
    },
  }
}

function attachHeroSources(video: HTMLVideoElement) {
  if (video.dataset.heroSourcesAttached === "1") return
  if (video.querySelector("source[src]")) return

  const webm = video.dataset.webm
  const mp4 = video.dataset.mp4
  if (!mp4 && !webm) return

  video.dataset.heroSourcesAttached = "1"

  if (mp4) {
    const source = document.createElement("source")
    source.src = mp4
    source.type = "video/mp4"
    video.append(source)
  }

  if (webm) {
    const source = document.createElement("source")
    source.src = webm
    source.type = "video/webm"
    video.append(source)
  }

  video.load()
}

function hydrateVideoSources(video: HTMLVideoElement) {
  const sources = Array.from(video.querySelectorAll("source[data-src]:not([src])")) as HTMLSourceElement[]
  if (!sources.length) return

  sources.forEach(source => {
    const src = source.getAttribute("data-src")
    if (!src) return
    source.src = src
  })

  video.load()
}

function unloadVideoSources(video: HTMLVideoElement) {
  const sources = Array.from(video.querySelectorAll("source[data-src][src]")) as HTMLSourceElement[]
  if (!sources.length) return

  sources.forEach(source => source.removeAttribute("src"))
  video.load()
}

const heroControllers = new WeakMap<HTMLElement, ReturnType<typeof makeAutoplayController>>()
const aboutControllers = new WeakMap<HTMLVideoElement, ReturnType<typeof makeAutoplayController>>()
const previewControllers = new WeakMap<HTMLVideoElement, ReturnType<typeof makeAutoplayController>>()
const thumbnailControllers = new WeakMap<HTMLElement, ReturnType<typeof makeAutoplayController>>()

function bindResumeListeners(start: () => void) {
  const abort = new AbortController()
  const startWhenVisible = () => {
    if (document.hidden) return
    start()
  }

  window.addEventListener("pageshow", startWhenVisible, { signal: abort.signal })
  window.addEventListener("focus", startWhenVisible, { signal: abort.signal })
  window.addEventListener("load", startWhenVisible, { signal: abort.signal })
  window.addEventListener("pointerdown", startWhenVisible, { passive: true, signal: abort.signal })
  window.addEventListener("touchstart", startWhenVisible, { passive: true, signal: abort.signal })
  window.addEventListener("keydown", startWhenVisible, { signal: abort.signal })
  document.addEventListener("visibilitychange", startWhenVisible, { signal: abort.signal })
  document.addEventListener("astro:before-swap", () => abort.abort(), { once: true, signal: abort.signal })
}

function isMotionAllowed() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function bootHeroVideos() {
  const roots = document.querySelectorAll<HTMLElement>(".vh-hero")

  roots.forEach(root => {
    if (!isMotionAllowed()) {
      root.dataset.reduced = "1"
      return
    }

    root.removeAttribute("data-reduced")

    const video = root.querySelector<HTMLVideoElement>("video")
    if (!video) return

    const minRevealMs = Number(root.getAttribute("data-min-reveal") || "600")
    const mountedAt = Date.now()

    let revealed = false

    const reveal = () => {
      if (revealed) return
      revealed = true
      const elapsed = Date.now() - mountedAt
      const delay = Math.max(0, minRevealMs - elapsed)
      window.setTimeout(() => {
        root.classList.add("is-revealed")
        root.classList.add("is-playing")
      }, delay)
    }

    const existing = heroControllers.get(root)
    const controller = existing ?? makeAutoplayController(video, {
      hydrate: () => attachHeroSources(video),
      onPlay: reveal,
      onStop: () => {
        root.classList.remove("is-playing")
      },
      maxAttempts: 8,
      resetOnStop: false,
    })

    if (!existing) {
      heroControllers.set(root, controller)
      bindResumeListeners(controller.start)
    }

    controller.start()
    window.setTimeout(() => controller.startNow(), 450)
  })
}

function bootVideoVideos() {
  if (!isMotionAllowed()) return

  const videos = document.querySelectorAll<HTMLVideoElement>("[data-about-autoplay-video]")
  videos.forEach(video => {
    const existing = aboutControllers.get(video)
    const controller = existing ?? makeAutoplayController(video, {
      maxAttempts: 8,
      resetOnStop: false,
    })

    if (!existing) {
      aboutControllers.set(video, controller)
      bindResumeListeners(controller.start)
    }

    controller.start()
    window.setTimeout(() => controller.startNow(), 120)
  })
}

function bootPreviewVideos() {
  if (!isMotionAllowed()) return

  const videos = document.querySelectorAll<HTMLVideoElement>("[data-preview-autoplay-video]")
  videos.forEach(video => {
    const existing = previewControllers.get(video)
    const controller = existing ?? makeAutoplayController(video, {
      maxAttempts: 8,
      resetOnStop: false,
      hydrate: () => {
        hydrateVideoSources(video)
      },
    })

    if (!existing) {
      previewControllers.set(video, controller)
      bindResumeListeners(controller.start)
    }

    controller.start()
    window.setTimeout(() => controller.startNow(), 240)
  })
}

type ThumbnailState = {
  item: HTMLElement
  container: HTMLElement
  video: HTMLVideoElement
  controller: ReturnType<typeof makeAutoplayController>
  autoplay: boolean
  index: number
  nearViewport: boolean
  proximityDistance: number
  visibleRatio: number
  interacting: boolean
}

type NetworkInformationLike = EventTarget & { saveData?: boolean }

type ThumbnailSession = {
  root: HTMLElement
  cleanup: () => void
  reconcile: () => void
  isCleaned: () => boolean
}

let thumbnailSession: ThumbnailSession | undefined

function getNetworkInformation() {
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection
}

function bootThumbnailVideos() {
  const items = Array.from(document.querySelectorAll<HTMLElement>("[data-thumbnail-card]"))
  if (!items.length) {
    thumbnailSession?.cleanup()
    thumbnailSession = undefined
    return
  }

  if (thumbnailSession?.root === items[0] && !thumbnailSession.isCleaned()) {
    thumbnailSession.reconcile()
    return
  }

  thumbnailSession?.cleanup()

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
  const desktopViewport = window.matchMedia("(min-width: 768px)")
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)")
  const connection = getNetworkInformation()

  const states = items.flatMap((item, index): ThumbnailState[] => {
    const container = item.querySelector<HTMLElement>("[data-thumbnail-video]")
    const video = container?.querySelector<HTMLVideoElement>("video")
    if (!container || !video) return []

    const existing = thumbnailControllers.get(item)
    const controller = existing ?? makeAutoplayController(video, {
      maxAttempts: 8,
      resetOnStop: true,
      hydrate: () => hydrateVideoSources(video),
      onPlay: () => container.classList.add("is-playing"),
      onStop: () => container.classList.remove("is-playing"),
    })
    if (!existing) thumbnailControllers.set(item, controller)

    return [{
      item,
      container,
      video,
      controller,
      autoplay: container.dataset.autoplay === "true",
      index,
      nearViewport: false,
      proximityDistance: Number.POSITIVE_INFINITY,
      visibleRatio: 0,
      interacting: false,
    }]
  })

  let proximityObserver: IntersectionObserver | undefined
  let visibilityObserver: IntersectionObserver | undefined
  let cleaned = false
  const listenerCleanups: Array<() => void> = []

  const listen = (
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, listener, options)
    listenerCleanups.push(() => target.removeEventListener(type, listener, options))
  }

  const mediaAllowed = () => !motionPreference.matches && connection?.saveData !== true

  const isWithinLoadMargin = (state: ThumbnailState) => {
    if (state.nearViewport) return true
    const rect = state.item.getBoundingClientRect()
    const margin = window.innerHeight * 0.5
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin
  }

  const stopState = (state: ThumbnailState, unload: boolean) => {
    state.video.autoplay = false
    state.controller.stop()
    if (!unload) return
    state.video.preload = "none"
    unloadVideoSources(state.video)
  }

  const startState = (state: ThumbnailState) => {
    prepareVideo(state.video)
    state.video.autoplay = true
    state.video.preload = "metadata"
    hydrateVideoSources(state.video)
    state.controller.start()
  }

  const reconcile = () => {
    if (cleaned) return

    if (!mediaAllowed() || document.hidden) {
      states.forEach(state => stopState(state, true))
      return
    }

    const playing = new Set(
      states
        .filter(state =>
          isWithinLoadMargin(state) &&
          (state.interacting || (state.autoplay && state.visibleRatio >= THUMBNAIL_PLAY_THRESHOLD)),
        )
        .sort((left, right) =>
          Number(right.interacting) - Number(left.interacting) ||
          right.visibleRatio - left.visibleRatio ||
          left.index - right.index,
        )
        .slice(0, MAX_THUMBNAIL_PLAYERS),
    )

    const hydrated = new Set(playing)
    if (hydrated.size < MAX_THUMBNAIL_PLAYERS) {
      states
        .filter(state => state.autoplay && state.nearViewport && !hydrated.has(state))
        .sort((left, right) =>
          left.proximityDistance - right.proximityDistance || left.index - right.index,
        )
        .slice(0, MAX_THUMBNAIL_PLAYERS - hydrated.size)
        .forEach(state => hydrated.add(state))
    }

    states.forEach(state => {
      if (playing.has(state)) {
        startState(state)
      } else {
        stopState(state, !hydrated.has(state))
        if (hydrated.has(state)) {
          state.video.preload = "metadata"
          hydrateVideoSources(state.video)
        }
      }
    })
  }

  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    proximityObserver?.disconnect()
    visibilityObserver?.disconnect()
    listenerCleanups.splice(0).forEach(removeListener => removeListener())
    states.forEach(state => stopState(state, true))
  }

  thumbnailSession = {
    root: items[0],
    cleanup,
    reconcile,
    isCleaned: () => cleaned,
  }

  listen(document, "astro:before-swap", cleanup, { once: true })

  if (!("IntersectionObserver" in window)) {
    states.forEach(state => stopState(state, true))
    return
  }

  const stateByItem = new Map(states.map(state => [state.item, state]))
  proximityObserver = new IntersectionObserver(
    entries => {
      if (cleaned) return
      entries.forEach(entry => {
        const state = stateByItem.get(entry.target as HTMLElement)
        if (!state) return
        state.nearViewport = entry.isIntersecting
        const rect = entry.boundingClientRect
        state.proximityDistance = rect.bottom < 0
          ? -rect.bottom
          : rect.top > window.innerHeight
            ? rect.top - window.innerHeight
            : 0
        if (!entry.isIntersecting) state.interacting = false
      })
      reconcile()
    },
    { rootMargin: "50% 0px" },
  )
  visibilityObserver = new IntersectionObserver(
    entries => {
      if (cleaned) return
      entries.forEach(entry => {
        const state = stateByItem.get(entry.target as HTMLElement)
        if (!state) return
        state.visibleRatio = entry.isIntersecting ? entry.intersectionRatio : 0
      })
      reconcile()
    },
    { threshold: [0, THUMBNAIL_PLAY_THRESHOLD, 0.6, 1] },
  )

  states.forEach(state => {
    proximityObserver?.observe(state.item)
    visibilityObserver?.observe(state.item)

    const beginInteraction = () => {
      if (!finePointer.matches || !desktopViewport.matches) return
      if (!isWithinLoadMargin(state)) return
      state.interacting = true
      reconcile()
    }
    const endInteraction = () => {
      state.interacting = false
      reconcile()
    }

    listen(state.item, "pointerenter", beginInteraction)
    listen(state.item, "pointerleave", endInteraction)
    listen(state.item, "focusin", beginInteraction)
    listen(state.item, "focusout", endInteraction)
  })

  const reconcileAfterInputChange = () => {
    if (!finePointer.matches || !desktopViewport.matches) {
      states.forEach(state => {
        state.interacting = false
      })
    }
    reconcile()
  }

  listen(window, "pageshow", reconcile)
  listen(window, "focus", reconcile)
  listen(document, "visibilitychange", reconcile)
  listen(finePointer, "change", reconcileAfterInputChange)
  listen(desktopViewport, "change", reconcileAfterInputChange)
  listen(motionPreference, "change", reconcile)
  if (connection) listen(connection, "change", reconcile)
}

function bootAllAutoplay() {
  bootHeroVideos()
  bootVideoVideos()
  bootPreviewVideos()
  bootThumbnailVideos()
}

function initAutoplay() {
  if (didInitAutoplayScripts) return
  didInitAutoplayScripts = true

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAllAutoplay, { once: true })
  } else {
    bootAllAutoplay()
  }

  document.addEventListener("astro:after-swap", bootAllAutoplay)
}

initAutoplay()
