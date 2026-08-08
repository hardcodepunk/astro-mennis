export const DEPLOY_GUARD_VALUE = 'sanity-deploy-wrapper-v1'

export const PRODUCTION_SANITY_ENVIRONMENT = Object.freeze({
  projectId: '454gxa26',
  dataset: 'production',
  appId: 'st7zms5txswv66ebr4184g2g',
  siteUrl: 'https://www.demennis.be',
})

export type DeployTarget = 'staging' | 'production'
export type DeploymentKind = 'studio' | 'graphql'

export type SanityEnvironment = Readonly<{
  projectId: string
  dataset: string
  appId: string
  siteUrl: string
}>

type EnvironmentVariables = Readonly<Record<string, string | undefined>>

const deploymentVariableNames = Object.freeze({
  projectId: 'SANITY_STUDIO_PROJECT_ID',
  dataset: 'SANITY_STUDIO_DATASET',
  appId: 'SANITY_STUDIO_APP_ID',
  siteUrl: 'SANITY_STUDIO_SITE_URL',
})

function environmentValue(
  environment: EnvironmentVariables,
  name: string,
  fallback: string,
): string {
  return environment[name] === undefined ? fallback : environment[name]!.trim()
}

function requireMatch(name: string, value: string, pattern: RegExp): string {
  if (!pattern.test(value)) {
    throw new Error(`${name} is missing or invalid`)
  }

  return value
}

function requireSiteUrl(value: string): string {
  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    throw new Error('SANITY_STUDIO_SITE_URL must be a valid HTTPS URL')
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('SANITY_STUDIO_SITE_URL must be a clean HTTPS origin without a path or query')
  }

  return parsed.origin
}

export function readSanityEnvironment(environment: EnvironmentVariables): SanityEnvironment {
  return Object.freeze({
    projectId: requireMatch(
      'SANITY_STUDIO_PROJECT_ID',
      environmentValue(
        environment,
        'SANITY_STUDIO_PROJECT_ID',
        PRODUCTION_SANITY_ENVIRONMENT.projectId,
      ),
      /^[a-z0-9]+$/,
    ),
    dataset: requireMatch(
      'SANITY_STUDIO_DATASET',
      environmentValue(environment, 'SANITY_STUDIO_DATASET', PRODUCTION_SANITY_ENVIRONMENT.dataset),
      /^[a-z0-9](?:[-_a-z0-9]{0,62}[a-z0-9])$/,
    ),
    appId: requireMatch(
      'SANITY_STUDIO_APP_ID',
      environmentValue(environment, 'SANITY_STUDIO_APP_ID', PRODUCTION_SANITY_ENVIRONMENT.appId),
      /^[a-z0-9]+$/,
    ),
    siteUrl: requireSiteUrl(
      environmentValue(
        environment,
        'SANITY_STUDIO_SITE_URL',
        PRODUCTION_SANITY_ENVIRONMENT.siteUrl,
      ),
    ),
  })
}

export function readSanityEnvironmentFromProcess(): SanityEnvironment {
  return readSanityEnvironment({
    SANITY_STUDIO_PROJECT_ID: process.env.SANITY_STUDIO_PROJECT_ID,
    SANITY_STUDIO_DATASET: process.env.SANITY_STUDIO_DATASET,
    SANITY_STUDIO_APP_ID: process.env.SANITY_STUDIO_APP_ID,
    SANITY_STUDIO_SITE_URL: process.env.SANITY_STUDIO_SITE_URL,
  })
}

function differsFromProduction(
  environment: SanityEnvironment,
  fields: Array<keyof SanityEnvironment>,
): boolean {
  return fields.some((field) => environment[field] !== PRODUCTION_SANITY_ENVIRONMENT[field])
}

