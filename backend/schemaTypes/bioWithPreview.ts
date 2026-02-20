import {defineField, defineType} from 'sanity'

export const bioWithPreview = defineType({
  name: 'bioWithPreview',
  title: 'Bio with preview',
  type: 'document',
  fields: [
    defineField({name: 'bio', title: 'Bio', type: 'text', rows: 4}),
    defineField({
      name: 'previewVideo',
      title: 'Preview video',
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
        title: 'Bio',
      }
    },
  },
})
