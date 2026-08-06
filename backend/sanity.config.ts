import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {readSanityEnvironmentFromProcess} from './sanity.environment'
import {createSingletonDocumentActionsResolver} from './singletonActions'
import {productionUrlForDocument, singletonTypeNames, structure} from './structure'

const environment = readSanityEnvironmentFromProcess()

export default defineConfig({
  name: 'default',
  title: 'Mennis',

  projectId: environment.projectId,
  dataset: environment.dataset,

  plugins: [structureTool({structure}), visionTool()],

  schema: {
    types: schemaTypes,
    templates: (templates) =>
      templates.filter((template) => !singletonTypeNames.has(template.schemaType)),
  },

  document: {
    actions: createSingletonDocumentActionsResolver(singletonTypeNames),
    newDocumentOptions: (options) =>
      options.filter((option) => !singletonTypeNames.has(option.templateId)),
    productionUrl: async (_prev, context) => productionUrlForDocument(context.document),
  },
})
