import { sanity } from "./sanity"
import {
  arrayOf,
  nullable,
  validateBioWithPreview,
  validateCategory,
  validateContactPage,
  validateLogoMarquee,
  validateSeoSettings,
  validateSiteSettings,
  validateWorkItem,
} from "./sanity.contract"

export type {
  Category,
  SeoSettings,
  WorkItem,
} from "./sanity.contract"

export async function getSiteSettings() {
  const q = `*[_id == "siteSettings"][0]{
    homeSeoH1,
    projectsSeoH1,
    videoHero{
      mp4,
      webm,
      poster,
      caption,
      captionTextScale,
      captionUppercase
    },
    workflowPanel{
      kicker,
      title,
      body,
      mirrorLayout
    },
    legalDocument{
      label,
      "url": file.asset->url,
      "filename": file.asset->originalFilename
    }
  }`
  const data = await sanity.fetch<unknown>(q)
  return nullable(data, "getSiteSettings", validateSiteSettings)
}

export async function getSeoSettings() {
  const q = `*[_id == "seo"][0]{
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
    contactH1,
    contactTitle,
    contactDescription,
    contactSocialImage,
    contactNoindex,
    categoryTitleTemplate,
    categoryDescriptionTemplate,
    workTitleTemplate,
    workDescriptionTemplate
  }`
  const data = await sanity.fetch<unknown>(q)
  return nullable(data, "getSeoSettings", validateSeoSettings)
}

export async function getContactPage() {
  const q = `*[_id == "contactPage"][0]{
    animatedSentences,
    mailSentence,
    email
  }`
  const data = await sanity.fetch<unknown>(q)
  return nullable(data, "getContactPage", validateContactPage)
}

export async function getVideoHeroSettings() {
  const settings = await getSiteSettings()
  return settings?.videoHero ?? null
}

export async function getLogoMarquee() {
  const q = `*[_id == "logoMarquee"][0]{
    logos[]{
      name,
      alt,
      "image": {
        "url": image.asset->url,
        "dimensions": image.asset->metadata.dimensions
      }
    }
  }`
  const data = await sanity.fetch<unknown>(q)
  return nullable(data, "getLogoMarquee", validateLogoMarquee)
}

export async function getBioWithPreview() {
  const q = `*[_id == "bioWithPreview"][0]{
    heroTitle,
    seoH1,
    heroVideo{ mp4, webm, poster },
    bio,
    mirrorLayout,
    bioTextScale,
    bioUppercase,
    previewVideo{ mp4, webm, poster },
    approach{
      kicker,
      title,
      body,
      mirrorLayout
    },
    contactReasons{
      kicker,
      title,
      items,
      mirrorLayout
    }
  }`
  const data = await sanity.fetch<unknown>(q)
  return nullable(data, "getBioWithPreview", validateBioWithPreview)
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
  const data = await sanity.fetch<unknown>(q, { limit })
  return arrayOf(data, "getFeaturedWorks", validateWorkItem)
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
  const data = await sanity.fetch<unknown>(q)
  return arrayOf(data, "getAllWorksForGrid", validateWorkItem)
}

export async function getCategories() {
  const q = `*[_type == "category"] | order(coalesce(sortOrder, 9999) asc, title asc){
    "slug": slug.current,
    title,
    sortOrder,
    ${seoSelection}
  }`
  const data = await sanity.fetch<unknown>(q)
  return arrayOf(data, "getCategories", validateCategory)
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
  const data = await sanity.fetch<unknown>(q)
  return arrayOf(data, "getWorks", validateWorkItem)
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
  const data = await sanity.fetch<unknown>(q, { slug })
  return arrayOf(data, "getWorksByCategorySlug", validateWorkItem)
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
        "asset": asset->{
          url,
          metadata{ dimensions{ width, height } }
        }
      }
    }
  }`
  const data = await sanity.fetch<unknown>(q, { slug })
  return nullable(data, "getWorkBySlug", validateWorkItem)
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
  const data = await sanity.fetch<unknown>(q, { limit, excludeSlug })
  return arrayOf(data, "getRecentWorks", validateWorkItem)
}
