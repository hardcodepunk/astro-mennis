import {defineField, defineType} from 'sanity'
import {defineCloudinaryVideoFields} from './shared'

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
      initialValue: {
        kicker: 'Workflow',
        title:
          'Whether I’m on rollerblades capturing ultra-smooth tracking shots at high speeds, or climbing structures to rig cameras for daring perspectives, I capture the raw energy of your project without the bloat of a massive crew.',
        body: 'I shape visual work around rhythm, movement and the energy of the people in front of the camera. The process stays lean, direct and built around the project.',
        mirrorLayout: false,
      },
      fields: [
        defineField({
          name: 'kicker',
          title: 'Small label',
          description: 'Small uppercase label above the heading.',
          type: 'string',
        }),
        defineField({
          name: 'title',
          title: 'Heading',
          description: 'Use Enter for line breaks.',
          type: 'text',
          rows: 4,
        }),
        defineField({
          name: 'body',
          title: 'Body text',
          description: 'Separate paragraphs with a blank line.',
          type: 'text',
          rows: 8,
        }),
        defineField({
          name: 'mirrorLayout',
          title: 'Flip columns',
          description: 'Switches the heading and body text columns.',
          type: 'boolean',
          initialValue: false,
        }),
      ],
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
