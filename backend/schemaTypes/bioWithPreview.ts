import {defineField, defineType} from 'sanity'
import {
  defineCloudinaryVideoFields,
  defineContactReasonsPanelFields,
  defineTextPanelFields,
  defaultApproachPanel,
  defaultContactReasonsPanel,
  defaultCloudinaryVideoUrls,
} from './shared'

export const bioWithPreview = defineType({
  name: 'bioWithPreview',
  title: 'About page',
  type: 'document',
  fields: [
    defineField({
      name: 'heroTitle',
      title: 'Hero title',
      description: 'Shown over the About page video banner. Use Enter for line breaks.',
      type: 'text',
      rows: 2,
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'heroTitleTextScale',
      title: 'Hero title size',
      description: 'Use 100 for default. Try 90 for smaller, 120 for larger.',
      type: 'number',
      initialValue: 100,
      validation: (r) => r.min(60).max(180),
    }),
    defineField({
      name: 'heroVideo',
      title: 'About hero video',
      description: 'Autoplaying video banner behind the About page title.',
      type: 'object',
      initialValue: defaultCloudinaryVideoUrls,
      fields: defineCloudinaryVideoFields({
        posterDescription: 'Static fallback image shown before the hero video loads.',
      }),
    }),
    defineField({
      name: 'bio',
      title: 'Bio',
      description: 'Text shown next to the preview video on the about page.',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'mirrorLayout',
      title: 'Put video on the left',
      description: 'Switches the text and video sides.',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'bioTextScale',
      title: 'Bio text size',
      description: 'Use 100 for default. Try 60 for smaller, 110 for larger.',
      type: 'number',
      initialValue: 100,
      validation: (r) => r.min(50).max(140),
    }),
    defineField({
      name: 'previewVideo',
      title: 'About preview video',
      type: 'object',
      fields: defineCloudinaryVideoFields({
        posterDescription: 'Static fallback image shown before the video loads.',
      }),
    }),
    defineField({
      name: 'approach',
      title: 'Approach panel',
      description: 'Green text panel shown below the bio/video block on the About page.',
      type: 'object',
      initialValue: defaultApproachPanel,
      fields: defineTextPanelFields({
        titleRows: 3,
      }),
    }),
    defineField({
      name: 'contactReasons',
      title: 'Contact reasons',
      description: 'Separate editable bullet section shown below the Approach panel on the About page.',
      type: 'object',
      initialValue: defaultContactReasonsPanel,
      fields: defineContactReasonsPanelFields(),
    }),
  ],
  preview: {
    prepare() {
      return {
        title: 'About page',
      }
    },
  },
})
