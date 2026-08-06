const activeTypewriters = new Set<() => void>()

function readSentences(root: HTMLElement) {
  try {
    const parsed = JSON.parse(root.dataset.sentences ?? "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.map(value => String(value || "").trim()).filter(Boolean)
  } catch {
    return []
  }
}

function startTypewriter(root: HTMLElement) {
  const target = root.querySelector<HTMLElement>("[data-contact-typewriter]")
  if (!target || target.dataset.typewriterReady === "true") return

  const sentences = readSentences(root)
  target.dataset.typewriterReady = "true"

  if (sentences.length <= 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    target.textContent = sentences[0] || target.textContent || ""
    return
  }

  let sentenceIndex = 0
  let charIndex = sentences[0].length
  let deleting = true
  let timeoutId = 0

  const stop = () => {
    window.clearTimeout(timeoutId)
    activeTypewriters.delete(stop)
  }

  const tick = () => {
    const current = sentences[sentenceIndex] || ""

    if (deleting) {
      charIndex -= 1
      target.textContent = current.slice(0, Math.max(0, charIndex))

      if (charIndex <= 0) {
        deleting = false
        sentenceIndex = (sentenceIndex + 1) % sentences.length
      }
    } else {
      const next = sentences[sentenceIndex] || ""
      charIndex += 1
      target.textContent = next.slice(0, charIndex)

      if (charIndex >= next.length) deleting = true
    }

    const atFullSentence = deleting && charIndex >= (sentences[sentenceIndex] || "").length
    const atEmptySentence = !deleting && charIndex <= 0
    const delay = atFullSentence ? 1400 : atEmptySentence ? 240 : deleting ? 32 : 58
    timeoutId = window.setTimeout(tick, delay)
  }

  activeTypewriters.add(stop)
  timeoutId = window.setTimeout(tick, 1200)
}

function bootTypewriters() {
  document.querySelectorAll<HTMLElement>("[data-contact-typewriter-root]").forEach(startTypewriter)
}

document.addEventListener("astro:before-swap", () => {
  Array.from(activeTypewriters).forEach(stop => stop())
})
document.addEventListener("astro:page-load", bootTypewriters)
document.addEventListener("astro:after-swap", bootTypewriters)

bootTypewriters()
