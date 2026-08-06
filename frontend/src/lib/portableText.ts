import sanitizeHtml from "sanitize-html"
import {
  toHTML,
  type PortableTextComponents,
  type PortableTextMarkComponent,
  type PortableTextTypeComponent,
} from "@portabletext/to-html"
import { sanityImageUrl } from "./media.ts"
import {
  isSafePortableTextHref,
  isSafeSanityImageUrl,
  type PortableTextBody,
  type PortableTextInlineImage,
  type PortableTextLinkMark,
} from "./sanity.contract.ts"

const renderInlineImage: PortableTextTypeComponent<PortableTextInlineImage> = ({ value }) => {
  const url = value?.asset?.url
  if (!url || !isSafeSanityImageUrl(url)) return ""

  const dimensions = value.asset.metadata?.dimensions
  const sourceWidth = positiveDimension(dimensions?.width, 1200)
  const sourceHeight = positiveDimension(dimensions?.height, 800)
  const crop = value.crop
  const visibleWidth = sourceWidth * Math.max(0.01, 1 - clampUnit(crop?.left) - clampUnit(crop?.right))
  const visibleHeight = sourceHeight * Math.max(0.01, 1 - clampUnit(crop?.top) - clampUnit(crop?.bottom))
  const width = Math.max(1, Math.min(1600, Math.round(visibleWidth)))
  const height = Math.max(1, Math.round(width * (visibleHeight / visibleWidth)))
  const alt = typeof value.alt === "string" ? value.alt : ""
  const caption = typeof value.caption === "string" ? value.caption : undefined
  const src = sanityImageUrl({
    src: url,
    width,
    height,
    crop,
    dimensions,
  })
  const attrs = `src="${escapeHtml(src || url)}" width="${width}" height="${height}" alt="${escapeHtml(
    alt,
  )}" loading="lazy" decoding="async"`

  if (caption) {
    return `<figure><img ${attrs} /><figcaption>${escapeHtml(caption)}</figcaption></figure>`
  }
  return `<img ${attrs} />`
}

const renderLink: PortableTextMarkComponent<PortableTextLinkMark> = ({ children, value }) => {
  const href = value?.href
  if (!href || !isSafePortableTextHref(href)) return children
  return `<a href="${escapeHtml(href)}">${children}</a>`
}

export const portableTextComponents: PortableTextComponents = {
  types: {
    inlineImage: renderInlineImage,
  },
  marks: {
    link: renderLink,
    underline: ({ children }) => `<u>${children}</u>`,
  },
  unknownType: () => "",
  unknownMark: ({ children }) => children,
  unknownBlockStyle: ({ children }) => `<p>${children ?? ""}</p>`,
  unknownList: ({ children }) => `<ul>${children ?? ""}</ul>`,
  unknownListItem: ({ children }) => `<li>${children ?? ""}</li>`,
}

const portableTextSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "code",
    "u",
    "del",
    "a",
    "br",
    "figure",
    "img",
    "figcaption",
  ],
  allowedAttributes: {
    a: ["href"],
    img: ["src", "width", "height", "alt", "loading", "decoding"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {
    img: ["https"],
  },
  allowProtocolRelative: false,
  nestingLimit: 20,
  parseStyleAttributes: false,
  exclusiveFilter: frame => frame.tag === "img" && !isSafeSanityImageUrl(frame.attribs.src || ""),
}

export function sanitizePortableTextHtml(value: string): string {
  return sanitizeHtml(value, portableTextSanitizeOptions)
}

export function portableTextToHtml(value: PortableTextBody | undefined) {
  if (!value?.length) return ""
  const html = toHTML(value, {
    components: portableTextComponents,
    onMissingComponent: false,
  })
  return sanitizePortableTextHtml(html)
}

function positiveDimension(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback
}

function clampUnit(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
