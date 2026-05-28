import type { Category, SeoSettings, WorkItem } from "./sanity.queries"

export const DEFAULT_SITE_URL = "https://www.demennis.be"
export const DEFAULT_TITLE = "De Mennis"
export const DEFAULT_DESCRIPTION = "Cinematic video work, brand films, reels and creative direction by De Mennis."
const DEFAULT_PERSON_NAME = "Dennis Van Stappen"
const DEFAULT_BASE_CITY = "Gent"
const DEFAULT_BASE_COUNTRY = "Belgium"
const DEFAULT_SAME_AS = ["https://www.instagram.com/demennis_/"]

export function normalizeSiteUrl(siteUrl?: string) {
  return (siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "")
}

export function absoluteUrl(input: string | undefined, siteUrl?: string) {
  if (!input) return undefined
  try {
    return new URL(input).toString()
  } catch {
    return new URL(input.startsWith("/") ? input : `/${input}`, normalizeSiteUrl(siteUrl)).toString()
  }
}

export function formatTitle(seo: SeoSettings | null | undefined, title?: string, isHome = false) {
  const rawTitle = title || seo?.defaultTitle || DEFAULT_TITLE
  if (isHome) return rawTitle

  const template = seo?.titleTemplate || "%s | De Mennis"
  if (template.includes("%s")) return template.replace("%s", rawTitle)
  return `${rawTitle} | ${template}`
}

export function metaDescription(seo: SeoSettings | null | undefined, description?: string) {
  return description || seo?.defaultDescription || DEFAULT_DESCRIPTION
}

export function socialImage(seo: SeoSettings | null | undefined, image?: string) {
  return image || seo?.defaultSocialImage
}

function brandName(seo: SeoSettings | null | undefined) {
  return seo?.brandName || seo?.defaultTitle || DEFAULT_TITLE
}

function personName(seo: SeoSettings | null | undefined) {
  return seo?.personName || DEFAULT_PERSON_NAME
}

function sameAs(seo: SeoSettings | null | undefined) {
  return seo?.sameAs?.length ? seo.sameAs : DEFAULT_SAME_AS
}

function addressJsonLd(seo: SeoSettings | null | undefined) {
  return {
    "@type": "PostalAddress",
    addressLocality: seo?.baseCity || DEFAULT_BASE_CITY,
    addressCountry: seo?.baseCountry || DEFAULT_BASE_COUNTRY,
  }
}

function personId(seo: SeoSettings | null | undefined) {
  return `${normalizeSiteUrl(seo?.siteUrl)}/#person`
}

function organizationId(seo: SeoSettings | null | undefined) {
  return `${normalizeSiteUrl(seo?.siteUrl)}/#organization`
}

function websiteId(seo: SeoSettings | null | undefined) {
  return `${normalizeSiteUrl(seo?.siteUrl)}/#website`
}

function pageId(path: string, siteUrl?: string) {
  return `${absoluteUrl(path, siteUrl)}#webpage`
}

function replaceSeoTokens(template: string | undefined, tokens: Record<string, string | undefined>) {
  if (!template) return ""
  return Object.entries(tokens).reduce(
    (value, [token, replacement]) => value.replaceAll(`%${token}%`, replacement || ""),
    template,
  )
}

export function categorySeoTitle(seo: SeoSettings | null | undefined, categoryTitle: string, titleOverride?: string) {
  if (titleOverride) return formatTitle(seo, titleOverride)
  if (!categoryTitle) return formatTitle(seo)

  const title = replaceSeoTokens(seo?.categoryTitleTemplate || "%category% Projects", {
    category: categoryTitle,
  })
  return formatTitle(seo, title)
}

export function categorySeoDescription(
  seo: SeoSettings | null | undefined,
  categoryTitle: string,
  descriptionOverride?: string,
) {
  if (descriptionOverride) return metaDescription(seo, descriptionOverride)

  const description = replaceSeoTokens(
    seo?.categoryDescriptionTemplate || "Explore %category% video projects by De Mennis.",
    { category: categoryTitle },
  )
  return metaDescription(seo, description)
}

export function workSeoTitle(seo: SeoSettings | null | undefined, work: WorkItem) {
  if (work.seo?.title) return formatTitle(seo, work.seo.title)

  const title = replaceSeoTokens(seo?.workTitleTemplate || "%title%", {
    title: work.title,
    client: work.client,
    category: work.category,
    year: work.year,
  })
  return formatTitle(seo, title || work.title)
}

export function workSeoDescription(seo: SeoSettings | null | undefined, work: WorkItem) {
  if (work.seo?.description) return metaDescription(seo, work.seo.description)

  const description = replaceSeoTokens(
    seo?.workDescriptionTemplate || "%title% is a %category% video project for %client% by De Mennis.",
    {
      title: work.title,
      client: work.client,
      category: work.category,
      year: work.year,
    },
  )
  return metaDescription(seo, description)
}

export function websiteJsonLd(seo: SeoSettings | null | undefined) {
  const siteUrl = normalizeSiteUrl(seo?.siteUrl)
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId(seo),
    name: brandName(seo),
    url: siteUrl,
    publisher: { "@id": organizationId(seo) },
  }
}

