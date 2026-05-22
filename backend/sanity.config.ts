import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {productionUrlForDocument, singletonTypeNames, structure} from './structure'

export default defineConfig({
  name: 'default',
  title: 'Mennis',

  projectId: process.env.SANITY_STUDIO_PROJECT_ID || '454gxa26',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',

  plugins: [structureTool({structure}), visionTool()],

  schema: {
    types: schemaTypes,
    templates: (templates) => templates.filter((template) => !singletonTypeNames.has(template.schemaType)),
  },

  document: {
    newDocumentOptions: (options) =>
      options.filter((option) => !singletonTypeNames.has(option.templateId)),
    productionUrl: async (_prev, context) => productionUrlForDocument(context.document),
  },
})
