import {defineField, defineType} from 'sanity'
import {cloudinaryMp4Url, cloudinaryPosterUrl, cloudinaryWebmUrl} from './validation'

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  fields: [
    defineField({
      name: 'videoHero',
      title: 'Video hero',
      type: 'object',
      fields: [
        defineField({
          name: 'mp4',
          title: 'MP4 URL',
          type: 'url',
          validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryMp4Url),
        }),
        defineField({
          name: 'webm',
          title: 'WEBM URL',
          type: 'url',
          validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryWebmUrl),
        }),
        defineField({
          name: 'poster',
          title: 'Poster URL',
          type: 'url',
          validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryPosterUrl),
        }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return {
        title: 'Site settings',
      }
    },
  },
})
