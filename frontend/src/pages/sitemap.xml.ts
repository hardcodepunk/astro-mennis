import {getContentSnapshot} from "../lib/sanity.queries"
import {serializeSitemap} from "../lib/sitemap"

export async function GET() {
  const snapshot = await getContentSnapshot()

  return new Response(serializeSitemap(snapshot), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  })
}
