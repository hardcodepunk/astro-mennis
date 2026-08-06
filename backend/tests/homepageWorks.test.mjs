import assert from 'node:assert/strict'
import test from 'node:test'

import {
  homepageWorksField,
  legacyFeaturedOnHomeField,
  legacyFeaturedOrderField,
} from '../schemaTypes/homepageWorks.ts'
import {
  HOMEPAGE_WORKS_MIGRATION_QUERY,
  assertHomepageWorksApplyGuard,
  createHomepageWorkReferences,
  parseHomepageWorksMigrationArguments,
  planHomepageWorksMigration,
} from '../scripts/homepage-works-migration.mjs'

const publishedWorks = [
  {_id: 'work-a', title: 'Work A', featuredOnHome: true, featuredOrder: 1},
  {_id: 'work-b', title: 'Work B', featuredOnHome: true, featuredOrder: 2},
  {_id: 'work-c', title: 'Work C', featuredOnHome: true, featuredOrder: 3},
  {_id: 'work-d', title: 'Work D', featuredOnHome: false},
]

function siteSettings(homepageWorks) {
  const document = {_id: 'siteSettings', _rev: 'settings-revision'}
  if (homepageWorks !== undefined) document.homepageWorks = homepageWorks
  return document
}

test('defines one ordered, unique, max-three homepage work reference array', () => {
  assert.equal(homepageWorksField.name, 'homepageWorks')
  assert.equal(homepageWorksField.type, 'array')
  assert.deepEqual(homepageWorksField.of, [{type: 'reference', to: [{type: 'work'}]}])

  const calls = []
  const rule = {
    max(value) {
      calls.push(['max', value])
      return this
    },
    unique() {
      calls.push(['unique'])
      return this
    },
  }

  assert.equal(homepageWorksField.validation(rule), rule)
  assert.deepEqual(calls, [['max', 3], ['unique']])
})

test('keeps legacy work controls hidden, read-only, and explicitly deprecated', () => {
  for (const field of [legacyFeaturedOnHomeField, legacyFeaturedOrderField]) {
    assert.equal(field.hidden, true)
    assert.equal(field.readOnly, true)
    assert.match(field.deprecated.reason, /Site settings/)
    assert.equal(field.initialValue, undefined)
    assert.equal(field.validation, undefined)
  }
})

test('orders unambiguous legacy selections without a secondary content tie-breaker', () => {
  const plan = planHomepageWorksMigration({
    siteSettings: siteSettings(),
    works: [publishedWorks[2], publishedWorks[0], publishedWorks[1], publishedWorks[3]],
  })

  assert.equal(plan.status, 'ready')
  assert.equal(plan.source, 'legacy')
  assert.deepEqual(plan.selectedWorkIds, ['work-a', 'work-b', 'work-c'])
})

test('refuses to infer an order when legacy works are tied', () => {
  const plan = planHomepageWorksMigration({
    siteSettings: siteSettings(),
    works: [
      publishedWorks[0],
      publishedWorks[1],
      {...publishedWorks[2], featuredOrder: 2},
    ],
  })

  assert.equal(plan.status, 'needs-editorial-order')
  assert.equal(plan.selectedWorkIds, undefined)
  assert.deepEqual(plan.issues.map((migrationIssue) => migrationIssue.code), [
    'legacy-order-tie',
  ])
  assert.deepEqual(plan.issues[0].workIds, ['work-b', 'work-c'])
})

test('requires an editorial choice when more than three legacy works are selected', () => {
  const plan = planHomepageWorksMigration({
    siteSettings: siteSettings(),
    works: [
      ...publishedWorks.slice(0, 3),
      {...publishedWorks[3], featuredOnHome: true, featuredOrder: 4},
    ],
  })

  assert.equal(plan.status, 'needs-editorial-order')
  assert.equal(plan.selectedWorkIds, undefined)
  assert.ok(plan.issues.some((migrationIssue) => migrationIssue.code === 'too-many-legacy-works'))
})

