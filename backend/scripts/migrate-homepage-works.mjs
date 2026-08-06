import {getCliClient} from 'sanity/cli'

import {
  HOMEPAGE_WORKS_MIGRATION_QUERY,
  assertHomepageWorksApplyGuard,
  createHomepageWorkReferences,
  parseHomepageWorksMigrationArguments,
  planHomepageWorksMigration,
} from './homepage-works-migration.mjs'

const usage = `Homepage project ordering migration

Run a read-only report:
  sanity exec scripts/migrate-homepage-works.mjs -- --dry-run

Resolve an ambiguous legacy order without writing:
  sanity exec scripts/migrate-homepage-works.mjs -- --work-id <first-id> --work-id <second-id> --work-id <third-id>

Choose an explicitly empty homepage without writing:
  sanity exec scripts/migrate-homepage-works.mjs -- --none

Only after reviewing the report, apply with an authenticated Sanity CLI session and all target confirmations:
  sanity exec scripts/migrate-homepage-works.mjs --with-user-token -- --apply [ordered --work-id values or --none] --confirm-project <id> --confirm-dataset <name> --confirm-revision <revision>
`

async function main() {
  const options = parseHomepageWorksMigrationArguments(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage)
    return
  }

  const client = getCliClient({apiVersion: '2026-08-06'})
  const target = client.config()
  const report = await client.fetch(HOMEPAGE_WORKS_MIGRATION_QUERY)
  const plan = planHomepageWorksMigration({
    siteSettings: report.siteSettings,
    works: report.works,
    requestedWorkIds: options.requestedWorkIds,
  })
  const summary = {
    mode: options.apply ? 'apply' : 'dry-run',
    target: {
      projectId: target.projectId,
      dataset: target.dataset,
    },
    siteSettingsRevision: report.siteSettings?._rev,
    draftSiteSettingsRevision: report.draftSiteSettings?._rev,
    plan,
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)

  if (!options.apply) {
    if (plan.status === 'needs-editorial-order') {
      process.stdout.write(
        '\nNo selection was inferred. Ask an editor to order up to three work ids, then rerun this dry-run with ordered --work-id values (or --none).\n',
      )
    }
    return
  }

  assertHomepageWorksApplyGuard({
    plan,
    target,
    siteSettingsRevision: report.siteSettings?._rev,
    draftSiteSettings: report.draftSiteSettings,
    confirmations: options.confirmations,
  })

  const result = await client
    .patch('siteSettings')
    .ifRevisionId(report.siteSettings._rev)
    .set({homepageWorks: createHomepageWorkReferences(plan.selectedWorkIds)})
    .commit()

  process.stdout.write(`Applied homepageWorks to siteSettings at revision ${result._rev}.\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