export function assertDeploymentEnvironment(
  target: DeployTarget,
  kind: DeploymentKind,
  environment: SanityEnvironment,
): void {
  const contentTargetFields: Array<keyof SanityEnvironment> = ['projectId', 'dataset']
  const studioTargetFields: Array<keyof SanityEnvironment> = [
    ...contentTargetFields,
    'appId',
    'siteUrl',
  ]
  const relevantFields = kind === 'studio' ? studioTargetFields : contentTargetFields

  if (target === 'production') {
    if (differsFromProduction(environment, relevantFields)) {
      throw new Error(`Production ${kind} deployment does not match the approved production target`)
    }

    return
  }

  if (
    environment.projectId === PRODUCTION_SANITY_ENVIRONMENT.projectId &&
    environment.dataset === PRODUCTION_SANITY_ENVIRONMENT.dataset
  ) {
    throw new Error('Staging deployment cannot target the production project and dataset')
  }

  if (environment.dataset === PRODUCTION_SANITY_ENVIRONMENT.dataset) {
    throw new Error('Staging deployment must use a non-production dataset')
  }

  if (kind === 'studio' && environment.appId === PRODUCTION_SANITY_ENVIRONMENT.appId) {
    throw new Error('Staging Studio deployment cannot target the production application')
  }

  if (kind === 'studio' && environment.siteUrl === PRODUCTION_SANITY_ENVIRONMENT.siteUrl) {
    throw new Error('Staging Studio deployment cannot use the production preview URL')
  }
}

export function assertExplicitDeploymentVariables(
  kind: DeploymentKind,
  variables: EnvironmentVariables,
): void {
  const requiredFields: Array<keyof typeof deploymentVariableNames> =
    kind === 'studio' ? ['projectId', 'dataset', 'appId', 'siteUrl'] : ['projectId', 'dataset']

  for (const field of requiredFields) {
    const name = deploymentVariableNames[field]
    if (!variables[name]?.trim()) {
      throw new Error(`${name} must be set explicitly for ${kind} deployment`)
    }
  }
}

export function assertNonInteractiveProductionConfirmation(variables: EnvironmentVariables): void {
  if (variables.SANITY_DEPLOY_CONFIRM !== 'production') {
    throw new Error(
      'Production deployment requires SANITY_DEPLOY_CONFIRM=production in non-interactive environments',
    )
  }
}

export function deploymentKindFromArguments(
  arguments_: readonly string[],
): DeploymentKind | undefined {
  if (arguments_.some((argument) => argument === '--help' || argument === '-h')) {
    return undefined
  }

  const commands = arguments_.filter((argument) => argument !== '--' && !argument.startsWith('-'))

  if (commands[0] === 'deploy') return 'studio'
  if (commands[0] === 'graphql' && commands[1] === 'deploy') return 'graphql'
  if (commands[0] === 'graphql:deploy') return 'graphql'

  return undefined
}

function isDeployTarget(value: string | undefined): value is DeployTarget {
  return value === 'staging' || value === 'production'
}

export function assertGuardedCliDeployment(
  arguments_: readonly string[],
  variables: EnvironmentVariables,
  environment: SanityEnvironment,
): void {
  const detectedKind = deploymentKindFromArguments(arguments_)
  if (!detectedKind) return

  const target = variables.SANITY_DEPLOY_TARGET
  const guardedKind = variables.SANITY_DEPLOY_KIND

  if (
    variables.SANITY_DEPLOY_GUARD !== DEPLOY_GUARD_VALUE ||
    !isDeployTarget(target) ||
    guardedKind !== detectedKind ||
    variables.SANITY_ACTIVE_ENV !== target
  ) {
    throw new Error(
      'Direct Sanity deployments are disabled. Use an explicit npm run deploy:* command.',
    )
  }

  const expectedArguments = detectedKind === 'studio' ? ['deploy'] : ['graphql', 'deploy']
  const hasOnlyExpectedArguments =
    arguments_.length === expectedArguments.length &&
    arguments_.every((argument, index) => argument === expectedArguments[index])

  if (!hasOnlyExpectedArguments) {
    throw new Error('Deployment flags and positional target overrides are disabled')
  }

  assertExplicitDeploymentVariables(detectedKind, variables)
  assertDeploymentEnvironment(target, detectedKind, environment)
}
