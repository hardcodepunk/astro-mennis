import {
  normalizeStoredAutoplayChoice,
  resolveAutoplayAllowed,
  type AutoplayChoice,
} from "../lib/autoplayPolicy.ts"

const MAX_AUTOPLAY_ATTEMPTS = 6
const MAX_THUMBNAIL_PLAYERS = 2
const AUTOPLAY_PLAY_START_TIMEOUT_MS = 12_000
const THUMBNAIL_PLAY_START_TIMEOUT_MS = 8_000
const THUMBNAIL_PLAY_THRESHOLD = 0.25
const THUMBNAIL_LOAD_MARGIN_RATIO = 0.5
const THUMBNAIL_VISIBILITY_THRESHOLDS = Array.from(
  { length: 21 },
  (_, index) => index / 20,
)
const AUTOPLAY_CHOICE_KEY = "astro-mennis:background-video-choice"

let didInitAutoplayScripts = false
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)")
const connection = getNetworkInformation()
const policyListeners = new Set<() => void>()

function readAutoplayChoice(): AutoplayChoice {
  try {
    const value = window.sessionStorage.getItem(AUTOPLAY_CHOICE_KEY)
    return normalizeStoredAutoplayChoice(value, motionPreference.matches)
  } catch {
    return "default"
  }
}

let autoplayChoice = readAutoplayChoice()

function saveAutoplayChoice(choice: AutoplayChoice) {
  autoplayChoice = choice
  try {
    if (choice === "default") window.sessionStorage.removeItem(AUTOPLAY_CHOICE_KEY)
    else window.sessionStorage.setItem(AUTOPLAY_CHOICE_KEY, choice)
  } catch {
    // Storage can be unavailable in hardened browsing modes; the in-memory choice still applies.
  }
}

function autoplayAllowed() {
  return resolveAutoplayAllowed({
    choice: autoplayChoice,
    reducedMotion: motionPreference.matches,
    saveData: connection?.saveData === true,
  })
}

function notifyPolicyChange() {
  policyListeners.forEach(listener => listener())
  updateAutoplayControls()
}

motionPreference.addEventListener("change", event => {
  if (event.matches && autoplayChoice === "play") saveAutoplayChoice("default")
  notifyPolicyChange()
})
connection?.addEventListener("change", notifyPolicyChange)

function prepareVideo(video: HTMLVideoElement) {
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.setAttribute("muted", "")
  video.setAttribute("playsinline", "")
  video.setAttribute("webkit-playsinline", "")
}

function supportsPointerEvents() {
  return typeof window.PointerEvent === "function"
}

function isActivationKey(event: KeyboardEvent) {
  return event.key !== "Escape" &&
    !event.isComposing &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
}

function isTrustedActivation(event: Event) {
  return event.isTrusted &&
    (event.type !== "keydown" || isActivationKey(event as KeyboardEvent))
}

