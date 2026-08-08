import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import test from 'node:test'

import {attachSignalForwarding, parseDeploymentRequest} from '../scripts/sanity-deploy.mjs'

test('parses guarded deployment requests and forwards only approved GraphQL options', () => {
  assert.deepEqual(parseDeploymentRequest(['staging', 'studio']), {
    target: 'staging',
    kind: 'studio',
    command: ['deploy'],
  })
  assert.deepEqual(
    parseDeploymentRequest(['production', 'graphql', '--dry-run', '--force']),
    {
      target: 'production',
      kind: 'graphql',
      command: ['graphql', 'deploy', '--dry-run', '--force'],
    },
  )

  assert.throws(() => parseDeploymentRequest(['preview', 'studio']), /Usage:/)
  assert.throws(
    () => parseDeploymentRequest(['staging', 'studio', '--dry-run']),
    /does not accept command-line options/,
  )
  assert.throws(
    () => parseDeploymentRequest(['staging', 'graphql', '--dataset', 'production']),
    /limited to --dry-run and --force/,
  )
  assert.throws(
    () => parseDeploymentRequest(['staging', 'graphql', '--force', '--force']),
    /must be unique/,
  )
})

test('forwards the first termination signal and escalates the second one', () => {
  const parentProcess = new EventEmitter()
  const forwardedSignals = []
  const child = {
    exitCode: null,
    signalCode: null,
    kill(signal) {
      forwardedSignals.push(signal)
      return true
    },
  }
  const removeSignalHandlers = attachSignalForwarding(child, parentProcess)

  parentProcess.emit('SIGTERM')
  parentProcess.emit('SIGINT')
  assert.deepEqual(forwardedSignals, ['SIGTERM', 'SIGKILL'])

  child.signalCode = 'SIGKILL'
  parentProcess.emit('SIGHUP')
  assert.deepEqual(forwardedSignals, ['SIGTERM', 'SIGKILL'])

  removeSignalHandlers()
  child.signalCode = null
  parentProcess.emit('SIGTERM')
  assert.deepEqual(forwardedSignals, ['SIGTERM', 'SIGKILL'])
})
