import {getCliClient} from 'sanity/cli'

import {
  REEL_POSTERS_MIGRATION_QUERY,
  assertReelPostersApplyGuard,
  parseReelPostersMigrationArguments,
  planReelPostersMigration,
} from './reel-posters-migration.mjs'

const usage = `Reel poster data migration

Run a read-only report across published works and drafts:
  sanity exec scripts/migrate-reel-posters.mjs --with-user-token -- --dry-run

Only after reviewing the report, apply with every target and revision confirmation:
  sanity exec scripts/migrate-reel-posters.mjs --with-user-token -- --apply --confirm-project <id> --confirm-dataset <name> --confirm-revision <document-id>=<revision> [repeat for every ready document]
`

async function main() {
  const options = parseReelPostersMigrationArguments(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage)
    return
  }

  const client = getCliClient({apiVersion: '2026-08-21'}).withConfig({perspective: 'raw'})
  const target = client.config()
  const documents = await client.fetch(REEL_POSTERS_MIGRATION_QUERY)
  const plan = planReelPostersMigration(documents)
  const summary = {
    mode: options.apply ? 'apply' : 'dry-run',
    target: {
      projectId: target.projectId,
      dataset: target.dataset,
    },
    plan,
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  if (!options.apply) return

  assertReelPostersApplyGuard({
    plan,
    target,
    confirmations: options.confirmations,
  })

  const ready = plan.filter((item) => item.status === 'ready')
  let transaction = client.transaction()
  ready.forEach((item) => {
    transaction = transaction.patch(item.documentId, (patch) =>
      patch.ifRevisionId(item.revision).set({'media.reels': item.reels}),
    )
  })
  const result = await transaction.commit()
  process.stdout.write(`Migrated ${ready.length} reel document(s) in transaction ${result.transactionId}.\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
