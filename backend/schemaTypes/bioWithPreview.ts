import {defineField, defineType} from 'sanity'
import {cloudinaryMp4Url, cloudinaryPosterUrl, cloudinaryWebmUrl} from './validation'

const contactReasonsInitialValue = {
  kicker: 'What to contact me for',
  title: 'Built for bold projects with movement, edge and energy.',
  items: [
    'Edgy & daring branding: commercials and promos that break the rules.',
    'Lifestyle & community culture: highlighting the people, the movement, and the vibe behind your brand.',
    'High-motion content: music videos, sports, and events that require speed, flow, and kinetic energy.',
    'Freelance rollerblade camera operator & editor.',
    'Aerial filmography.',
    'Ideas.',
  ],
}

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
      initialValue: {
        mp4: 'https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,vc_h264,ac_aac,f_mp4/v1737957147/wsuszohtmu2pks673muc.mp4',
        webm: 'https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,vc_vp9,f_webm/v1761381373/b8f7chk3u9s6jaqh4bae.webm',
        poster:
          'https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,so_0,f_jpg,w_1600/v1737957147/wsuszohtmu2pks673muc.jpg',
      },
      fields: [
        defineField({
          name: 'poster',
          title: 'Poster URL',
          description: 'Static fallback image shown before the hero video loads.',
          type: 'url',
          validation: (r) => r.required().uri({scheme: ['https']}).custom(cloudinaryPosterUrl),
        }),
        defineField({
          name: 'webm',
          title: 'WEBM URL',
          description: 'Preferred browser video format.',
          type: 'url',
          validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryWebmUrl),
        }),
        defineField({
          name: 'mp4',
          title: 'MP4 URL',
          description: 'Fallback video format.',
          type: 'url',
          validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryMp4Url),
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
      fields: [
        defineField({
          name: 'poster',
          title: 'Poster URL',
          description: 'Static fallback image shown before the video loads.',
          type: 'url',
          validation: (r) => r.required().uri({scheme: ['https']}).custom(cloudinaryPosterUrl),
        }),
        defineField({
          name: 'webm',
          title: 'WEBM URL',
          description: 'Preferred browser video format.',
          type: 'url',
          validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryWebmUrl),
        }),
        defineField({
          name: 'mp4',
          title: 'MP4 URL',
          description: 'Fallback video format.',
          type: 'url',
          validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryMp4Url),
        }),
      ],
    }),
    defineField({
      name: 'approach',
      title: 'Approach panel',
      description: 'Green text panel shown below the bio/video block on the About page.',
      type: 'object',
      initialValue: {
        kicker: 'Approach',
        title: 'Clean frames. Strong pacing. Calm process.',
        body: [
          'I make visual work that feels sharp, deliberate and human. The focus is on tone, movement and structure, with a process that stays clear from first idea to final delivery.',
          'That can mean branded content, campaign visuals, portraits, event films or short-form edits. The output changes depending on the project, but the standard stays the same.',
          'I care about images that carry weight without feeling overworked. Clean direction, strong editing and the right energy on set matter just as much as the final look.',
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
          description: 'Use Enter for line breaks.',
          type: 'text',
          rows: 3,
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
      name: 'contactReasons',
      title: 'Contact reasons',
      description: 'Separate editable bullet section shown below the Approach panel on the About page.',
      type: 'object',
      initialValue: contactReasonsInitialValue,
      fields: [
        defineField({
          name: 'kicker',
          title: 'Small label',
          type: 'string',
        }),
        defineField({
          name: 'title',
          title: 'Heading',
          description: 'Use Enter for line breaks.',
          type: 'text',
          rows: 3,
        }),
        defineField({
          name: 'items',
          title: 'Reasons',
          description: 'Each item becomes one bullet in the About page section.',
          type: 'array',
          of: [{type: 'string'}],
        }),
        defineField({
          name: 'mirrorLayout',
          title: 'Flip columns',
          description: 'Switches the heading and reasons columns.',
          type: 'boolean',
          initialValue: false,
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
