import {createHash} from 'node:crypto'

import {isCloudinaryPosterUrl, validateYouTubeUrl} from '@astro-mennis/media-contract'

export const REEL_POSTERS_MIGRATION_QUERY = `*[
  _type == "work" && media.mode == "slider"
]{
  _id,
  _rev,
  title,
  "reels": media.reels,
  "reelPosterAssets": media.reels[
    _type == "projectReel" && defined(posterImage.asset._ref)
  ]{
    "assetRef": posterImage.asset._ref,
    "resolvedAssetId": posterImage.asset->_id
  }
}`

function issue(code, message, details = {}) {
  return {code, message, ...details}
}

function reelKey(documentId, index, youtubeUrl) {
  const canonicalDocumentId = documentId.startsWith('drafts.')
    ? documentId.slice('drafts.'.length)
    : documentId
  const digest = createHash('sha256')
    .update(`${canonicalDocumentId}\0${index}\0${youtubeUrl}`)
    .digest('hex')
    .slice(0, 16)
  return `reel-${digest}`
}

function validKey(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value)
}

const SANITY_IMAGE_ASSET_ID = /^image-[A-Za-z0-9]+-[1-9][0-9]*x[1-9][0-9]*-[A-Za-z0-9]+$/

function validSanityPosterImage(value, resolvedPosterAssetIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (value._type !== 'image') return false
  const asset = value.asset
  return Boolean(
    asset &&
    typeof asset === 'object' &&
    !Array.isArray(asset) &&
    asset._type === 'reference' &&
    typeof asset._ref === 'string' &&
    SANITY_IMAGE_ASSET_ID.test(asset._ref) &&
    resolvedPosterAssetIds.has(asset._ref),
  )
}

function normalizeReel(documentId, reel, index, resolvedPosterAssetIds) {
  if (typeof reel === 'string') {
    if (!reel.trim()) {
      return {
        issue: issue(
          'invalid-legacy-reel-url',
          `Reel ${index + 1} must have a non-empty YouTube URL.`,
          {index, value: reel},
        ),
      }
    }
    const youtubeValidation = validateYouTubeUrl(reel)
    if (youtubeValidation !== true) {
      return {
        issue: issue(
          'invalid-legacy-reel-url',
          `Reel ${index + 1} ${youtubeValidation}.`,
          {index, value: reel},
        ),
      }
    }
    return {
      changed: true,
      reel: {
        _key: reelKey(documentId, index, reel),
        _type: 'projectReel',
        youtubeUrl: reel,
      },
    }
  }

  if (!reel || typeof reel !== 'object' || Array.isArray(reel)) {
    return {
      issue: issue('invalid-reel', `Reel ${index + 1} must be a URL or reel object.`, {
        index,
      }),
    }
  }

  const youtubeUrl = reel.youtubeUrl
  if (typeof youtubeUrl !== 'string' || !youtubeUrl.trim()) {
    return {
      issue: issue(
        'invalid-reel-url',
        `Reel ${index + 1} must have a non-empty YouTube URL.`,
        {index, value: youtubeUrl},
      ),
    }
  }
  const youtubeValidation = validateYouTubeUrl(youtubeUrl)
  if (youtubeValidation !== true) {
    return {
      issue: issue(
        'invalid-reel-url',
        `Reel ${index + 1} YouTube URL ${youtubeValidation}.`,
        {index, value: youtubeUrl},
      ),
    }
  }
  if (reel.poster !== undefined && reel.poster !== null) {
    if (typeof reel.poster !== 'string' || !isCloudinaryPosterUrl(reel.poster)) {
      return {
        issue: issue(
          'invalid-reel-poster',
          `Reel ${index + 1} poster must be a Cloudinary image delivery URL.`,
          {index, value: reel.poster},
        ),
      }
    }
  }
  if (
    reel.posterImage !== undefined &&
    reel.posterImage !== null &&
    !validSanityPosterImage(reel.posterImage, resolvedPosterAssetIds)
  ) {
    return {
      issue: issue(
        'invalid-reel-poster-image',
        `Reel ${index + 1} poster image must reference a Sanity image asset.`,
        {index},
      ),
    }
  }

  const key = validKey(reel._key) ? reel._key : reelKey(documentId, index, youtubeUrl)
  const normalized = {
    ...reel,
    _key: key,
    _type: 'projectReel',
    youtubeUrl,
  }
  return {
    changed: reel._type !== 'projectReel' || reel._key !== key,
    reel: normalized,
  }
}

