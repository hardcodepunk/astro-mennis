import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

import {
  REEL_POSTERS_MIGRATION_QUERY,
  assertReelPostersApplyGuard,
  parseReelPostersMigrationArguments,
  planReelPostersMigration,
} from '../scripts/reel-posters-migration.mjs'

const runnerSource = readFileSync(
  new URL('../scripts/migrate-reel-posters.mjs', import.meta.url),
  'utf8',
)

const legacyDocument = {
  _id: 'work-slider',
  _rev: 'revision-1',
  title: 'Slider',
  reels: [
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/aqz-KE-bpKQ',
  ],
}

const nativePosterAssetRef = 'image-nativeposter-720x1280-jpg'

test('legacy reel URLs become ordered keyed reel objects', () => {
  const [firstPlan] = planReelPostersMigration([legacyDocument])
  const [secondPlan] = planReelPostersMigration([legacyDocument])

  assert.equal(firstPlan.status, 'ready')
  assert.deepEqual(
    firstPlan.reels.map((reel) => ({type: reel._type, url: reel.youtubeUrl})),
    [
      {type: 'projectReel', url: legacyDocument.reels[0]},
      {type: 'projectReel', url: legacyDocument.reels[1]},
    ],
  )
  assert.match(firstPlan.reels[0]._key, /^reel-[a-f0-9]{16}$/)
  assert.equal(firstPlan.reels[0]._key, secondPlan.reels[0]._key)
})

test('published and draft copies receive the same reel keys', () => {
  const [published, draft] = planReelPostersMigration([
    legacyDocument,
    {...legacyDocument, _id: `drafts.${legacyDocument._id}`, _rev: 'draft-revision'},
  ])

  assert.deepEqual(
    published.reels.map((reel) => reel._key),
    draft.reels.map((reel) => reel._key),
  )
})

test('existing reel objects and posters are preserved idempotently', () => {
  const document = {
    ...legacyDocument,
    reels: [
      {
        _key: 'existing-key',
        _type: 'projectReel',
        youtubeUrl: legacyDocument.reels[0],
        poster: 'https://res.cloudinary.com/demo/image/upload/v1/reel.jpg',
        posterImage: {
          _type: 'image',
          asset: {_type: 'reference', _ref: nativePosterAssetRef},
          hotspot: {x: 0.5, y: 0.5, width: 0.5, height: 0.5},
        },
      },
    ],
    reelPosterAssets: [{assetRef: nativePosterAssetRef, resolvedAssetId: nativePosterAssetRef}],
  }

  const [plan] = planReelPostersMigration([document])

  assert.equal(plan.status, 'already-migrated')
  assert.deepEqual(plan.reels, document.reels)
})

test('invalid reel data blocks the migration without producing a patch', () => {
  const [plan] = planReelPostersMigration([{
    ...legacyDocument,
    reels: [{youtubeUrl: 'https://example.com/not-youtube', poster: 'https://example.com/poster.jpg'}],
  }])

  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reels, undefined)
  assert.equal(plan.issues[0].code, 'invalid-reel-url')
})

test('missing and empty reel URLs cannot pass the migration plan', () => {
  const plans = planReelPostersMigration([
    {...legacyDocument, _id: 'work-empty', reels: ['']},
    {...legacyDocument, _id: 'work-missing', reels: [{}]},
  ])

  assert.deepEqual(plans.map((plan) => plan.status), ['blocked', 'blocked'])
  assert.deepEqual(
    plans.map((plan) => plan.issues[0].code),
    ['invalid-legacy-reel-url', 'invalid-reel-url'],
  )
})

test('an invalid native poster reference blocks the migration', () => {
  const [plan] = planReelPostersMigration([{
    ...legacyDocument,
    reels: [{
      _type: 'projectReel',
      youtubeUrl: legacyDocument.reels[0],
      posterImage: {asset: {_ref: 'file-not-an-image'}},
    }],
  }])

  assert.equal(plan.status, 'blocked')
  assert.equal(plan.issues[0].code, 'invalid-reel-poster-image')
})

test('a well-shaped but unresolved native poster reference blocks the migration', () => {
  const [plan] = planReelPostersMigration([{
    ...legacyDocument,
    reels: [{
      _type: 'projectReel',
      youtubeUrl: legacyDocument.reels[0],
      posterImage: {
        _type: 'image',
        asset: {_type: 'reference', _ref: nativePosterAssetRef},
      },
    }],
    reelPosterAssets: [{assetRef: nativePosterAssetRef, resolvedAssetId: null}],
  }])

  assert.equal(plan.status, 'blocked')
  assert.equal(plan.issues[0].code, 'invalid-reel-poster-image')
})

test('apply mode requires exact target and document revision confirmations', () => {
  const options = parseReelPostersMigrationArguments([
    '--apply',
    '--confirm-project=project-id',
    '--confirm-dataset=production',
    '--confirm-revision=work-slider=revision-1',
  ])
  const plan = planReelPostersMigration([legacyDocument])

  assert.doesNotThrow(() => assertReelPostersApplyGuard({
    plan,
    target: {projectId: 'project-id', dataset: 'production'},
    confirmations: options.confirmations,
  }))
  assert.throws(
    () => assertReelPostersApplyGuard({
      plan,
      target: {projectId: 'project-id', dataset: 'production'},
      confirmations: {...options.confirmations, revisions: {}},
    }),
    /--confirm-revision=work-slider=revision-1/,
  )
})

test('the migration audits published documents and drafts before writing', () => {
  assert.match(REEL_POSTERS_MIGRATION_QUERY, /_type == "work"/)
  assert.match(REEL_POSTERS_MIGRATION_QUERY, /media\.mode == "slider"/)
  assert.match(REEL_POSTERS_MIGRATION_QUERY, /posterImage\.asset->_id/)
  assert.match(runnerSource, /withConfig\(\{perspective: 'raw'\}\)/)
  assert.match(runnerSource, /patch\.ifRevisionId\(item\.revision\)/)
})
