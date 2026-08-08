import {
  isCloudinaryPosterUrl,
  isCloudinaryVideoUrl,
  validateYouTubeUrl,
} from '@astro-mennis/media-contract'

const CLOUDINARY_HOST = 'res.cloudinary.com'
const IMAGE_EXTENSIONS = /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i

export function httpsUrl(value?: string) {
  const url = parseUrl(value)
  if (!url) return true
  return url.protocol === 'https:' ? true : 'Use an HTTPS URL'
}

export function httpsImageUrl(value?: string) {
  const base = httpsUrl(value)
  if (base !== true || !value) return base

  const url = parseUrl(value)
  if (url?.hostname === CLOUDINARY_HOST) return true
  return IMAGE_EXTENSIONS.test(url?.pathname || '') ? true : 'Use a direct image URL'
}

export function cloudinaryPosterUrl(value?: string) {
  const base = cloudinaryDeliveryUrl(value, ['image', 'video'])
  if (base !== true || !value) return base
  return isCloudinaryPosterUrl(value) ? true : 'Use a Cloudinary image delivery URL for posters'
}

export function cloudinaryMp4Url(value?: string) {
  const base = cloudinaryDeliveryUrl(value, ['video'])
  if (base !== true || !value) return base
  return isCloudinaryVideoUrl(value, 'mp4') ? true : 'Use a direct Cloudinary .mp4 URL'
}

export function cloudinaryWebmUrl(value?: string) {
  const base = cloudinaryDeliveryUrl(value, ['video'])
  if (base !== true || !value) return base
  return isCloudinaryVideoUrl(value, 'webm') ? true : 'Use a direct Cloudinary .webm URL'
}

export function youtubeUrl(value?: string) {
  return validateYouTubeUrl(value)
}

function cloudinaryDeliveryUrl(value: string | undefined, resourceTypes: string[]) {
  const base = httpsUrl(value)
  if (base !== true || !value) return base

  const url = parseUrl(value)
  if (url?.hostname !== CLOUDINARY_HOST) return 'Use a Cloudinary delivery URL'

  const hasAllowedUploadPath = resourceTypes.some((type) => url.pathname.includes(`/${type}/upload/`))
  return hasAllowedUploadPath ? true : `Use a Cloudinary ${resourceTypes.join(' or ')} upload URL`
}

function parseUrl(value?: string) {
  if (!value) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}
