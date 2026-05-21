import {defineField, defineType} from 'sanity'

export const seo = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'document',
  fields: [
    defineField({
      name: 'homeH1',
      title: 'Homepage H1',
      description: 'Visually hidden heading used for SEO and accessibility on the homepage.',
      type: 'string',
      initialValue: 'De Mennis',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'projectsH1',
      title: 'Projects H1',
      description: 'Visually hidden heading used for SEO and accessibility on the projects page.',
      type: 'string',
      initialValue: 'Projects',
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    prepare() {
      return {
        title: 'SEO',
      }
    },
  },
})
