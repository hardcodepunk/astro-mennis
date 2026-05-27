import {defineField, defineType} from 'sanity'

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
  ],
  preview: {
    prepare() {
      return {
        title: 'Contact page',
      }
    },
  },
})
