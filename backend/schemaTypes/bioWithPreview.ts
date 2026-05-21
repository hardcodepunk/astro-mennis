import {defineField, defineType} from 'sanity'

export const bioWithPreview = defineType({
  name: 'bioWithPreview',
  title: 'About page',
  type: 'document',
  fields: [
    defineField({
      name: 'heroTitle',
      title: 'Hero title',
      description: 'Shown over the About page video banner.',
      type: 'string',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'heroVideo',
      title: 'About hero video',
      description: 'Autoplaying video banner behind the About page title.',
      type: 'object',
      fields: [
        defineField({
          name: 'poster',
          title: 'Poster URL',
          description: 'Static fallback image shown before the hero video loads.',
          type: 'url',
          validation: (r) => r.required(),
        }),
        defineField({
          name: 'webm',
          title: 'WEBM URL',
          description: 'Preferred browser video format.',
          type: 'url',
        }),
        defineField({
          name: 'mp4',
          title: 'MP4 URL',
          description: 'Fallback video format.',
          type: 'url',
        }),
      ],
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
      description: 'Switches the text and video sides on desktop.',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'bioTextScale',
      title: 'Bio text size',
      description: 'Use 100 for default. Try 90 for smaller, 110 for larger.',
      type: 'number',
      initialValue: 100,
      validation: (r) => r.min(75).max(140),
    }),
    defineField({
      name: 'previewVideo',
      title: 'About preview video',
      type: 'object',
      fields: [
        defineField({
          name: 'poster',
          title: 'Poster URL',
          description: 'Static fallback image shown before the video loads.',
          type: 'url',
          validation: (r) => r.required(),
        }),
        defineField({
          name: 'webm',
          title: 'WEBM URL',
          description: 'Preferred browser video format.',
          type: 'url',
        }),
        defineField({
          name: 'mp4',
          title: 'MP4 URL',
          description: 'Fallback video format.',
          type: 'url',
        }),
      ],
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