export function makeAutoplayController(
  video: HTMLVideoElement,
  callbacks: {
    hydrate?: () => void
    onExhausted?: () => void
    onPlay?: () => void
    onStop?: () => void
    maxAttempts?: number
    playStartTimeoutMs?: number
    resetOnStop?: boolean
  } = {},
) {
  let startRequested = false
  let retryScheduled = false
  let requestGeneration = 0
  let pendingPlayAttempt: {
    generation: number
    cleanup: () => void
  } | undefined
  let retryCleanup: (() => void) | undefined
  let didMarkPlaying = false
  let attempts = 0

  const {
    hydrate,
    onExhausted,
    onPlay,
    onStop,
    maxAttempts = MAX_AUTOPLAY_ATTEMPTS,
    playStartTimeoutMs = AUTOPLAY_PLAY_START_TIMEOUT_MS,
    resetOnStop = false,
  } = callbacks

  const clearRetry = () => {
    const cleanup = retryCleanup
    retryCleanup = undefined
    retryScheduled = false
    cleanup?.()
  }

  const clearPendingPlay = (
    attempt = pendingPlayAttempt,
  ) => {
    if (!attempt || pendingPlayAttempt !== attempt) return false
    pendingPlayAttempt = undefined
    attempt.cleanup()
    return true
  }

  const markPlaying = () => {
    if (!startRequested) return
    attempts = 0
    clearPendingPlay()
    clearRetry()
    if (!didMarkPlaying) {
      didMarkPlaying = true
      onPlay?.()
    }
  }

  const scheduleRetry = (generation: number) => {
    if (!startRequested || generation !== requestGeneration) return
    if (attempts >= maxAttempts) {
      onExhausted?.()
      return
    }
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

  const beginPendingPlay = (generation: number) => {
    const attempt = {
      generation,
      cleanup: () => {},
    }
    pendingPlayAttempt = attempt

    if (!playStartTimeoutMs || playStartTimeoutMs <= 0) return attempt

    let remainingMs = playStartTimeoutMs
    let startedAt: number | undefined
    let timer: number | undefined

    const pauseTimer = () => {
      if (timer === undefined) return
      window.clearTimeout(timer)
      timer = undefined
      if (startedAt !== undefined) {
        remainingMs = Math.max(0, remainingMs - (Date.now() - startedAt))
        startedAt = undefined
      }
    }

    const expire = () => {
      timer = undefined
      startedAt = undefined
      if (pendingPlayAttempt !== attempt || document.hidden) return
      clearPendingPlay(attempt)
      if (!startRequested || generation !== requestGeneration) return
      if (!video.paused) video.pause()
      if (onExhausted) {
        onExhausted()
      } else {
        scheduleRetry(generation)
      }
    }

    const armTimer = () => {
      if (pendingPlayAttempt !== attempt || document.hidden || timer !== undefined) return
      startedAt = Date.now()
      timer = window.setTimeout(expire, remainingMs)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseTimer()
      } else {
        armTimer()
      }
    }

    attempt.cleanup = () => {
      pauseTimer()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    armTimer()
    return attempt
  }

  const tryStart = (generation: number) => {
    if (!startRequested || generation !== requestGeneration) return
    if (!document.body.contains(video)) return

    hydrate?.()
    prepareVideo(video)

    if (pendingPlayAttempt?.generation === generation) return

    if (!video.paused && !video.ended) {
      markPlaying()
      return
    }

    const attempt = beginPendingPlay(generation)
    video.play().then(() => {
      if (!clearPendingPlay(attempt)) return
      if (!startRequested || generation !== requestGeneration) return
      markPlaying()
    }).catch(() => {
      if (!clearPendingPlay(attempt)) return
      scheduleRetry(generation)
    })
  }

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
      didMarkPlaying = false
      attempts = 0
      clearPendingPlay()
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

function hydrateVideoSources(video: HTMLVideoElement) {
  const sources = Array.from(
    video.querySelectorAll("source[data-src]:not([src]):not([data-autoplay-source-failed])"),
  ) as HTMLSourceElement[]
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

function bindResumeListeners(reconcile: () => void, cleanup: () => void) {
  const abort = new AbortController()
  const reconcileFromTrustedActivation = (event: Event) => {
    if (isTrustedActivation(event)) reconcile()
  }

  window.addEventListener("pageshow", reconcile, { signal: abort.signal })
  window.addEventListener("focus", reconcile, { signal: abort.signal })
  window.addEventListener("load", reconcile, { signal: abort.signal })
  if (supportsPointerEvents()) {
    window.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse") reconcileFromTrustedActivation(event)
    }, { passive: true, signal: abort.signal })
    window.addEventListener("pointerup", event => {
      if (event.pointerType !== "mouse") reconcileFromTrustedActivation(event)
    }, { passive: true, signal: abort.signal })
  } else {
    window.addEventListener("mousedown", reconcileFromTrustedActivation, { passive: true, signal: abort.signal })
    window.addEventListener("touchend", reconcileFromTrustedActivation, { passive: true, signal: abort.signal })
  }
  window.addEventListener("click", reconcileFromTrustedActivation, { passive: true, signal: abort.signal })
  window.addEventListener("keydown", reconcileFromTrustedActivation, { signal: abort.signal })
  document.addEventListener("visibilitychange", reconcile, { signal: abort.signal })
  policyListeners.add(reconcile)
  document.addEventListener("astro:before-swap", () => {
    policyListeners.delete(reconcile)
    cleanup()
    abort.abort()
  }, { once: true, signal: abort.signal })
}

function bootHeroVideos() {
  const roots = document.querySelectorAll<HTMLElement>(".vh-hero")

  roots.forEach(root => {
    const video = root.querySelector<HTMLVideoElement>("[data-hero-autoplay-video]")
    if (!video) return

    const minRevealMs = Number(root.getAttribute("data-min-reveal") || "600")
    const mountedAt = Date.now()

    let revealed = false
    let revealTimer: number | undefined

    const cancelReveal = () => {
      if (revealTimer === undefined) return
      window.clearTimeout(revealTimer)
      revealTimer = undefined
    }

    const reveal = () => {
      cancelReveal()
      if (revealed) {
        root.classList.add("is-playing")
        return
      }

      const elapsed = Date.now() - mountedAt
      const delay = Math.max(0, minRevealMs - elapsed)
      const finishReveal = () => {
        revealTimer = undefined
        if (!root.isConnected || video.paused || !autoplayAllowed() || document.hidden) return
        revealed = true
        root.classList.add("is-revealed")
        root.classList.add("is-playing")
      }

      if (delay === 0) finishReveal()
      else revealTimer = window.setTimeout(finishReveal, delay)
    }

    const existing = heroControllers.get(root)
    const controller = existing ?? makeAutoplayController(video, {
      hydrate: () => hydrateVideoSources(video),
      onPlay: reveal,
      onStop: () => {
        cancelReveal()
        root.classList.remove("is-playing")
      },
      maxAttempts: 8,
      resetOnStop: false,
    })

    const reconcile = () => {
      if (autoplayAllowed() && !document.hidden) {
        root.removeAttribute("data-reduced")
        video.preload = "metadata"
        controller.start()
      } else {
        root.dataset.reduced = "1"
        video.autoplay = false
        video.preload = "none"
        controller.stop()
        unloadVideoSources(video)
      }
    }

    if (!existing) {
      heroControllers.set(root, controller)
      bindResumeListeners(reconcile, () => {
        cancelReveal()
        video.autoplay = false
        video.preload = "none"
        controller.stop()
        unloadVideoSources(video)
      })
    }

    reconcile()
    window.setTimeout(() => {
      if (autoplayAllowed() && !document.hidden) controller.startNow()
    }, 450)
  })
}

function bootVideoVideos() {
  const videos = document.querySelectorAll<HTMLVideoElement>("[data-about-autoplay-video]")
  videos.forEach(video => {
    const existing = aboutControllers.get(video)
    const controller = existing ?? makeAutoplayController(video, {
      hydrate: () => hydrateVideoSources(video),
      maxAttempts: 8,
      resetOnStop: false,
    })

    const reconcile = () => {
      if (autoplayAllowed() && !document.hidden) {
        video.preload = "metadata"
        controller.start()
      } else {
        video.autoplay = false
        video.preload = "none"
        controller.stop()
        unloadVideoSources(video)
      }
    }

    if (!existing) {
      aboutControllers.set(video, controller)
      bindResumeListeners(reconcile, () => {
        video.autoplay = false
        video.preload = "none"
        controller.stop()
        unloadVideoSources(video)
      })
    }

    reconcile()
    window.setTimeout(() => {
      if (autoplayAllowed() && !document.hidden) controller.startNow()
    }, 120)
  })
}

function bootPreviewVideos() {
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

    const reconcile = () => {
      if (autoplayAllowed() && !document.hidden) {
        video.preload = "metadata"
        controller.start()
      } else {
        video.autoplay = false
        video.preload = "none"
        controller.stop()
        unloadVideoSources(video)
      }
    }

    if (!existing) {
      previewControllers.set(video, controller)
      bindResumeListeners(reconcile, () => {
        video.autoplay = false
        video.preload = "none"
        controller.stop()
        unloadVideoSources(video)
      })
    }

    reconcile()
    window.setTimeout(() => {
      if (autoplayAllowed() && !document.hidden) controller.startNow()
    }, 240)
  })
}

