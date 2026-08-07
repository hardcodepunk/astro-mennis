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
  legalDocument?: {
    label?: string
    url?: string
    filename?: string
  }
  workflowPanel?: TextPanel
}

export type TextPanel = {
  kicker?: string
  title?: string
  body?: string
  mirrorLayout?: boolean
}

export type ContactReasonsPanel = {
  kicker?: string
  title?: string
  items?: string[]
  mirrorLayout?: boolean
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
    crop?: {
      top?: number
      bottom?: number
      left?: number
      right?: number
    }
    dimensions?: {
      width?: number
      height?: number
    }
  }
}

export type BioWithPreviewDoc = {
  heroTitle?: string
  heroTitleTextScale?: number
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
  approach?: TextPanel
  contactReasons?: ContactReasonsPanel
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

const PORTABLE_TEXT_STYLES = new Set(["normal", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"])
const PORTABLE_TEXT_LIST_ITEMS = new Set(["bullet", "number"])
const PORTABLE_TEXT_DECORATORS = new Set(["strong", "em", "code", "underline", "strike-through"])
const PORTABLE_TEXT_MAX_ANNOTATIONS_PER_SPAN = 1

export const PORTABLE_TEXT_MAX_LIST_LEVEL = 10
export const PORTABLE_TEXT_MAX_MARKS_PER_SPAN =
  PORTABLE_TEXT_DECORATORS.size + PORTABLE_TEXT_MAX_ANNOTATIONS_PER_SPAN

export type PortableTextLinkMark = {
  _key: string
  _type: "link"
  href?: string
}

export type PortableTextSpan = {
  _key: string
  _type: "span"
  text: string
  marks: string[]
}

export type PortableTextBlock = {
  _key: string
  _type: "block"
  style: "normal" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote"
  children: PortableTextSpan[]
  markDefs: PortableTextLinkMark[]
  listItem?: "bullet" | "number"
  level?: number
}

export type PortableTextInlineImage = {
  _key: string
  _type: "inlineImage"
  alt: string
  caption?: string
  crop?: {
    top: number
    bottom: number
    left: number
    right: number
  }
  hotspot?: {
    x: number
    y: number
    width: number
    height: number
  }
  asset: {
    url: string
    metadata?: {
      dimensions?: {
        width: number
        height: number
      }
    }
  }
}

export type PortableTextBody = Array<PortableTextBlock | PortableTextInlineImage>

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
  body?: PortableTextBody
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
    workflowPanel: optionalTextPanel(obj.workflowPanel, `${path}.workflowPanel`),
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
    heroTitleTextScale: optionalNumber(obj.heroTitleTextScale, `${path}.heroTitleTextScale`),
    seoH1: optionalString(obj.seoH1, `${path}.seoH1`),
    heroVideo: optionalMediaUrls(obj.heroVideo, `${path}.heroVideo`),
    bio: optionalString(obj.bio, `${path}.bio`),
    mirrorLayout: optionalBoolean(obj.mirrorLayout, `${path}.mirrorLayout`),
    bioTextScale: optionalNumber(obj.bioTextScale, `${path}.bioTextScale`),
    previewVideo: optionalMediaUrls(obj.previewVideo, `${path}.previewVideo`),
    approach: optionalTextPanel(obj.approach, `${path}.approach`),
    contactReasons: optionalContactReasonsPanel(obj.contactReasons, `${path}.contactReasons`),
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
    body: obj.body === null || obj.body === undefined ? undefined : validatePortableTextBody(obj.body, `${path}.body`),
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
      crop: optionalCrop(image.crop, `${path}.image.crop`),
      dimensions: optionalDimensions(image.dimensions, `${path}.image.dimensions`),
    },
  }
}

