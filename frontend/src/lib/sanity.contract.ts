class SanityContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SanityContractError"
  }
}

export type SiteSettings = {
  homeSeoH1?: string
  projectsSeoH1?: string
  videoHero?: {
    mp4?: string
    webm?: string
    poster?: string
    caption?: string
    captionTextScale?: number
    captionUppercase?: boolean
  }
  workflowPanel?: {
    kicker?: string
    title?: string
    body?: string
    mirrorLayout?: boolean
  }
  contactReasons?: {
    kicker?: string
    title?: string
    items?: string[]
  }
  legalDocument?: {
    label?: string
    url?: string
    filename?: string
  }
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
  contactH1?: string
  contactTitle?: string
  contactDescription?: string
  contactSocialImage?: string
  contactNoindex?: boolean
  categoryTitleTemplate?: string
  categoryDescriptionTemplate?: string
  workTitleTemplate?: string
  workDescriptionTemplate?: string
}

export type ContactPageDoc = {
  animatedSentences?: string[]
  mailSentence?: string
  email?: string
}

type DocumentSeo = {
  title?: string
  description?: string
  socialImage?: string
  socialImageAlt?: string
  canonicalUrl?: string
  noindex?: boolean
  focusKeyword?: string
}

export type LogoItem = {
  name?: string
  alt?: string
  image: {
    url: string
    dimensions?: {
      width?: number
      height?: number
    }
  }
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
  approach?: {
    kicker?: string
    title?: string
    body?: string
    mirrorLayout?: boolean
  }
}

export type Category = {
  slug: string
  title: string
  sortOrder?: number
  seo?: DocumentSeo
}

type WorkMedia =
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

type Validator<T> = (value: unknown, path: string) => T

export function nullable<T>(value: unknown, path: string, validator: Validator<T>) {
  if (value === null || value === undefined) return null
  return validator(value, path)
}

export function arrayOf<T>(value: unknown, path: string, validator: Validator<T>) {
  if (!Array.isArray(value)) throw contractError(path, "array", value)
  return value.map((item, index) => validator(item, `${path}[${index}]`))
}

export function validateSiteSettings(value: unknown, path: string): SiteSettings {
  const obj = objectAt(value, path)
  return {
    homeSeoH1: optionalString(obj.homeSeoH1, `${path}.homeSeoH1`),
    projectsSeoH1: optionalString(obj.projectsSeoH1, `${path}.projectsSeoH1`),
    videoHero: optionalMediaUrls(obj.videoHero, `${path}.videoHero`),
    workflowPanel: optionalObject(obj.workflowPanel, `${path}.workflowPanel`, workflow => ({
      kicker: optionalString(workflow.kicker, `${path}.workflowPanel.kicker`),
      title: optionalString(workflow.title, `${path}.workflowPanel.title`),
      body: optionalString(workflow.body, `${path}.workflowPanel.body`),
      mirrorLayout: optionalBoolean(workflow.mirrorLayout, `${path}.workflowPanel.mirrorLayout`),
    })),
    contactReasons: optionalObject(obj.contactReasons, `${path}.contactReasons`, contactReasons => ({
      kicker: optionalString(contactReasons.kicker, `${path}.contactReasons.kicker`),
      title: optionalString(contactReasons.title, `${path}.contactReasons.title`),
      items: optionalStringArray(contactReasons.items, `${path}.contactReasons.items`),
    })),
    legalDocument: optionalObject(obj.legalDocument, `${path}.legalDocument`, legalDocument => ({
      label: optionalString(legalDocument.label, `${path}.legalDocument.label`),
      url: optionalString(legalDocument.url, `${path}.legalDocument.url`),
      filename: optionalString(legalDocument.filename, `${path}.legalDocument.filename`),
    })),
  }
}

