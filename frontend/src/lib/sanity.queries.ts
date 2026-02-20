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

export type BioWithPreviewDoc = {
  bio?: string
  previewVideo?: {
    mp4?: string
    webm?: string
    poster?: string
  }
}

export async function getBioWithPreview() {
  const q = `*[_type == "bioWithPreview"] | order(_updatedAt desc)[0]{
    bio,
    previewVideo{ mp4, webm, poster }
  }`
  return sanity.fetch<BioWithPreviewDoc | null>(q)
}