export function organizationJsonLd(seo: SeoSettings | null | undefined) {
  const siteUrl = normalizeSiteUrl(seo?.siteUrl)
  const logo = absoluteUrl("/logo.png", siteUrl)
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId(seo),
    name: brandName(seo),
    url: siteUrl,
    logo,
    address: addressJsonLd(seo),
    founder: { "@id": personId(seo) },
    sameAs: sameAs(seo),
  }
}

export function personJsonLd(seo: SeoSettings | null | undefined) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": personId(seo),
    name: personName(seo),
    url: normalizeSiteUrl(seo?.siteUrl),
    homeLocation: {
      "@type": "Place",
      name: `${seo?.baseCity || DEFAULT_BASE_CITY}, ${seo?.baseCountry || DEFAULT_BASE_COUNTRY}`,
      address: addressJsonLd(seo),
    },
    worksFor: { "@id": organizationId(seo) },
    sameAs: sameAs(seo),
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[], siteUrl?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, siteUrl),
    })),
  }
}

export function collectionPageJsonLd(params: {
  seo: SeoSettings | null | undefined
  title: string
  description: string
  path: string
  works: WorkItem[]
  category?: Category | null
}) {
  const { seo, title, description, path, works, category } = params
  const url = absoluteUrl(path, seo?.siteUrl)
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": pageId(path, seo?.siteUrl),
    name: title,
    description,
    url,
    isPartOf: { "@id": websiteId(seo) },
    publisher: { "@id": organizationId(seo) },
    about: category
      ? {
          "@type": "Thing",
          name: category.title,
        }
      : undefined,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: works.map((work, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/works/${work.slug}`, seo?.siteUrl),
        name: work.title,
      })),
    },
  }
}

export function contactPageJsonLd(params: {
  seo: SeoSettings | null | undefined
  title: string
  description: string
  email?: string
  socialUrls?: string[]
}) {
  const { seo, title, description, email, socialUrls = [] } = params
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": pageId("/contact", seo?.siteUrl),
    name: title,
    description,
    url: absoluteUrl("/contact", seo?.siteUrl),
    isPartOf: { "@id": websiteId(seo) },
    publisher: { "@id": organizationId(seo) },
    mainEntity: {
      "@type": "Organization",
      "@id": organizationId(seo),
      name: brandName(seo),
      email,
      sameAs: socialUrls.length ? socialUrls : sameAs(seo),
    },
  }
}

export function creativeWorkJsonLd(params: {
  seo: SeoSettings | null | undefined
  work: WorkItem
  title: string
  description: string
  path: string
  image?: string
}) {
  const { seo, work, title, description, path, image } = params
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${absoluteUrl(path, seo?.siteUrl)}#creative-work`,
    name: title,
    headline: work.title,
    description,
    url: absoluteUrl(path, seo?.siteUrl),
    image: absoluteUrl(image ?? work.preview.poster, seo?.siteUrl),
    datePublished: work.publishedAt,
    dateModified: work.updatedAt,
    creator: { "@id": personId(seo) },
    publisher: { "@id": organizationId(seo) },
    locationCreated: {
      "@type": "Place",
      name: `${seo?.baseCity || DEFAULT_BASE_CITY}, ${seo?.baseCountry || DEFAULT_BASE_COUNTRY}`,
      address: addressJsonLd(seo),
    },
    about: [
      work.category
        ? {
            "@type": "Thing",
            name: work.category,
          }
        : undefined,
      work.client
        ? {
            "@type": "Organization",
            name: work.client,
          }
        : undefined,
    ].filter(Boolean),
  }
}

export function videoObjectJsonLd(params: {
  seo: SeoSettings | null | undefined
  work: WorkItem
  title: string
  description: string
  image?: string
}) {
  const { seo, work, title, description, image } = params
  const thumbnailUrl = absoluteUrl(image ?? work.preview.poster, seo?.siteUrl)
  const base = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    description,
    thumbnailUrl: thumbnailUrl ? [thumbnailUrl] : undefined,
    uploadDate: work.publishedAt,
    dateModified: work.updatedAt,
    creator: { "@id": personId(seo) },
    publisher: { "@id": organizationId(seo) },
  }

  if (work.media?.mode === "single") {
    const embedUrl = youtubeEmbedUrl(work.media.youtubeUrl)
    if (!embedUrl) return []
    return [{ ...base, embedUrl }]
  }

  if (work.media?.mode === "slider") {
    return (work.media.reels ?? [])
      .map(url => youtubeEmbedUrl(url))
      .filter((url): url is string => Boolean(url))
      .map((embedUrl, index) => ({
        ...base,
        name: index === 0 ? title : `${title} reel ${index + 1}`,
        embedUrl,
      }))
  }

  const contentUrl = work.preview.mp4 || work.preview.webm
  if (!contentUrl) return []
  return [{ ...base, contentUrl: absoluteUrl(contentUrl, seo?.siteUrl) }]
}

function youtubeEmbedUrl(input?: string) {
  const id = youtubeId(input)
  return id ? `https://www.youtube.com/embed/${id}` : undefined
}

function youtubeId(input?: string) {
  if (!input) return undefined
  const s = input.trim()
  if (!s) return undefined

  const patterns = [
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{6,})/,
    /[?&]v=([A-Za-z0-9_-]{6,})/,
    /^([A-Za-z0-9_-]{6,})$/,
  ]

  for (const pattern of patterns) {
    const match = s.match(pattern)
    if (match?.[1]) return match[1]
  }

  return undefined
}
