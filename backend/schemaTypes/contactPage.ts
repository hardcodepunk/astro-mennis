import {defineField, defineType} from 'sanity'
import {httpsUrl} from './validation'

export const contactPage = defineType({
  name: 'contactPage',
  title: 'Contact page',
  type: 'document',
  fields: [
    defineField({
      name: 'animatedSentences',
      title: 'Animated sentences',
      description: 'Sentences that rewrite themselves in the large contact headline.',
      type: 'array',
      of: [{type: 'string'}],
      initialValue: [
        'Wild concepts captured with sharp video production.',
        'Edgy visuals for brands, music and movement.',
        'Atypical camera work with a calm production process.',
      ],
      validation: (r) => r.required().min(1),
    }),
    defineField({
      name: 'mailSentence',
      title: 'Mail sentence',
      description: 'Short phrase shown before the email address.',
      type: 'string',
      initialValue: 'Shoot at',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'email',
      title: 'Email address',
      type: 'string',
      initialValue: 'hello@demennis.be',
      validation: (r) => r.required().email(),
    }),
    defineField({
      name: 'socialLinks',
      title: 'Social links',
      type: 'array',
      of: [
        defineField({
          name: 'socialLink',
          title: 'Social link',
          type: 'object',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              validation: (r) => r.required(),
            }),
            defineField({
              name: 'url',
              title: 'URL',
              type: 'url',
              validation: (r) => r.required().uri({scheme: ['https']}).custom(httpsUrl),
            }),
          ],
          preview: {
            select: {
              title: 'label',
              subtitle: 'url',
            },
          },
        }),
      ],
      initialValue: [{label: 'Instagram', url: 'https://www.instagram.com/demennis_/'}],
    }),
  ],
  preview: {
    prepare() {
      return {
        title: 'Contact page',
      }
    },
  },
})
