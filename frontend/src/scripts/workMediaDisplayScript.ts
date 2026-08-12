import Plyr from "plyr"
import {
  PlaybackAcknowledgementLease,
  PlaybackIntentCoordinator,
  PlyrKeyRepeatTracker,
  feedbackAfterSupersession,
  feedbackAfterVisibilityPause,
  playbackAcknowledgementAction,
  renderWorkMediaFeedback,
  shouldRecordPlayerShortcut,
  type PlaybackIntentSession,
  type WorkMediaFeedbackState,
} from "./workMediaPlayerState.ts"

type PlayerSession = PlaybackIntentSession & {
  player: Plyr | null
  frame: HTMLElement
  embed: HTMLElement
  overlay: HTMLButtonElement
  status: HTMLElement
  retry: HTMLButtonElement
  fallback: HTMLAnchorElement
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
  endedGuardRequestId: number | null
  replayBaselineTime: number | null
  replayRequiresReset: boolean
  replayPlayingRequestId: number | null
  replayProgressRequestId: number | null
  providerStateRevision: number
  shortcutRepeatTracker: PlyrKeyRepeatTracker
  accessibilityObserver: MutationObserver | null
  onReady: () => void
  onOverlayClick: (event: MouseEvent) => void
  onPlayerShortcutKey: (event: KeyboardEvent) => void
  onPlay: () => void
  onPlaying: () => void
  onWaiting: () => void
  onPause: () => void
  onTimeUpdate: () => void
  onEnded: () => void
  onError: () => void
}

type YouTubeWindow = Window & {
  YT?: { Player?: unknown }
  onYouTubeIframeAPIReady?: () => void
}

export type WorkMediaRuntime = {
  loadYouTubeApi: () => Promise<void>
  createPlayer: (embed: HTMLElement, options: Plyr.Options) => Plyr
}

const activeCleanups = new Set<() => void>()
const youtubeApiUrl = "https://www.youtube.com/iframe_api"
const playerReadyTimeoutMs = 15_000
const youtubeNoCookieOrigin = "https://www.youtube-nocookie.com"
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

