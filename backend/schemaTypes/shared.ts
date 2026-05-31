import {defineField} from 'sanity'
import {
  cloudinaryMp4Url,
  cloudinaryPosterUrl,
  cloudinaryWebmUrl,
  httpsImageUrl,
  httpsUrl,
} from './validation'

export const defaultCloudinaryVideoUrls = {
  mp4: 'https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,vc_h264,ac_aac,f_mp4/v1737957147/wsuszohtmu2pks673muc.mp4',
  webm: 'https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,vc_vp9,f_webm/v1761381373/b8f7chk3u9s6jaqh4bae.webm',
  poster:
    'https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,so_0,f_jpg,w_1600/v1737957147/wsuszohtmu2pks673muc.jpg',
}

type DocumentTypeContext = 'work' | 'category' | 'project' | 'item'

export function defineDocumentSeoFields(context: DocumentTypeContext = 'item') {
  const contextLabel = context === 'work' ? 'work page' : context === 'category' ? 'category' : 'item'
  return [
    defineField({
      name: 'title',
      title: 'SEO title',
      description: `Overrides the generated browser/search title for this ${contextLabel}.`,
      type: 'string',
      validation: (r) => r.max(70),
    }),
    defineField({
      name: 'description',
      title: 'Meta description',
      description: `Overrides the generated search/social description for this ${contextLabel}.`,
      type: 'text',
      rows: 3,
      validation: (r) => r.max(170),
    }),
    defineField({
      name: 'socialImage',
      title: 'Social image URL',
      description: 'Absolute image URL used for Open Graph and Twitter previews.',
      type: 'url',
      validation: (r) => r.uri({scheme: ['https']}).custom(httpsImageUrl),
    }),
    defineField({
      name: 'socialImageAlt',
      title: 'Social image alt text',
      type: 'string',
    }),
    defineField({
      name: 'canonicalUrl',
      title: 'Canonical URL override',
      description: `Only use when this ${contextLabel} should canonicalize to a different URL.`,
      type: 'url',
      validation: (r) => r.uri({scheme: ['https']}).custom(httpsUrl),
    }),
    defineField({
      name: 'noindex',
      title: `Hide this ${contextLabel} from search results`,
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'focusKeyword',
      title: 'Focus keyword',
      description: 'Internal planning note only. This is not rendered as a meta keywords tag.',
      type: 'string',
    }),
  ]
}

type CloudinaryVideoFieldOptions = {
  posterRequired?: boolean
  posterTitle?: string
  posterDescription?: string
  webmTitle?: string
  webmDescription?: string
  mp4Title?: string
  mp4Description?: string
}

export function defineCloudinaryVideoFields({
  posterRequired = false,
  posterTitle = 'Poster URL',
  posterDescription = 'Static fallback image shown before playback.',
  webmTitle = 'WEBM URL',
  webmDescription = 'Preferred browser video format.',
  mp4Title = 'MP4 URL',
  mp4Description = 'Fallback video format.',
}: CloudinaryVideoFieldOptions = {}) {
  return [
    defineField({
      name: 'poster',
      title: posterTitle,
      description: posterDescription,
      type: 'url',
      validation: (r) =>
        (posterRequired ? r.required() : r).uri({scheme: ['https']}).custom(cloudinaryPosterUrl),
    }),
    defineField({
      name: 'webm',
      title: webmTitle,
      description: webmDescription,
      type: 'url',
      validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryWebmUrl),
    }),
    defineField({
      name: 'mp4',
      title: mp4Title,
      description: mp4Description,
      type: 'url',
      validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryMp4Url),
    }),
  ]
}
