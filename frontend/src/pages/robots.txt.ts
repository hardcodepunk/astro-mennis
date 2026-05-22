import { getSeoSettings } from "../lib/sanity.queries"
import { normalizeSiteUrl } from "../lib/seo"

export async function GET() {
  const seoSettings = await getSeoSettings()
  const siteUrl = normalizeSiteUrl(seoSettings?.siteUrl)

  return new Response(`User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap-index.xml
`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}
