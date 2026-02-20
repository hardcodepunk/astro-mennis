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

export type Category = {
  slug: string
  title: string
  tagline: string
  preview: { poster: string; webm?: string; mp4?: string }
  overviewTitle?: string
  overviewLead?: string
  body?: unknown
}

export type WorkItem = {
  slug: string
  title: string
  category: string
  categorySlug: string
  client: string
  tagline: string
  preview: { poster: string; webm?: string; mp4?: string }
  year?: string
  overviewTitle?: string
  overviewLead?: string
  body?: unknown
}

export async function getCategories() {
  const q = `*[_type == "category"] | order(title asc){
    "slug": slug.current,
    title,
    tagline,
    preview{ poster, webm, mp4 },
    overviewTitle,
    overviewLead
  }`
  return sanity.fetch<Category[]>(q)
}

export async function getCategoryBySlug(slug: string) {
  const q = `*[_type == "category" && slug.current == $slug][0]{
    "slug": slug.current,
    title,
    tagline,
    preview{ poster, webm, mp4 },
    overviewTitle,
    overviewLead,
    body[]{
      ...,
      _type == "inlineImage" => {
        ...,
        "asset": asset->{ url }
      }
    }
  }`
  return sanity.fetch<Category | null>(q, { slug })
}

export async function getWorks() {
  const q = `*[_type == "work"] | order(publishedAt desc, _createdAt desc){
    "slug": slug.current,
    title,
    "category": category->title,
    "categorySlug": category->slug.current,
    client,
    tagline,
    preview{ poster, webm, mp4 },
    overviewTitle,
    overviewLead
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
    tagline,
    preview{ poster, webm, mp4 },
    overviewTitle,
    overviewLead
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
    tagline,
    year,
    preview{ poster, webm, mp4 },
    overviewTitle,
    overviewLead,
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
    tagline,
    preview{ poster, webm, mp4 }
  }`
  return sanity.fetch<WorkItem[]>(q, { limit })
}
