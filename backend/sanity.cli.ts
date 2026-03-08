import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '454gxa26',
    dataset: 'production',
  },
  deployment: {
    appId: 'st7zms5txswv66ebr4184g2g',
    autoUpdates: true,
  },
})
