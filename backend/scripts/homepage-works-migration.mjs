export const MAX_HOMEPAGE_WORKS = 3

export const HOMEPAGE_WORKS_MIGRATION_QUERY = `{
  "siteSettings": *[_id == "siteSettings"][0]{
    _id,
    _rev,
    homepageWorks[]{_ref}
  },
  "works": *[_type == "work" && !(_id in path("drafts.**"))]{
    _id,
    title,
    featuredOnHome,
    featuredOrder
  }
}`

export const HOMEPAGE_WORKS_DRAFT_QUERY = `*[_id == "drafts.siteSettings"][0]{
  _id,
  _rev,
  homepageWorks[]{_ref}
}`

function issue(code, message, details = {}) {
  return {code, message, ...details}
}

function displayName(work) {
  return typeof work.title === 'string' && work.title.trim() ? work.title.trim() : work._id
}

function validateOrderedWorkIds(workIds, publishedWorks) {
  const issues = []
  const knownIds = new Set(publishedWorks.map((work) => work._id))

  if (workIds.length > MAX_HOMEPAGE_WORKS) {
    issues.push(
      issue(
        'too-many-homepage-works',
        `Choose at most ${MAX_HOMEPAGE_WORKS} homepage projects.`,
        {count: workIds.length},
      ),
    )
  }

  const seen = new Set()
  for (const workId of workIds) {
    if (typeof workId !== 'string' || !workId.trim()) {
      issues.push(issue('invalid-work-id', 'Every homepage project must have a document id.'))
      continue
    }

    if (seen.has(workId)) {
      issues.push(
        issue('duplicate-work-id', `Homepage project ${workId} was selected more than once.`, {
          workId,
        }),
      )
    }
    seen.add(workId)

    if (!knownIds.has(workId)) {
      issues.push(
        issue('unknown-work-id', `Homepage project ${workId} is not a published work document.`, {
          workId,
        }),
      )
    }
  }

  return issues
}

function currentHomepageWorkIds(siteSettings) {
  if (siteSettings.homepageWorks === undefined || siteSettings.homepageWorks === null) {
    return undefined
  }

  if (!Array.isArray(siteSettings.homepageWorks)) return null

  return siteSettings.homepageWorks.map((reference) => reference?._ref)
}

function legacyCandidate(work) {
  return {
    _id: work._id,
    title: displayName(work),
    featuredOrder: work.featuredOrder ?? null,
  }
}

function planFromLegacyWorks(works) {
  const candidates = works.filter((work) => work.featuredOnHome === true).map(legacyCandidate)
  const issues = []

  if (candidates.length > MAX_HOMEPAGE_WORKS) {
    issues.push(
      issue(
        'too-many-legacy-works',
        `${candidates.length} works are marked for the homepage; an editor must choose at most ${MAX_HOMEPAGE_WORKS}.`,
        {workIds: candidates.map((work) => work._id)},
      ),
    )
  }

  const candidatesByOrder = new Map()
  for (const candidate of candidates) {
    const order = candidate.featuredOrder
    if (order !== null && (!Number.isInteger(order) || order < 1)) {
      issues.push(
        issue(
          'invalid-legacy-order',
          `${candidate.title} (${candidate._id}) has an invalid legacy homepage order.`,
          {workId: candidate._id, featuredOrder: order},
        ),
      )
      continue
    }

    const orderKey = order === null ? 'missing' : String(order)
    const orderedCandidates = candidatesByOrder.get(orderKey) ?? []
    orderedCandidates.push(candidate)
    candidatesByOrder.set(orderKey, orderedCandidates)
  }

  for (const [orderKey, tiedCandidates] of candidatesByOrder) {
    if (tiedCandidates.length < 2) continue

    const label = orderKey === 'missing' ? 'no order' : `order ${orderKey}`
    issues.push(
      issue(
        'legacy-order-tie',
        `${tiedCandidates.map((work) => `${work.title} (${work._id})`).join(', ')} share ${label}; an editor must choose their order.`,
        {
          featuredOrder: orderKey === 'missing' ? null : Number(orderKey),
          workIds: tiedCandidates.map((work) => work._id),
        },
      ),
    )
  }

  if (issues.length) {
    return {
      status: 'needs-editorial-order',
      source: 'legacy',
      selectedWorkIds: undefined,
      candidates,
      issues,
    }
  }

  const orderedCandidates = [...candidates].sort((left, right) => {
    const leftOrder = left.featuredOrder ?? Number.POSITIVE_INFINITY
    const rightOrder = right.featuredOrder ?? Number.POSITIVE_INFINITY
    return leftOrder - rightOrder
  })

  return {
    status: 'ready',
    source: 'legacy',
    selectedWorkIds: orderedCandidates.map((work) => work._id),
    candidates,
    issues: [],
  }
}

