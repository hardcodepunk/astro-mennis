import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

import {deploymentStatus} from '../schemaTypes/deploymentStatus.ts'

test('shows an automation-owned deployment status without editable controls', () => {
  assert.equal(deploymentStatus.name, 'deploymentStatus')
  assert.equal(deploymentStatus.type, 'document')
  assert.equal(deploymentStatus.readOnly, true)

  const fields = new Map(deploymentStatus.fields.map((field) => [field.name, field]))
  assert.deepEqual(
    fields.get('status').options.list.map((option) => option.value),
    ['idle', 'queued', 'requesting', 'requested', 'failed'],
  )
  assert.equal(fields.get('message').hidden, undefined)
  assert.equal(fields.get('workflowUrl').hidden, undefined)
  assert.equal(fields.get('latestEventKey').hidden, true)
  assert.equal(fields.get('recentEventKeys').hidden, true)
  assert.equal(fields.get('dispatchState').hidden, true)
  assert.equal(fields.get('claimId').hidden, true)
  assert.equal(fields.get('claimedAt').hidden, true)
  assert.equal(fields.get('claimedAt').type, 'datetime')
  assert.equal(fields.get('eventId').hidden, true)
  assert.equal(fields.get('status').options.list.some((option) => option.value === 'succeeded'), false)
})

test('registers deployment status as a protected singleton', async () => {
  const [schemaIndex, structure] = await Promise.all([
    readFile(new URL('../schemaTypes/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../structure.ts', import.meta.url), 'utf8'),
  ])

  assert.match(schemaIndex, /import \{deploymentStatus\} from '\.\/deploymentStatus'/)
  assert.match(schemaIndex, /deploymentStatus,/)
  assert.match(structure, /'deploymentStatus'/)
  assert.match(structure, /deploymentStatus: 'Frontend deployment'/)
})
