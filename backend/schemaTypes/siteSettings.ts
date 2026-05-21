import {defineField, defineType} from 'sanity'

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
        defineField({name: 'mp4', title: 'MP4 URL', type: 'url'}),
        defineField({name: 'webm', title: 'WEBM URL', type: 'url'}),
        defineField({name: 'poster', title: 'Poster URL', type: 'url'}),
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
