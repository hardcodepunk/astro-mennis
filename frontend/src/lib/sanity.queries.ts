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

export type LogoItem = {
  name?: string
  alt?: string
  image: {
    url: string
  }
}

export async function getLogoMarquee() {
  const q = `*[_type == "logoMarquee"][0]{
    logos[]{
      name,
      alt,
      "image": {
        "url": image.asset->url
      }
    }
  }`
  return sanity.fetch<{ logos: LogoItem[] } | null>(q)
}

export type BioWithPreviewDoc = {
  bio?: string
  mirrorLayout?: boolean
  bioTextScale?: number
  previewVideo?: {
    mp4?: string
    webm?: string
    poster?: string
  }
}

export async function getBioWithPreview() {
  const q = `*[_type == "bioWithPreview"] | order(_updatedAt desc)[0]{
    bio,
    mirrorLayout,
    bioTextScale,
    previewVideo{ mp4, webm, poster }
  }`
  return sanity.fetch<BioWithPreviewDoc | null>(q)
}

export type Category = {
  slug: string
  title: string
  sortOrder?: number
}

export type WorkMedia =
  | { mode: "preview" }
  | { mode: "single"; youtubeUrl?: string }
  | { mode: "slider"; reels?: string[] }

export type WorkItem = {
  slug: string
  title: string
  category: string
  categorySlug: string
  client: string
  preview: { poster: string; webm?: string; mp4?: string }
  thumbnailAutoplay?: boolean
  year?: string
  overviewTitle?: string
  body?: unknown
  media?: WorkMedia
  featuredOnHome?: boolean
  featuredOrder?: number
}

export async function getFeaturedWorks(limit = 3) {
  const q = `*[_type == "work" && featuredOnHome == true]
    | order(featuredOrder asc, publishedAt desc, _createdAt desc)[0...$limit]{
      "slug": slug.current,
      title,
      "category": category->title,
      "categorySlug": category->slug.current,
      client,
      preview{ poster, webm, mp4 },
      thumbnailAutoplay,
      featuredOnHome,
      featuredOrder
    }`
  return sanity.fetch<WorkItem[]>(q, { limit })
}

export async function getAllWorksForGrid() {
  const q = `*[_type == "work"] | order(publishedAt desc, _createdAt desc){
    "slug": slug.current,
    title,
    "category": category->title,
    "categorySlug": category->slug.current,
    client,
    preview{ poster, webm, mp4 },
    thumbnailAutoplay
  }`
  return sanity.fetch<WorkItem[]>(q)
}

export async function getCategories() {
  const q = `*[_type == "category"] | order(coalesce(sortOrder, 9999) asc, title asc){
    "slug": slug.current,
    title,
    sortOrder
  }`
  return sanity.fetch<Category[]>(q)
}

export async function getWorks() {
  const q = `*[_type == "work"] | order(publishedAt desc, _createdAt desc){
    "slug": slug.current,
    title,
    "category": category->title,
    "categorySlug": category->slug.current,
    client,
    preview{ poster, webm, mp4 },
    thumbnailAutoplay,
    overviewTitle
  }`
  return sanity.fetch<WorkItem[]>(q)
}

export async function getWorksByCategorySlug(slug: string) {
  const q = `*[_type == "work" && category->slug.current == $slug]
  | order(publishedAt desc, _createdAt desc){
    "slug": slug.current,
    title,
    "category": category->title,
    "categorySlug": category->slug.current,
    client,
    preview{ poster, webm, mp4 },
    thumbnailAutoplay,
    overviewTitle
  }`
  return sanity.fetch<WorkItem[]>(q, { slug })
}

export async function getWorkBySlug(slug: string) {
  const q = `*[_type == "work" && slug.current == $slug][0]{
    "slug": slug.current,
    title,
    "category": category->title,
    "categorySlug": category->slug.current,
    client,
    year,
    preview{ poster, webm, mp4 },
    thumbnailAutoplay,

    media{
      mode,
      youtubeUrl,
      reels
    },

    overviewTitle,
    body[]{
      ...,
      _type == "inlineImage" => {
        ...,
        "asset": asset->{ url }
      }
    }
  }`
  return sanity.fetch<WorkItem | null>(q, { slug })
}

export async function getRecentWorks(limit = 2) {
  const q = `*[_type == "work"] | order(publishedAt desc, _createdAt desc)[0...$limit]{
    "slug": slug.current,
    title,
    "category": category->title,
    "categorySlug": category->slug.current,
    client,
    preview{ poster, webm, mp4 },
    thumbnailAutoplay
  }`
  return sanity.fetch<WorkItem[]>(q, { limit })
}
