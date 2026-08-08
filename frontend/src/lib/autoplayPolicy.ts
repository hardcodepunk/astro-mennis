export function resolveAutoplayAllowed(options: {
  reducedMotion: boolean
  saveData: boolean
}) {
  const { reducedMotion, saveData } = options
  return !reducedMotion && !saveData
}
