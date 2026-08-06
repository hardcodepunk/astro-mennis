const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const TOP_THRESHOLD = 8

let inertedBackground: HTMLElement[] = []
let menuCloseTimer: number | undefined
let menuCloseCleanup: (() => void) | undefined
let menuTransitionId = 0

function getHeaderParts() {
  const header = document.querySelector<HTMLElement>("[data-header]")
  const button = document.querySelector<HTMLButtonElement>("[data-menu-button]")
  const overlay = document.querySelector<HTMLElement>("[data-menu-overlay]")
  const icon = button?.querySelector<HTMLElement>(".hamburger") ?? null

  return { header, button, overlay, icon }
}

function restoreBackground() {
  inertedBackground.forEach(element => element.removeAttribute("inert"))
  inertedBackground = []
}

function setBackgroundInert(overlay: HTMLElement) {
  restoreBackground()

  inertedBackground = Array.from(document.body.children).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && element !== overlay && !element.hasAttribute("inert"),
  )
  inertedBackground.forEach(element => element.setAttribute("inert", ""))
}

function getMenuFocusable() {
  const { overlay } = getHeaderParts()
  if (!overlay) return []

  return Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => !element.hasAttribute("inert"),
  )
}

function focusFirstMenuItem() {
  const { overlay } = getHeaderParts()
  overlay?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()
}

function clearPendingMenuClose() {
  if (menuCloseTimer !== undefined) window.clearTimeout(menuCloseTimer)
  menuCloseTimer = undefined

  menuCloseCleanup?.()
  menuCloseCleanup = undefined
}

function setMenuOpen(open: boolean, { returnFocus = true } = {}) {
  const { header, button, overlay, icon } = getHeaderParts()
  if (!button || !overlay || !header) return

  const wasOpen = button.getAttribute("aria-expanded") === "true"
  const transitionId = ++menuTransitionId
  clearPendingMenuClose()

  if (open) {
    overlay.hidden = false
    overlay.removeAttribute("inert")
    setBackgroundInert(overlay)
  }

  overlay.setAttribute("aria-hidden", String(!open))
  button.setAttribute("aria-expanded", String(open))
  button.setAttribute("aria-label", open ? "Close menu" : "Open menu")
  icon?.classList.toggle("is-open", open)
  header.classList.toggle("is-menu-open", open)
  document.documentElement.classList.toggle("overflow-hidden", open)
  document.body.classList.toggle("overflow-hidden", open)

  if (open) {
    if (!wasOpen) {
      window.requestAnimationFrame(() => {
        if (menuTransitionId !== transitionId) return
        window.requestAnimationFrame(() => {
          if (menuTransitionId !== transitionId) return
          overlay.classList.add("is-open")
          focusFirstMenuItem()
        })
      })
    }
    return
  }

  overlay.classList.remove("is-open")
  overlay.setAttribute("inert", "")
  restoreBackground()
  if (wasOpen && returnFocus) button.focus()

  const finishClose = () => {
    if (menuTransitionId !== transitionId) return
    clearPendingMenuClose()
    overlay.hidden = true
  }

  if (!wasOpen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finishClose()
    return
  }

  const panel = overlay.querySelector<HTMLElement>(".mobile-menu__panel")
  const handleTransitionEnd = (event: TransitionEvent) => {
    if (event.target !== panel || event.propertyName !== "transform") return
    finishClose()
  }

  panel?.addEventListener("transitionend", handleTransitionEnd)
  menuCloseCleanup = () => panel?.removeEventListener("transitionend", handleTransitionEnd)
  menuCloseTimer = window.setTimeout(finishClose, 300)
}

function normalizePath(path: string) {
  return path.replace(/\/$/, "") || "/"
}

function getTransparentPaths(header: HTMLElement) {
  try {
    const paths = JSON.parse(header.dataset.transparentPaths ?? "[]")
    return Array.isArray(paths) ? paths.filter((path): path is string => typeof path === "string") : []
  } catch {
    return []
  }
}

function canBeTransparent(header: HTMLElement) {
  const paths = getTransparentPaths(header)
  return paths.length > 0
    ? paths.includes(normalizePath(window.location.pathname))
    : header.dataset.transparentOnTop === "true"
}

function updateHeaderBackground() {
  const { header, overlay } = getHeaderParts()
  if (!header || !overlay || overlay.classList.contains("is-open")) return

  if (!canBeTransparent(header)) {
    header.classList.add("is-solid")
    return
  }

  header.classList.toggle("is-solid", (window.scrollY || 0) > TOP_THRESHOLD)
}

function resetHeader() {
  setMenuOpen(false, { returnFocus: false })
  updateHeaderBackground()
}

document.addEventListener("click", event => {
  const target = event.target
  if (!(target instanceof Element)) return

  const button = target.closest("[data-menu-button]")
  if (button) {
    setMenuOpen(button.getAttribute("aria-expanded") !== "true")
    return
  }

  if (target.closest("[data-menu-backdrop]") || target.closest("[data-menu-close]")) {
    setMenuOpen(false)
    return
  }

  if (target.closest("[data-menu-link]")) setMenuOpen(false, { returnFocus: false })
})

window.addEventListener("keydown", event => {
  const { overlay } = getHeaderParts()
  if (overlay?.getAttribute("aria-hidden") !== "false") return

  if (event.key === "Escape") {
    event.preventDefault()
    setMenuOpen(false)
    return
  }

  if (event.key !== "Tab") return

  const focusable = getMenuFocusable()
  if (!focusable.length) {
    event.preventDefault()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  const activeIsFocusable = active instanceof HTMLElement && focusable.includes(active)

  if (event.shiftKey && (active === first || !activeIsFocusable)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || !activeIsFocusable)) {
    event.preventDefault()
    first.focus()
  }
})

document.addEventListener("focusin", event => {
  const { overlay } = getHeaderParts()
  if (overlay?.getAttribute("aria-hidden") !== "false") return
  if (event.target instanceof Node && overlay.contains(event.target)) return
  focusFirstMenuItem()
})

window.addEventListener("hashchange", () => setMenuOpen(false, { returnFocus: false }))
window.addEventListener("resize", () => {
  if (window.matchMedia("(min-width: 768px)").matches) {
    setMenuOpen(false, { returnFocus: false })
  }
})
window.addEventListener("scroll", updateHeaderBackground, { passive: true })
document.addEventListener("astro:before-swap", () => setMenuOpen(false, { returnFocus: false }))
document.addEventListener("astro:page-load", resetHeader)
document.addEventListener("astro:after-swap", resetHeader)

resetHeader()
