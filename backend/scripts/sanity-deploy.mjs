import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline/promises'
import {fileURLToPath} from 'node:url'

import {loadEnv} from '@sanity/cli'

import {
  assertDeploymentEnvironment,
  assertExplicitDeploymentVariables,
  assertNonInteractiveProductionConfirmation,
  DEPLOY_GUARD_VALUE,
  readSanityEnvironment,
} from '../sanity.environment.ts'

const backendDirectory = fileURLToPath(new URL('..', import.meta.url))
const sanityBinary = fileURLToPath(new URL('../node_modules/sanity/bin/sanity', import.meta.url))

function parseDeploymentRequest(arguments_) {
  const [target, kind, ...unexpected] = arguments_

  if (
    unexpected.length > 0 ||
    (target !== 'staging' && target !== 'production') ||
    (kind !== 'studio' && kind !== 'graphql')
  ) {
    throw new Error('Usage: sanity-deploy.mjs <staging|production> <studio|graphql>')
  }

  return {target, kind}
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

function runSanity(arguments_, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [sanityBinary, ...arguments_], {
      cwd: backendDirectory,
      env: environment,
      stdio: 'inherit',
    })

    const signalHandlers = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => [
      signal,
      () => {
        if (!child.killed) child.kill(signal)
      },
    ])
    const removeSignalHandlers = () => {
      for (const [signal, handler] of signalHandlers) {
        process.removeListener(signal, handler)
      }
    }

    for (const [signal, handler] of signalHandlers) {
      process.on(signal, handler)
    }

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

async function main() {
  const {target, kind} = parseDeploymentRequest(process.argv.slice(2))
  const fileEnvironment = loadEnv(target, backendDirectory, 'SANITY_STUDIO_')
  const deploymentVariables = {
    ...fileEnvironment,
    ...process.env,
    SANITY_ACTIVE_ENV: target,
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
  }

  const command = kind === 'studio' ? ['deploy'] : ['graphql', 'deploy']
  process.exitCode = await runSanity(command, deploymentVariables)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Deployment blocked: ${message}\n`)
  process.exitCode = 1
})
