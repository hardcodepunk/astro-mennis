import Plyr from "plyr"

type PlayerSession = {
  player: Plyr | null
  frame: HTMLElement
  embed: HTMLElement
  overlay: HTMLButtonElement
  ready: boolean
  activationRequestId: number | null
  activated: boolean
  intersecting: boolean
  sufficientlyVisible: boolean
  accessibilityObserver: MutationObserver | null
  onReady: () => void
  onOverlayClick: (event: MouseEvent) => void
  onPlay: () => void
  onPause: () => void
  onEnded: () => void
}

type YouTubeWindow = Window & {
  YT?: { Player?: unknown }
  onYouTubeIframeAPIReady?: () => void
}

const activeCleanups = new Set<() => void>()
const youtubeApiUrl = "https://www.youtube.com/iframe_api"
const failedYouTubeApiScripts = new WeakSet<HTMLScriptElement>()
let youtubeApiPromise: Promise<void> | undefined

function hasYouTubeApi(youtubeWindow: YouTubeWindow) {
  return typeof youtubeWindow.YT?.Player === "function"
}

function ensureYouTubeApi() {
  const youtubeWindow = window as YouTubeWindow
  if (hasYouTubeApi(youtubeWindow)) return Promise.resolve()
  if (youtubeApiPromise) return youtubeApiPromise

  youtubeApiPromise = new Promise<void>((resolve, reject) => {
    const previousCallback = youtubeWindow.onYouTubeIframeAPIReady
    let script = document.querySelector<HTMLScriptElement>(`script[src="${youtubeApiUrl}"]`)
    if (script && failedYouTubeApiScripts.has(script)) script = null
    let timeoutId = 0
    let settled = false

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      script?.removeEventListener("error", onError)
      if (youtubeWindow.onYouTubeIframeAPIReady === onApiReady) {
        youtubeWindow.onYouTubeIframeAPIReady = previousCallback
      }
    }

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      cleanup()
      if (error && script) {
        failedYouTubeApiScripts.add(script)
        if (script.dataset.workMediaYoutubeApi === "1") script.remove()
      }
      if (error) reject(error)
      else resolve()
    }

    const onApiReady = () => {
      try {
        previousCallback?.()
      } finally {
        finish(
          hasYouTubeApi(youtubeWindow)
            ? undefined
            : new Error("The YouTube player API did not initialize"),
        )
      }
    }

    const onError = () => {
      finish(new Error("The YouTube player API failed to load"))
    }

    youtubeWindow.onYouTubeIframeAPIReady = onApiReady
    script?.addEventListener("error", onError, { once: true })
    timeoutId = window.setTimeout(() => {
      finish(new Error("The YouTube player API timed out"))
    }, 15_000)

    if (!script) {
      script = document.createElement("script")
      script.src = youtubeApiUrl
      script.async = true
      script.dataset.workMediaYoutubeApi = "1"
      script.addEventListener("error", onError, { once: true })
      document.head.append(script)
    }
  }).catch(error => {
    youtubeApiPromise = undefined
    throw error
  })

  return youtubeApiPromise
}

function setPlayerLocked(frame: HTMLElement, embed: HTMLElement, locked: boolean) {
  const container = frame.querySelector<HTMLElement>(".plyr")
  const targets = new Set<HTMLElement>([embed])
  if (container) targets.add(container)

  for (const target of targets) {
    target.toggleAttribute("inert", locked)
    if (locked) {
      target.setAttribute("aria-hidden", "true")
    } else {
      target.removeAttribute("aria-hidden")
    }
  }

  container?.toggleAttribute("data-yt-player-locked", locked)
  container?.toggleAttribute("data-yt-player-unlocking", !locked)
}