export function validateSeoSettings(value: unknown, path: string): SeoSettings {
  const obj = objectAt(value, path)
  return {
    siteUrl: optionalString(obj.siteUrl, `${path}.siteUrl`),
    defaultTitle: optionalString(obj.defaultTitle, `${path}.defaultTitle`),
    titleTemplate: optionalString(obj.titleTemplate, `${path}.titleTemplate`),
    defaultDescription: optionalString(obj.defaultDescription, `${path}.defaultDescription`),
    defaultSocialImage: optionalString(obj.defaultSocialImage, `${path}.defaultSocialImage`),
    defaultSocialImageAlt: optionalString(obj.defaultSocialImageAlt, `${path}.defaultSocialImageAlt`),
    twitterHandle: optionalString(obj.twitterHandle, `${path}.twitterHandle`),
    brandName: optionalString(obj.brandName, `${path}.brandName`),
    personName: optionalString(obj.personName, `${path}.personName`),
    baseCity: optionalString(obj.baseCity, `${path}.baseCity`),
    baseCountry: optionalString(obj.baseCountry, `${path}.baseCountry`),
    sameAs: optionalStringArray(obj.sameAs, `${path}.sameAs`),
    homeH1: optionalString(obj.homeH1, `${path}.homeH1`),
    homeTitle: optionalString(obj.homeTitle, `${path}.homeTitle`),
    homeDescription: optionalString(obj.homeDescription, `${path}.homeDescription`),
    homeSocialImage: optionalString(obj.homeSocialImage, `${path}.homeSocialImage`),
    homeNoindex: optionalBoolean(obj.homeNoindex, `${path}.homeNoindex`),
    projectsH1: optionalString(obj.projectsH1, `${path}.projectsH1`),
    projectsTitle: optionalString(obj.projectsTitle, `${path}.projectsTitle`),
    projectsDescription: optionalString(obj.projectsDescription, `${path}.projectsDescription`),
    projectsSocialImage: optionalString(obj.projectsSocialImage, `${path}.projectsSocialImage`),
    projectsNoindex: optionalBoolean(obj.projectsNoindex, `${path}.projectsNoindex`),
    aboutTitle: optionalString(obj.aboutTitle, `${path}.aboutTitle`),
    aboutDescription: optionalString(obj.aboutDescription, `${path}.aboutDescription`),
    aboutSocialImage: optionalString(obj.aboutSocialImage, `${path}.aboutSocialImage`),
    aboutNoindex: optionalBoolean(obj.aboutNoindex, `${path}.aboutNoindex`),
    contactH1: optionalString(obj.contactH1, `${path}.contactH1`),
    contactTitle: optionalString(obj.contactTitle, `${path}.contactTitle`),
    contactDescription: optionalString(obj.contactDescription, `${path}.contactDescription`),
    contactSocialImage: optionalString(obj.contactSocialImage, `${path}.contactSocialImage`),
    contactNoindex: optionalBoolean(obj.contactNoindex, `${path}.contactNoindex`),
    categoryTitleTemplate: optionalString(obj.categoryTitleTemplate, `${path}.categoryTitleTemplate`),
    categoryDescriptionTemplate: optionalString(obj.categoryDescriptionTemplate, `${path}.categoryDescriptionTemplate`),
    workTitleTemplate: optionalString(obj.workTitleTemplate, `${path}.workTitleTemplate`),
    workDescriptionTemplate: optionalString(obj.workDescriptionTemplate, `${path}.workDescriptionTemplate`),
  }
}

export function validateContactPage(value: unknown, path: string): ContactPageDoc {
  const obj = objectAt(value, path)
  return {
    animatedSentences: optionalStringArray(obj.animatedSentences, `${path}.animatedSentences`),
    mailSentence: optionalString(obj.mailSentence, `${path}.mailSentence`),
    email: optionalString(obj.email, `${path}.email`),
  }
}

export function validateLogoMarquee(value: unknown, path: string): { logos: LogoItem[] } {
  const obj = objectAt(value, path)
  return {
    logos: obj.logos === null || obj.logos === undefined ? [] : arrayOf(obj.logos, `${path}.logos`, validateLogoItem),
  }
}

export function validateBioWithPreview(value: unknown, path: string): BioWithPreviewDoc {
  const obj = objectAt(value, path)
  return {
    heroTitle: optionalString(obj.heroTitle, `${path}.heroTitle`),
    seoH1: optionalString(obj.seoH1, `${path}.seoH1`),
    heroVideo: optionalMediaUrls(obj.heroVideo, `${path}.heroVideo`),
    bio: optionalString(obj.bio, `${path}.bio`),
    mirrorLayout: optionalBoolean(obj.mirrorLayout, `${path}.mirrorLayout`),
    bioTextScale: optionalNumber(obj.bioTextScale, `${path}.bioTextScale`),
    previewVideo: optionalMediaUrls(obj.previewVideo, `${path}.previewVideo`),
    approach: optionalObject(obj.approach, `${path}.approach`, approach => ({
      kicker: optionalString(approach.kicker, `${path}.approach.kicker`),
      title: optionalString(approach.title, `${path}.approach.title`),
      body: optionalString(approach.body, `${path}.approach.body`),
      mirrorLayout: optionalBoolean(approach.mirrorLayout, `${path}.approach.mirrorLayout`),
    })),
  }
}

export function validateCategory(value: unknown, path: string): Category {
  const obj = objectAt(value, path)
  return {
    slug: requiredString(obj.slug, `${path}.slug`),
    title: requiredString(obj.title, `${path}.title`),
    sortOrder: optionalNumber(obj.sortOrder, `${path}.sortOrder`),
    seo: optionalObject(obj.seo, `${path}.seo`, validateDocumentSeo),
  }
}

