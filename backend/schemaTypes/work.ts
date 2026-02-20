import {defineField, defineType} from 'sanity'

export const work = defineType({
  name: 'work',
  title: 'Work',
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
      name: 'year',
      title: 'Year',
      type: 'string',
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'client',
      title: 'Client',
      type: 'string',
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: [{type: 'category'}],
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
        defineField({
          name: 'webm',
          title: 'WEBM URL',
          type: 'url',
        }),
        defineField({
          name: 'mp4',
          title: 'MP4 URL',
          type: 'url',
        }),
      ],
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'overviewLead',
      title: 'Overview lead',
      type: 'text',
      rows: 3,
    }),

    defineField({
      name: 'overviewBody',
      title: 'Overview body',
      type: 'text',
      rows: 6,
    }),

    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
  ],

  preview: {
    select: {
      title: 'title',
      subtitle: 'client',
      media: 'preview.poster',
    },
  },
})
