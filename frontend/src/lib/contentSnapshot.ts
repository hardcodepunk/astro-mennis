import {
  arrayOf,
  nullable,
  validateBioWithPreview,
  validateCategory,
  validateContactPage,
  validateLogoMarquee,
  validateSeoSettings,
  validateSiteSettings,
  validateWorkDetail,
  type BioWithPreviewDoc,
  type Category,
  type ContactPageDoc,
  type LogoItem,
  type SeoSettings,
  type SiteSettings,
  type WorkDetail,
} from "./sanity.contract.ts"

const seoSelection = `seo{
  title,
  description,
  socialImage,
  socialImageAlt,
  canonicalUrl,
  noindex
}`
const previewSelection = `preview{ poster, webm, mp4 }`
const textPanelSelection = `kicker, title, body, mirrorLayout`
const mediaSelection = `mp4, webm, poster`
const contactReasonsSelection = `kicker, title, items, mirrorLayout`

export const CONTENT_SNAPSHOT_QUERY = `{
  "siteSettings": *[_id == "siteSettings"][0]{
    "homepageWorkIds": homepageWorks[]._ref,
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
    workflowPanel{${textPanelSelection}},
    legalDocument{
      label,
      "url": file.asset->url,
      "filename": file.asset->originalFilename
    }
  },
  "seoSettings": *[_id == "seo"][0]{
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
  },
  "contactPage": *[_id == "contactPage"][0]{
    animatedSentences,
    mailSentence,
    email
  },
  "logoMarquee": *[_id == "logoMarquee"][0]{
    logos[]{
      name,
      alt,
      "image": {
        "url": image.asset->url,
        "crop": image.crop,
        "dimensions": image.asset->metadata.dimensions
      }
    }
  },
  "bioWithPreview": *[_id == "bioWithPreview"][0]{
    heroTitle,
    heroTitleTextScale,
    seoH1,
    heroVideo{${mediaSelection}},
    bio,
    mirrorLayout,
    bioTextScale,
    previewVideo{${mediaSelection}},
    approach{${textPanelSelection}},
    contactReasons{${contactReasonsSelection}}
  },
  "categories": *[_type == "category"]
    | order(coalesce(sortOrder, 9999) asc, title asc){
      "slug": slug.current,
      title,
      sortOrder,
      ${seoSelection}
    },
  "works": *[_type == "work"] | order(publishedAt desc, _createdAt desc){
    _id,
    "slug": slug.current,
    title,
    "category": category->title,
    "categorySlug": category->slug.current,
    client,
    year,
    publishedAt,
    "updatedAt": _updatedAt,
    ${previewSelection},
    thumbnailAutoplay,
    featuredOnHome,
    featuredOrder,
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
  }
}`

export type ContentSnapshot = Readonly<{
  siteSettings: SiteSettings | null
  seoSettings: SeoSettings | null
  contactPage: ContactPageDoc | null
  logoMarquee: { logos: LogoItem[] } | null
  bioWithPreview: BioWithPreviewDoc | null
  categories: readonly Category[]
  works: readonly WorkDetail[]
}>

type RawLoader = () => Promise<unknown>

export function validateContentSnapshot(value: unknown): ContentSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("contentSnapshot expected an object")
  }

  const raw = value as Record<string, unknown>
  const categories = Object.freeze(arrayOf(
    raw.categories,
    "contentSnapshot.categories",
    validateCategory,
  ))
  const works = Object.freeze(arrayOf(
    raw.works,
    "contentSnapshot.works",
    validateWorkDetail,
  ))

  return Object.freeze({
    siteSettings: nullable(
      raw.siteSettings,
      "contentSnapshot.siteSettings",
      validateSiteSettings,
    ),
    seoSettings: nullable(
      raw.seoSettings,
      "contentSnapshot.seoSettings",
      validateSeoSettings,
    ),
    contactPage: nullable(
      raw.contactPage,
      "contentSnapshot.contactPage",
      validateContactPage,
    ),
    logoMarquee: nullable(
      raw.logoMarquee,
      "contentSnapshot.logoMarquee",
      validateLogoMarquee,
    ),
    bioWithPreview: nullable(
      raw.bioWithPreview,
      "contentSnapshot.bioWithPreview",
      validateBioWithPreview,
    ),
    categories,
    works,
  })
}

export function selectFeaturedWorks(snapshot: ContentSnapshot, limit = 3) {
  const configuredWorkIds = snapshot.siteSettings?.homepageWorkIds
  if (configuredWorkIds !== undefined) {
    const worksById = new Map(snapshot.works.map(work => [work._id, work]))
    return configuredWorkIds
      .map(workId => worksById.get(workId))
      .filter((work): work is WorkDetail => work !== undefined)
      .slice(0, normalizeLimit(limit))
  }

  return snapshot.works
    .filter(work => work.featuredOnHome)
    .sort((left, right) =>
      (left.featuredOrder ?? Number.MAX_SAFE_INTEGER) -
      (right.featuredOrder ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, normalizeLimit(limit))
}

export function selectWorksByCategorySlug(snapshot: ContentSnapshot, slug: string) {
  return snapshot.works.filter(work => work.categorySlug === slug)
}

export function selectRecentWorks(
  snapshot: ContentSnapshot,
  limit = 2,
  excludeSlug?: string,
) {
  return snapshot.works
    .filter(work => !excludeSlug || work.slug !== excludeSlug)
    .slice(0, normalizeLimit(limit))
}

export function createContentRepository(loadRaw: RawLoader) {
  let snapshotPromise: Promise<ContentSnapshot> | undefined
  const loadSnapshot = () => {
    snapshotPromise ??= loadRaw().then(validateContentSnapshot)
    return snapshotPromise
  }

  return Object.freeze({
    getContentSnapshot: loadSnapshot,
    async getSiteSettings() {
      return (await loadSnapshot()).siteSettings
    },
    async getSeoSettings() {
      return (await loadSnapshot()).seoSettings
    },
    async getContactPage() {
      return (await loadSnapshot()).contactPage
    },
    async getVideoHeroSettings() {
      return (await loadSnapshot()).siteSettings?.videoHero ?? null
    },
    async getLogoMarquee() {
      return (await loadSnapshot()).logoMarquee
    },
    async getBioWithPreview() {
      return (await loadSnapshot()).bioWithPreview
    },
    async getFeaturedWorks(limit = 3) {
      return [...selectFeaturedWorks(await loadSnapshot(), limit)]
    },
    async getAllWorksForGrid() {
      return [...(await loadSnapshot()).works]
    },
    async getCategories() {
      return [...(await loadSnapshot()).categories]
    },
    async getWorks() {
      return [...(await loadSnapshot()).works]
    },
    async getWorksByCategorySlug(slug: string) {
      return [...selectWorksByCategorySlug(await loadSnapshot(), slug)]
    },
    async getWorkBySlug(slug: string) {
      return (await loadSnapshot()).works.find(work => work.slug === slug) ?? null
    },
    async getRecentWorks(limit = 2, excludeSlug?: string) {
      return [...selectRecentWorks(await loadSnapshot(), limit, excludeSlug)]
    },
  })
}

function normalizeLimit(limit: number) {
  if (!Number.isFinite(limit)) return 0
  return Math.max(0, Math.trunc(limit))
}
