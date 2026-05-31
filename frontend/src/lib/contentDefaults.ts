export type TextPanelDefaults = {
  kicker: string
  title: string
  body: string
  mirrorLayout: boolean
}

export type ContactReasonsDefaults = {
  kicker: string
  title: string
  items: string[]
  mirrorLayout: boolean
}

export const DEFAULT_WORKFLOW_PANEL: TextPanelDefaults = {
  kicker: "Workflow",
  title: "Playful process, bold ideas, thoughtful results",
  body: [
    "We live in a world of acceleration, chasing the end goal, forgetting to enjoy the ride. At De Mennis, we slow down just enough to capture the magic in between: the boldness, the play, the small details that get lost when there is no room to breathe.",
    "We believe that when passionate people come together and actually enjoy the process, something extraordinary happens.",
    "And what cannot be put into words, we put into visuals.",
  ].join("\n\n"),
  mirrorLayout: false,
}

export const DEFAULT_APPROACH_PANEL: TextPanelDefaults = {
  kicker: "Approach",
  title: "Clean frames. Strong pacing. Calm process.",
  body: [
    "I make visual work that feels sharp, deliberate and human. The focus is on tone, movement and structure, with a process that stays clear from first idea to final delivery.",
    "That can mean branded content, campaign visuals, portraits, event films or short-form edits. The output changes depending on the project, but the standard stays the same.",
    "I care about images that carry weight without feeling overworked. Clean direction, strong editing and the right energy on set matter just as much as the final look.",
  ].join("\n\n"),
  mirrorLayout: false,
}

export const DEFAULT_CONTACT_REASONS: ContactReasonsDefaults = {
  kicker: "What to contact me for",
  title: "Built for bold projects with movement, edge and energy.",
  items: [
    "Edgy & daring branding: commercials and promos that break the rules.",
    "Lifestyle & community culture: highlighting the people, the movement, and the vibe behind your brand.",
    "High-motion content: music videos, sports, and events that require speed, flow, and kinetic energy.",
    "Freelance rollerblade camera operator & editor.",
    "Aerial filmography.",
    "Ideas.",
  ],
  mirrorLayout: false,
}

type TextPanelInput = {
  kicker?: string
  title?: string
  body?: string
  mirrorLayout?: boolean
}

type ContactReasonsInput = {
  kicker?: string
  title?: string
  items?: string[]
  mirrorLayout?: boolean
}

type PanelOptions = {
  useFallbackOnBlankText?: boolean
}

function normalizeText(value: string | undefined, fallback: string, useFallbackOnBlankText: boolean) {
  if (value === undefined || value === null) return useFallbackOnBlankText ? fallback : ""
  const trimmed = value.trim()
  return useFallbackOnBlankText && trimmed.length === 0 ? fallback : trimmed
}

export function resolveTextPanel(
  panel: TextPanelInput | undefined,
  fallback: TextPanelDefaults,
  options: PanelOptions = {},
) {
  const useFallbackOnBlankText = options.useFallbackOnBlankText ?? true
  return {
    kicker: normalizeText(panel?.kicker, fallback.kicker, useFallbackOnBlankText),
    title: normalizeText(panel?.title, fallback.title, useFallbackOnBlankText),
    body: normalizeText(panel?.body, fallback.body, useFallbackOnBlankText),
    mirrorLayout: panel?.mirrorLayout ?? fallback.mirrorLayout,
  }
}

export function resolveContactReasons(panel: ContactReasonsInput | undefined, fallback: ContactReasonsDefaults) {
  if (!panel) {
    return {
      kicker: fallback.kicker,
      title: fallback.title,
      items: fallback.items,
      mirrorLayout: fallback.mirrorLayout,
    }
  }

  const items = (panel.items ?? []).map(item => item.trim()).filter(Boolean)
  return {
    kicker: panel.kicker?.trim() ?? "",
    title: panel.title?.trim() ?? "",
    items,
    mirrorLayout: panel.mirrorLayout ?? fallback.mirrorLayout,
  }
}