export function planReelPostersMigration(documents) {
  return documents.map((document) => {
    const issues = []
    if (!document || typeof document !== 'object') {
      return {
        status: 'blocked',
        documentId: undefined,
        revision: undefined,
        title: undefined,
        issues: [issue('invalid-document', 'Migration input must contain work documents.')],
      }
    }

    const documentId = document._id
    const revision = document._rev
    if (typeof documentId !== 'string' || !documentId) {
      issues.push(issue('missing-document-id', 'Work document is missing its id.'))
    }
    if (typeof revision !== 'string' || !revision) {
      issues.push(issue('missing-revision', `${documentId || 'Work document'} is missing its revision.`))
    }
    if (!Array.isArray(document.reels) || document.reels.length < 1 || document.reels.length > 4) {
      issues.push(
        issue(
          'invalid-reels-array',
          `${documentId || 'Work document'} must contain between 1 and 4 reels.`,
        ),
      )
    }

    if (issues.length) {
      return {
        status: 'blocked',
        documentId,
        revision,
        title: document.title,
        issues,
      }
    }

    let changed = false
    const reels = []
    const resolvedPosterAssetIds = new Set(
      Array.isArray(document.reelPosterAssets)
        ? document.reelPosterAssets
          .filter((asset) =>
            asset &&
            typeof asset === 'object' &&
            asset.assetRef === asset.resolvedAssetId &&
            typeof asset.resolvedAssetId === 'string',
          )
          .map((asset) => asset.resolvedAssetId)
        : [],
    )
    document.reels.forEach((reel, index) => {
      const result = normalizeReel(documentId, reel, index, resolvedPosterAssetIds)
      if (result.issue) issues.push(result.issue)
      if (result.reel) reels.push(result.reel)
      changed ||= result.changed === true
    })

    return {
      status: issues.length ? 'blocked' : changed ? 'ready' : 'already-migrated',
      documentId,
      revision,
      title: document.title,
      reels: issues.length ? undefined : reels,
      issues,
    }
  })
}

function argumentValue(argument, name) {
  const prefix = `${name}=`
  return argument.startsWith(prefix) ? argument.slice(prefix.length) : undefined
}

export function parseReelPostersMigrationArguments(arguments_) {
  let apply = false
  let explicitDryRun = false
  let help = false
  let projectId
  let dataset
  const revisions = {}
  const recordRevision = (value) => {
    const separator = value.indexOf('=')
    if (separator < 1 || separator === value.length - 1) {
      throw new Error('--confirm-revision must use <document-id>=<revision>.')
    }
    revisions[value.slice(0, separator)] = value.slice(separator + 1)
  }

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
    } else if (argument === '--help' || argument === '-h') {
      help = true
    } else if (argument === '--confirm-project') {
      projectId = takeNextValue('--confirm-project')
    } else if (argument.startsWith('--confirm-project=')) {
      projectId = argumentValue(argument, '--confirm-project')
    } else if (argument === '--confirm-dataset') {
      dataset = takeNextValue('--confirm-dataset')
    } else if (argument.startsWith('--confirm-dataset=')) {
      dataset = argumentValue(argument, '--confirm-dataset')
    } else if (argument === '--confirm-revision') {
      recordRevision(takeNextValue('--confirm-revision'))
    } else if (argument.startsWith('--confirm-revision=')) {
      recordRevision(argumentValue(argument, '--confirm-revision'))
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (apply && explicitDryRun) throw new Error('--apply and --dry-run cannot be combined.')

  return {
    apply,
    help,
    confirmations: {projectId, dataset, revisions},
  }
}

export function assertReelPostersApplyGuard({plan, target, confirmations}) {
  const blocked = plan.filter((item) => item.status === 'blocked')
  if (blocked.length) {
    throw new Error('The reel poster migration is blocked. Resolve every reported issue first.')
  }

  const ready = plan.filter((item) => item.status === 'ready')
  if (!ready.length) throw new Error('No reel documents require migration.')

  if (confirmations.projectId !== target.projectId) {
    throw new Error(`Pass --confirm-project=${target.projectId} to confirm the target project.`)
  }
  if (confirmations.dataset !== target.dataset) {
    throw new Error(`Pass --confirm-dataset=${target.dataset} to confirm the target dataset.`)
  }

  ready.forEach((item) => {
    if (confirmations.revisions[item.documentId] !== item.revision) {
      throw new Error(
        `Pass --confirm-revision=${item.documentId}=${item.revision} to confirm the reviewed revision.`,
      )
    }
  })
}
