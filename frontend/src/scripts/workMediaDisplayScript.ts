import {
  PlaybackAcknowledgementLease,
  PlaybackIntentCoordinator,
  feedbackAfterSupersession,
  feedbackAfterVisibilityPause,
  renderWorkMediaFeedback,
  type PlaybackIntentSession,
  type WorkMediaFeedbackState,
} from "./workMediaPlayerState.ts"

type YouTubePlayer = {
  playVideo: () => void
  pauseVideo: () => void
  destroy: () => void
  getPlayerState: () => number
  getCurrentTime: () => number
  getDuration: () => number
  getIframe: () => HTMLIFrameElement
}

type YouTubePlayerEvent = { target: YouTubePlayer }
type YouTubePlayerStateEvent = YouTubePlayerEvent & { data: number }
type YouTubePlayerErrorEvent = YouTubePlayerEvent & { data: number }

type YouTubePlayerOptions = {
  events: {
    onReady: (event: YouTubePlayerEvent) => void
    onStateChange: (event: YouTubePlayerStateEvent) => void
    onError: (event: YouTubePlayerErrorEvent) => void
    onAutoplayBlocked: (event: YouTubePlayerEvent) => void
  }
}

type YouTubePlayerConstructor = new (
  iframe: HTMLIFrameElement,
  options: YouTubePlayerOptions,
) => YouTubePlayer

type PlayerSession = PlaybackIntentSession & {
  player: YouTubePlayer | null
  iframe: HTMLIFrameElement | null
  frame: HTMLElement
  embed: HTMLElement
  overlay: HTMLButtonElement
  status: HTMLElement
  retry: HTMLButtonElement
  mediaTitle: string
  ready: boolean
  activated: boolean
  intersecting: boolean
  sufficientlyVisible: boolean
  feedbackState: WorkMediaFeedbackState
  playAcknowledgement: PlaybackAcknowledgementLease
  readyTimeoutId: number | null
  awaitingInitialPlaying: boolean
  providerUnavailable: boolean
  lastAcknowledgedRequestId: number | null
  playerRevision: number
  onOverlayClick: (event: MouseEvent) => void
}

type YouTubeWindow = Window & {
  YT?: { Player?: YouTubePlayerConstructor }
  onYouTubeIframeAPIReady?: () => void
}

export type WorkMediaRuntime = {
  loadYouTubeApi: () => Promise<void>
  createPlayer: (iframe: HTMLIFrameElement, options: YouTubePlayerOptions) => YouTubePlayer
}

const activeCleanups = new Set<() => void>()
const youtubeApiUrl = "https://www.youtube.com/iframe_api"
const playerReadyTimeoutMs = 15_000
const youtubeNoCookieOrigin = "https://www.youtube-nocookie.com"
const unavailableYouTubeErrorCodes = new Set([2, 5, 100, 101, 150, 153])
const youtubePlayerState = {
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
} as const
const failedYouTubeApiScripts = new WeakSet<HTMLScriptElement>()
let youtubeApiPromise: Promise<void> | undefined

function hasYouTubeApi(youtubeWindow: YouTubeWindow) {
  return typeof youtubeWindow.YT?.Player === "function"
}

function ensureYouTubeNoCookiePreconnect() {
  if (document.querySelector(`link[rel="preconnect"][href="${youtubeNoCookieOrigin}"]`)) return

  const link = document.createElement("link")
  link.rel = "preconnect"
  link.href = youtubeNoCookieOrigin
  link.dataset.workMediaYoutubePreconnect = "1"
  document.head.append(link)
}