export function initWorkMediaRoot(
  root: HTMLElement,
  runtime: WorkMediaRuntime = {
    loadYouTubeApi: ensureYouTubeApi,
    createPlayer: (embed, options) => new Plyr(embed, options),
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
  let currentPlayingSession: PlayerSession | null = null

  const setFeedback = (session: PlayerSession, state: WorkMediaFeedbackState) => {
    session.feedbackState = state
    renderWorkMediaFeedback(
      {
        overlay: session.overlay,
        status: session.status,
        retry: session.retry,
        fallback: session.fallback,
      },
      session.mediaTitle,
      state,
    )
  }

  const replayPositionShowsProgress = (session: PlayerSession, currentTime: number) => {
    const baselineTime = session.replayBaselineTime
    if (baselineTime === null || !Number.isFinite(currentTime)) return false

    const resetFromBaseline = currentTime < baselineTime - 0.05
    const advancedFromBaseline = currentTime > baselineTime + 0.01
    return resetFromBaseline || (!session.replayRequiresReset && advancedFromBaseline)
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
    session.providerStateRevision += 1
    playbackIntent.cancel(session)
    clearPlayAcknowledgement(session)
    session.endedGuardRequestId = null
    session.replayBaselineTime = null
    session.replayRequiresReset = false
    session.replayPlayingRequestId = null
    session.replayProgressRequestId = null
    if (currentPlayingSession === session) currentPlayingSession = null
  }

  const pauseSession = (session: PlayerSession) => {
    cancelPlayback(session)
    session.player?.pause()
  }

  const revealUnavailable = (session: PlayerSession) => {
    const playerContainer = session.frame.querySelector<HTMLElement>(".plyr")
    const activeElement = document.activeElement
    const moveFocusToFallback =
      activeElement === session.overlay ||
      activeElement === session.retry ||
      (activeElement instanceof Node && playerContainer?.contains(activeElement))

    session.providerUnavailable = true
    pauseSession(session)
    session.player?.toggleControls(true)
    setPlayerLocked(session.frame, session.embed, true)
    session.overlay.hidden = false
    setFeedback(session, "unavailable")
    if (moveFocusToFallback) session.fallback.focus()
  }

  const recordIntent = (session: PlayerSession, wantsPlayback: boolean) => {
    clearPlayAcknowledgement(session)
    const { requestId } = playbackIntent.record(session, wantsPlayback)
    session.providerStateRevision += 1
    const guardsReplay = wantsPlayback && session.lastAcknowledgedRequestId !== null
    const replayBaselineTime = session.player?.currentTime
    const replayDuration = session.player?.duration
    const finiteReplayBaseline = Number.isFinite(replayBaselineTime)
      ? (replayBaselineTime ?? null)
      : null
    const finiteReplayDuration = Number.isFinite(replayDuration) ? (replayDuration ?? null) : null
    session.endedGuardRequestId = guardsReplay ? requestId : null
    session.replayBaselineTime = guardsReplay ? finiteReplayBaseline : null
    session.replayRequiresReset = Boolean(
      guardsReplay &&
        (session.player?.ended ||
          (finiteReplayDuration !== null &&
            finiteReplayDuration > 0 &&
            finiteReplayBaseline !== null &&
            finiteReplayBaseline >= finiteReplayDuration - 0.01)),
    )
    session.replayPlayingRequestId = null
    session.replayProgressRequestId = null

    for (const other of sessions) {
      if (other === session) continue
      clearPlayAcknowledgement(other)
      clearPlayerReadyTimeout(other)
      other.providerStateRevision += 1
      other.endedGuardRequestId = null
      other.replayBaselineTime = null
      other.replayRequiresReset = false
      other.replayPlayingRequestId = null
      other.replayProgressRequestId = null
      if (currentPlayingSession === other) currentPlayingSession = null
      if (other.ready && other.activated) other.player?.pause()

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
    session.player?.toggleControls(true)
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

  const updatePlayAcknowledgement = (
    session: PlayerSession,
    event: "waiting" | "pause" | "playing",
  ) => {
    const action = playbackAcknowledgementAction(event, session.awaitingInitialPlaying)
    if (action === "acknowledge") {
      clearPlayAcknowledgement(session)
    } else if (action === "renew") {
      session.awaitingInitialPlaying = true
      renewPlayAcknowledgement(session)
    }
  }

  for (const embed of embeds) {
    const frame = embed.closest<HTMLElement>("[data-yt-frame]")
    const overlay = frame?.querySelector<HTMLButtonElement>("[data-yt-overlay]")
    const status = frame?.querySelector<HTMLElement>("[data-yt-status]")
    const retry = frame?.querySelector<HTMLButtonElement>("[data-yt-retry]")
    const fallback = frame?.querySelector<HTMLAnchorElement>("[data-yt-fallback]")
    if (!frame || !overlay || !status || !retry || !fallback) continue

    const mediaTitle = embed.dataset.ytTitle?.trim() || "project video"
    const youtubeVideoId = fallback.dataset.ytVideoId?.trim()
    if (youtubeVideoId) {
      fallback.href = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideoId)}`
    }

    const session: PlayerSession = {
      player: null,
      frame,
      embed,
      overlay,
      status,
      retry,
      fallback,
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
      endedGuardRequestId: null,
      replayBaselineTime: null,
      replayRequiresReset: false,
      replayPlayingRequestId: null,
      replayProgressRequestId: null,
      providerStateRevision: 0,
      shortcutRepeatTracker: new PlyrKeyRepeatTracker(),
      accessibilityObserver: null,
      onReady: () => undefined,
      onOverlayClick: () => undefined,
      onPlayerShortcutKey: () => undefined,
      onPlay: () => undefined,
      onPlaying: () => undefined,
      onWaiting: () => undefined,
      onPause: () => undefined,
      onTimeUpdate: () => undefined,
      onEnded: () => undefined,
      onError: () => undefined,
    }
    sessions.push(session)
    setFeedback(session, "idle")

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

      const playControl = frame.querySelector<HTMLButtonElement>(
        '.plyr__controls [data-plyr="play"]',
      )
      if (!playControl) {
        revealUnavailable(session)
        console.warn("Unable to initialize the YouTube player controls")
        return
      }

      const activationControlStillHasFocus =
        document.activeElement === overlay || document.activeElement === retry
      const focusRequestId = session.activationRequestId
      session.activated = true
      setPlayerLocked(frame, embed, false)
      player.toggleControls(true)
      overlay.hidden = true
      if (activationControlStillHasFocus) playControl.focus()

      const userActivation = (
        navigator as Navigator & { userActivation?: { isActive: boolean } }
      ).userActivation
      const canUseOriginalGesture = !userActivation || userActivation.isActive

      if (!session.sufficientlyVisible || !canUseOriginalGesture) {
        cancelPlayback(session)
        setFeedback(session, "ready")
      } else {
        startPlayAcknowledgement(session)
        try {
          const playAttempt = player.play()
          playAttempt?.catch(() => handlePlaybackBlocked(session, focusRequestId))
        } catch {
          handlePlaybackBlocked(session, focusRequestId)
        }
      }

      window.requestAnimationFrame(() => {
        frame
          .querySelector<HTMLElement>(".plyr")
          ?.removeAttribute("data-yt-player-unlocking")
      })
    }

    const createSessionPlayer = () => {
      if (disposed || session.player) return

      const player = runtime.createPlayer(embed, {
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
        listeners: {
          play: () => {
            const currentPlayer = session.player
            if (!currentPlayer || disposed || !session.activated) return

            if (session.providerUnavailable) {
              recordIntent(session, false)
              revealUnavailable(session)
              return false
            }

            const wantsPlayback = !currentPlayer.playing
            recordIntent(session, wantsPlayback)
            setFeedback(session, wantsPlayback ? "loading" : "playing")
            if (wantsPlayback) startPlayAcknowledgement(session)
          },
        },
        youtube: {
          rel: 0,
          modestbranding: 1,
          noCookie: true,
          widget_referrer: window.location.origin,
        },
      } as Plyr.Options)
      session.player = player

      const confirmProviderPlaying = () => {
        updatePlayAcknowledgement(session, "playing")
        session.lastAcknowledgedRequestId = session.activationRequestId
        currentPlayingSession = session
        setFeedback(session, "playing")
      }

      session.onReady = () => {
        clearPlayerReadyTimeout(session)
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

        if (playbackIntent.isWinning(session)) activate()
        else setPlayerLocked(frame, embed, true)
      }

      session.onPlay = () => {
        if (disposed) return
        playbackIntent.handleProviderPlayback(session, () => pauseSession(session))
      }

      session.onWaiting = () => {
        if (disposed) return
        if (!playbackIntent.handleProviderPlayback(session, () => pauseSession(session))) return
        updatePlayAcknowledgement(session, "waiting")
      }

      session.onPlaying = () => {
        if (disposed) return
        session.providerStateRevision += 1
        if (!session.sufficientlyVisible) {
          pauseSession(session)
          setFeedback(session, feedbackAfterVisibilityPause(session.feedbackState))
          return
        }
        if (!playbackIntent.handleProviderPlayback(session, () => pauseSession(session))) return

        const acknowledgedRequestId = session.activationRequestId
        let replayHasProgressEvidence = true
        if (
          acknowledgedRequestId !== null &&
          session.endedGuardRequestId === acknowledgedRequestId
        ) {
          session.replayPlayingRequestId = acknowledgedRequestId
          replayHasProgressEvidence =
            session.lastAcknowledgedRequestId === acknowledgedRequestId ||
            session.replayProgressRequestId === acknowledgedRequestId ||
            replayPositionShowsProgress(session, player.currentTime)
          if (replayHasProgressEvidence) {
            session.replayProgressRequestId = acknowledgedRequestId
          }
        }

        if (!replayHasProgressEvidence) {
          setFeedback(session, "loading")
          return
        }

        confirmProviderPlaying()
      }

      session.onPause = () => {
        if (currentPlayingSession === session) currentPlayingSession = null
        const requestId = session.activationRequestId
        const pauseRevision = ++session.providerStateRevision
        if (!playbackIntent.isWinning(session, requestId)) return

        queueMicrotask(() => {
          if (
            disposed ||
            session.providerUnavailable ||
            session.providerStateRevision !== pauseRevision ||
            !playbackIntent.isWinning(session, requestId)
          ) {
            return
          }
          updatePlayAcknowledgement(session, "pause")
          setFeedback(session, "loading")
        })
      }

      session.onTimeUpdate = () => {
        if (
          disposed ||
          session.providerUnavailable ||
          session.endedGuardRequestId === null ||
          session.endedGuardRequestId !== session.activationRequestId ||
          session.replayPlayingRequestId !== session.activationRequestId ||
          !player.playing ||
          !playbackIntent.isWinning(session)
        ) {
          return
        }

        const currentTime = player.currentTime
        if (replayPositionShowsProgress(session, currentTime)) {
          session.replayProgressRequestId = session.activationRequestId
          if (session.lastAcknowledgedRequestId !== session.activationRequestId) {
            confirmProviderPlaying()
          }
        }
      }

      session.onEnded = () => {
        if (disposed || session.providerUnavailable) return
        session.providerStateRevision += 1
        const guardsNewerPlayback =
          session.endedGuardRequestId !== null &&
          session.endedGuardRequestId === session.activationRequestId
        const duration = player.duration
        const currentTime = player.currentTime
        const endTolerance = Math.max(0.25, duration * 0.001)
        const isNaturalEndPosition =
          Number.isFinite(duration) &&
          duration > 0 &&
          Number.isFinite(currentTime) &&
          currentTime >= duration - endTolerance
        const replayHasProgressEvidence =
          session.replayPlayingRequestId === session.activationRequestId &&
          (session.replayProgressRequestId === session.activationRequestId ||
            replayPositionShowsProgress(session, currentTime))
        const guardsUnsettledReplay =
          guardsNewerPlayback && (!replayHasProgressEvidence || !isNaturalEndPosition)
        const providerRequestUnsettled =
          (session.awaitingInitialPlaying ||
            session.lastAcknowledgedRequestId !== session.activationRequestId) &&
          !replayHasProgressEvidence
        if (
          playbackIntent.isWinning(session) &&
          (guardsUnsettledReplay || providerRequestUnsettled)
        ) {
          session.awaitingInitialPlaying = true
          renewPlayAcknowledgement(session)
          setFeedback(session, "loading")
          return
        }

        cancelPlayback(session)
        setFeedback(session, "playing")
      }

      session.onError = () => {
        if (disposed) return
        clearPlayerReadyTimeout(session)
        session.providerStateRevision += 1
        const shouldReveal = playbackIntent.isCurrent(session)
        session.providerUnavailable = true
        cancelPlayback(session)
        if (shouldReveal) revealUnavailable(session)
      }

      player.on("ready", session.onReady)
      player.on("play", session.onPlay)
      player.on("playing", session.onPlaying)
      player.on("waiting", session.onWaiting)
      player.on("pause", session.onPause)
      player.on("timeupdate", session.onTimeUpdate)
      player.on("ended", session.onEnded)
      player.on("error", session.onError)

      // Plyr creates its container synchronously but finishes the provider setup later.
      setPlayerLocked(frame, embed, true)
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
        const restoreRetryFocus = activeElement === overlay || activeElement === retry
        playbackIntent.clear(session)
        overlay.hidden = false
        setPlayerLocked(frame, embed, true)
        setFeedback(session, "error")
        if (restoreRetryFocus) retry.focus()
        console.warn("The YouTube player did not become ready")
      }, playerReadyTimeoutMs)
      session.readyTimeoutId = timeoutId
    }

    session.onPlayerShortcutKey = event => {
      const player = session.player
      if (disposed || !player || !session.activated) return

      const target = event.target instanceof Element ? event.target : null
      const playerContainer = target?.closest(".plyr")
      const eventWithinPlayer = Boolean(playerContainer && frame.contains(playerContainer))
      const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      if (!eventWithinPlayer || modified || !event.key) return

      if (event.type === "keyup") {
        session.shortcutRepeatTracker.release()
        return
      }

      const focused = document.activeElement instanceof Element ? document.activeElement : null
      const focusedIsSeek = focused?.matches('[data-plyr="seek"]') ?? false
      const focusedIsEditable =
        focused?.matches("input, textarea, select, [contenteditable]") ?? false
      const focusedIsButtonOrMenuitem =
        focused?.matches('button, [role^="menuitem"]') ?? false
      if (focusedIsEditable && !focusedIsSeek) return
      if (event.key === " " && focusedIsButtonOrMenuitem) return

      const repeatedKey = session.shortcutRepeatTracker.press(event.key)
      const shouldRecord = shouldRecordPlayerShortcut({
        key: event.key,
        repeatedKey,
        modified,
        eventWithinPlayer,
        focusedIsEditable,
        focusedIsSeek,
        focusedIsButtonOrMenuitem,
      })
      if (!shouldRecord) return

      if (session.providerUnavailable) {
        recordIntent(session, false)
        revealUnavailable(session)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      const wantsPlayback = !player.playing
      recordIntent(session, wantsPlayback)
      setFeedback(session, wantsPlayback ? "loading" : "playing")
      if (wantsPlayback) startPlayAcknowledgement(session)
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
          playbackIntent.clear(session)
          overlay.hidden = false
          setFeedback(session, "error")
          if (restoreRetryFocus) retry.focus()
          console.warn("Unable to initialize the YouTube player", error)
        })
    }

    overlay.addEventListener("click", session.onOverlayClick)
    retry.addEventListener("click", session.onOverlayClick)
    frame.addEventListener("keydown", session.onPlayerShortcutKey, true)
    frame.addEventListener("keyup", session.onPlayerShortcutKey, true)
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
    const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-slide]"))
    const paginationDots = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-dot]"))
    const paginationStatus = root.querySelector<HTMLElement>("[data-yt-pagination-status]")

    const getAmount = () => {
      const first = rail.querySelector<HTMLElement>("[data-yt-slide]")
      if (!first) return 178
      const gapValue = getComputedStyle(rail).gap || "18px"
      const gap = Number.parseFloat(gapValue) || 18
      return first.getBoundingClientRect().width + gap
    }

    const scrollByCard = (direction: "left" | "right") => {
      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      rail.scrollBy({
        left: direction === "left" ? -getAmount() : getAmount(),
        behavior: reduceMotion ? "auto" : "smooth",
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
      const atStart = left <= 2
      const atEnd = left >= max - 2

      if (atStart && document.activeElement === prev && next && !atEnd) next.focus()
      if (atEnd && document.activeElement === next && prev && !atStart) prev.focus()
      if (prev) prev.hidden = atStart
      if (next) next.hidden = atEnd
      if (paginationDots.length > 0 || paginationStatus) {
        const amount = getAmount()
        const activeIndex = Math.min(
          Math.max(0, slides.length - 1),
          Math.max(0, Math.round(left / amount)),
        )
        paginationDots.forEach((dot, index) => {
          dot.classList.toggle("is-active", index === activeIndex)
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
      const landscapeRail = rail.classList?.contains("yt-rail--landscape") ?? false

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
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    playbackIntent.dispose()

    for (const session of sessions) {
      session.overlay.removeEventListener("click", session.onOverlayClick)
      session.retry.removeEventListener("click", session.onOverlayClick)
      session.frame.removeEventListener("keydown", session.onPlayerShortcutKey, true)
      session.frame.removeEventListener("keyup", session.onPlayerShortcutKey, true)
      clearPlayAcknowledgement(session)
      clearPlayerReadyTimeout(session)
      session.accessibilityObserver?.disconnect()
      if (session.ready) {
        session.player?.pause()
        session.player?.destroy()
      }
      // When the SDK is loaded but Plyr is still waiting for the provider, its
      // disposed-aware ready handler performs the normal public teardown.
    }

    currentPlayingSession = null
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
