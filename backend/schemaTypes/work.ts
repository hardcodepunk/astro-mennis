import {defineField, defineType} from 'sanity'

type HeroMediaParent = {mode?: 'preview' | 'single' | 'slider'}

export const work = defineType({
  name: 'work',
  title: 'Work',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      description: 'Shown on project cards and as the work page heading.',
      type: 'string',
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'slug',
      title: 'Slug',
      description: 'Used in the URL, e.g. /works/way-coffee-roasters. Generate after entering title.',
      type: 'slug',
      options: {source: 'title'},
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'year',
      title: 'Year',
      description: 'Shown in the project meta on the work page.',
      type: 'string',
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'client',
      title: 'Client',
      description: 'Shown in the project meta on the work page.',
      type: 'string',
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'category',
      title: 'Project category',
      description: 'Controls where this project appears in /projects filters.',
      type: 'reference',
      to: [{type: 'category'}],
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'featuredOnHome',
      title: 'Show on homepage project grid',
      description: 'Adds this project to the homepage featured work section.',
      type: 'boolean',
      initialValue: false,
    }),

    defineField({
      name: 'featuredOrder',
      title: 'Homepage order',
      description: 'Optional. Lower numbers appear first on the homepage.',
      type: 'number',
      hidden: ({document}) => !document?.featuredOnHome,
      validation: (r) => r.integer().positive().max(3),
    }),

    defineField({
      name: 'preview',
      title: 'Project card thumbnail',
      description: 'Used by project cards, recent work cards, homepage cards, and as fallback work page video.',
      type: 'object',
      fields: [
        defineField({
          name: 'poster',
          title: 'Thumbnail poster URL',
          description: 'Static image shown before the video plays.',
          type: 'url',
          validation: (r) => r.required(),
        }),
        defineField({
          name: 'webm',
          title: 'Thumbnail WEBM URL',
          description: 'Optional. Preferred lightweight video format for thumbnail playback.',
          type: 'url',
        }),
        defineField({
          name: 'mp4',
          title: 'Thumbnail MP4 URL',
          description: 'Optional fallback video format for thumbnail playback.',
          type: 'url',
        }),
      ],
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'thumbnailAutoplay',
      title: 'Autoplay thumbnail',
      description: 'Autoplay this project thumbnail in project grids, homepage cards, and recent work previews.',
      type: 'boolean',
      initialValue: false,
    }),

    defineField({
      name: 'media',
      title: 'Work page hero media',
      description: 'Controls the main media shown at the top of the work page.',
      type: 'object',
      options: {collapsible: true, collapsed: true},
      initialValue: {mode: 'preview'},
      fields: [
        defineField({
          name: 'mode',
          title: 'Hero media type',
          type: 'string',
          options: {
            list: [
              {title: 'Use thumbnail video', value: 'preview'},
              {title: 'Single YouTube video', value: 'single'},
              {title: 'YouTube reels slider', value: 'slider'},
            ],
            layout: 'radio',
          },
          initialValue: 'preview',
          validation: (r) => r.required(),
        }),

        defineField({
          name: 'youtubeUrl',
          title: 'YouTube URL',
          description: 'Required when hero media type is Single YouTube video.',
          type: 'url',
          hidden: ({parent}) => (parent as HeroMediaParent)?.mode !== 'single',
          validation: (r) =>
            r.custom((val, ctx) => {
              const mode = (ctx.parent as HeroMediaParent | undefined)?.mode
              if (mode !== 'single') return true
              return val ? true : 'Required for single YouTube video'
            }),
        }),

        defineField({
          name: 'reels',
          title: 'YouTube reels URLs',
          description: 'Required when hero media type is YouTube reels slider. Add up to 4 URLs.',
          type: 'array',
          of: [{type: 'url'}],
          hidden: ({parent}) => (parent as HeroMediaParent)?.mode !== 'slider',
          validation: (r) =>
            r.custom((val, ctx) => {
              const mode = (ctx.parent as HeroMediaParent | undefined)?.mode
              if (mode !== 'slider') return true
              if (!Array.isArray(val) || val.length < 1) return 'Add at least 1 URL'
              if (val.length > 4) return 'Max 4 URLs'
              return true
            }),
        }),
      ],
    }),

    defineField({
      name: 'overviewTitle',
      title: 'Overview title',
      description: 'Optional heading shown above the project body on the work page.',
      type: 'string',
    }),

    defineField({
      name: 'seo',
      title: 'SEO',
      description: 'Optional overrides for this work page. Empty fields fall back to the global work templates.',
      type: 'object',
      options: {collapsible: true, collapsed: true},
      fields: [
        defineField({
          name: 'title',
          title: 'SEO title',
          description: 'Overrides the generated browser/search title for this work page.',
          type: 'string',
          validation: (r) => r.max(70),
        }),
        defineField({
          name: 'description',
          title: 'Meta description',
          description: 'Overrides the generated search/social description for this work page.',
          type: 'text',
          rows: 3,
          validation: (r) => r.max(170),
        }),
        defineField({
          name: 'socialImage',
          title: 'Social image URL',
          description: 'Absolute image URL used for Open Graph and Twitter previews.',
          type: 'url',
        }),
        defineField({
          name: 'socialImageAlt',
          title: 'Social image alt text',
          type: 'string',
        }),
        defineField({
          name: 'canonicalUrl',
          title: 'Canonical URL override',
          description: 'Only use when this work page should canonicalize to a different URL.',
          type: 'url',
        }),
        defineField({
          name: 'noindex',
          title: 'Hide this work page from search results',
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

    defineField({
      name: 'body',
      title: 'Body',
      description: 'Main content shown on the work page.',
      type: 'array',
      of: [
        {type: 'block'},
        defineField({
          name: 'inlineImage',
          title: 'Image',
          type: 'image',
          options: {hotspot: true},
          fields: [
            defineField({
              name: 'alt',
              title: 'Alt text',
              type: 'string',
              validation: (r) => r.required(),
            }),
            defineField({
              name: 'caption',
              title: 'Caption',
              type: 'string',
            }),
          ],
        }),
      ],
    }),

    defineField({
      name: 'publishedAt',
      title: 'Published at',
      description: 'Used to order projects when no manual order applies.',
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