function initHero(root: HTMLElement) {
  if (root.dataset.workHeroInited === "1") return
  root.dataset.workHeroInited = "1"

  const embeds = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-embed]"))
  if (!embeds.length) {
    delete root.dataset.workHeroInited
    return
  }

  let disposed = false
  const sessions: PlayerSession[] = []
  let activationRequestId = 0
  let latestRequestedSession: PlayerSession | null = null
  let currentPlayingSession: PlayerSession | null = null

  for (const embed of embeds) {
    const frame = embed.closest<HTMLElement>("[data-yt-frame]")
    const overlay = frame?.querySelector<HTMLButtonElement>("[data-yt-overlay]")
    if (!frame || !overlay) continue

    const mediaTitle = embed.dataset.ytTitle?.trim() || "project video"

    const session: PlayerSession = {
      player: null,
      frame,
      embed,
      overlay,
      ready: false,
      activationRequestId: null,
      activated: false,
      intersecting: true,
      sufficientlyVisible: true,
      accessibilityObserver: null,
      onReady: () => undefined,
      onOverlayClick: () => undefined,
      onPlay: () => undefined,
      onPause: () => undefined,
      onEnded: () => undefined,
    }
    sessions.push(session)

    const activate = () => {
      const player = session.player
      const isLatestRequest =
        latestRequestedSession === session && session.activationRequestId === activationRequestId
      if (
        disposed ||
        !player ||
        session.activated ||
        !session.ready ||
        !isLatestRequest
      ) {
        return
      }

      const playControl = frame.querySelector<HTMLButtonElement>(
        '.plyr__controls [data-plyr="play"]',
      )
      if (!playControl) return

      const overlayStillHasFocus = document.activeElement === overlay
      session.activated = true
      setPlayerLocked(frame, embed, false)
      player.toggleControls(true)
      overlay.hidden = true

      const playAttempt = player.play()
      if (!session.sufficientlyVisible) player.pause()
      const focusRequestId = session.activationRequestId
      window.requestAnimationFrame(() => {
        if (overlayStillHasFocus) {
          const activeElement = document.activeElement
          if (
            !disposed &&
            session.activated &&
            latestRequestedSession === session &&
            session.intersecting &&
            session.activationRequestId === focusRequestId &&
            focusRequestId === activationRequestId &&
            (activeElement === document.body || activeElement === overlay)
          ) {
            playControl.focus()
          }
        }
        frame
          .querySelector<HTMLElement>(".plyr")
          ?.removeAttribute("data-yt-player-unlocking")
      })
      playAttempt?.catch(() => {
        if (disposed) return
        player.toggleControls(true)
      })
    }

    const createPlayer = () => {
      if (disposed || session.player) return

      const player = new Plyr(embed, {
        ratio: embed.dataset.ytRatio || "16:9",
        clickToPlay: false,
        controls: [
          "play",
          "progress",
          "current-time",
          "mute",
          "volume",
          "settings",
          "fullscreen",
        ],
        i18n: {
          play: `Play ${mediaTitle}`,
          pause: `Pause ${mediaTitle}`,
        },
        youtube: {
          rel: 0,
          modestbranding: 1,
        },
      } as Plyr.Options)
      session.player = player

      session.onReady = () => {
        session.ready = true
        player.off("ready", session.onReady)

        if (disposed) {
          player.destroy()
          return
        }

        const iframe = frame.querySelector<HTMLIFrameElement>("iframe")
        if (iframe) {
          const preservePlayerAccessibility = () => {
            if (iframe.title !== mediaTitle) iframe.title = mediaTitle
            if (iframe.getAttribute("tabindex") !== "-1") iframe.setAttribute("tabindex", "-1")

            const playLabel = `${player.playing ? "Pause" : "Play"} ${mediaTitle}`
            frame
              .querySelectorAll<HTMLButtonElement>('[data-plyr="play"]')
              .forEach(playButton => {
                if (playButton.getAttribute("aria-label") !== playLabel) {
                  playButton.setAttribute("aria-label", playLabel)
                }
              })
          }

          preservePlayerAccessibility()
          session.accessibilityObserver = new MutationObserver(preservePlayerAccessibility)
          session.accessibilityObserver.observe(frame, {
            subtree: true,
            attributes: true,
            attributeFilter: ["title", "tabindex", "aria-label"],
          })
        }

        const isLatestRequest =
          latestRequestedSession === session && session.activationRequestId === activationRequestId
        if (isLatestRequest) activate()
        else setPlayerLocked(frame, embed, true)
      }

      session.onPlay = () => {
        if (disposed) return

        if (latestRequestedSession && latestRequestedSession !== session) {
          latestRequestedSession.activationRequestId = null
        }
        activationRequestId += 1
        session.activationRequestId = activationRequestId
        latestRequestedSession = session

        for (const other of sessions) {
          if (other !== session && other.ready && other.activated) other.player?.pause()
        }
        currentPlayingSession = session
      }

      session.onPause = () => {
        if (currentPlayingSession === session) currentPlayingSession = null
      }

      session.onEnded = session.onPause

      player.on("ready", session.onReady)
      player.on("play", session.onPlay)
      player.on("pause", session.onPause)
      player.on("ended", session.onEnded)

      // Plyr creates its container synchronously but finishes the provider setup later.
      setPlayerLocked(frame, embed, true)
    }

    session.onOverlayClick = event => {
      event.preventDefault()
      event.stopPropagation()
      activationRequestId += 1
      session.activationRequestId = activationRequestId
      latestRequestedSession = session

      for (const other of sessions) {
        if (other !== session && other.ready && other.activated) other.player?.pause()
      }

      if (session.player) {
        activate()
        return
      }

      const requestedId = session.activationRequestId
      void ensureYouTubeApi()
        .then(() => {
          const isLatestRequest =
            !disposed &&
            latestRequestedSession === session &&
            session.activationRequestId === requestedId
          if (!isLatestRequest) return

          createPlayer()
          activate()
        })
        .catch(error => {
          if (disposed || latestRequestedSession !== session) return
          session.activationRequestId = null
          latestRequestedSession = null
          console.warn("Unable to initialize the YouTube player", error)
        })
    }

    overlay.addEventListener("click", session.onOverlayClick)
    setPlayerLocked(frame, embed, true)
  }

  const rail = root.querySelector<HTMLElement>("[data-yt-rail]")
  const prev = root.querySelector<HTMLButtonElement>("[data-yt-prev]")
  const next = root.querySelector<HTMLButtonElement>("[data-yt-next]")
  let resizeObserver: ResizeObserver | undefined
  let intersectionObserver: IntersectionObserver | undefined
  let onPrevClick: ((event: MouseEvent) => void) | undefined
  let onNextClick: ((event: MouseEvent) => void) | undefined
  let updateNav: (() => void) | undefined

  if (rail) {
    const getAmount = () => {
      const first = rail.querySelector<HTMLElement>("[data-yt-slide]")
      if (!first) return 178
      const gapValue = getComputedStyle(rail).gap || "18px"
      const gap = Number.parseFloat(gapValue) || 18
      return first.getBoundingClientRect().width + gap
    }

    const scrollByCard = (direction: "left" | "right") => {
      rail.scrollBy({
        left: direction === "left" ? -getAmount() : getAmount(),
        behavior: "smooth",
      })
    }

    onPrevClick = event => {
      event.preventDefault()
      event.stopPropagation()
      scrollByCard("left")
    }
    onNextClick = event => {
      event.preventDefault()
      event.stopPropagation()
      scrollByCard("right")
    }

    prev?.addEventListener("click", onPrevClick)
    next?.addEventListener("click", onNextClick)

    updateNav = () => {
      const left = rail.scrollLeft
      const max = Math.max(0, rail.scrollWidth - rail.clientWidth)

      if (prev) prev.hidden = left <= 2
      if (next) next.hidden = left >= max - 2
    }

    updateNav()
    rail.addEventListener("scroll", updateNav, { passive: true })

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateNav)
      resizeObserver.observe(rail)
    }

    if (typeof IntersectionObserver !== "undefined") {
      const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-slide]"))
      const sessionByFrame = new Map(sessions.map(session => [session.frame, session]))

      intersectionObserver = new IntersectionObserver(
        entries => {
          if (disposed) return

          for (const entry of entries) {
            const frame = (entry.target as HTMLElement).querySelector<HTMLElement>("[data-yt-frame]")
            const session = frame ? sessionByFrame.get(frame) : undefined
            if (!session) continue

            session.intersecting = entry.isIntersecting && entry.intersectionRatio > 0
            session.sufficientlyVisible = entry.intersectionRatio >= 0.7
            if (!session.intersecting && !session.activated && latestRequestedSession === session) {
              activationRequestId += 1
              session.activationRequestId = null
              latestRequestedSession = null
            }

            if (entry.intersectionRatio < 0.7 && session.ready && session.activated) {
              session.player?.pause()
            }
          }
        },
        { root: rail, threshold: 0.7 },
      )

      slides.forEach(slide => intersectionObserver?.observe(slide))
    }
  }

  const cleanup = () => {
    if (disposed) return
    disposed = true

    if (rail && updateNav) rail.removeEventListener("scroll", updateNav)
    if (prev && onPrevClick) prev.removeEventListener("click", onPrevClick)
    if (next && onNextClick) next.removeEventListener("click", onNextClick)
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()

    for (const session of sessions) {
      session.overlay.removeEventListener("click", session.onOverlayClick)
      session.accessibilityObserver?.disconnect()
      if (session.ready) {
        session.player?.pause()
        session.player?.destroy()
      }
      // When the SDK is loaded but Plyr is still waiting for the provider, its
      // disposed-aware ready handler performs the normal public teardown.
    }

    latestRequestedSession = null
    currentPlayingSession = null
    delete root.dataset.workHeroInited
    activeCleanups.delete(cleanup)
  }

  activeCleanups.add(cleanup)
}

function boot() {
  document.querySelectorAll<HTMLElement>("[data-work-hero]").forEach(initHero)
}

function cleanupAll() {
  for (const cleanup of [...activeCleanups]) cleanup()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true })
} else {
  boot()
}

document.addEventListener("astro:page-load", boot)
document.addEventListener("astro:before-swap", cleanupAll)
