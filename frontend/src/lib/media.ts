import {
  isImageDeliveryUrl,
  parseYouTubeId,
} from "@astro-mennis/media-contract"
import { createImageUrlBuilder } from "@sanity/image-url"
import type { WorkPoster } from "./sanity.contract"

const CLOUDINARY_UPLOAD = "/upload/"
const CLOUDINARY_VIDEO_UPLOAD = "/video/upload/"

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

export type ImageSource = string | WorkPoster

export const LANDSCAPE_POSTER_PRESET = Object.freeze({
  widths: Object.freeze([320, 480, 720, 1024, 1280]),
  fallbackWidth: 1280,
  sizes: "(max-width: 72rem) calc(100vw - 2rem), 72rem",
  aspectRatio: 16 / 9,
})

export const REEL_POSTER_PRESET = Object.freeze({
  widths: Object.freeze([320, 480, 720]),
  fallbackWidth: 720,
  sizes: "(max-width: 30rem) 86vw, 420px",
  aspectRatio: 9 / 16,
})

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

type CloudinaryVideoFormat = "mp4" | "webm"

const CLOUDINARY_VIDEO_DELIVERY_TRANSFORMS = new Set(["ac", "f", "q", "vc"])

export function cloudinaryVideo(
  url: string | undefined,
  format: CloudinaryVideoFormat,
) {
  if (!url) return undefined

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  if (parsed.hostname !== "res.cloudinary.com" || !parsed.pathname.includes(CLOUDINARY_VIDEO_UPLOAD)) {
    return url
  }

  const markerIndex = parsed.pathname.indexOf(CLOUDINARY_VIDEO_UPLOAD)
  const beforeUpload = parsed.pathname.slice(0, markerIndex + CLOUDINARY_VIDEO_UPLOAD.length)
  const afterUpload = parsed.pathname.slice(markerIndex + CLOUDINARY_VIDEO_UPLOAD.length)
  const segments = afterUpload.split("/").filter(Boolean)
  const versionIndex = segments.findIndex(segment => /^v\d+$/.test(segment))
  const transformSegmentCount = versionIndex >= 0
    ? versionIndex
    : segments.findIndex(segment => !isCloudinaryTransformSegment(segment))
  const safeTransformCount = transformSegmentCount === -1 ? 0 : transformSegmentCount
  const existingTransforms = segments.slice(0, safeTransformCount).flatMap(segment => segment.split(","))
  const assetPath = segments.slice(safeTransformCount).join("/")
  if (!assetPath) return url

  const preservedTransforms = existingTransforms.filter(transform => {
    const separatorIndex = transform.indexOf("_")
    return separatorIndex <= 0 ||
      !CLOUDINARY_VIDEO_DELIVERY_TRANSFORMS.has(transform.slice(0, separatorIndex))
  })
  const codec = format === "webm" ? "vp9" : "h264"
  const transforms = [
    ...preservedTransforms,
    "q_auto:eco",
    `vc_${codec}`,
    "ac_none",
    `f_${format}`,
  ]

  parsed.pathname = `${beforeUpload}${transforms.join(",")}/${assetPath}`
  return parsed.toString()
}

export function safePosterUrl(url: string | undefined, fallback: string): string {
  return url && isImageDeliveryUrl(url) ? url : fallback
}

function cloudinaryImageSrcset(url: string | undefined, widths: readonly number[], quality: CloudinaryQuality = "auto") {
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
  src: ImageSource | undefined
  widths: readonly number[]
  fallbackWidth: number
  sizes: string
  quality?: CloudinaryQuality
  aspectRatio?: number
}) {
  const { src, widths, fallbackWidth, sizes, quality = "auto", aspectRatio } = options
  if (src && typeof src !== "string" && src.provider === "sanity") {
    const builder = sanityPosterBuilder(src)
    const transformedUrl = (width: number) => {
      if (!builder) return sanityImageUrl({
        src: src.url,
        width,
        crop: src.crop,
        dimensions: src.dimensions,
      })
      const sized = aspectRatio
        ? builder.width(width).height(Math.round(width / aspectRatio)).fit("crop")
        : builder.width(width).fit("max")
      return sized.auto("format").url()
    }
    const srcset = widths
      .filter((width, index, list) => width > 0 && list.indexOf(width) === index)
      .sort((a, b) => a - b)
      .map(width => {
        const transformed = transformedUrl(width)
        return transformed ? `${transformed} ${width}w` : undefined
      })
      .filter((entry): entry is string => Boolean(entry))
      .join(", ") || undefined

    return {
      src: transformedUrl(fallbackWidth) ?? src.url,
      srcset,
      sizes,
    }
  }

  const url = typeof src === "string" ? src : src?.url
  return {
    src: cloudinaryImage(url, fallbackWidth, quality) ?? url,
    srcset: cloudinaryImageSrcset(url, widths, quality),
    sizes,
  }
}

function sanityPosterBuilder(source: Extract<ImageSource, {provider: "sanity"}>) {
  let parsed: URL
  try {
    parsed = new URL(source.url)
  } catch {
    return undefined
  }
  const segments = parsed.pathname.split("/").filter(Boolean)
  if (parsed.hostname !== "cdn.sanity.io" || segments[0] !== "images") return undefined
  const projectId = segments[1]
  const dataset = segments[2]
  if (!projectId || !dataset) return undefined

  const crop = source.crop
  const hotspot = source.hotspot
  const image = {
    asset: {url: source.url},
    ...(crop
      && typeof crop.top === "number"
      && typeof crop.bottom === "number"
      && typeof crop.left === "number"
      && typeof crop.right === "number"
      ? {crop: {top: crop.top, bottom: crop.bottom, left: crop.left, right: crop.right}}
      : {}),
    ...(hotspot
      && typeof hotspot.x === "number"
      && typeof hotspot.y === "number"
      && typeof hotspot.width === "number"
      && typeof hotspot.height === "number"
      ? {hotspot: {x: hotspot.x, y: hotspot.y, width: hotspot.width, height: hotspot.height}}
      : {}),
  }

  return createImageUrlBuilder({projectId, dataset}).image(image)
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

export const defaultHeroMedia = Object.freeze({
  mp4: "https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,vc_h264,ac_aac,f_mp4/v1737957147/wsuszohtmu2pks673muc.mp4",
  webm: "https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,vc_vp9,f_webm/v1761381373/b8f7chk3u9s6jaqh4bae.webm",
  poster:
    "https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,so_0,f_jpg,w_1600/v1737957147/wsuszohtmu2pks673muc.jpg",
} as const)
