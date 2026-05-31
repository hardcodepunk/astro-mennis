const MAX_AUTOPLAY_ATTEMPTS = 6

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
  let attempts = 0

  const {
    hydrate,
    onPlay,
    onStop,
    maxAttempts = MAX_AUTOPLAY_ATTEMPTS,
    resetOnStop = false,
  } = callbacks

  const tryStart = () => {
    if (!startRequested) return
    if (!document.body.contains(video) || !video.paused) return

    hydrate?.()
    prepareVideo(video)

    video.play().then(
      () => {
        attempts = 0
        retryScheduled = false
        onPlay?.()
      },
    ).catch(() => {
      if (!startRequested) return
      if (attempts >= maxAttempts) return

      attempts += 1
      if (retryScheduled) return

      retryScheduled = true
      const delay = video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ? 180 : 600
      const retry = () => {
        retryScheduled = false
        tryStart()
      }

      video.addEventListener("loadeddata", retry, { once: true })
      video.addEventListener("canplay", retry, { once: true })
      window.setTimeout(retry, delay)
    })
  }

  return {
    start() {
      if (startRequested) {
        tryStart()
        return
      }

      startRequested = true
      tryStart()
      window.setTimeout(tryStart, 120)
    },

    stop() {
      startRequested = false
      retryScheduled = false
      attempts = 0
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
      if (!startRequested) startRequested = true
      tryStart()
    },
  }
}

function attachHeroSources(video: HTMLVideoElement) {
  if (video.dataset.heroSourcesAttached === "1") return
  video.dataset.heroSourcesAttached = "1"

  const webm = video.dataset.webm
  const mp4 = video.dataset.mp4

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
  const sources = Array.from(video.querySelectorAll("source[data-src]")) as HTMLSourceElement[]
  if (!sources.length) return

  sources.forEach(source => {
    const src = source.getAttribute("data-src")
    if (!src) return
    source.src = src
    source.removeAttribute("data-src")
  })

  video.load()
}

const heroControllers = new WeakMap<HTMLElement, ReturnType<typeof makeAutoplayController>>()
const aboutControllers = new WeakMap<HTMLVideoElement, ReturnType<typeof makeAutoplayController>>()
const previewControllers = new WeakMap<HTMLVideoElement, ReturnType<typeof makeAutoplayController>>()
const thumbnailControllers = new WeakMap<HTMLElement, ReturnType<typeof makeAutoplayController> & { autoplay: boolean }>()

function bindResumeListeners(start: () => void) {
  const abort = new AbortController()
  const startWhenVisible = () => {
    if (document.hidden) return
    start()
  }

  window.addEventListener("pageshow", start, { signal: abort.signal })
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
      root.dataset.vhHeroMotionReduced = "1"
      return
    }

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

function bootThumbnailVideos() {
  if (!isMotionAllowed()) return

  const items = document.querySelectorAll<HTMLElement>("[data-thumbnail-card]")
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
  const desktopViewport = window.matchMedia("(min-width: 768px)")

  items.forEach(item => {
    const container = item.querySelector<HTMLElement>('[data-thumbnail-video]')
    if (!container) return

    const video = container.querySelector<HTMLVideoElement>("video")
    if (!video) return

    const shouldAutoplay = container.dataset.autoplay === "true"
    const existing = thumbnailControllers.get(item)

    const controller = existing ?? makeAutoplayController(video, {
      maxAttempts: 8,
      resetOnStop: true,
      hydrate: () => {
        hydrateVideoSources(video)
      },
      onPlay: () => {
        container.classList.add("is-playing")
      },
      onStop: () => {
        container.classList.remove("is-playing")
      },
    })

    if (!existing) {
      thumbnailControllers.set(item, Object.assign(controller, {autoplay: shouldAutoplay}))

      if (shouldAutoplay) {
        video.preload = "metadata"
        controller.start()
        bindResumeListeners(controller.start)
      } else {
        const shouldBindHover = finePointer.matches && desktopViewport.matches
        if (!shouldBindHover) return

        item.addEventListener("pointerenter", () => {
          controller.start()
        })
        item.addEventListener("pointerleave", () => {
          controller.stop()
        })
        item.addEventListener("focusin", () => {
          controller.start()
        })
        item.addEventListener("focusout", () => {
          controller.stop()
        })
      }
    }

    if (existing?.autoplay) {
      controller.start()
    }
  })
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

  document.addEventListener("astro:page-load", bootAllAutoplay)
  document.addEventListener("astro:after-swap", bootAllAutoplay)
}

initAutoplay()
