import {defineField, defineType} from 'sanity'

export const category = defineType({
  name: 'category',
  title: 'Project categories',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      description: 'Shown in project filters and project cards.',
      type: 'string',
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'slug',
      title: 'Slug',
      description: 'Used in the URL, e.g. /projects/creative. Generate after entering title.',
      type: 'slug',
      options: {source: 'title'},
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'sortOrder',
      title: 'Sort order',
      description: 'Optional. Lower numbers appear first in project filters.',
      type: 'number',
      validation: (r) => r.integer().positive(),
    }),
  ],

  preview: {
    select: {
      title: 'title',
      slug: 'slug.current',
      sortOrder: 'sortOrder',
    },
    prepare({title, slug, sortOrder}) {
      return {
        title,
        subtitle: [sortOrder ? `#${sortOrder}` : null, slug].filter(Boolean).join(' · '),
      }
    },
  },
})
