import * as PlyrModule from "plyr"

console.log("workHeroMedia loaded")

const Plyr: any = (PlyrModule as any).default ?? PlyrModule

function initHero(root: HTMLElement) {
  const embeds = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-embed]"))
  if (!embeds.length) return

  console.log("initHero", root)

  const players = embeds.map(el => {
    const ratio = el.getAttribute("data-yt-ratio") || "16:9"

    return new Plyr(el, {
      ratio,
      clickToPlay: false,
      controls: ["play", "progress", "current-time", "mute", "volume", "settings", "fullscreen"],
      youtube: {
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin,
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

    overlay.addEventListener("click", () => {
      if (ready) {
        player.play()
      } else {
        playRequested = true
      }
    })
  })

  const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-slide]"))

  if (!slides.length) return

  const pauseAt = (idx: number) => {
    players[idx]?.pause()
    const frame = slides[idx]?.querySelector<HTMLElement>("[data-yt-frame]")
    if (frame) frame.classList.remove("is-playing")
  }

  const rail = root.querySelector<HTMLElement>("[data-yt-rail]")
  if (!rail) return

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
