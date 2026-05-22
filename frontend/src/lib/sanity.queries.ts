import { sanity } from "./sanity"

export type SiteSettings = {
  homeSeoH1?: string
  projectsSeoH1?: string
  videoHero?: {
    mp4?: string
    webm?: string
    poster?: string
  }
}

export async function getSiteSettings() {
  const q = `*[_type == "siteSettings"][0]{
    homeSeoH1,
    projectsSeoH1,
    videoHero{
      mp4,
      webm,
      poster
    }
  }`
  return sanity.fetch<SiteSettings | null>(q)
}

export type SeoSettings = {
  siteUrl?: string
  defaultTitle?: string
  titleTemplate?: string
  defaultDescription?: string
  defaultSocialImage?: string
  defaultSocialImageAlt?: string
  twitterHandle?: string
  brandName?: string
  personName?: string
  baseCity?: string
  baseCountry?: string
  sameAs?: string[]
  homeH1?: string
  homeTitle?: string
  homeDescription?: string
  homeSocialImage?: string
  homeNoindex?: boolean
  projectsH1?: string
  projectsTitle?: string
  projectsDescription?: string
  projectsSocialImage?: string
  projectsNoindex?: boolean
  aboutTitle?: string
  aboutDescription?: string
  aboutSocialImage?: string
  aboutNoindex?: boolean
  categoryTitleTemplate?: string
  categoryDescriptionTemplate?: string
  workTitleTemplate?: string
  workDescriptionTemplate?: string
}

export type DocumentSeo = {
  title?: string
  description?: string
  socialImage?: string
  socialImageAlt?: string
  canonicalUrl?: string
  noindex?: boolean
  focusKeyword?: string
}

export async function getSeoSettings() {
  const q = `*[_type == "seo"][0]{
    siteUrl,
    defaultTitle,
    titleTemplate,
    defaultDescription,
    defaultSocialImage,
    defaultSocialImageAlt,
    twitterHandle,
    brandName,
    personName,
    baseCity,
    baseCountry,
    sameAs,
    homeH1,
    homeTitle,
    homeDescription,
    homeSocialImage,
    homeNoindex,
    projectsH1,
    projectsTitle,
    projectsDescription,
    projectsSocialImage,
    projectsNoindex,
    aboutTitle,
    aboutDescription,
    aboutSocialImage,
    aboutNoindex,
    categoryTitleTemplate,
    categoryDescriptionTemplate,
    workTitleTemplate,
    workDescriptionTemplate
  }`
  return sanity.fetch<SeoSettings | null>(q)
}

export async function getVideoHeroSettings() {
  const settings = await getSiteSettings()
  return settings?.videoHero ?? null
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
  heroTitle?: string
  seoH1?: string
  heroVideo?: {
    mp4?: string
    webm?: string
    poster?: string
  }
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
    heroTitle,
    seoH1,
    heroVideo{ mp4, webm, poster },
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
  seo?: DocumentSeo
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
  publishedAt?: string
  updatedAt?: string
  overviewTitle?: string
  body?: unknown
  media?: WorkMedia
  featuredOnHome?: boolean
  featuredOrder?: number
  seo?: DocumentSeo
}

const seoSelection = `seo{
  title,
  description,
  socialImage,
  socialImageAlt,
  canonicalUrl,
  noindex,
  focusKeyword
}`

export async function getFeaturedWorks(limit = 3) {
  const q = `*[_type == "work" && featuredOnHome == true]
    | order(featuredOrder asc, publishedAt desc, _createdAt desc)[0...$limit]{
      "slug": slug.current,
      title,
      "category": category->title,
      "categorySlug": category->slug.current,
      client,
      publishedAt,
      "updatedAt": _updatedAt,
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
    publishedAt,
    "updatedAt": _updatedAt,
    preview{ poster, webm, mp4 },
    thumbnailAutoplay
  }`
  return sanity.fetch<WorkItem[]>(q)
}

export async function getCategories() {
  const q = `*[_type == "category"] | order(coalesce(sortOrder, 9999) asc, title asc){
    "slug": slug.current,
    title,
    sortOrder,
    ${seoSelection}
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
    overviewTitle,
    ${seoSelection}
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
    overviewTitle,
    ${seoSelection}
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
    publishedAt,
    "updatedAt": _updatedAt,
    preview{ poster, webm, mp4 },
    thumbnailAutoplay,
    ${seoSelection},

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

export async function getRecentWorks(limit = 2, excludeSlug?: string) {
  const q = `*[_type == "work" && (!defined($excludeSlug) || slug.current != $excludeSlug)]
  | order(publishedAt desc, _createdAt desc)[0...$limit]{
    "slug": slug.current,
    title,
    "category": category->title,
    "categorySlug": category->slug.current,
    client,
    preview{ poster, webm, mp4 },
    thumbnailAutoplay
  }`
  return sanity.fetch<WorkItem[]>(q, { limit, excludeSlug })
}