export function validateWorkItem(value: unknown, path: string): WorkItem {
  const obj = objectAt(value, path)
  return {
    slug: requiredString(obj.slug, `${path}.slug`),
    title: requiredString(obj.title, `${path}.title`),
    category: requiredString(obj.category, `${path}.category`),
    categorySlug: requiredString(obj.categorySlug, `${path}.categorySlug`),
    client: requiredString(obj.client, `${path}.client`),
    preview: validatePreview(obj.preview, `${path}.preview`),
    thumbnailAutoplay: optionalBoolean(obj.thumbnailAutoplay, `${path}.thumbnailAutoplay`),
    year: optionalString(obj.year, `${path}.year`),
    publishedAt: optionalString(obj.publishedAt, `${path}.publishedAt`),
    updatedAt: optionalString(obj.updatedAt, `${path}.updatedAt`),
    overviewTitle: optionalString(obj.overviewTitle, `${path}.overviewTitle`),
    body: obj.body === null || obj.body === undefined ? undefined : obj.body,
    media: optionalObject(obj.media, `${path}.media`, validateWorkMedia),
    featuredOnHome: optionalBoolean(obj.featuredOnHome, `${path}.featuredOnHome`),
    featuredOrder: optionalNumber(obj.featuredOrder, `${path}.featuredOrder`),
    seo: optionalObject(obj.seo, `${path}.seo`, validateDocumentSeo),
  }
}

function validateLogoItem(value: unknown, path: string): LogoItem {
  const obj = objectAt(value, path)
  const image = objectAt(obj.image, `${path}.image`)
  return {
    name: optionalString(obj.name, `${path}.name`),
    alt: optionalString(obj.alt, `${path}.alt`),
    image: {
      url: requiredString(image.url, `${path}.image.url`),
      dimensions: optionalDimensions(image.dimensions, `${path}.image.dimensions`),
    },
  }
}

function validateDocumentSeo(value: unknown, path: string): DocumentSeo {
  const obj = objectAt(value, path)
  return {
    title: optionalString(obj.title, `${path}.title`),
    description: optionalString(obj.description, `${path}.description`),
    socialImage: optionalString(obj.socialImage, `${path}.socialImage`),
    socialImageAlt: optionalString(obj.socialImageAlt, `${path}.socialImageAlt`),
    canonicalUrl: optionalString(obj.canonicalUrl, `${path}.canonicalUrl`),
    noindex: optionalBoolean(obj.noindex, `${path}.noindex`),
    focusKeyword: optionalString(obj.focusKeyword, `${path}.focusKeyword`),
  }
}

function validatePreview(value: unknown, path: string): WorkItem["preview"] {
  const obj = objectAt(value, path)
  return {
    poster: requiredString(obj.poster, `${path}.poster`),
    webm: optionalString(obj.webm, `${path}.webm`),
    mp4: optionalString(obj.mp4, `${path}.mp4`),
  }
}

function validateWorkMedia(value: unknown, path: string): WorkMedia {
  const obj = objectAt(value, path)
  const mode = requiredString(obj.mode, `${path}.mode`)

  if (mode === "preview") return { mode }
  if (mode === "single") {
    return {
      mode,
      youtubeUrl: optionalString(obj.youtubeUrl, `${path}.youtubeUrl`),
    }
  }
  if (mode === "slider") {
    return {
      mode,
      reels: optionalStringArray(obj.reels, `${path}.reels`),
    }
  }

  throw new SanityContractError(`${path}.mode expected "preview", "single", or "slider"; received ${formatValue(mode)}`)
}

function optionalMediaUrls(value: unknown, path: string) {
  return optionalObject(value, path, obj => ({
    mp4: optionalString(obj.mp4, `${path}.mp4`),
    webm: optionalString(obj.webm, `${path}.webm`),
    poster: optionalString(obj.poster, `${path}.poster`),
    caption: optionalString(obj.caption, `${path}.caption`),
    captionTextScale: optionalNumber(obj.captionTextScale, `${path}.captionTextScale`),
    captionUppercase: optionalBoolean(obj.captionUppercase, `${path}.captionUppercase`),
  }))
}

function optionalDimensions(value: unknown, path: string) {
  return optionalObject(value, path, obj => ({
    width: optionalNumber(obj.width, `${path}.width`),
    height: optionalNumber(obj.height, `${path}.height`),
  }))
}

function optionalObject<T>(value: unknown, path: string, validator: (value: Record<string, unknown>, path: string) => T) {
  if (value === null || value === undefined) return undefined
  return validator(objectAt(value, path), path)
}

function objectAt(value: unknown, path: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw contractError(path, "object", value)
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown, path: string) {
  if (typeof value === "string" && value.trim()) return value
  throw contractError(path, "non-empty string", value)
}

function optionalString(value: unknown, path: string) {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string") return value
  throw contractError(path, "string", value)
}

function optionalNumber(value: unknown, path: string) {
  if (value === null || value === undefined) return undefined
  if (typeof value === "number" && Number.isFinite(value)) return value
  throw contractError(path, "finite number", value)
}

function optionalBoolean(value: unknown, path: string) {
  if (value === null || value === undefined) return undefined
  if (typeof value === "boolean") return value
  throw contractError(path, "boolean", value)
}

function optionalStringArray(value: unknown, path: string) {
  if (value === null || value === undefined) return undefined
  if (!Array.isArray(value)) throw contractError(path, "array", value)
  return value.map((item, index) => requiredString(item, `${path}[${index}]`))
}

function contractError(path: string, expected: string, received: unknown) {
  return new SanityContractError(`${path} expected ${expected}; received ${formatValue(received)}`)
}

function formatValue(value: unknown) {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "string") return JSON.stringify(value)
  if (Array.isArray(value)) return "array"
  return typeof value
}
