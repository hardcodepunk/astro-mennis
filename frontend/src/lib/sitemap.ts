import type {ContentSnapshot} from "./contentSnapshot.ts"
import {absoluteUrl, normalizeSiteUrl} from "./seo.ts"

type SitemapCandidate = {
  path: string
  canonicalUrl?: string
  noindex?: boolean
}

export function selectSitemapUrls(snapshot: ContentSnapshot) {
  const siteUrl = normalizeSiteUrl(snapshot.seoSettings?.siteUrl)
  const siteOrigin = new URL(siteUrl).origin
  const candidates = createSitemapCandidates(snapshot)
  const selfCanonicalUrls = new Map<string, URL>()

  for (const candidate of candidates) {
    if (candidate.noindex === true) continue

    const canonical = sameSiteUrl(candidate.canonicalUrl ?? candidate.path, siteUrl, siteOrigin)
    if (!canonical) continue

    const candidatePath = routePath(candidate.path, siteUrl)
    if (routePath(canonical.pathname, siteUrl) !== candidatePath) continue
    selfCanonicalUrls.set(candidatePath, canonical)
  }
  const urls = new Set<string>()

  for (const candidate of candidates) {
    if (candidate.noindex === true) continue

    const url = sameSiteUrl(candidate.canonicalUrl ?? candidate.path, siteUrl, siteOrigin)
    if (!url) continue

    const targetCanonical = selfCanonicalUrls.get(routePath(url.pathname, siteUrl))
    if (!targetCanonical || urlIdentity(targetCanonical, siteUrl) !== urlIdentity(url, siteUrl)) {
      continue
    }

    urls.add(targetCanonical.toString())
  }

  return [...urls]
}

function routePath(value: string, siteUrl: string) {
  const pathname = new URL(value, siteUrl).pathname
  return pathname.replace(/\/+$/, "") || "/"
}

function sameSiteUrl(value: string, siteUrl: string, siteOrigin: string) {
  const absolute = absoluteUrl(value, siteUrl)
  if (!absolute) return undefined

  const url = new URL(absolute)
  if (!/^https?:$/.test(url.protocol) || url.origin !== siteOrigin) return undefined
  url.hash = ""
  return url
}

function urlIdentity(url: URL, siteUrl: string) {
  return `${url.origin}${routePath(url.pathname, siteUrl)}${url.search}`
}

export function serializeSitemap(snapshot: ContentSnapshot) {
  const entries = selectSitemapUrls(snapshot)
    .map(url => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join("\n")

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
    "",
  ].join("\n")
}

function createSitemapCandidates(snapshot: ContentSnapshot): SitemapCandidate[] {
  const seo = snapshot.seoSettings

  return [
    {path: "/", noindex: seo?.homeNoindex},
    {path: "/projects/", noindex: seo?.projectsNoindex},
    {path: "/about/", noindex: seo?.aboutNoindex},
    {path: "/contact/", noindex: seo?.contactNoindex},
    ...snapshot.categories.map(category => ({
      path: `/projects/${category.slug}/`,
      canonicalUrl: category.seo?.canonicalUrl,
      noindex: category.seo?.noindex,
    })),
    ...snapshot.works.map(work => ({
      path: `/works/${work.slug}/`,
      canonicalUrl: work.seo?.canonicalUrl,
      noindex: work.seo?.noindex,
    })),
  ]
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}