export function planHomepageWorksMigration({siteSettings, works, requestedWorkIds}) {
  if (!siteSettings || siteSettings._id !== 'siteSettings') {
    return {
      status: 'blocked',
      source: 'none',
      selectedWorkIds: undefined,
      candidates: [],
      issues: [
        issue(
          'missing-site-settings',
          'The published siteSettings singleton does not exist. Create and publish it before migrating.',
        ),
      ],
    }
  }

  const configuredWorkIds = currentHomepageWorkIds(siteSettings)
  if (configuredWorkIds !== undefined) {
    if (configuredWorkIds === null) {
      return {
        status: 'blocked',
        source: 'configured',
        selectedWorkIds: undefined,
        candidates: [],
        issues: [
          issue('invalid-current-selection', 'siteSettings.homepageWorks is not an array.'),
        ],
      }
    }

    const issues = validateOrderedWorkIds(configuredWorkIds, works)
    return {
      status: issues.length ? 'blocked' : 'already-configured',
      source: 'configured',
      selectedWorkIds: configuredWorkIds,
      candidates: [],
      issues,
    }
  }

  if (requestedWorkIds !== undefined) {
    const issues = validateOrderedWorkIds(requestedWorkIds, works)
    return {
      status: issues.length ? 'blocked' : 'ready',
      source: 'editorial',
      selectedWorkIds: issues.length ? undefined : [...requestedWorkIds],
      candidates: works.filter((work) => requestedWorkIds.includes(work._id)).map(legacyCandidate),
      issues,
    }
  }

  return planFromLegacyWorks(works)
}

export function createHomepageWorkReferences(workIds) {
  return workIds.map((workId, index) => ({
    _key: `homepageWork${index + 1}`,
    _type: 'reference',
    _ref: workId,
  }))
}

export function assertHomepageWorksApplyGuard({
  plan,
  target,
  siteSettingsRevision,
  draftSiteSettings,
  confirmations,
}) {
  if (plan.status !== 'ready' || !plan.selectedWorkIds) {
    throw new Error('The homepage migration has no reviewed selection ready to apply.')
  }

  if (draftSiteSettings) {
    throw new Error(
      'A draft siteSettings document exists. Publish or discard it before applying this migration.',
    )
  }

  if (!siteSettingsRevision) {
    throw new Error('The published siteSettings revision is missing.')
  }

  if (confirmations.projectId !== target.projectId) {
    throw new Error(`Pass --confirm-project=${target.projectId} to confirm the target project.`)
  }

  if (confirmations.dataset !== target.dataset) {
    throw new Error(`Pass --confirm-dataset=${target.dataset} to confirm the target dataset.`)
  }

  if (confirmations.revision !== siteSettingsRevision) {
    throw new Error(
      `Pass --confirm-revision=${siteSettingsRevision} to confirm the reviewed siteSettings revision.`,
    )
  }
}

function argumentValue(argument, name) {
  const prefix = `${name}=`
  return argument.startsWith(prefix) ? argument.slice(prefix.length) : undefined
}

export function parseHomepageWorksMigrationArguments(arguments_) {
  const workIds = []
  let apply = false
  let explicitDryRun = false
  let selectNone = false
  let help = false
  let projectId
  let dataset
  let revision

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]
    const takeNextValue = (name) => {
      const value = arguments_[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`)
      index += 1
      return value
    }

    if (argument === '--apply') {
      apply = true
    } else if (argument === '--dry-run') {
      explicitDryRun = true
    } else if (argument === '--none') {
      selectNone = true
    } else if (argument === '--help' || argument === '-h') {
      help = true
    } else if (argument === '--work-id') {
      workIds.push(takeNextValue('--work-id'))
    } else if (argument.startsWith('--work-id=')) {
      workIds.push(argumentValue(argument, '--work-id'))
    } else if (argument === '--confirm-project') {
      projectId = takeNextValue('--confirm-project')
    } else if (argument.startsWith('--confirm-project=')) {
      projectId = argumentValue(argument, '--confirm-project')
    } else if (argument === '--confirm-dataset') {
      dataset = takeNextValue('--confirm-dataset')
    } else if (argument.startsWith('--confirm-dataset=')) {
      dataset = argumentValue(argument, '--confirm-dataset')
    } else if (argument === '--confirm-revision') {
      revision = takeNextValue('--confirm-revision')
    } else if (argument.startsWith('--confirm-revision=')) {
      revision = argumentValue(argument, '--confirm-revision')
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (apply && explicitDryRun) throw new Error('--apply and --dry-run cannot be combined.')
  if (selectNone && workIds.length) throw new Error('--none cannot be combined with --work-id.')

  return {
    apply,
    help,
    requestedWorkIds: selectNone ? [] : workIds.length ? workIds : undefined,
    confirmations: {projectId, dataset, revision},
  }
}
