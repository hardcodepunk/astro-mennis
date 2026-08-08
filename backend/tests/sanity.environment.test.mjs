import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEPLOY_CONFIRMATION_VALUE,
  assertDeploymentEnvironment,
  assertExplicitDeploymentVariables,
  assertGuardedCliDeployment,
  assertNonInteractiveProductionConfirmation,
  DEPLOY_GUARD_VALUE,
  deploymentArgumentsForKind,
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
  assert.equal(readSanityEnvironment({SANITY_STUDIO_DATASET: 'a'}).dataset, 'a')
  assert.equal(
    readSanityEnvironment({SANITY_STUDIO_DATASET: `a${'b'.repeat(63)}`}).dataset.length,
    64,
  )
  assert.throws(
    () => readSanityEnvironment({SANITY_STUDIO_DATASET: `a${'b'.repeat(64)}`}),
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
  assert.throws(
    () => readSanityEnvironment({SANITY_STUDIO_SITE_URL: 'https://www.demennis.be./'}),
    /clean HTTPS origin/,
  )
  assert.throws(
    () => readSanityEnvironment({SANITY_STUDIO_SITE_URL: 'https://www.demennis.be%2e/'}),
    /clean HTTPS origin/,
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

test('blocks every known production preview origin for a staging Studio', () => {
  for (const siteUrl of [
    PRODUCTION_SANITY_ENVIRONMENT.siteUrl,
    'https://demennis.be',
    'https://astro-mennis.vercel.app',
  ]) {
    assert.throws(
      () => assertDeploymentEnvironment('staging', 'studio', {...stagingEnvironment, siteUrl}),
      /cannot use the production preview URL/,
    )
  }
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
  assert.equal(deploymentKindFromArguments(['graphql', 'deploy', '-h']), undefined)
  assert.equal(deploymentKindFromArguments(['deploy', '--', '--help']), 'studio')
  assert.equal(deploymentKindFromArguments(['deploy', '--', '-h']), 'studio')
  assert.equal(deploymentKindFromArguments(['graphql', 'deploy', '--', '--help']), 'graphql')
  assert.equal(deploymentKindFromArguments(['build']), undefined)
})

test('builds canonical deployment arguments and limits GraphQL options', () => {
  assert.deepEqual(deploymentArgumentsForKind('studio'), ['deploy'])
  assert.deepEqual(deploymentArgumentsForKind('graphql'), ['graphql', 'deploy'])
  assert.deepEqual(deploymentArgumentsForKind('graphql', ['--dry-run']), [
    'graphql',
    'deploy',
    '--dry-run',
  ])
  assert.deepEqual(deploymentArgumentsForKind('graphql', ['--force', '--dry-run']), [
    'graphql',
    'deploy',
    '--force',
    '--dry-run',
  ])

  assert.throws(
    () => deploymentArgumentsForKind('studio', ['--dry-run']),
    /does not accept command-line options/,
  )
  assert.throws(
    () => deploymentArgumentsForKind('graphql', ['--dataset', 'production']),
    /limited to --dry-run and --force/,
  )
  assert.throws(
    () => deploymentArgumentsForKind('graphql', ['--force', '--force']),
    /must be unique/,
  )
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
    /Direct Sanity Studio deployments.*deploy:staging.*deploy:production/,
  )
  assert.throws(
    () => assertGuardedCliDeployment(['graphql:deploy'], {}, PRODUCTION_SANITY_ENVIRONMENT),
    /Direct Sanity GraphQL deployments.*deploy-graphql:staging.*deploy-graphql:production/,
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
    /Direct Sanity GraphQL deployments are disabled/,
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

  assert.doesNotThrow(() =>
    assertGuardedCliDeployment(
      ['graphql', 'deploy', '--force', '--dry-run'],
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

test('production CLI deployment requires confirmation recorded by the wrapper', () => {
  const variables = {
    SANITY_ACTIVE_ENV: 'production',
    SANITY_DEPLOY_GUARD: DEPLOY_GUARD_VALUE,
    SANITY_DEPLOY_KIND: 'studio',
    SANITY_DEPLOY_TARGET: 'production',
    SANITY_STUDIO_APP_ID: PRODUCTION_SANITY_ENVIRONMENT.appId,
    SANITY_STUDIO_DATASET: PRODUCTION_SANITY_ENVIRONMENT.dataset,
    SANITY_STUDIO_PROJECT_ID: PRODUCTION_SANITY_ENVIRONMENT.projectId,
    SANITY_STUDIO_SITE_URL: PRODUCTION_SANITY_ENVIRONMENT.siteUrl,
  }

  assert.throws(
    () => assertGuardedCliDeployment(['deploy'], variables, PRODUCTION_SANITY_ENVIRONMENT),
    /has not been confirmed by the deployment wrapper/,
  )
  assert.doesNotThrow(() =>
    assertGuardedCliDeployment(
      ['deploy'],
      {...variables, SANITY_DEPLOY_CONFIRMED: DEPLOY_CONFIRMATION_VALUE},
      PRODUCTION_SANITY_ENVIRONMENT,
    ),
  )
})

test('rejects CLI flags that can override a guarded target or deployment behavior', () => {
  const graphqlVariables = {
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
        graphqlVariables,
        stagingEnvironment,
      ),
    /target overrides are disabled/,
  )
  assert.throws(
    () =>
      assertGuardedCliDeployment(
        ['graphql:deploy', '--dataset=production'],
        graphqlVariables,
        stagingEnvironment,
      ),
    /target overrides are disabled/,
  )
  assert.throws(
    () =>
      assertGuardedCliDeployment(
        ['graphql', 'deploy', '--force', '--force'],
        graphqlVariables,
        stagingEnvironment,
      ),
    /target overrides are disabled/,
  )
  assert.throws(
    () =>
      assertGuardedCliDeployment(
        ['graphql', 'deploy', '--', '--help'],
        graphqlVariables,
        stagingEnvironment,
      ),
    /target overrides are disabled/,
  )
  assert.throws(
    () =>
      assertGuardedCliDeployment(
        ['deploy', '--', '--help'],
        {
          SANITY_ACTIVE_ENV: 'staging',
          SANITY_DEPLOY_GUARD: DEPLOY_GUARD_VALUE,
          SANITY_DEPLOY_KIND: 'studio',
          SANITY_DEPLOY_TARGET: 'staging',
          SANITY_STUDIO_APP_ID: stagingEnvironment.appId,
          SANITY_STUDIO_DATASET: stagingEnvironment.dataset,
          SANITY_STUDIO_PROJECT_ID: stagingEnvironment.projectId,
          SANITY_STUDIO_SITE_URL: stagingEnvironment.siteUrl,
        },
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
