import {existsSync} from "node:fs"
import {readdir, readFile} from "node:fs/promises"
import {fileURLToPath} from "node:url"

import {validateContentSnapshot} from "../src/lib/contentSnapshot.ts"
import {selectSitemapUrls, serializeSitemap} from "../src/lib/sitemap.ts"
import {normalizeSiteUrl} from "../src/lib/seo.ts"

const frontendRoot = fileURLToPath(new URL("../", import.meta.url))
const snapshot = validateContentSnapshot(JSON.parse(
  await readFile(`${frontendRoot}.content-snapshot.json`, "utf8"),
))
const sitemapPath = `${frontendRoot}dist/sitemap.xml`
const sitemap = await readFile(sitemapPath, "utf8")
const expectedSitemap = serializeSitemap(snapshot)

if (sitemap !== expectedSitemap) {
  throw new Error("Built sitemap.xml does not match the prepared content snapshot")
}

const legacySitemapPath = `${frontendRoot}dist/sitemap-index.xml`
if (existsSync(legacySitemapPath)) {
  throw new Error("Obsolete sitemap-index.xml was generated")
}

const siteUrl = normalizeSiteUrl(snapshot.seoSettings?.siteUrl)
const robots = await readFile(`${frontendRoot}dist/robots.txt`, "utf8")
if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) {
  throw new Error("Built robots.txt does not reference the snapshot sitemap URL")
}

const sitemapRoutePaths = new Set(
  [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => {
    const location = match[1].replaceAll("&amp;", "&")
    const pathname = new URL(location).pathname
    return pathname.replace(/\/+$/, "") || "/"
  }),
)

for (const htmlPath of await collectHtmlPaths(`${frontendRoot}dist`)) {
  const html = await readFile(htmlPath, "utf8")
  if (!/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*\bnoindex\b)[^>]*>/i.test(html)) {
    continue
  }

  const relativePath = htmlPath.slice(`${frontendRoot}dist`.length).replaceAll("\\", "/")
  const route = relativePath.endsWith("/index.html")
    ? relativePath.slice(0, -"/index.html".length) || "/"
    : relativePath.replace(/\.html$/, "")
  if (sitemapRoutePaths.has(route)) {
    throw new Error(`Built noindex route ${route} appears in sitemap.xml`)
  }
}

console.log(
  `Verified sitemap.xml with ${selectSitemapUrls(snapshot).length} indexable snapshot routes.`,
)

async function collectHtmlPaths(directory) {
  const entries = await readdir(directory, {withFileTypes: true})
  const paths = []
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) paths.push(...await collectHtmlPaths(path))
    else if (entry.name.endsWith(".html")) paths.push(path)
  }
  return paths
}
