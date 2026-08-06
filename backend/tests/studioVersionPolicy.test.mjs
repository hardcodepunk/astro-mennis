import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const backendRoot = new URL('../', import.meta.url)

test('hosted Studio updates only through reviewed dependency changes', async () => {
  const [packageSource, lockSource, cliSource] = await Promise.all([
    readFile(new URL('package.json', backendRoot), 'utf8'),
    readFile(new URL('package-lock.json', backendRoot), 'utf8'),
    readFile(new URL('sanity.cli.ts', backendRoot), 'utf8'),
  ])
  const packageJson = JSON.parse(packageSource)
  const packageLock = JSON.parse(lockSource)
  const expectedPins = {
    '@sanity/vision': packageJson.dependencies['@sanity/vision'],
    sanity: packageJson.dependencies.sanity,
    '@sanity/cli': packageJson.devDependencies['@sanity/cli'],
  }

  assert.equal(expectedPins.sanity, expectedPins['@sanity/vision'])
  Object.entries(expectedPins).forEach(([name, version]) => {
    assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must use an exact version`)
    const lockSection = name === '@sanity/cli' ? 'devDependencies' : 'dependencies'
    assert.equal(packageLock.packages[''][lockSection][name], version)
  })
  assert.match(cliSource, /autoUpdates:\s*false/)
  assert.doesNotMatch(cliSource, /autoUpdates:\s*true/)
})
