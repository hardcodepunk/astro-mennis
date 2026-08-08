export type AutoplayChoice = "default" | "pause" | "play"

export function normalizeStoredAutoplayChoice(
  value: unknown,
  reducedMotion: boolean,
): AutoplayChoice {
  if (value === "pause") return "pause"
  if (value === "play" && !reducedMotion) return "play"
  return "default"
}

export function resolveAutoplayAllowed(options: {
  choice: AutoplayChoice
  reducedMotion: boolean
  saveData: boolean
}) {
  const { choice, reducedMotion, saveData } = options
  if (saveData || choice === "pause") return false
  if (choice === "play") return true
  return !reducedMotion
}
