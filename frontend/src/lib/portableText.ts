import { toHTML } from "@portabletext/to-html"
import { imageAttributes } from "./media"

export function portableTextToHtml(value: unknown) {
  if (!value) return ""
  return toHTML(value as any, {
    components: {
      types: {
        inlineImage: ({ value }: any) => {
          const url = value?.asset?.url
          const alt = value?.alt || ""
          const caption = value?.caption
          const dimensions = value?.asset?.metadata?.dimensions
          const width = Number(dimensions?.width) || 1200
          const height = Number(dimensions?.height) || 800
          const image = imageAttributes({
            src: url,
            widths: [480, 720, 960, 1200, 1600],
            fallbackWidth: Math.min(1600, width),
            sizes: "(max-width: 70ch) calc(100vw - 2rem), 70ch",
          })
          if (!url) return ""
          const attrs = `src="${escapeHtml(image.src || url)}"${
            image.srcset ? ` srcset="${escapeHtml(image.srcset)}"` : ""
          } sizes="${escapeHtml(image.sizes)}" width="${width}" height="${height}" alt="${escapeHtml(
            alt,
          )}" loading="lazy" decoding="async"`
          if (caption) {
            return `<figure><img ${attrs} /><figcaption>${escapeHtml(caption)}</figcaption></figure>`
          }
          return `<img ${attrs} />`
        },
      },
    },
  })
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
