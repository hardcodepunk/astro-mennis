import {spawn} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createInterface} from 'node:readline/promises'
import {fileURLToPath} from 'node:url'
import {parseEnv} from 'node:util'

import {
  DEPLOY_CONFIRMATION_VALUE,
  assertDeploymentEnvironment,
  assertExplicitDeploymentVariables,
  assertNonInteractiveProductionConfirmation,
  DEPLOY_GUARD_VALUE,
  deploymentArgumentsForKind,
  readSanityEnvironment,
} from '../sanity.environment.ts'

const backendDirectory = fileURLToPath(new URL('..', import.meta.url))
const sanityBinary = fileURLToPath(new URL('../node_modules/sanity/bin/sanity', import.meta.url))
const deploymentVariableNames = new Set([
  'SANITY_STUDIO_PROJECT_ID',
  'SANITY_STUDIO_DATASET',
  'SANITY_STUDIO_APP_ID',
  'SANITY_STUDIO_SITE_URL',
])
const deploymentUsage = 'Usage: sanity-deploy.mjs <staging|production> <studio|graphql> [options]'

async function readOptionalEnvironmentFile(path) {
  try {
    return parseEnv(await readFile(path, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return {}
    throw error
  }
}

export async function loadDeploymentFileEnvironment(target, directory = backendDirectory) {
  const [targetEnvironment, localEnvironment] = await Promise.all([
    readOptionalEnvironmentFile(resolve(directory, `.env.${target}`)),
    readOptionalEnvironmentFile(resolve(directory, `.env.${target}.local`)),
  ])

  return Object.fromEntries(
    Object.entries({...targetEnvironment, ...localEnvironment}).filter(([name]) =>
      deploymentVariableNames.has(name),
    ),
  )
}

export function parseDeploymentRequest(arguments_) {
  const [target, kind, ...options] = arguments_

  if (
    (target !== 'staging' && target !== 'production') ||
    (kind !== 'studio' && kind !== 'graphql')
  ) {
    throw new Error(deploymentUsage)
  }

  return {target, kind, command: deploymentArgumentsForKind(kind, options)}
}

async function confirmProduction(originalEnvironment) {
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY

  if (!isInteractive) {
    assertNonInteractiveProductionConfirmation(originalEnvironment)
    return
  }

  const prompt = createInterface({input: process.stdin, output: process.stdout})

  try {
    const answer = await prompt.question('Type "production" to confirm this deployment: ')
    if (answer.trim() !== 'production') {
      throw new Error('Production deployment cancelled')
    }
  } finally {
    prompt.close()
  }
}

export function attachSignalForwarding(child, parentProcess = process) {
  let hasForwardedSignal = false
  const signalHandlers = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => [
    signal,
    () => {
      if (child.exitCode !== null || child.signalCode !== null) return

      const childSignal = hasForwardedSignal ? 'SIGKILL' : signal
      if (child.kill(childSignal)) hasForwardedSignal = true
    },
  ])

  for (const [signal, handler] of signalHandlers) {
    parentProcess.on(signal, handler)
  }

  return () => {
    for (const [signal, handler] of signalHandlers) {
      parentProcess.removeListener(signal, handler)
    }
  }
}

function runSanity(arguments_, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [sanityBinary, ...arguments_], {
      cwd: backendDirectory,
      env: environment,
      stdio: 'inherit',
    })

    const removeSignalHandlers = attachSignalForwarding(child)

    child.once('error', (error) => {
      removeSignalHandlers()
      reject(error)
    })
    child.once('close', (code, signal) => {
      removeSignalHandlers()
      if (signal) {
        reject(new Error(`Sanity CLI exited after receiving ${signal}`))
        return
      }

      resolve(code ?? 1)
    })
  })
}

export async function main() {
  const {target, kind, command} = parseDeploymentRequest(process.argv.slice(2))
  const fileEnvironment = await loadDeploymentFileEnvironment(target)
  const deploymentVariables = {
    ...fileEnvironment,
    ...process.env,
    SANITY_ACTIVE_ENV: target,
    SANITY_DEPLOY_CONFIRMED: '',
    SANITY_DEPLOY_GUARD: DEPLOY_GUARD_VALUE,
    SANITY_DEPLOY_KIND: kind,
    SANITY_DEPLOY_TARGET: target,
  }

  assertExplicitDeploymentVariables(kind, deploymentVariables)
  const environment = readSanityEnvironment(deploymentVariables)

  assertDeploymentEnvironment(target, kind, environment)

  const application = kind === 'studio' ? `\nApplication: ${environment.appId}` : ''
  const previewUrl = kind === 'studio' ? `\nPreview URL: ${environment.siteUrl}` : ''
  process.stdout.write(
    `Deploy target: ${target}\nKind: ${kind}\nProject: ${environment.projectId}\nDataset: ${environment.dataset}${application}${previewUrl}\n`,
  )

  if (target === 'production') {
    await confirmProduction(process.env)
    deploymentVariables.SANITY_DEPLOY_CONFIRMED = DEPLOY_CONFIRMATION_VALUE
  }

  process.exitCode = await runSanity(command, deploymentVariables)
}

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Deployment blocked: ${message}\n`)
    process.exitCode = 1
  })
}