function createYouTubeIframe(videoId: string, mediaTitle: string) {
  const iframe = document.createElement("iframe")
  const parameters = new URLSearchParams({
    controls: "1",
    playsinline: "1",
    enablejsapi: "1",
    rel: "0",
    origin: window.location.origin,
    widget_referrer: window.location.origin,
  })

  iframe.src = `${youtubeNoCookieOrigin}/embed/${encodeURIComponent(videoId)}?${parameters}`
  iframe.title = mediaTitle
  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  iframe.allowFullscreen = true
  iframe.referrerPolicy = "strict-origin-when-cross-origin"
  iframe.setAttribute("frameborder", "0")
  iframe.setAttribute("inert", "")
  iframe.setAttribute("aria-hidden", "true")
  return iframe
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

function setPlayerLocked(embed: HTMLElement, iframe: HTMLIFrameElement | null, locked: boolean) {
  for (const target of [embed, iframe]) {
    if (!target) continue
    target.toggleAttribute("inert", locked)
    if (locked) {
      target.setAttribute("aria-hidden", "true")
    } else {
      target.removeAttribute("aria-hidden")
    }
  }
}

export function initWorkMediaRoot(
  root: HTMLElement,
  runtime: WorkMediaRuntime = {
    loadYouTubeApi: ensureYouTubeApi,
    createPlayer: (iframe, options) => {
      const Player = (window as YouTubeWindow).YT?.Player
      if (!Player) throw new Error("The YouTube player API is unavailable")
      return new Player(iframe, options)
    },
  },
) {
  if (root.dataset.workHeroInited === "1") return
  root.dataset.workHeroInited = "1"

  const embeds = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-embed]"))
  if (!embeds.length) {
    delete root.dataset.workHeroInited
    return
  }

  let disposed = false
  const sessions: PlayerSession[] = []
  const playbackIntent = new PlaybackIntentCoordinator(() => sessions)

  const setFeedback = (session: PlayerSession, state: WorkMediaFeedbackState) => {
    session.feedbackState = state
    session.frame.dataset.ytFeedbackState = state
    renderWorkMediaFeedback(
      {
        overlay: session.overlay,
        status: session.status,
        retry: session.retry,
      },
      session.mediaTitle,
      state,
    )
  }

  const clearPlayAcknowledgement = (session: PlayerSession) => {
    session.awaitingInitialPlaying = false
    session.playAcknowledgement.acknowledge()
  }

  const clearPlayerReadyTimeout = (session: PlayerSession) => {
    if (session.readyTimeoutId === null) return
    window.clearTimeout(session.readyTimeoutId)
    session.readyTimeoutId = null
  }

  const cancelPlayback = (session: PlayerSession) => {
    playbackIntent.cancel(session)
    clearPlayAcknowledgement(session)
  }

  const pauseSession = (session: PlayerSession) => {
    cancelPlayback(session)
    try {
      session.player?.pauseVideo()
    } catch {
      // A provider can disappear between a visibility change and this command.
    }
  }

  const revealUnavailable = (session: PlayerSession) => {
    const activeElement = document.activeElement
    const moveFocusToIframe =
      activeElement === session.overlay ||
      activeElement === session.retry ||
      activeElement === session.iframe

    session.providerUnavailable = true
    pauseSession(session)
    session.overlay.hidden = true
    setPlayerLocked(session.embed, session.iframe, false)
    setFeedback(session, "unavailable")
    if (moveFocusToIframe) session.iframe?.focus()
  }

  const recordIntent = (session: PlayerSession, wantsPlayback: boolean) => {
    clearPlayAcknowledgement(session)
    const { requestId } = playbackIntent.record(session, wantsPlayback)

    for (const other of sessions) {
      if (other === session) continue
      clearPlayAcknowledgement(other)
      clearPlayerReadyTimeout(other)
      if (other.ready && other.activated) {
        try {
          other.player?.pauseVideo()
        } catch {
          // The stale player will be reconciled by its next provider event.
        }
      }

      const nextFeedback = feedbackAfterSupersession(other.feedbackState, other.activated)
      if (nextFeedback) {
        if (!other.activated) other.overlay.hidden = false
        setFeedback(other, nextFeedback)
      }
    }

    return requestId
  }

  const handlePlaybackBlocked = (session: PlayerSession, requestId: number | null) => {
    if (disposed || !playbackIntent.isWinning(session, requestId)) return
    pauseSession(session)
    setFeedback(session, "ready")
  }

  const renewPlayAcknowledgement = (session: PlayerSession) => {
    if (!session.awaitingInitialPlaying) return
    const requestId = session.activationRequestId
    if (!playbackIntent.isWinning(session, requestId)) return

    session.playAcknowledgement.acknowledge()
    session.playAcknowledgement.arm(() => {
      handlePlaybackBlocked(session, requestId)
    })
  }

  const startPlayAcknowledgement = (session: PlayerSession) => {
    clearPlayAcknowledgement(session)
    session.awaitingInitialPlaying = true
    renewPlayAcknowledgement(session)
  }

  for (const embed of embeds) {
    const frame = embed.closest<HTMLElement>("[data-yt-frame]")
    const overlay = frame?.querySelector<HTMLButtonElement>("[data-yt-overlay]")
    const status = frame?.querySelector<HTMLElement>("[data-yt-status]")
    const retry = frame?.querySelector<HTMLButtonElement>("[data-yt-retry]")
    if (!frame || !overlay || !status || !retry) continue

    const mediaTitle = embed.dataset.ytTitle?.trim() || "project video"
    const youtubeVideoId = embed.dataset.ytVideoId?.trim()

    const session: PlayerSession = {
      player: null,
      iframe: null,
      frame,
      embed,
      overlay,
      status,
      retry,
      mediaTitle,
      ready: false,
      activationRequestId: null,
      wantsPlayback: false,
      activated: false,
      intersecting: true,
      sufficientlyVisible: true,
      feedbackState: "idle",
      playAcknowledgement: new PlaybackAcknowledgementLease({
        set: (callback, delay) => window.setTimeout(callback, delay),
        clear: timeoutId => window.clearTimeout(timeoutId),
      }),
      readyTimeoutId: null,
      awaitingInitialPlaying: false,
      providerUnavailable: false,
      lastAcknowledgedRequestId: null,
      playerRevision: 0,
      onOverlayClick: () => undefined,
    }
    sessions.push(session)
    setFeedback(session, "idle")

    const resetSessionPlayer = () => {
      clearPlayerReadyTimeout(session)
      clearPlayAcknowledgement(session)
      session.playerRevision += 1
      const player = session.player
      const iframe = session.iframe
      session.player = null
      session.iframe = null
      session.ready = false
      session.activated = false
      try {
        player?.destroy()
      } catch {
        // The provider may already have torn itself down after an error.
      }
      iframe?.remove()
      setPlayerLocked(embed, null, true)
    }

    const showRetryableError = (restoreFocus: boolean, warning: string, error?: unknown) => {
      playbackIntent.clear(session)
      resetSessionPlayer()
      overlay.hidden = false
      setFeedback(session, "error")
      if (restoreFocus) retry.focus()
      if (error === undefined) console.warn(warning)
      else console.warn(warning, error)
    }

    const activate = () => {
      const player = session.player
      if (
        disposed ||
        !player ||
        session.activated ||
        !session.ready ||
        !playbackIntent.isWinning(session)
      ) {
        return
      }

      const activationControlStillHasFocus =
        document.activeElement === overlay || document.activeElement === retry
      const requestId = session.activationRequestId
      session.activated = true
      overlay.hidden = true
      setPlayerLocked(embed, session.iframe, !session.sufficientlyVisible)
      if (activationControlStillHasFocus && session.sufficientlyVisible) {
        session.iframe?.focus()
      }

      if (!session.sufficientlyVisible) {
        cancelPlayback(session)
        setFeedback(session, "ready")
      } else {
        startPlayAcknowledgement(session)
        try {
          player.playVideo()
        } catch {
          handlePlaybackBlocked(session, requestId)
        }
      }
    }

    const createSessionPlayer = () => {
      if (disposed || session.player) return
      if (!youtubeVideoId) throw new Error("The YouTube video ID is missing")

      const iframe = createYouTubeIframe(youtubeVideoId, mediaTitle)
      embed.replaceChildren(iframe)
      session.iframe = iframe
      setPlayerLocked(embed, iframe, true)
      const revision = ++session.playerRevision

      const acceptsEvent = (eventPlayer: YouTubePlayer) =>
        !disposed &&
        session.playerRevision === revision &&
        (!session.player || session.player === eventPlayer)

      const takeEventPlayer = (eventPlayer: YouTubePlayer) => {
        if (!acceptsEvent(eventPlayer)) return false
        if (!session.player) session.player = eventPlayer
        return true
      }

      const confirmProviderPlaying = () => {
        clearPlayAcknowledgement(session)
        session.lastAcknowledgedRequestId = session.activationRequestId
        setFeedback(session, "playing")
      }

      const onReady = ({ target }: YouTubePlayerEvent) => {
        if (!takeEventPlayer(target)) return
        clearPlayerReadyTimeout(session)
        session.ready = true
        const playerIframe = target.getIframe?.()
        if (playerIframe) {
          session.iframe = playerIframe
          playerIframe.title = mediaTitle
        }

        if (session.providerUnavailable) {
          session.overlay.hidden = true
          setPlayerLocked(embed, session.iframe, false)
          return
        }

        if (playbackIntent.isWinning(session)) activate()
        else setPlayerLocked(embed, session.iframe, true)
      }

      const onStateChange = ({ target, data }: YouTubePlayerStateEvent) => {
        if (!takeEventPlayer(target) || session.providerUnavailable) return

        if (data === youtubePlayerState.playing) {
          if (!session.ready || !session.activated || !session.sufficientlyVisible) {
            pauseSession(session)
            setFeedback(session, feedbackAfterVisibilityPause(session.feedbackState))
            return
          }

          // Native controls live inside a cross-origin iframe, so PLAYING is the
          // first reliable signal that the visitor requested playback there.
          if (!playbackIntent.isWinning(session)) {
            const anotherSessionIsWinning = sessions.some(
              other => other !== session && playbackIntent.isWinning(other),
            )
            if (anotherSessionIsWinning && document.activeElement !== session.iframe) {
              pauseSession(session)
              return
            }
            recordIntent(session, true)
          }
          confirmProviderPlaying()
          return
        }

        if (data === youtubePlayerState.buffering) {
          if (playbackIntent.isWinning(session) && session.awaitingInitialPlaying) {
            clearPlayAcknowledgement(session)
          }
          return
        }

        if (data === youtubePlayerState.paused) {
          if (!playbackIntent.isWinning(session)) return
          if (session.awaitingInitialPlaying) {
            renewPlayAcknowledgement(session)
            setFeedback(session, "loading")
          } else {
            cancelPlayback(session)
            setFeedback(session, "playing")
          }
          return
        }

        if (data === youtubePlayerState.ended) {
          cancelPlayback(session)
          setFeedback(session, "playing")
        }
      }

      const onError = ({ target, data }: YouTubePlayerErrorEvent) => {
        if (!takeEventPlayer(target) || session.providerUnavailable) return
        clearPlayerReadyTimeout(session)
        const activeElement = document.activeElement
        const restoreFocus =
          activeElement === overlay || activeElement === retry || activeElement === session.iframe

        if (unavailableYouTubeErrorCodes.has(data)) {
          revealUnavailable(session)
          return
        }

        showRetryableError(restoreFocus, `The YouTube player failed with error ${data}`)
      }

      const onAutoplayBlocked = ({ target }: YouTubePlayerEvent) => {
        if (!takeEventPlayer(target) || session.providerUnavailable) return
        handlePlaybackBlocked(session, session.activationRequestId)
      }

      try {
        const player = runtime.createPlayer(iframe, {
          events: { onReady, onStateChange, onError, onAutoplayBlocked },
        })

        if (disposed || session.playerRevision !== revision) {
          player.destroy()
          return
        }
        if (!session.player) session.player = player
      } catch (error) {
        if (session.playerRevision === revision) resetSessionPlayer()
        throw error
      }
    }

    const armPlayerReadyTimeout = (requestId: number) => {
      clearPlayerReadyTimeout(session)
      const pendingPlayer = session.player
      if (!pendingPlayer || session.ready || !playbackIntent.isWinning(session, requestId)) return

      const timeoutId = window.setTimeout(() => {
        if (session.readyTimeoutId !== timeoutId) return
        session.readyTimeoutId = null
        if (
          disposed ||
          session.player !== pendingPlayer ||
          session.ready ||
          !playbackIntent.isWinning(session, requestId)
        ) {
          return
        }

        const activeElement = document.activeElement
        const restoreRetryFocus =
          activeElement === overlay || activeElement === retry || activeElement === session.iframe
        showRetryableError(
          restoreRetryFocus,
          "The YouTube player did not become ready",
        )
      }, playerReadyTimeoutMs)
      session.readyTimeoutId = timeoutId
    }

    session.onOverlayClick = event => {
      event.preventDefault()
      event.stopPropagation()
      if (overlay.getAttribute("aria-disabled") === "true") return

      if (session.providerUnavailable) {
        recordIntent(session, false)
        revealUnavailable(session)
        return
      }

      const activationControlHadFocus =
        document.activeElement === overlay || document.activeElement === retry
      if (document.activeElement === retry) overlay.focus()
      const requestedId = recordIntent(session, true)
      setFeedback(session, "loading")

      if (session.player) {
        if (!session.ready) armPlayerReadyTimeout(requestedId)
        activate()
        return
      }

      ensureYouTubeNoCookiePreconnect()
      void runtime
        .loadYouTubeApi()
        .then(() => {
          if (disposed || !playbackIntent.isWinning(session, requestedId)) return

          createSessionPlayer()
          armPlayerReadyTimeout(requestedId)
          activate()
        })
        .catch(error => {
          if (disposed || !playbackIntent.isCurrent(session, requestedId)) return
          const activeElement = document.activeElement
          const restoreRetryFocus =
            activationControlHadFocus && (activeElement === overlay || activeElement === retry)
          showRetryableError(
            restoreRetryFocus,
            "Unable to initialize the YouTube player",
            error,
          )
        })
    }

    overlay.addEventListener("click", session.onOverlayClick)
    retry.addEventListener("click", session.onOverlayClick)
    setPlayerLocked(embed, null, true)
  }

  const rail = root.querySelector<HTMLElement>("[data-yt-rail]")
  const prev = root.querySelector<HTMLButtonElement>("[data-yt-prev]")
  const next = root.querySelector<HTMLButtonElement>("[data-yt-next]")
  let resizeObserver: ResizeObserver | undefined
  let intersectionObserver: IntersectionObserver | undefined
  let onPrevClick: ((event: MouseEvent) => void) | undefined
  let onNextClick: ((event: MouseEvent) => void) | undefined
  const dotClickHandlers: Array<{
    dot: HTMLElement
    handler: (event: MouseEvent) => void
  }> = []
  let updateNav: (() => void) | undefined

  if (rail) {
    const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-slide]"))
    const paginationDots = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-dot]"))
    const paginationStatus = root.querySelector<HTMLElement>("[data-yt-pagination-status]")
    const landscapeRail = rail.classList?.contains("yt-rail--landscape") ?? false

    const getAmount = () => {
      const first = rail.querySelector<HTMLElement>("[data-yt-slide]")
      if (!first) return 178
      const gapValue = getComputedStyle(rail).gap || "18px"
      const gap = Number.parseFloat(gapValue) || 18
      return first.getBoundingClientRect().width + gap
    }

    const getActiveIndex = (left: number) => {
      const amount = getAmount()
      return Math.min(
        Math.max(0, slides.length - 1),
        Math.max(0, Math.round(left / amount)),
      )
    }

    const syncNavControls = (left: number, activeIndex: number) => {
      const max = Math.max(0, rail.scrollWidth - rail.clientWidth)
      const atStart = landscapeRail ? activeIndex === 0 : left <= 2
      const atEnd = landscapeRail ? activeIndex === slides.length - 1 : left >= max - 2
      const focusedControl = document.activeElement

      if (prev) prev.hidden = atStart
      if (next) next.hidden = atEnd
      if (atStart && focusedControl === prev && next && !atEnd) next.focus()
      if (atEnd && focusedControl === next && prev && !atStart) prev.focus()
    }

    const getScrollBehavior = (): ScrollBehavior => {
      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      return reduceMotion ? "auto" : "smooth"
    }

    const scrollToIndex = (index: number) => {
      const amount = getAmount()
      const boundedIndex = Math.min(
        Math.max(0, slides.length - 1),
        Math.max(0, index),
      )
      rail.scrollTo({
        left: boundedIndex * amount,
        behavior: getScrollBehavior(),
      })
    }

    const scrollByCard = (direction: "left" | "right") => {
      const activeIndex = getActiveIndex(rail.scrollLeft)
      scrollToIndex(activeIndex + (direction === "left" ? -1 : 1))
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
    paginationDots.forEach((dot, index) => {
      const handler = (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        scrollToIndex(index)
      }
      dot.addEventListener("click", handler)
      dotClickHandlers.push({ dot, handler })
    })

    updateNav = () => {
      const left = rail.scrollLeft
      const tracksActiveSlide = landscapeRail || paginationDots.length > 0 || Boolean(paginationStatus)
      const activeIndex = tracksActiveSlide ? getActiveIndex(left) : 0
      syncNavControls(left, activeIndex)
      if (paginationDots.length > 0 || paginationStatus) {
        paginationDots.forEach((dot, index) => {
          const active = index === activeIndex
          dot.classList.toggle("is-active", active)
          if (active) dot.setAttribute("aria-current", "true")
          else dot.removeAttribute("aria-current")
        })
        if (paginationStatus && slides[activeIndex]) {
          const title = slides[activeIndex]
            .querySelector<HTMLElement>(".yt-slide__title")
            ?.textContent
            ?.trim()
          paginationStatus.textContent = `Video ${activeIndex + 1} of ${slides.length}${title ? `: ${title}` : ""}`
        }
      }
    }

    updateNav()
    rail.addEventListener("scroll", updateNav, { passive: true })

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateNav)
      resizeObserver.observe(rail)
    }

    if (typeof IntersectionObserver !== "undefined") {
      const sessionByFrame = new Map(sessions.map(session => [session.frame, session]))

      intersectionObserver = new IntersectionObserver(
        entries => {
          if (disposed) return

          for (const entry of entries) {
            const slide = entry.target as HTMLElement
            const frame = slide.querySelector<HTMLElement>("[data-yt-frame]")
            const session = frame ? sessionByFrame.get(frame) : undefined
            if (!session) continue

            session.intersecting = entry.isIntersecting && entry.intersectionRatio > 0
            session.sufficientlyVisible = entry.intersectionRatio >= 0.7
            if (session.ready && session.activated && !session.providerUnavailable) {
              setPlayerLocked(
                session.embed,
                session.iframe,
                !session.sufficientlyVisible,
              )
            }
            if (landscapeRail) {
              slide.toggleAttribute("inert", !session.sufficientlyVisible)
              if (session.sufficientlyVisible) {
                slide.removeAttribute("aria-hidden")
                slide.setAttribute("aria-current", "true")
              } else {
                slide.setAttribute("aria-hidden", "true")
                slide.removeAttribute("aria-current")
              }
            }
            if (
              !session.intersecting &&
              !session.activated &&
              playbackIntent.isCurrent(session)
            ) {
              playbackIntent.clear(session)
              clearPlayerReadyTimeout(session)
              setFeedback(session, "idle")
            }

            if (entry.intersectionRatio < 0.7 && session.ready && session.activated) {
              pauseSession(session)
              setFeedback(session, feedbackAfterVisibilityPause(session.feedbackState))
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
    for (const { dot, handler } of dotClickHandlers) {
      dot.removeEventListener("click", handler)
    }
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    playbackIntent.dispose()

    for (const session of sessions) {
      session.overlay.removeEventListener("click", session.onOverlayClick)
      session.retry.removeEventListener("click", session.onOverlayClick)
      session.overlay.removeAttribute("tabindex")
      delete session.frame.dataset.ytFeedbackState
      clearPlayAcknowledgement(session)
      clearPlayerReadyTimeout(session)
      session.playerRevision += 1
      try {
        session.player?.pauseVideo()
      } catch {
        // The provider may already be unavailable while Astro swaps the page.
      }
      try {
        session.player?.destroy()
      } catch {
        // The provider may already have destroyed itself.
      }
      session.iframe?.remove()
      session.player = null
      session.iframe = null
    }

    delete root.dataset.workHeroInited
    activeCleanups.delete(cleanup)
  }

  activeCleanups.add(cleanup)
  return cleanup
}

function boot() {
  document.querySelectorAll<HTMLElement>("[data-work-hero]").forEach(root => {
    initWorkMediaRoot(root)
  })
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
