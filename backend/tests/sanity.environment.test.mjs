import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertDeploymentEnvironment,
  assertExplicitDeploymentVariables,
  assertGuardedCliDeployment,
  assertNonInteractiveProductionConfirmation,
  DEPLOY_GUARD_VALUE,
  deploymentKindFromArguments,
  PRODUCTION_SANITY_ENVIRONMENT,
  readSanityEnvironment,
} from '../sanity.environment.ts'

const stagingEnvironment = Object.freeze({
  projectId: 'stagingproject',
  dataset: 'staging',
  appId: 'stagingapplication',
  siteUrl: 'https://staging.demennis.example',
})

test('uses one production default for Studio and CLI configuration', () => {
  assert.deepEqual(readSanityEnvironment({}), PRODUCTION_SANITY_ENVIRONMENT)
})

test('validates configured values before Sanity consumes them', () => {
  assert.throws(
    () => readSanityEnvironment({SANITY_STUDIO_SITE_URL: 'http://example.com'}),
    /clean HTTPS origin/,
  )
  assert.throws(
    () => readSanityEnvironment({SANITY_STUDIO_DATASET: ''}),
    /SANITY_STUDIO_DATASET is missing or invalid/,
  )
  assert.throws(
    () => readSanityEnvironment({SANITY_STUDIO_SITE_URL: 'https://example.com/preview'}),
    /clean HTTPS origin/,
  )
  assert.equal(
    readSanityEnvironment({SANITY_STUDIO_SITE_URL: 'https://WWW.DEMENNIS.BE:443/'}).siteUrl,
    PRODUCTION_SANITY_ENVIRONMENT.siteUrl,
  )
})

test('blocks staging content deployment to the production Content Lake target', () => {
  assert.throws(
    () => assertDeploymentEnvironment('staging', 'graphql', PRODUCTION_SANITY_ENVIRONMENT),
    /cannot target the production project and dataset/,
  )
})

test('requires a non-production dataset even when staging uses another project', () => {
  assert.throws(
    () =>
      assertDeploymentEnvironment('staging', 'graphql', {
        ...stagingEnvironment,
        dataset: 'production',
      }),
    /must use a non-production dataset/,
  )
})

test('blocks staging Studio deployment to the production hosted application', () => {
  assert.throws(
    () =>
      assertDeploymentEnvironment('staging', 'studio', {
        ...stagingEnvironment,
        appId: PRODUCTION_SANITY_ENVIRONMENT.appId,
      }),
    /cannot target the production application/,
  )
})

test('requires every relevant production target value to match the approved target', () => {
  assert.throws(
    () =>
      assertDeploymentEnvironment('production', 'studio', {
        ...PRODUCTION_SANITY_ENVIRONMENT,
        dataset: 'staging',
      }),
    /does not match the approved production target/,
  )

  assert.doesNotThrow(() =>
    assertDeploymentEnvironment('production', 'studio', PRODUCTION_SANITY_ENVIRONMENT),
  )
})

test('recognizes only actual deployment commands', () => {
  assert.equal(deploymentKindFromArguments(['deploy']), 'studio')
  assert.equal(deploymentKindFromArguments(['graphql', 'deploy']), 'graphql')
  assert.equal(deploymentKindFromArguments(['graphql:deploy']), 'graphql')
  assert.equal(deploymentKindFromArguments(['deploy', '--help']), undefined)
  assert.equal(deploymentKindFromArguments(['build']), undefined)
})

test('requires deployment values to be explicit instead of accepting defaults', () => {
  assert.throws(
    () =>
      assertExplicitDeploymentVariables('studio', {
        SANITY_STUDIO_PROJECT_ID: stagingEnvironment.projectId,
        SANITY_STUDIO_DATASET: stagingEnvironment.dataset,
      }),
    /SANITY_STUDIO_APP_ID must be set explicitly/,
  )
})

test('blocks direct CLI deployments without the wrapper markers', () => {
  assert.throws(
    () => assertGuardedCliDeployment(['deploy'], {}, PRODUCTION_SANITY_ENVIRONMENT),
    /Direct Sanity deployments are disabled/,
  )
  assert.throws(
    () => assertGuardedCliDeployment(['graphql:deploy'], {}, PRODUCTION_SANITY_ENVIRONMENT),
    /Direct Sanity deployments are disabled/,
  )
})

test('blocks a guarded command when its declared kind does not match', () => {
  assert.throws(
    () =>
      assertGuardedCliDeployment(
        ['graphql', 'deploy'],
        {
          SANITY_ACTIVE_ENV: 'staging',
          SANITY_DEPLOY_GUARD: DEPLOY_GUARD_VALUE,
          SANITY_DEPLOY_KIND: 'studio',
          SANITY_DEPLOY_TARGET: 'staging',
        },
        stagingEnvironment,
      ),
    /Direct Sanity deployments are disabled/,
  )
})

test('allows the wrapper only when command, mode, and validated target agree', () => {
  assert.doesNotThrow(() =>
    assertGuardedCliDeployment(
      ['graphql', 'deploy'],
      {
        SANITY_ACTIVE_ENV: 'staging',
        SANITY_DEPLOY_GUARD: DEPLOY_GUARD_VALUE,
        SANITY_DEPLOY_KIND: 'graphql',
        SANITY_DEPLOY_TARGET: 'staging',
        SANITY_STUDIO_DATASET: stagingEnvironment.dataset,
        SANITY_STUDIO_PROJECT_ID: stagingEnvironment.projectId,
      },
      stagingEnvironment,
    ),
  )
})

test('rejects CLI flags that can override a guarded target or deployment behavior', () => {
  const variables = {
    SANITY_ACTIVE_ENV: 'staging',
    SANITY_DEPLOY_GUARD: DEPLOY_GUARD_VALUE,
    SANITY_DEPLOY_KIND: 'graphql',
    SANITY_DEPLOY_TARGET: 'staging',
    SANITY_STUDIO_DATASET: stagingEnvironment.dataset,
    SANITY_STUDIO_PROJECT_ID: stagingEnvironment.projectId,
  }

  assert.throws(
    () =>
      assertGuardedCliDeployment(
        ['graphql', 'deploy', '--dataset', 'production'],
        variables,
        stagingEnvironment,
      ),
    /target overrides are disabled/,
  )
  assert.throws(
    () =>
      assertGuardedCliDeployment(
        ['graphql:deploy', '--dataset=production'],
        variables,
        stagingEnvironment,
      ),
    /target overrides are disabled/,
  )
})

test('production wrapper refuses a non-interactive run without independent confirmation', () => {
  assert.throws(
    () => assertNonInteractiveProductionConfirmation({SANITY_DEPLOY_CONFIRM: ''}),
    /requires SANITY_DEPLOY_CONFIRM=production/,
  )
  assert.doesNotThrow(() =>
    assertNonInteractiveProductionConfirmation({SANITY_DEPLOY_CONFIRM: 'production'}),
  )
})