test('uses an explicit editorial order exactly as supplied', () => {
  const plan = planHomepageWorksMigration({
    siteSettings: siteSettings(),
    works: publishedWorks,
    requestedWorkIds: ['work-c', 'work-a', 'work-b'],
  })

  assert.equal(plan.status, 'ready')
  assert.equal(plan.source, 'editorial')
  assert.deepEqual(plan.selectedWorkIds, ['work-c', 'work-a', 'work-b'])
})

test('distinguishes an explicit empty selection from an unmigrated field', () => {
  const explicitNone = planHomepageWorksMigration({
    siteSettings: siteSettings(),
    works: publishedWorks,
    requestedWorkIds: [],
  })
  const alreadyEmpty = planHomepageWorksMigration({
    siteSettings: siteSettings([]),
    works: publishedWorks,
  })

  assert.equal(explicitNone.status, 'ready')
  assert.deepEqual(explicitNone.selectedWorkIds, [])
  assert.equal(alreadyEmpty.status, 'already-configured')
  assert.deepEqual(alreadyEmpty.selectedWorkIds, [])
})

test('rejects duplicate, unpublished, and over-limit editorial selections', () => {
  const plan = planHomepageWorksMigration({
    siteSettings: siteSettings(),
    works: publishedWorks,
    requestedWorkIds: ['work-a', 'work-a', 'missing-work', 'work-b'],
  })

  assert.equal(plan.status, 'blocked')
  assert.equal(plan.selectedWorkIds, undefined)
  assert.deepEqual(
    new Set(plan.issues.map((migrationIssue) => migrationIssue.code)),
    new Set(['too-many-homepage-works', 'duplicate-work-id', 'unknown-work-id']),
  )
})

test('does not overwrite an existing configured selection', () => {
  const plan = planHomepageWorksMigration({
    siteSettings: siteSettings([{_ref: 'work-b'}]),
    works: publishedWorks,
    requestedWorkIds: ['work-a'],
  })

  assert.equal(plan.status, 'already-configured')
  assert.deepEqual(plan.selectedWorkIds, ['work-b'])
})

test('creates keyed references in the reviewed order', () => {
  assert.deepEqual(createHomepageWorkReferences(['work-c', 'work-a']), [
    {_key: 'homepageWork1', _type: 'reference', _ref: 'work-c'},
    {_key: 'homepageWork2', _type: 'reference', _ref: 'work-a'},
  ])
})

test('requires exact target, revision, and clean draft state before applying', () => {
  const plan = planHomepageWorksMigration({
    siteSettings: siteSettings(),
    works: publishedWorks,
    requestedWorkIds: ['work-a'],
  })
  const guard = {
    plan,
    target: {projectId: 'project-id', dataset: 'production'},
    siteSettingsRevision: 'settings-revision',
    draftSiteSettings: null,
    confirmations: {
      projectId: 'project-id',
      dataset: 'production',
      revision: 'settings-revision',
    },
  }

  assert.doesNotThrow(() => assertHomepageWorksApplyGuard(guard))
  assert.throws(
    () =>
      assertHomepageWorksApplyGuard({
        ...guard,
        confirmations: {...guard.confirmations, dataset: 'staging'},
      }),
    /confirm-dataset=production/,
  )
  assert.throws(
    () => assertHomepageWorksApplyGuard({...guard, draftSiteSettings: {_rev: 'draft-rev'}}),
    /draft siteSettings/,
  )
})

test('parses ordered selections while keeping dry-run as the default', () => {
  assert.deepEqual(
    parseHomepageWorksMigrationArguments(['--work-id', 'work-c', '--work-id=work-a']),
    {
      apply: false,
      help: false,
      requestedWorkIds: ['work-c', 'work-a'],
      confirmations: {projectId: undefined, dataset: undefined, revision: undefined},
    },
  )
  assert.deepEqual(parseHomepageWorksMigrationArguments(['--none']).requestedWorkIds, [])
  assert.throws(
    () => parseHomepageWorksMigrationArguments(['--none', '--work-id=work-a']),
    /cannot be combined/,
  )
})

test('the report reads published works separately and checks for a settings draft', () => {
  assert.match(HOMEPAGE_WORKS_MIGRATION_QUERY, /drafts\.siteSettings/)
  assert.match(HOMEPAGE_WORKS_MIGRATION_QUERY, /!\(_id in path\("drafts\.\*\*"\)\)/)
})
