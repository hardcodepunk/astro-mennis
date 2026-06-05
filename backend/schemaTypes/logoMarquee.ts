import {defineField, defineType} from 'sanity'

export const logoMarquee = defineType({
  name: 'logoMarquee',
  title: 'Logo Marquee',
  type: 'document',
  fields: [
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
              description:
                'Displayed in a fixed-size logo box on the website. Use the image crop to trim empty whitespace around the logo.',
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
    prepare() {
      return {
        title: 'Logo marquee',
      }
    },
  },
})
