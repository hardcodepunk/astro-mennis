const CLOUDINARY_HOST = "res.cloudinary.com"
const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i
const VIDEO_ID = /^[A-Za-z0-9_-]{6,}$/
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
])

function parseAbsoluteUrl(value) {
  if (typeof value !== "string" || !value.trim()) return undefined
  try {
    return new URL(value.trim())
  } catch {
    return undefined
  }
}

function validVideoId(value) {
  const id = value?.trim()
  return id && VIDEO_ID.test(id) ? id : undefined
}

export function parseYouTubeId(value) {
  if (typeof value !== "string") return undefined
  const input = value.trim()
  if (!input) return undefined

  const directId = validVideoId(input)
  if (directId) return directId

  const url = parseAbsoluteUrl(input)
  if (!url) return undefined
  const host = url.hostname.toLowerCase()

  if (host === "youtu.be") {
    return validVideoId(url.pathname.split("/").filter(Boolean)[0])
  }
  if (!YOUTUBE_HOSTS.has(host)) return undefined

  const segments = url.pathname.split("/").filter(Boolean)
  if (["embed", "live", "shorts"].includes(segments[0])) {
    return validVideoId(segments[1])
  }

  return validVideoId(url.searchParams.get("v"))
}

export function validateYouTubeUrl(value) {
  if (value === undefined || value === null || value === "") return true
  const url = parseAbsoluteUrl(value)
  if (!url || url.protocol !== "https:") return "Use an HTTPS YouTube URL"
  if (!parseYouTubeId(value)) return "Use a supported YouTube URL with a video ID"
  return true
}

export function isCloudinaryPosterUrl(value) {
  const url = parseAbsoluteUrl(value)
  if (!url || url.protocol !== "https:" || url.hostname !== CLOUDINARY_HOST) return false

  const upload = url.pathname.match(/\/(image|video)\/upload\/(.+)$/)
  if (!upload) return false
  if (upload[1] === "image") return true

  const deliveryPath = upload[2]
  const filename = deliveryPath.split("/").at(-1) || ""
  if (IMAGE_EXTENSION.test(filename)) return true

  const imageFormatTransform = /(?:^|[,/])f_(?:avif|gif|jpe?g|png|svg|webp)(?:[,/]|$)/i
  return imageFormatTransform.test(deliveryPath)
}

export function isCloudinaryVideoUrl(value, format) {
  const url = parseAbsoluteUrl(value)
  if (!url || url.protocol !== "https:" || url.hostname !== CLOUDINARY_HOST) return false
  if (!url.pathname.includes("/video/upload/")) return false
  return new RegExp(`\\.${format}$`, "i").test(url.pathname)
}

export function isImageDeliveryUrl(value) {
  const url = parseAbsoluteUrl(value)
  if (!url || url.protocol !== "https:") return false
  if (url.hostname === CLOUDINARY_HOST) return isCloudinaryPosterUrl(value)
  return IMAGE_EXTENSION.test(url.pathname)
}