type ThumbnailState = {
  item: HTMLElement
  container: HTMLElement
  video: HTMLVideoElement
  sources: HTMLSourceElement[]
  controller: ReturnType<typeof makeAutoplayController>
  autoplay: boolean
  index: number
  nearViewport: boolean
  proximityDistance: number
  visibleRatio: number
  interacting: boolean
  playRequested: boolean
  unavailableReason?: "source" | "play"
  failedSources: Set<HTMLSourceElement>
}

type NetworkInformationLike = EventTarget & { saveData?: boolean }

type ThumbnailSession = {
  root: HTMLElement
  cleanup: () => void
  handlePlayExhaustion: (item: HTMLElement) => void
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

  const states = items.flatMap((item, index): ThumbnailState[] => {
    const container = item.querySelector<HTMLElement>("[data-thumbnail-video]")
    const video = container?.querySelector<HTMLVideoElement>("video")
    if (!container || !video) return []

    const sources = Array.from(
      video.querySelectorAll<HTMLSourceElement>("source[data-src], source[src]"),
    ).filter(source => {
      const type = source.getAttribute("type")
      return !type || video.canPlayType(type) !== ""
    })
    if (!sources.length) return []

    const existing = thumbnailControllers.get(item)
    const controller = existing ?? makeAutoplayController(video, {
      maxAttempts: 8,
      playStartTimeoutMs: THUMBNAIL_PLAY_START_TIMEOUT_MS,
      resetOnStop: true,
      hydrate: () => hydrateVideoSources(video),
      onExhausted: () => thumbnailSession?.handlePlayExhaustion(item),
      onPlay: () => container.classList.add("is-playing"),
      onStop: () => container.classList.remove("is-playing"),
    })
    if (!existing) thumbnailControllers.set(item, controller)

    return [{
      item,
      container,
      video,
      sources,
      controller,
      autoplay: container.dataset.autoplay === "true",
      index,
      nearViewport: false,
      proximityDistance: Number.POSITIVE_INFINITY,
      visibleRatio: 0,
      interacting: false,
      playRequested: false,
      failedSources: new Set(),
    }]
  })

  if (!states.length) {
    thumbnailSession = undefined
    return
  }

  const stateByItem = new Map(states.map(state => [state.item, state]))
  let proximityObserver: IntersectionObserver | undefined
  let visibilityObserver: IntersectionObserver | undefined
  let proximityMarginPx = -1
  let resizeFrame: number | undefined
  let reconcileFrame: number | undefined
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

  const mediaAllowed = () => autoplayAllowed()
  const getViewportHeight = () => document.documentElement.clientHeight || window.innerHeight
  const getViewportWidth = () => document.documentElement.clientWidth || window.innerWidth
  const getLoadMargin = () => getViewportHeight() * THUMBNAIL_LOAD_MARGIN_RATIO

  const refreshProximityState = (
    state: ThumbnailState,
    rect: DOMRectReadOnly,
    loadMargin = getLoadMargin(),
    viewportHeight = getViewportHeight(),
  ) => {
    const viewportWidth = getViewportWidth()
    state.nearViewport = rect.width > 0 && rect.height > 0 &&
      rect.right >= 0 && rect.left <= viewportWidth &&
      rect.bottom >= -loadMargin && rect.top <= viewportHeight + loadMargin
    state.proximityDistance = state.nearViewport
      ? rect.bottom < 0
        ? -rect.bottom
        : rect.top > viewportHeight
          ? rect.top - viewportHeight
          : 0
      : Number.POSITIVE_INFINITY
  }

  const refreshVisibleRatio = (state: ThumbnailState, rect: DOMRectReadOnly) => {
    if (rect.width <= 0 || rect.height <= 0) {
      state.visibleRatio = 0
      return
    }

    const visibleWidth = Math.max(0, Math.min(rect.right, getViewportWidth()) - Math.max(rect.left, 0))
    const visibleHeight = Math.max(0, Math.min(rect.bottom, getViewportHeight()) - Math.max(rect.top, 0))
    state.visibleRatio = (visibleWidth * visibleHeight) / (rect.width * rect.height)
  }

  const clearSourceFailures = (state: ThumbnailState) => {
    state.failedSources.clear()
    state.sources.forEach(source => {
      delete source.dataset.autoplaySourceFailed
    })
    if (state.unavailableReason === "source") state.unavailableReason = undefined
  }

  const stopState = (state: ThumbnailState, unload: boolean) => {
    state.video.autoplay = false
    if (state.playRequested) {
      state.playRequested = false
      state.controller.stop()
    }
    if (!unload) return
    state.video.preload = "none"
    unloadVideoSources(state.video)
  }

  const startState = (state: ThumbnailState) => {
    if (state.playRequested) return
    prepareVideo(state.video)
    state.video.autoplay = true
    state.video.preload = "metadata"
    hydrateVideoSources(state.video)
    state.playRequested = true
    state.controller.start()
  }

  const reconcile = () => {
    if (cleaned) return

    const viewportHeight = getViewportHeight()
    const loadMargin = viewportHeight * THUMBNAIL_LOAD_MARGIN_RATIO
    const interactionsAllowed = finePointer.matches && desktopViewport.matches
    states.forEach(state => {
      const rect = state.item.getBoundingClientRect()
      refreshProximityState(
        state,
        rect,
        loadMargin,
        viewportHeight,
      )
      refreshVisibleRatio(state, rect)
      state.interacting = interactionsAllowed &&
        state.nearViewport &&
        (state.item.matches(":hover") || state.item.matches(":focus-within"))
    })

    if (!mediaAllowed() || document.hidden) {
      states.forEach(state => stopState(state, true))
      return
    }

    const playing = new Set(
      states
        .filter(state =>
          !state.unavailableReason &&
          state.nearViewport &&
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
        .filter(state =>
          state.autoplay &&
          !state.unavailableReason &&
          state.nearViewport &&
          !hydrated.has(state),
        )
        .sort((left, right) =>
          left.proximityDistance - right.proximityDistance || left.index - right.index,
        )
        .slice(0, MAX_THUMBNAIL_PLAYERS - hydrated.size)
        .forEach(state => hydrated.add(state))
    }

    states.forEach(state => {
      if (!playing.has(state)) stopState(state, !hydrated.has(state))
    })

    states.forEach(state => {
      if (playing.has(state)) {
        startState(state)
      } else if (hydrated.has(state)) {
        state.video.preload = "metadata"
        hydrateVideoSources(state.video)
      }
    })
  }

  const handleSourceFailure = (
    state: ThumbnailState,
    source: HTMLSourceElement,
  ) => {
    if (!source.hasAttribute("src") || state.failedSources.has(source)) return

    state.failedSources.add(source)
    source.dataset.autoplaySourceFailed = "1"
    source.removeAttribute("src")
    if (state.failedSources.size >= state.sources.length) {
      state.unavailableReason = "source"
    }

    if (state.playRequested) {
      state.playRequested = false
      state.controller.stop()
    }

    state.video.load()
    reconcile()
  }

  const resumeActiveStates = () => {
    reconcile()
    states
      .filter(state => state.playRequested && state.video.paused)
      .forEach(state => state.controller.start())
  }

  const recoverSourceFailures = () => {
    states
      .filter(state => state.unavailableReason === "source")
      .forEach(clearSourceFailures)
    resumeActiveStates()
  }

  const recoverAllFailedStates = () => {
    states.forEach(clearSourceFailures)
    resumeActiveStates()
  }

  const reconcileAndResumeState = (state: ThumbnailState) => {
    reconcile()
    if (state.playRequested && state.video.paused) state.controller.start()
  }

  const resumeFromUserGesture = () => {
    if (cleaned || document.hidden || !mediaAllowed()) return

    states.forEach(state => {
      if (state.unavailableReason !== "play") return
      state.unavailableReason = state.failedSources.size >= state.sources.length
        ? "source"
        : undefined
    })
    resumeActiveStates()
  }

  const scheduleReconcile = () => {
    if (cleaned || reconcileFrame !== undefined) return
    reconcileFrame = window.requestAnimationFrame(() => {
      reconcileFrame = undefined
      reconcile()
    })
  }

  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame)
    if (reconcileFrame !== undefined) window.cancelAnimationFrame(reconcileFrame)
    resizeFrame = undefined
    reconcileFrame = undefined
    proximityObserver?.disconnect()
    visibilityObserver?.disconnect()
    policyListeners.delete(reconcile)
    listenerCleanups.splice(0).forEach(removeListener => removeListener())
    states.forEach(state => stopState(state, true))
  }

  const handlePlayExhaustion = (item: HTMLElement) => {
    if (cleaned) return
    const state = stateByItem.get(item)
    if (!state) return

    state.unavailableReason = "play"
    state.playRequested = false
    state.controller.stop()
    reconcile()
  }

  thumbnailSession = {
    root: items[0],
    cleanup,
    handlePlayExhaustion,
    reconcile,
    isCleaned: () => cleaned,
  }
  policyListeners.add(reconcile)

  listen(document, "astro:before-swap", cleanup, { once: true })

  if (!("IntersectionObserver" in window)) {
    states.forEach(state => stopState(state, true))
    return
  }

  const rebuildProximityObserver = () => {
    if (cleaned) return

    const viewportHeight = getViewportHeight()
    const nextMarginPx = Math.max(0, Math.round(viewportHeight * THUMBNAIL_LOAD_MARGIN_RATIO))
    states.forEach(state => {
      const rect = state.item.getBoundingClientRect()
      refreshProximityState(state, rect, nextMarginPx, viewportHeight)
      refreshVisibleRatio(state, rect)
    })

    if (!proximityObserver || nextMarginPx !== proximityMarginPx) {
      proximityObserver?.disconnect()
      proximityMarginPx = nextMarginPx
      proximityObserver = new IntersectionObserver(
        entries => {
          if (cleaned) return
          const currentViewportHeight = getViewportHeight()
          entries.forEach(entry => {
            const state = stateByItem.get(entry.target as HTMLElement)
            if (!state) return
            refreshProximityState(
              state,
              entry.boundingClientRect,
              proximityMarginPx,
              currentViewportHeight,
            )
          })
          reconcile()
        },
        { rootMargin: `${nextMarginPx}px 0px` },
      )
      states.forEach(state => proximityObserver?.observe(state.item))
    }

    reconcile()
  }

  const scheduleProximityObserverRebuild = () => {
    if (cleaned || resizeFrame !== undefined) return
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = undefined
      rebuildProximityObserver()
    })
  }

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
    { threshold: THUMBNAIL_VISIBILITY_THRESHOLDS },
  )

  states.forEach(state => {
    visibilityObserver?.observe(state.item)
    listen(state.item, "pointerenter", () => reconcileAndResumeState(state))
    listen(state.item, "pointerleave", reconcile)
    listen(state.item, "focusin", () => reconcileAndResumeState(state))
    listen(state.item, "focusout", reconcile)
    listen(state.video, "error", () => {
      const currentSrc = state.video.currentSrc
      if (!currentSrc) return
      const failedSource = state.sources.find(source => {
        const src = source.getAttribute("src")
        return src ? new URL(src, document.baseURI).href === currentSrc : false
      })
      if (failedSource) handleSourceFailure(state, failedSource)
    })
    state.sources.forEach(source => {
      listen(source, "error", () => {
        handleSourceFailure(state, source)
      })
    })
  })

  rebuildProximityObserver()
  listen(window, "pageshow", recoverSourceFailures)
  listen(window, "focus", recoverSourceFailures)
  listen(window, "online", recoverAllFailedStates)
  if (supportsPointerEvents()) {
    listen(window, "pointerdown", event => {
      if ((event as PointerEvent).pointerType === "mouse" && isTrustedActivation(event)) {
        resumeFromUserGesture()
      }
    }, { passive: true })
    listen(window, "pointerup", event => {
      if ((event as PointerEvent).pointerType !== "mouse" && isTrustedActivation(event)) {
        resumeFromUserGesture()
      }
    }, { passive: true })
  } else {
    listen(window, "mousedown", event => {
      if (isTrustedActivation(event)) resumeFromUserGesture()
    }, { passive: true })
    listen(window, "touchend", event => {
      if (isTrustedActivation(event)) resumeFromUserGesture()
    }, { passive: true })
  }
  listen(window, "click", event => {
    if (isTrustedActivation(event)) resumeFromUserGesture()
  }, { passive: true })
  listen(window, "keydown", event => {
    if (isTrustedActivation(event)) resumeFromUserGesture()
  })
  listen(window, "scroll", scheduleReconcile, { passive: true })
  listen(window, "resize", scheduleProximityObserverRebuild, { passive: true })
  listen(document, "visibilitychange", reconcile)
  listen(finePointer, "change", reconcile)
  listen(desktopViewport, "change", reconcile)
  if (connection) listen(connection, "change", recoverAllFailedStates)
}

