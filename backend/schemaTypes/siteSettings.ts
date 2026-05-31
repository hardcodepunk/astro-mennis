import {defineField, defineType} from 'sanity'
import {
  defaultWorkflowPanel,
  defineCloudinaryVideoFields,
  defineTextPanelFields,
} from './shared'

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  fields: [
    defineField({
      name: 'videoHero',
      title: 'Video hero',
      type: 'object',
      fields: [
        ...defineCloudinaryVideoFields({
          mp4Description: 'Fallback video format.',
          webmDescription: 'Preferred browser video format.',
          posterDescription: 'Poster image shown while the video is loading.',
          posterTitle: 'Poster URL',
        }),
        defineField({
          name: 'caption',
          title: 'Text above email',
          description: 'Optional line shown above the email link in the homepage video hero.',
          type: 'string',
          initialValue: 'wild concepts captured by edgy and atypical video production',
        }),
        defineField({
          name: 'captionTextScale',
          title: 'Text above email size',
          description: 'Use 100 for default. Try 90 for smaller, 120 for larger.',
          type: 'number',
          initialValue: 100,
          validation: (r) => r.min(60).max(180),
        }),
        defineField({
          name: 'captionUppercase',
          title: 'Uppercase text above email',
          description: 'Turn off to preserve normal casing.',
          type: 'boolean',
          initialValue: true,
        }),
      ],
    }),
    defineField({
      name: 'workflowPanel',
      title: 'Homepage mission section',
      description: 'Mission text section shown between the homepage video hero and contact reasons.',
      type: 'object',
      initialValue: defaultWorkflowPanel,
      fields: defineTextPanelFields({
        titleRows: 4,
        bodyRows: 8,
      }),
    }),
    defineField({
      name: 'legalDocument',
      title: 'Footer legal document',
      description: 'Optional small footer link for privacy, legal terms or another client-uploaded PDF.',
      type: 'object',
      fields: [
        defineField({
          name: 'label',
          title: 'Link label',
          description: 'Example: Privacy / Legal',
          type: 'string',
          initialValue: 'Privacy / Legal',
        }),
        defineField({
          name: 'file',
          title: 'PDF file',
          type: 'file',
          options: {
            accept: 'application/pdf',
          },
        }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return {
        title: 'Site settings',
      }
    },
  },
})
