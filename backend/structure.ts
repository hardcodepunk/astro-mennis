import type {StructureResolver} from 'sanity/structure'

const singletonTypes = ['seo', 'siteSettings', 'bioWithPreview', 'contactPage', 'logoMarquee'] as const

export const singletonTypeNames = new Set<string>(singletonTypes)

const singletonTitles: Record<(typeof singletonTypes)[number], string> = {
  seo: 'SEO',
  siteSettings: 'Site settings',
  bioWithPreview: 'About page',
  contactPage: 'Contact page',
  logoMarquee: 'Logo marquee',
}

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      ...singletonTypes.map((type) =>
        S.listItem()
          .id(type)
          .title(singletonTitles[type])
          .child(S.document().id(type).schemaType(type).documentId(type).title(singletonTitles[type])),
      ),
      S.divider(),
      ...S.documentTypeListItems().filter((item) => {
        const id = item.getId()
        return !id || !singletonTypeNames.has(id)
      }),
    ])

export function productionUrlForDocument(document: {_type?: string; slug?: {current?: string}}) {
  const siteUrl = (process.env.SANITY_STUDIO_SITE_URL || 'https://www.demennis.be').replace(/\/+$/, '')

  if (document._type === 'work' && document.slug?.current) {
    return `${siteUrl}/works/${document.slug.current}`
  }

  if (document._type === 'category' && document.slug?.current) {
    return `${siteUrl}/projects/${document.slug.current}`
  }

  if (document._type === 'bioWithPreview') return `${siteUrl}/about`
  if (document._type === 'contactPage') return `${siteUrl}/contact`
  if (document._type === 'seo' || document._type === 'siteSettings' || document._type === 'logoMarquee') {
    return siteUrl
  }

  return undefined
}
