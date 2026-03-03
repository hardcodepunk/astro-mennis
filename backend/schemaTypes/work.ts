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
      name: 'media',
      title: 'Hero media',
      type: 'object',
      options: {collapsible: true, collapsed: true},
      initialValue: {mode: 'preview'},
      fields: [
        defineField({
          name: 'mode',
          title: 'Type',
          type: 'string',
          options: {
            list: [
              {title: 'Default preview video (mp4/webm)', value: 'preview'},
              {title: 'Single YouTube video', value: 'single'},
              {title: 'Reels slider (up to 4)', value: 'slider'},
            ],
            layout: 'radio',
          },
          initialValue: 'preview',
          validation: (r) => r.required(),
        }),

        defineField({
          name: 'youtubeUrl',
          title: 'YouTube URL',
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
          title: 'Reels URLs',
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
      name: 'overviewLead',
      title: 'Overview lead',
      type: 'text',
      rows: 3,
      validation: (r) => r.required(),
    }),

    defineField({
      name: 'overviewTitle',
      title: 'Overview title',
      type: 'string',
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
            defineField({
              name: 'alt',
              title: 'Alt text',
              type: 'string',
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
