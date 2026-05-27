import {defineField, defineType} from 'sanity'
import {cloudinaryMp4Url, cloudinaryPosterUrl, cloudinaryWebmUrl} from './validation'

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
        defineField({
          name: 'mp4',
          title: 'MP4 URL',
          type: 'url',
          validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryMp4Url),
        }),
        defineField({
          name: 'webm',
          title: 'WEBM URL',
          type: 'url',
          validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryWebmUrl),
        }),
        defineField({
          name: 'poster',
          title: 'Poster URL',
          type: 'url',
          validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryPosterUrl),
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
      title: 'Homepage workflow panel',
      description: 'Green text panel shown between the homepage video hero and projects.',
      type: 'object',
      initialValue: {
        kicker: 'Workflow',
        title:
          'Whether I’m on rollerblades capturing ultra-smooth tracking shots at high speeds, or climbing structures to rig cameras for daring perspectives, I capture the raw energy of your project without the bloat of a massive crew.',
        body: [
          'What to Contact Me For:',
          '* Edgy & Daring Branding: Commercials and promos that breaks the rules.',
          '* Lifestyle & Community Culture: Highlighting the people, the movement, and the vibe behind your brand.',
          '* High-Motion Content: Music videos, sports, and events that require speed, flow, and kinetic energy.',
          '* Freelance (rollerblade) camera operator & editor',
          '* Aerial filmography',
          '* Idea’s',
        ].join('\n\n'),
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
          type: 'string',
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
          title: 'Put body text on the left',
          description: 'Switches the heading and body text columns on desktop.',
          type: 'boolean',
          initialValue: false,
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
