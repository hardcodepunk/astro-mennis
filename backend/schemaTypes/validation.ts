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
  return cloudinaryDeliveryUrl(value, ['image', 'video'])
}

export function cloudinaryMp4Url(value?: string) {
  const base = cloudinaryDeliveryUrl(value, ['video'])
  if (base !== true || !value) return base
  return /\.mp4(\?.*)?$/i.test(value) ? true : 'Use a direct Cloudinary .mp4 URL'
}

export function cloudinaryWebmUrl(value?: string) {
  const base = cloudinaryDeliveryUrl(value, ['video'])
  if (base !== true || !value) return base
  return /\.webm(\?.*)?$/i.test(value) ? true : 'Use a direct Cloudinary .webm URL'
}

export function youtubeUrl(value?: string) {
  const url = parseUrl(value)
  if (!url) return true
  if (url.protocol !== 'https:') return 'Use an HTTPS YouTube URL'

  const host = url.hostname.replace(/^www\./, '')
  const isYouTube = host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be'
  if (!isYouTube) return 'Use a YouTube or youtu.be URL'

  if (host === 'youtu.be') return url.pathname.length > 1 ? true : 'YouTube URL is missing a video ID'
  if (url.pathname.startsWith('/shorts/') && url.pathname.split('/')[2]) return true
  if (url.pathname.startsWith('/embed/') && url.pathname.split('/')[2]) return true
  if (url.searchParams.get('v')) return true
  return 'YouTube URL is missing a video ID'
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
