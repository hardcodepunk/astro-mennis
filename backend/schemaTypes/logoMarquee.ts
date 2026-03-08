import {defineField, defineType} from 'sanity'

export const logoMarquee = defineType({
  name: 'logoMarquee',
  title: 'Logo Marquee',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Internal title',
      type: 'string',
      initialValue: 'Homepage logos',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'logos',
      title: 'Logos',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'logoItem',
          fields: [
            defineField({
              name: 'alt',
              title: 'Alt text',
              type: 'string',
            }),
            defineField({
              name: 'image',
              title: 'Logo',
              type: 'image',
              options: {hotspot: true},
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: {
              title: 'alt',
              media: 'image',
            },
          },
        },
      ],
    }),
  ],
  preview: {
    select: {
      title: 'title',
    },
  },
})