function hasBackgroundVideos() {
  const standaloneVideos = document.querySelectorAll<HTMLVideoElement>(
    "[data-hero-autoplay-video], [data-about-autoplay-video], [data-preview-autoplay-video]",
  )
  if (Array.from(standaloneVideos).some(video => video.querySelector("source[data-src]"))) return true

  const autoplayThumbnails = document.querySelectorAll<HTMLElement>(
    "[data-thumbnail-video][data-autoplay='true']",
  )
  return Array.from(autoplayThumbnails).some(container => container.querySelector("video source[data-src]"))
}

function updateAutoplayControls() {
  const enabled = autoplayAllowed()
  const dataSaverEnabled = connection?.saveData === true

  document.querySelectorAll<HTMLButtonElement>("[data-autoplay-control]").forEach(button => {
    const label = button.querySelector<HTMLElement>("[data-autoplay-control-label]")
    button.hidden = !hasBackgroundVideos()
    button.disabled = dataSaverEnabled
    button.title = dataSaverEnabled ? "Background videos are disabled by your data-saver setting" : ""
    if (label) {
      label.textContent = dataSaverEnabled
        ? "Videos disabled by data saver"
        : enabled
          ? "Pause background videos"
          : "Play background videos"
    }
  })
}

function bootAutoplayControl() {
  document.querySelectorAll<HTMLButtonElement>("[data-autoplay-control]").forEach(button => {
    if (button.dataset.autoplayControlReady === "1") return
    button.dataset.autoplayControlReady = "1"
    button.addEventListener("click", () => {
      if (connection?.saveData === true) return
      saveAutoplayChoice(autoplayAllowed() ? "pause" : "play")
      notifyPolicyChange()
    })
  })
  updateAutoplayControls()
}

function bootAllAutoplay() {
  bootAutoplayControl()
  bootHeroVideos()
  bootVideoVideos()
  bootPreviewVideos()
  bootThumbnailVideos()
  updateAutoplayControls()
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
