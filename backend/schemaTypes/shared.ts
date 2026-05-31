import {defineField} from 'sanity'
import {
  cloudinaryMp4Url,
  cloudinaryPosterUrl,
  cloudinaryWebmUrl,
  httpsImageUrl,
  httpsUrl,
} from './validation'

export const defaultCloudinaryVideoUrls = {
  mp4: 'https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,vc_h264,ac_aac,f_mp4/v1737957147/wsuszohtmu2pks673muc.mp4',
  webm: 'https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,vc_vp9,f_webm/v1761381373/b8f7chk3u9s6jaqh4bae.webm',
  poster:
    'https://res.cloudinary.com/hardcodepunk/video/upload/q_auto:eco,so_0,f_jpg,w_1600/v1737957147/wsuszohtmu2pks673muc.jpg',
}

export const defaultWorkflowPanel = {
  kicker: 'Workflow',
  title: 'Playful process, bold ideas, thoughtful results',
  body: [
    'We live in a world of acceleration, chasing the end goal, forgetting to enjoy the ride. At De Mennis, we slow down just enough to capture the magic in between: the boldness, the play, the small details that get lost when there is no room to breathe.',
    'We believe that when passionate people come together and actually enjoy the process, something extraordinary happens.',
    'And what cannot be put into words, we put into visuals.',
  ].join('\n\n'),
  mirrorLayout: false,
}

export const defaultApproachPanel = {
  kicker: 'Approach',
  title: 'Clean frames. Strong pacing. Calm process.',
  body: [
    'I make visual work that feels sharp, deliberate and human. The focus is on tone, movement and structure, with a process that stays clear from first idea to final delivery.',
    'That can mean branded content, campaign visuals, portraits, event films or short-form edits. The output changes depending on the project, but the standard stays the same.',
    'I care about images that carry weight without feeling overworked. Clean direction, strong editing and the right energy on set matter just as much as the final look.',
  ].join('\n\n'),
  mirrorLayout: false,
}

export const defaultContactReasonsPanel = {
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
  mirrorLayout: false,
}

type DocumentTypeContext = 'work' | 'category' | 'project' | 'item'

export function defineDocumentSeoFields(context: DocumentTypeContext = 'item') {
  const contextLabel = context === 'work' ? 'work page' : context === 'category' ? 'category' : 'item'
  return [
    defineField({
      name: 'title',
      title: 'SEO title',
      description: `Overrides the generated browser/search title for this ${contextLabel}.`,
      type: 'string',
      validation: (r) => r.max(70),
    }),
    defineField({
      name: 'description',
      title: 'Meta description',
      description: `Overrides the generated search/social description for this ${contextLabel}.`,
      type: 'text',
      rows: 3,
      validation: (r) => r.max(170),
    }),
    defineField({
      name: 'socialImage',
      title: 'Social image URL',
      description: 'Absolute image URL used for Open Graph and Twitter previews.',
      type: 'url',
      validation: (r) => r.uri({scheme: ['https']}).custom(httpsImageUrl),
    }),
    defineField({
      name: 'socialImageAlt',
      title: 'Social image alt text',
      type: 'string',
    }),
    defineField({
      name: 'canonicalUrl',
      title: 'Canonical URL override',
      description: `Only use when this ${contextLabel} should canonicalize to a different URL.`,
      type: 'url',
      validation: (r) => r.uri({scheme: ['https']}).custom(httpsUrl),
    }),
    defineField({
      name: 'noindex',
      title: `Hide this ${contextLabel} from search results`,
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'focusKeyword',
      title: 'Focus keyword',
      description: 'Internal planning note only. This is not rendered as a meta keywords tag.',
      type: 'string',
    }),
  ]
}

type CloudinaryVideoFieldOptions = {
  posterRequired?: boolean
  posterTitle?: string
  posterDescription?: string
  webmTitle?: string
  webmDescription?: string
  mp4Title?: string
  mp4Description?: string
}

type TextPanelFieldsetOptions = {
  titleRows?: number
  bodyRows?: number
  titleDescription?: string
}

type ContactReasonsPanelOptions = {
  titleRows?: number
}

export function defineCloudinaryVideoFields({
  posterRequired = false,
  posterTitle = 'Poster URL',
  posterDescription = 'Static fallback image shown before playback.',
  webmTitle = 'WEBM URL',
  webmDescription = 'Preferred browser video format.',
  mp4Title = 'MP4 URL',
  mp4Description = 'Fallback video format.',
}: CloudinaryVideoFieldOptions = {}) {
  return [
    defineField({
      name: 'poster',
      title: posterTitle,
      description: posterDescription,
      type: 'url',
      validation: (r) =>
        (posterRequired ? r.required() : r).uri({scheme: ['https']}).custom(cloudinaryPosterUrl),
    }),
    defineField({
      name: 'webm',
      title: webmTitle,
      description: webmDescription,
      type: 'url',
      validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryWebmUrl),
    }),
    defineField({
      name: 'mp4',
      title: mp4Title,
      description: mp4Description,
      type: 'url',
      validation: (r) => r.uri({scheme: ['https']}).custom(cloudinaryMp4Url),
    }),
  ]
}

export function defineTextPanelFields({
  titleRows = 4,
  bodyRows = 8,
  titleDescription = 'Use Enter for line breaks.',
}: TextPanelFieldsetOptions = {}) {
  return [
    defineField({
      name: 'kicker',
      title: 'Small label',
      description: 'Small uppercase label above the heading.',
      type: 'string',
    }),
    defineField({
      name: 'title',
      title: 'Heading',
      description: titleDescription,
      type: 'text',
      rows: titleRows,
    }),
    defineField({
      name: 'body',
      title: 'Body text',
      description: 'Separate paragraphs with a blank line.',
      type: 'text',
      rows: bodyRows,
    }),
    defineField({
      name: 'mirrorLayout',
      title: 'Flip columns',
      description: 'Switches the heading and body text columns.',
      type: 'boolean',
      initialValue: false,
    }),
  ]
}

export function defineContactReasonsPanelFields({ titleRows = 3 }: ContactReasonsPanelOptions = {}) {
  return [
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
      rows: titleRows,
    }),
    defineField({
      name: 'items',
      title: 'Reasons',
      description: 'Each item becomes one bullet in the section.',
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
  ]
}
