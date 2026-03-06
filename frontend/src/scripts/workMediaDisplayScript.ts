import * as PlyrModule from "plyr"

const Plyr: any = (PlyrModule as any).default ?? PlyrModule

console.log("workMediaDisplayScript loaded")

function initHero(root: HTMLElement) {
  if (root.dataset.workHeroInited === "1") return
  root.dataset.workHeroInited = "1"

  const embeds = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-embed]"))
  if (!embeds.length) return

  const players = embeds.map(el => {
    const ratio = el.getAttribute("data-yt-ratio") || "16:9"
    return new Plyr(el, {
      ratio,
      clickToPlay: false,
      controls: ["play", "progress", "current-time", "mute", "volume", "settings", "fullscreen"],
      youtube: {
        rel: 0,
        modestbranding: 1,
      },
    })
  })

  const frames = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-frame]"))

  frames.forEach((frame, idx) => {
    const overlay = frame.querySelector<HTMLButtonElement>("[data-yt-overlay]")
    const player = players[idx]
    if (!overlay || !player) return

    let ready = false
    let playRequested = false

    player.on("ready", () => {
      ready = true
      if (playRequested) {
        player.play()
        playRequested = false
      }
    })

    player.on("playing", () => {
      frame.classList.add("is-playing")
    })

    player.on("play", () => {
      frame.classList.add("is-playing")
    })

    player.on("pause", () => {
      frame.classList.remove("is-playing")
    })

    player.on("ended", () => {
      frame.classList.remove("is-playing")
    })

    overlay.addEventListener("click", e => {
      e.preventDefault()
      e.stopPropagation()

      if (ready) {
        player.play()
      } else {
        playRequested = true
      }
    })
  })

  const rail = root.querySelector<HTMLElement>("[data-yt-rail]")
  if (!rail) return

  const prev = root.querySelector<HTMLButtonElement>("[data-yt-prev]")
  const next = root.querySelector<HTMLButtonElement>("[data-yt-next]")

  const getAmount = () => {
    const first = rail.querySelector<HTMLElement>("[data-yt-slide]")
    if (!first) return 178
    const gapValue = getComputedStyle(rail).gap || "18px"
    const gap = Number.parseFloat(gapValue) || 18
    return first.getBoundingClientRect().width + gap
  }

  const scrollByCard = (dir: "left" | "right") => {
    const amount = getAmount()
    rail.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    })
  }

  prev?.addEventListener("click", e => {
    e.preventDefault()
    e.stopPropagation()
    scrollByCard("left")
  })

  next?.addEventListener("click", e => {
    e.preventDefault()
    e.stopPropagation()
    scrollByCard("right")
  })

  const updateNav = () => {
    const left = rail.scrollLeft
    const max = Math.max(0, rail.scrollWidth - rail.clientWidth)

    if (prev) prev.hidden = left <= 2
    if (next) next.hidden = left >= max - 2
  }

  updateNav()

  rail.addEventListener("scroll", updateNav, { passive: true })

  const ro = new ResizeObserver(() => {
    updateNav()
  })
  ro.observe(rail)

  const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-slide]"))

  const pauseAt = (idx: number) => {
    players[idx]?.pause()
    const frame = slides[idx]?.querySelector<HTMLElement>("[data-yt-frame]")
    if (frame) frame.classList.remove("is-playing")
  }

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

  slides.forEach(slide => io.observe(slide))
}

function boot() {
  document.querySelectorAll<HTMLElement>("[data-work-hero]").forEach(initHero)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true })
} else {
  boot()
}

document.addEventListener("astro:page-load", boot as EventListener)
document.addEventListener("astro:after-swap", boot as EventListener)
