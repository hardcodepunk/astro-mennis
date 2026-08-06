import assert from 'node:assert/strict'
import test from 'node:test'

import {validateAuditReport} from '../scripts/audit-dependencies.mjs'

const policy = {
  schemaVersion: 1,
  exceptions: [
    {
      advisoryIds: [123],
      package: 'example-leaf',
      nodes: ['node_modules/tool/node_modules/example-leaf'],
      maxSeverity: 'moderate',
      expiresOn: '2026-09-06',
      reason: 'Temporary upstream-only test exception.',
    },
  ],
}

function report(overrides = {}) {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      'example-leaf': {
        name: 'example-leaf',
        severity: 'moderate',
        via: [
          {
            source: 123,
            name: 'example-leaf',
            severity: 'moderate',
            url: 'https://github.com/advisories/GHSA-example',
          },
        ],
        nodes: ['node_modules/tool/node_modules/example-leaf'],
      },
      tool: {
        name: 'tool',
        severity: 'moderate',
        via: ['example-leaf'],
        nodes: ['node_modules/tool'],
      },
      ...overrides,
    },
  }
}

test('accepts only advisories that resolve to an active exact-path exception', () => {
  const summary = validateAuditReport(report(), policy, new Date('2026-08-06T00:00:00Z'))

  assert.deepEqual(summary, {
    vulnerabilityCount: 2,
    advisoryCount: 1,
    unusedAdvisories: [],
  })
})

test('rejects new advisories and changed dependency paths', () => {
  const unexpectedAdvisory = report({
    surprise: {
      name: 'surprise',
      severity: 'high',
      via: [{source: 999, name: 'surprise', severity: 'high'}],
      nodes: ['node_modules/surprise'],
    },
  })
  assert.throws(() => validateAuditReport(unexpectedAdvisory, policy), /unapproved advisory 999/)

  const moved = report()
  moved.vulnerabilities['example-leaf'].nodes = ['node_modules/another/example-leaf']
  assert.throws(() => validateAuditReport(moved, policy), /unapproved dependency path/)
})

test('rejects severity escalation and expired exceptions', () => {
  const escalated = report()
  escalated.vulnerabilities['example-leaf'].via[0].severity = 'high'
  assert.throws(() => validateAuditReport(escalated, policy), /exceeds policy maximum/)
  assert.throws(
    () => validateAuditReport(report(), policy, new Date('2026-09-07T00:00:00Z')),
    /exception.*expired/,
  )
  assert.throws(
    () => validateAuditReport({vulnerabilities: {}}, policy, new Date('2026-09-07T00:00:00Z')),
    /exception.*expired/,
  )
})
