import {defineField, defineType} from 'sanity'
import {httpsImageUrl, httpsUrl} from './validation'

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

    defineField({
      name: 'seo',
      title: 'SEO',
      description: 'Optional overrides for this category page. Empty fields fall back to the global SEO templates.',
      type: 'object',
      options: {collapsible: true, collapsed: true},
      fields: [
        defineField({
          name: 'title',
          title: 'SEO title',
          description: 'Overrides the generated browser/search title for this category.',
          type: 'string',
          validation: (r) => r.max(70),
        }),
        defineField({
          name: 'description',
          title: 'Meta description',
          description: 'Overrides the generated search/social description for this category.',
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
          description: 'Only use when this category should canonicalize to a different URL.',
          type: 'url',
          validation: (r) => r.uri({scheme: ['https']}).custom(httpsUrl),
        }),
        defineField({
          name: 'noindex',
          title: 'Hide this category from search results',
          type: 'boolean',
          initialValue: false,
        }),
        defineField({
          name: 'focusKeyword',
          title: 'Focus keyword',
          description: 'Internal planning note only. This is not rendered as a meta keywords tag.',
          type: 'string',
        }),
      ],
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
