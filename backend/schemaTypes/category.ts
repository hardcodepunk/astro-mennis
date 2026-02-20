import {defineField, defineType} from 'sanity'

export const category = defineType({
  name: 'category',
  title: 'Category',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title'},
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'tagline',
      title: 'Tagline',
      type: 'string',
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'preview',
      title: 'Preview',
      type: 'object',
      fields: [
        defineField({
          name: 'poster',
          title: 'Poster URL',
          type: 'url',
          validation: (r) => r.required(),
        }),
        defineField({name: 'webm', title: 'WEBM URL', type: 'url'}),
        defineField({name: 'mp4', title: 'MP4 URL', type: 'url'}),
      ],
    }),

    defineField({
      name: 'overviewTitle',
      title: 'Overview title',
      type: 'string',
    }),

    defineField({
      name: 'overviewLead',
      title: 'Overview lead',
      type: 'text',
      rows: 3,
    }),

    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [
        {type: 'block'},
        defineField({
          name: 'inlineImage',
          title: 'Image',
          type: 'image',
          options: {hotspot: true},
          fields: [
            defineField({name: 'alt', title: 'Alt text', type: 'string'}),
            defineField({name: 'caption', title: 'Caption', type: 'string'}),
          ],
        }),
      ],
    }),
  ],

  preview: {
    select: {
      title: 'title',
      subtitle: 'tagline',
      media: 'preview.poster',
    },
  },
})
