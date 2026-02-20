import { toHTML } from "@portabletext/to-html"

export function portableTextToHtml(value: unknown) {
  if (!value) return ""
  return toHTML(value as any, {
    components: {
      types: {
        inlineImage: ({ value }: any) => {
          const url = value?.asset?.url
          const alt = value?.alt || ""
          const caption = value?.caption
          if (!url) return ""
          if (caption) {
            return `<figure><img src="${url}" alt="${escapeHtml(alt)}" loading="lazy" /><figcaption>${escapeHtml(caption)}</figcaption></figure>`
          }
          return `<img src="${url}" alt="${escapeHtml(alt)}" loading="lazy" />`
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
