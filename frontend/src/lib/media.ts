const CLOUDINARY_UPLOAD = "/upload/"

type CloudinaryQuality = "auto" | "auto:eco"

export function cloudinaryImage(url: string | undefined, width: number, quality: CloudinaryQuality = "auto") {
  if (!url) return undefined
  if (!isImageUrl(url)) return url
  if (!url.includes("res.cloudinary.com") || !url.includes(CLOUDINARY_UPLOAD)) return url

  const markerIndex = url.indexOf(CLOUDINARY_UPLOAD)
  const beforeUpload = url.slice(0, markerIndex + CLOUDINARY_UPLOAD.length)
  const afterUpload = url.slice(markerIndex + CLOUDINARY_UPLOAD.length)
  const segments = afterUpload.split("/")
  const hasTransformSegment = segments.length > 1 && !/^v\d+$/.test(segments[0])
  const existingTransforms = hasTransformSegment ? segments[0].split(",") : []
  const assetPath = hasTransformSegment ? segments.slice(1).join("/") : afterUpload
  const preservedTransforms = existingTransforms.filter(transform => transform.startsWith("so_"))
  const transforms = [...preservedTransforms, "f_auto", `q_${quality}`, `w_${width}`]

  return `${beforeUpload}${transforms.join(",")}/${assetPath}`
}

function isImageUrl(url: string | undefined) {
  if (!url) return false
  const cleanUrl = url.split("?")[0].toLowerCase()
  return /\.(avif|gif|jpe?g|png|svg|webp)$/.test(cleanUrl)
}

export function safePosterUrl(url: string | undefined, fallback: string): string {
  return url && isImageUrl(url) ? url : fallback
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

export function youtubeId(input?: string | null) {
  if (!input) return undefined
  const s = String(input).trim()
  if (!s) return undefined

  const patterns = [
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{6,})/,
    /[?&]v=([A-Za-z0-9_-]{6,})/,
    /^([A-Za-z0-9_-]{6,})$/,
  ]

  for (const pattern of patterns) {
    const match = s.match(pattern)
    if (match?.[1]) return match[1]
  }

  return undefined
}

export function youtubePoster(id: string | undefined, quality: "maxres" | "hq" = "maxres") {
  if (!id) return undefined
  return `https://i.ytimg.com/vi/${id}/${quality === "maxres" ? "maxresdefault" : "hqdefault"}.jpg`
}
