import {defineCliConfig} from 'sanity/cli'
import {assertGuardedCliDeployment, readSanityEnvironmentFromProcess} from './sanity.environment'

const environment = readSanityEnvironmentFromProcess()

assertGuardedCliDeployment(process.argv.slice(2), process.env, environment)

export default defineCliConfig({
  api: {
    projectId: environment.projectId,
    dataset: environment.dataset,
  },
  deployment: {
    appId: environment.appId,
    autoUpdates: false,
  },
})
