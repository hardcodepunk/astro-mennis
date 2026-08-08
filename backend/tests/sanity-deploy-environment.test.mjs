import assert from 'node:assert/strict'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'

import {loadDeploymentFileEnvironment} from '../scripts/sanity-deploy.mjs'

test('loads only the selected deployment target files', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'sanity-deploy-environment-'))
  context.after(() => rm(directory, {force: true, recursive: true}))

  await Promise.all([
    writeFile(join(directory, '.env'), 'SANITY_STUDIO_DATASET=generic\n'),
    writeFile(join(directory, '.env.local'), 'SANITY_STUDIO_PROJECT_ID=genericlocal\n'),
    writeFile(
      join(directory, '.env.staging'),
      'SANITY_STUDIO_PROJECT_ID=stagingproject\nSANITY_STUDIO_DATASET=staging\nIGNORED=value\n',
    ),
    writeFile(join(directory, '.env.staging.local'), 'SANITY_STUDIO_DATASET=preview\n'),
    writeFile(
      join(directory, '.env.production'),
      'SANITY_STUDIO_PROJECT_ID=productionproject\nSANITY_STUDIO_DATASET=production\n',
    ),
  ])

  assert.deepEqual(await loadDeploymentFileEnvironment('staging', directory), {
    SANITY_STUDIO_DATASET: 'preview',
    SANITY_STUDIO_PROJECT_ID: 'stagingproject',
  })
  assert.deepEqual(await loadDeploymentFileEnvironment('production', directory), {
    SANITY_STUDIO_DATASET: 'production',
    SANITY_STUDIO_PROJECT_ID: 'productionproject',
  })
})

test('returns an empty environment when target files do not exist', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'sanity-deploy-environment-'))
  context.after(() => rm(directory, {force: true, recursive: true}))

  assert.deepEqual(await loadDeploymentFileEnvironment('staging', directory), {})
})
