import {defineField} from 'sanity'

export const homepageWorksField = defineField({
  name: 'homepageWorks',
  title: 'Homepage projects',
  description:
    'Choose up to three projects and drag them into the exact order they should appear. Leave the list empty to show no projects.',
  type: 'array',
  of: [
    {
      type: 'reference',
      to: [{type: 'work'}],
    },
  ],
  validation: (rule) => rule.max(3).unique(),
})

const legacyHomepageFieldDeprecation = {
  reason: 'Use Site settings → Homepage projects instead.',
}

export const legacyFeaturedOnHomeField = defineField({
  name: 'featuredOnHome',
  title: 'Legacy homepage selection',
  description: 'Retained temporarily so unmigrated content can use the legacy frontend fallback.',
  type: 'boolean',
  hidden: true,
  readOnly: true,
  deprecated: legacyHomepageFieldDeprecation,
})

export const legacyFeaturedOrderField = defineField({
  name: 'featuredOrder',
  title: 'Legacy homepage order',
  description: 'Retained temporarily so unmigrated content can use the legacy frontend fallback.',
  type: 'number',
  hidden: true,
  readOnly: true,
  deprecated: legacyHomepageFieldDeprecation,
})