function optionalCrop(value: unknown, path: string) {
  return optionalObject(value, path, obj => ({
    top: optionalNumber(obj.top, `${path}.top`),
    bottom: optionalNumber(obj.bottom, `${path}.bottom`),
    left: optionalNumber(obj.left, `${path}.left`),
    right: optionalNumber(obj.right, `${path}.right`),
  }))
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

export function validatePortableTextBody(value: unknown, path: string): PortableTextBody {
  return arrayOf(value, path, (item, itemPath) => {
    const obj = objectAt(item, itemPath)
    const type = requiredString(obj._type, `${itemPath}._type`)

    if (type === "block") return validatePortableTextBlock(obj, itemPath)
    if (type === "inlineImage") return validatePortableTextInlineImage(obj, itemPath)

    throw contractError(`${itemPath}._type`, '"block" or "inlineImage"', type)
  })
}

function validatePortableTextBlock(obj: Record<string, unknown>, path: string): PortableTextBlock {
  const markDefs = obj.markDefs === null || obj.markDefs === undefined
    ? []
    : arrayOf(obj.markDefs, `${path}.markDefs`, validatePortableTextLinkMark)
  const markDefKeys = new Set<string>()

  markDefs.forEach((markDef, index) => {
    if (markDefKeys.has(markDef._key)) {
      throw new SanityContractError(`${path}.markDefs[${index}]._key must be unique; received ${JSON.stringify(markDef._key)}`)
    }
    markDefKeys.add(markDef._key)
  })

  const style = obj.style === null || obj.style === undefined
    ? "normal"
    : allowedString(obj.style, `${path}.style`, PORTABLE_TEXT_STYLES)
  const listItem = obj.listItem === null || obj.listItem === undefined
    ? undefined
    : allowedString(obj.listItem, `${path}.listItem`, PORTABLE_TEXT_LIST_ITEMS)
  const level = obj.level === null || obj.level === undefined
    ? undefined
    : portableTextListLevel(obj.level, `${path}.level`)
  const children = arrayOf(obj.children, `${path}.children`, (child, childPath) =>
    validatePortableTextSpan(child, childPath, markDefKeys),
  )

  return {
    _key: requiredString(obj._key, `${path}._key`),
    _type: "block",
    style: style as PortableTextBlock["style"],
    children,
    markDefs,
    ...(listItem ? { listItem: listItem as PortableTextBlock["listItem"] } : {}),
    ...(listItem && level ? { level } : {}),
  }
}

function validatePortableTextSpan(value: unknown, path: string, markDefKeys: Set<string>): PortableTextSpan {
  const obj = objectAt(value, path)
  const type = requiredString(obj._type, `${path}._type`)
  if (type !== "span") throw contractError(`${path}._type`, '"span"', type)

  const marks = validatePortableTextMarks(obj.marks, `${path}.marks`, markDefKeys)

  return {
    _key: requiredString(obj._key, `${path}._key`),
    _type: "span",
    text: typeof obj.text === "string" ? obj.text : requiredString(obj.text, `${path}.text`),
    marks,
  }
}

function validatePortableTextMarks(value: unknown, path: string, markDefKeys: Set<string>): string[] {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value)) throw contractError(path, "array", value)
  if (value.length > PORTABLE_TEXT_MAX_MARKS_PER_SPAN) {
    throw new SanityContractError(
      `${path} must contain at most ${PORTABLE_TEXT_MAX_MARKS_PER_SPAN} marks; received ${value.length}`,
    )
  }

  const seenMarks = new Set<string>()
  let annotationCount = 0

  return arrayOf(value, path, (mark, markPath) => {
    const name = requiredString(mark, markPath)
    if (seenMarks.has(name)) {
      throw new SanityContractError(`${markPath} duplicates mark ${JSON.stringify(name)}`)
    }

    const isDecorator = PORTABLE_TEXT_DECORATORS.has(name)
    const isAnnotation = markDefKeys.has(name)
    if (!isDecorator && !isAnnotation) {
      throw new SanityContractError(`${markPath} references an unknown mark; received ${JSON.stringify(name)}`)
    }
    if (isAnnotation && ++annotationCount > PORTABLE_TEXT_MAX_ANNOTATIONS_PER_SPAN) {
      throw new SanityContractError(
        `${path} must reference at most ${PORTABLE_TEXT_MAX_ANNOTATIONS_PER_SPAN} annotation mark`,
      )
    }

    seenMarks.add(name)
    return name
  })
}

function validatePortableTextLinkMark(value: unknown, path: string): PortableTextLinkMark {
  const obj = objectAt(value, path)
  const type = requiredString(obj._type, `${path}._type`)
  if (type !== "link") throw contractError(`${path}._type`, '"link"', type)

  const rawHref = optionalString(obj.href, `${path}.href`)?.trim()
  const href = rawHref && isSafePortableTextHref(rawHref) ? rawHref : undefined

  return {
    _key: requiredString(obj._key, `${path}._key`),
    _type: "link",
    ...(href ? { href } : {}),
  }
}

