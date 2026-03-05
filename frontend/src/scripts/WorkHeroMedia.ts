import * as PlyrModule from "plyr"

const Plyr: any = (PlyrModule as any).default ?? PlyrModule

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function getSlideLefts(slides: HTMLElement[]) {
  return slides.map(s => s.offsetLeft)
}

function nearestIndex(scrollLeft: number, lefts: number[]) {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < lefts.length; i++) {
    const d = Math.abs(lefts[i] - scrollLeft)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

function initSliderNav(
  root: HTMLElement,
  rail: HTMLElement,
  slides: HTMLElement[],
  onIndexChange?: (idx: number) => void,
) {
  if (slides.length <= 1) return

  const prev = root.querySelector<HTMLButtonElement>("[data-yt-prev]")
  const next = root.querySelector<HTMLButtonElement>("[data-yt-next]")
  const dotsWrap = root.querySelector<HTMLElement>("[data-yt-dots]")

  let lefts: number[] = []
  let active = 0

  const applyButtonState = () => {
    if (prev) prev.hidden = active === 0
    if (next) next.hidden = active === slides.length - 1
  }

  const applyDots = () => {
    if (!dotsWrap) return
    const dots = Array.from(dotsWrap.querySelectorAll<HTMLButtonElement>("[data-yt-dot]"))
    dots.forEach((d, i) => {
      if (i === active) d.setAttribute("aria-current", "true")
      else d.removeAttribute("aria-current")
    })
  }

  const setActive = (idx: number) => {
    active = clamp(idx, 0, slides.length - 1)
    onIndexChange?.(active)
    applyButtonState()
    applyDots()
  }

  const measure = () => {
    lefts = getSlideLefts(slides)
  }

  const snapToActive = (behavior: ScrollBehavior) => {
    measure()
    rail.scrollTo({ left: Math.max(0, lefts[active] ?? 0), behavior })
  }

  const scrollToIndex = (idx: number, behavior: ScrollBehavior = "smooth") => {
    setActive(idx)
    snapToActive(behavior)
  }

  if (dotsWrap && !dotsWrap.querySelector("[data-yt-dot]")) {
    dotsWrap.innerHTML = ""
    for (let i = 0; i < slides.length; i++) {
      const b = document.createElement("button")
      b.type = "button"
      b.setAttribute("data-yt-dot", "")
      b.setAttribute("aria-label", `Go to reel ${i + 1}`)
      if (i === active) b.setAttribute("aria-current", "true")
      b.addEventListener("click", () => scrollToIndex(i))
      dotsWrap.appendChild(b)
    }
  }

  prev?.addEventListener("click", () => scrollToIndex(active - 1))
  next?.addEventListener("click", () => scrollToIndex(active + 1))

  const ro = new ResizeObserver(() => {
    measure()
    snapToActive("auto")
  })
  ro.observe(rail)

  let isDown = false
  let startX = 0
  let startLeft = 0
  let moved = false
  let pointerId: number | null = null

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    isDown = true
    moved = false
    pointerId = e.pointerId
    startX = e.clientX
    startLeft = rail.scrollLeft
    rail.setPointerCapture(pointerId)
    rail.classList.add("is-dragging")
  }

  const onMove = (e: PointerEvent) => {
    if (!isDown) return
    const dx = e.clientX - startX
    if (Math.abs(dx) > 6) moved = true
    rail.scrollLeft = startLeft - dx
  }

  const onUp = () => {
    if (!isDown) return
    isDown = false
    pointerId = null
    rail.classList.remove("is-dragging")

    measure()
    const idx = nearestIndex(rail.scrollLeft, lefts)
    scrollToIndex(idx, "smooth")
  }

  rail.addEventListener("pointerdown", onDown)
  rail.addEventListener("pointermove", onMove)
  rail.addEventListener("pointerup", onUp)
  rail.addEventListener("pointercancel", onUp)

  rail.addEventListener(
    "click",
    e => {
      if (moved) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    true,
  )

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      active = 0
      setActive(0)
      snapToActive("auto")
    })
  })
}

function initHero(root: HTMLElement) {
  const embeds = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-embed]"))
  if (!embeds.length) return

  const players = embeds.map(el => {
    const ratio = el.getAttribute("data-yt-ratio") || "16:9"
    return new Plyr(el, {
      ratio,
      clickToPlay: false,
      controls: ["play", "progress", "current-time", "mute", "volume", "settings", "fullscreen"],
    })
  })

  const frames = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-frame]"))
  frames.forEach((frame, idx) => {
    const overlay = frame.querySelector<HTMLButtonElement>("[data-yt-overlay]")
    const player = players[idx]
    if (!overlay || !player) return

    player.on("playing", () => frame.classList.add("is-playing"))
    player.on("play", () => frame.classList.add("is-playing"))

    overlay.addEventListener("click", () => {
      frame.classList.remove("is-playing")
      player.play()
    })
  })

  const rail = root.querySelector<HTMLElement>("[data-yt-rail]")
  if (!rail) return

  const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-slide]"))

  const pauseAt = (idx: number) => {
    players[idx]?.pause()
    const frame = slides[idx]?.querySelector<HTMLElement>("[data-yt-frame]")
    if (frame) frame.classList.remove("is-playing")
  }

  initSliderNav(root, rail, slides, idx => {
    for (let i = 0; i < slides.length; i++) {
      if (i !== idx) pauseAt(i)
    }
  })

  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        const idx = slides.indexOf(entry.target as HTMLElement)
        if (idx === -1) continue
        if (!entry.isIntersecting) pauseAt(idx)
      }
    },
    { root: rail, threshold: 0.7 },
  )

  slides.forEach(s => io.observe(s))
}

document.querySelectorAll<HTMLElement>("[data-work-hero]").forEach(initHero)
