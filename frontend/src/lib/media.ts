import {
  isImageDeliveryUrl,
  parseYouTubeId,
} from "@astro-mennis/media-contract"

const CLOUDINARY_UPLOAD = "/upload/"

type CloudinaryQuality = "auto" | "auto:eco"
type SanityCrop = {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

type ImageDimensions = {
  width?: number
  height?: number
}

export function cloudinaryImage(url: string | undefined, width: number, quality: CloudinaryQuality = "auto") {
  if (!url) return undefined
  if (!isImageDeliveryUrl(url)) return url
  const parsed = new URL(url)
  if (parsed.hostname !== "res.cloudinary.com" || !parsed.pathname.includes(CLOUDINARY_UPLOAD)) return url

  const markerIndex = parsed.pathname.indexOf(CLOUDINARY_UPLOAD)
  const beforeUpload = parsed.pathname.slice(0, markerIndex + CLOUDINARY_UPLOAD.length)
  const afterUpload = parsed.pathname.slice(markerIndex + CLOUDINARY_UPLOAD.length)
  const segments = afterUpload.split("/").filter(Boolean)
  const versionIndex = segments.findIndex(segment => /^v\d+$/.test(segment))
  const transformSegmentCount = versionIndex >= 0
    ? versionIndex
    : segments.findIndex(segment => !isCloudinaryTransformSegment(segment))
  const safeTransformCount = transformSegmentCount === -1 ? 0 : transformSegmentCount
  const existingTransforms = segments.slice(0, safeTransformCount).flatMap(segment => segment.split(","))
  const assetPath = segments.slice(safeTransformCount).join("/")
  if (!assetPath) return url
  const preservedTransforms = existingTransforms.filter(transform => transform.startsWith("so_"))
  const transforms = [...preservedTransforms, "f_auto", `q_${quality}`, `w_${width}`]

  parsed.pathname = `${beforeUpload}${transforms.join(",")}/${assetPath}`
  return parsed.toString()
}

const CLOUDINARY_TRANSFORM_KEYS = new Set([
  "a", "ac", "af", "ar", "b", "bo", "br", "c", "co", "cs", "d", "dl", "dn", "dpr",
  "du", "e", "eo", "f", "fl", "fn", "fps", "g", "h", "if", "ki", "l", "o", "p", "pg",
  "q", "r", "so", "sp", "t", "u", "vc", "vs", "w", "x", "y", "z",
])

function isCloudinaryTransformSegment(segment: string) {
  if (!segment || /^v\d+$/.test(segment)) return false
  return segment.split(",").every(component => {
    const separatorIndex = component.indexOf("_")
    return separatorIndex > 0 && CLOUDINARY_TRANSFORM_KEYS.has(component.slice(0, separatorIndex))
  })
}

export function safePosterUrl(url: string | undefined, fallback: string): string {
  return url && isImageDeliveryUrl(url) ? url : fallback
}

function imageSrcset(url: string | undefined, widths: number[], quality: CloudinaryQuality = "auto") {
  if (!url) return undefined
  if (!url.includes("res.cloudinary.com") || !url.includes(CLOUDINARY_UPLOAD)) return undefined

  const entries = widths
    .filter((width, index, list) => width > 0 && list.indexOf(width) === index)
    .sort((a, b) => a - b)
    .map(width => {
      const transformed = cloudinaryImage(url, width, quality)
      return transformed ? `${transformed} ${width}w` : undefined
    })
    .filter((entry): entry is string => Boolean(entry))

  return entries.length > 0 ? entries.join(", ") : undefined
}

export function imageAttributes(options: {
  src: string | undefined
  widths: number[]
  fallbackWidth: number
  sizes: string
  quality?: CloudinaryQuality
}) {
  const { src, widths, fallbackWidth, sizes, quality = "auto" } = options
  return {
    src: cloudinaryImage(src, fallbackWidth, quality) ?? src,
    srcset: imageSrcset(src, widths, quality),
    sizes,
  }
}

export function sanityImageUrl(options: {
  src: string | undefined
  width: number
  height?: number
  crop?: SanityCrop
  dimensions?: ImageDimensions
}) {
  const { src, width, height, crop, dimensions } = options
  if (!src || !src.includes("cdn.sanity.io/images/")) return src

  const params = new URLSearchParams({
    auto: "format",
    fit: "max",
    w: String(width),
  })

  if (height) params.set("h", String(height))

  const rect = sanityCropRect(crop, dimensions)
  if (rect) params.set("rect", rect)

  return `${src}${src.includes("?") ? "&" : "?"}${params.toString()}`
}

function sanityCropRect(crop: SanityCrop | undefined, dimensions: ImageDimensions | undefined) {
  const width = dimensions?.width
  const height = dimensions?.height
  if (!crop || !width || !height) return undefined

  const left = clampUnit(crop.left)
  const right = clampUnit(crop.right)
  const top = clampUnit(crop.top)
  const bottom = clampUnit(crop.bottom)
  const rectX = Math.round(width * left)
  const rectY = Math.round(height * top)
  const rectW = Math.round(width * Math.max(0.01, 1 - left - right))
  const rectH = Math.round(height * Math.max(0.01, 1 - top - bottom))

  return `${rectX},${rectY},${rectW},${rectH}`
}

function clampUnit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function youtubeId(input?: string | null) {
  return parseYouTubeId(input)
}

export function youtubePoster(id: string | undefined, quality: "maxres" | "hq" = "maxres") {
  if (!id) return undefined
  return `https://i.ytimg.com/vi/${id}/${quality === "maxres" ? "maxresdefault" : "hqdefault"}.jpg`
}

export const defaultHeroMedia = Object.freeze({
  mp4: "https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,vc_h264,ac_aac,f_mp4/v1737957147/wsuszohtmu2pks673muc.mp4",
  webm: "https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,vc_vp9,f_webm/v1761381373/b8f7chk3u9s6jaqh4bae.webm",
  poster:
    "https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,so_0,f_jpg,w_1600/v1737957147/wsuszohtmu2pks673muc.jpg",
} as const)
