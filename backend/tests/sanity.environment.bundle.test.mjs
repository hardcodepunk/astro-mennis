import assert from 'node:assert/strict'
import {Buffer} from 'node:buffer'
import test from 'node:test'
import {fileURLToPath} from 'node:url'

import {build} from 'vite'

const bundledEnvironment = Object.freeze({
  projectId: 'bundleproject',
  dataset: 'bundlecheck',
  appId: 'bundleapplication',
  siteUrl: 'https://bundle-check.example',
})

test('Vite statically embeds the selected Studio environment', async () => {
  const entry = fileURLToPath(new URL('../sanity.environment.ts', import.meta.url))
  const buildResult = await build({
    configFile: false,
    logLevel: 'silent',
    define: {
      'process.env.SANITY_STUDIO_PROJECT_ID': JSON.stringify(bundledEnvironment.projectId),
      'process.env.SANITY_STUDIO_DATASET': JSON.stringify(bundledEnvironment.dataset),
      'process.env.SANITY_STUDIO_APP_ID': JSON.stringify(bundledEnvironment.appId),
      'process.env.SANITY_STUDIO_SITE_URL': JSON.stringify(bundledEnvironment.siteUrl),
    },
    build: {
      minify: false,
      write: false,
      lib: {
        entry,
        formats: ['es'],
      },
    },
  })
  const outputs = Array.isArray(buildResult) ? buildResult : [buildResult]
  const entryChunk = outputs
    .flatMap((output) => output.output)
    .find((output) => output.type === 'chunk' && output.isEntry)

  assert.ok(entryChunk && entryChunk.type === 'chunk')
  assert.match(entryChunk.code, /bundleproject/)
  assert.match(entryChunk.code, /bundlecheck/)
  assert.match(entryChunk.code, /bundle-check\.example/)

  const bundledModule = await import(
    `data:text/javascript;base64,${Buffer.from(entryChunk.code).toString('base64')}`
  )

  assert.deepEqual({...bundledModule.readSanityEnvironmentFromProcess()}, bundledEnvironment)
})
