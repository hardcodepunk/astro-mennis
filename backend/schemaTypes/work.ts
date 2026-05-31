import {defineField, defineType} from 'sanity'
import {
  defineCloudinaryVideoFields,
  defineDocumentSeoFields,
  youtubeUrl,
} from './validation'

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
      fields: defineCloudinaryVideoFields({
        posterRequired: true,
        posterTitle: 'Thumbnail poster URL',
        posterDescription: 'Static image shown before the video plays.',
        webmTitle: 'Thumbnail WEBM URL',
        webmDescription: 'Optional. Preferred lightweight video format for thumbnail playback.',
        mp4Title: 'Thumbnail MP4 URL',
        mp4Description: 'Optional fallback video format for thumbnail playback.',
      }),
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'thumbnailAutoplay',
      title: 'Autoplay thumbnail',
      description:
        'Autoplay this project thumbnail in project grids, homepage cards, and recent work previews when a thumbnail video URL is set.',
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
            r.uri({scheme: ['https']}).custom((val, ctx) => {
              const mode = (ctx.parent as HeroMediaParent | undefined)?.mode
              if (mode !== 'single') return true
              if (!val) return 'Required for single YouTube video'
              return youtubeUrl(val)
            }),
        }),

        defineField({
          name: 'reels',
          title: 'YouTube reels URLs',
          description: 'Required when hero media type is YouTube reels slider. Add up to 4 URLs.',
          type: 'array',
          of: [
            {
              type: 'url',
              validation: (r) => r.uri({scheme: ['https']}).custom(youtubeUrl),
            },
          ],
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
      fields: defineDocumentSeoFields('work'),
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
