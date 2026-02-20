import { sanity } from "./sanity"

export async function getVideoHeroSettings() {
  const q = `*[_type == "siteSettings"][0].videoHero{
    mp4,
    webm,
    poster
  }`
  return sanity.fetch<{
    mp4?: string
    webm?: string
    poster?: string
  } | null>(q)
}
