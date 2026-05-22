import type { SeoSettings, WorkItem } from "./sanity.queries"

export const DEFAULT_SITE_URL = "https://www.demennis.be"
export const DEFAULT_TITLE = "De Mennis"
export const DEFAULT_DESCRIPTION = "Cinematic video work, brand films, reels and creative direction by De Mennis."

export type JsonLd = Record<string, unknown> | Record<string, unknown>[]

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

export function replaceSeoTokens(template: string | undefined, tokens: Record<string, string | undefined>) {
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
    name: seo?.defaultTitle || DEFAULT_TITLE,
    url: siteUrl,
  }
}

export function organizationJsonLd(seo: SeoSettings | null | undefined) {
  const siteUrl = normalizeSiteUrl(seo?.siteUrl)
  const logo = absoluteUrl("/logo.png", siteUrl)
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seo?.defaultTitle || DEFAULT_TITLE,
    url: siteUrl,
    logo,
    sameAs: ["https://www.instagram.com/demennis_/"],
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
