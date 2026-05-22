function createYouTubeIframe(id: string) {
  const iframe = document.createElement("iframe")
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1`
  iframe.title = "YouTube video player"
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  iframe.allowFullscreen = true
  iframe.loading = "lazy"
  iframe.referrerPolicy = "strict-origin-when-cross-origin"
  return iframe
}

function stopFrame(frame: HTMLElement) {
  const iframe = frame.querySelector("iframe")
  iframe?.remove()
  frame.classList.remove("is-playing")
}

function playFrame(frame: HTMLElement) {
  const embed = frame.querySelector<HTMLElement>("[data-yt-embed]")
  if (!embed || embed.querySelector("iframe")) return

  const id = embed.dataset.ytId
  if (!id) return

  embed.append(createYouTubeIframe(id))
  frame.classList.add("is-playing")
}

function initHero(root: HTMLElement) {
  if (root.dataset.workHeroInited === "1") return
  root.dataset.workHeroInited = "1"

  const frames = Array.from(root.querySelectorAll<HTMLElement>("[data-yt-frame]"))
  if (!frames.length) return

  frames.forEach(frame => {
    const overlay = frame.querySelector<HTMLButtonElement>("[data-yt-overlay]")
    overlay?.addEventListener("click", e => {
      e.preventDefault()
      e.stopPropagation()
      playFrame(frame)
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

  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        const idx = slides.indexOf(entry.target as HTMLElement)
        if (idx === -1) continue
        if (!entry.isIntersecting) {
          const frame = slides[idx]?.querySelector<HTMLElement>("[data-yt-frame]")
          if (frame) stopFrame(frame)
        }
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