function validatePortableTextInlineImage(value: Record<string, unknown>, path: string): PortableTextInlineImage {
  const asset = objectAt(value.asset, `${path}.asset`)
  const url = requiredString(asset.url, `${path}.asset.url`).trim()
  if (!isSafeSanityImageUrl(url)) {
    throw new SanityContractError(`${path}.asset.url must be an HTTPS Sanity image URL`)
  }

  const metadata = optionalObject(asset.metadata, `${path}.asset.metadata`, metadataValue => {
    const dimensions = optionalObject(
      metadataValue.dimensions,
      `${path}.asset.metadata.dimensions`,
      dimensionsValue => ({
        width: positiveFiniteNumber(dimensionsValue.width, `${path}.asset.metadata.dimensions.width`),
        height: positiveFiniteNumber(dimensionsValue.height, `${path}.asset.metadata.dimensions.height`),
      }),
    )
    return dimensions ? { dimensions } : {}
  })
  const crop = optionalObject(value.crop, `${path}.crop`, cropValue => {
    const result = {
      top: unitNumber(cropValue.top, `${path}.crop.top`),
      bottom: unitNumber(cropValue.bottom, `${path}.crop.bottom`),
      left: unitNumber(cropValue.left, `${path}.crop.left`),
      right: unitNumber(cropValue.right, `${path}.crop.right`),
    }
    if (result.top + result.bottom >= 1 || result.left + result.right >= 1) {
      throw new SanityContractError(`${path}.crop must leave a visible image area`)
    }
    return result
  })
  const hotspot = optionalObject(value.hotspot, `${path}.hotspot`, hotspotValue => ({
    x: unitNumber(hotspotValue.x, `${path}.hotspot.x`),
    y: unitNumber(hotspotValue.y, `${path}.hotspot.y`),
    width: positiveUnitNumber(hotspotValue.width, `${path}.hotspot.width`),
    height: positiveUnitNumber(hotspotValue.height, `${path}.hotspot.height`),
  }))

  return {
    _key: requiredString(value._key, `${path}._key`),
    _type: "inlineImage",
    alt: requiredString(value.alt, `${path}.alt`),
    caption: optionalString(value.caption, `${path}.caption`),
    ...(crop ? { crop } : {}),
    ...(hotspot ? { hotspot } : {}),
    asset: {
      url,
      ...(metadata ? { metadata } : {}),
    },
  }
}

export function isSafePortableTextHref(value: string): boolean {
  const href = value.trim()
  if (!href || /[\u0000-\u001f\u007f]/.test(href) || href.startsWith("//")) return false

  try {
    const url = new URL(href, "https://relative.invalid/")
    if (url.origin === "https://relative.invalid") return true
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
  } catch {
    return false
  }
}

export function isSafeSanityImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "cdn.sanity.io" && url.pathname.startsWith("/images/")
  } catch {
    return false
  }
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

function optionalTextPanel(value: unknown, path: string) {
  return optionalObject(value, path, panel => ({
    kicker: optionalString(panel.kicker, `${path}.kicker`),
    title: optionalString(panel.title, `${path}.title`),
    body: optionalString(panel.body, `${path}.body`),
    mirrorLayout: optionalBoolean(panel.mirrorLayout, `${path}.mirrorLayout`),
  }))
}

function optionalContactReasonsPanel(value: unknown, path: string) {
  return optionalObject(value, path, panel => ({
    kicker: optionalString(panel.kicker, `${path}.kicker`),
    title: optionalString(panel.title, `${path}.title`),
    items: optionalStringArray(panel.items, `${path}.items`),
    mirrorLayout: optionalBoolean(panel.mirrorLayout, `${path}.mirrorLayout`),
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

function positiveFiniteNumber(value: unknown, path: string) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value
  throw contractError(path, "positive finite number", value)
}

function unitNumber(value: unknown, path: string) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) return value
  throw contractError(path, "number from 0 to 1", value)
}

function positiveUnitNumber(value: unknown, path: string) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1) return value
  throw contractError(path, "number greater than 0 and at most 1", value)
}

function portableTextListLevel(value: unknown, path: string) {
  if (
    typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 1
    && value <= PORTABLE_TEXT_MAX_LIST_LEVEL
  ) {
    return value
  }
  throw contractError(path, `safe integer from 1 to ${PORTABLE_TEXT_MAX_LIST_LEVEL}`, value)
}

function allowedString(value: unknown, path: string, allowed: Set<string>) {
  const result = requiredString(value, path)
  if (allowed.has(result)) return result
  throw new SanityContractError(`${path} expected one of ${Array.from(allowed).join(", ")}; received ${JSON.stringify(result)}`)
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
