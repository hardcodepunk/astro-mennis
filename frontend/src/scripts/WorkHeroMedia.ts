import * as PlyrModule from "plyr"

const Plyr: any = (PlyrModule as any).default ?? PlyrModule

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

  const prev = root.querySelector<HTMLButtonElement>("[data-yt-prev]")
  const next = root.querySelector<HTMLButtonElement>("[data-yt-next]")

  const scrollByCard = (dir: "left" | "right") => {
    const first = rail.querySelector<HTMLElement>("[data-yt-slide]")
    const cardW = first?.clientWidth ?? 160
    const gap = 18
    const amount = cardW + gap

    rail.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    })
  }

  prev?.addEventListener("click", () => scrollByCard("left"))
  next?.addEventListener("click", () => scrollByCard("right"))

  let isDown = false
  let startX = 0
  let startLeft = 0

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    if ((e.target as HTMLElement | null)?.closest?.("[data-yt-overlay]")) return
    if ((e.target as HTMLElement | null)?.closest?.(".plyr__controls")) return

    isDown = true
    startX = e.clientX
    startLeft = rail.scrollLeft
    rail.classList.add("is-grabbing")
    rail.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!isDown) return
    rail.scrollLeft = startLeft - (e.clientX - startX)
  }

  const endDrag = () => {
    if (!isDown) return
    isDown = false
    rail.classList.remove("is-grabbing")
  }

  rail.addEventListener("pointerdown", onPointerDown)
  rail.addEventListener("pointermove", onPointerMove)
  rail.addEventListener("pointerup", endDrag)
  rail.addEventListener("pointercancel", endDrag)
  rail.addEventListener("pointerleave", endDrag)

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

  slides.forEach(s => io.observe(s))
}

document.querySelectorAll<HTMLElement>("[data-work-hero]").forEach(initHero)
