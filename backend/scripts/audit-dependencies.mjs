import {spawnSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'

const severityRank = Object.freeze({low: 1, moderate: 2, high: 3, critical: 4})

function policyByAdvisoryId(policy, errors, currentTime) {
  if (policy?.schemaVersion !== 1 || !Array.isArray(policy.exceptions)) {
    errors.push('audit-policy.json must use schemaVersion 1 with an exceptions array')
    return new Map()
  }

  const entries = new Map()
  for (const exception of policy.exceptions) {
    if (!Array.isArray(exception.advisoryIds) || exception.advisoryIds.length === 0) {
      errors.push('Every audit exception must list at least one advisory ID')
      continue
    }
    if (!severityRank[exception.maxSeverity]) {
      errors.push(`Invalid maximum severity for ${exception.package || 'unknown package'}`)
    }
    if (!Array.isArray(exception.nodes) || exception.nodes.length === 0) {
      errors.push(`Audit exception for ${exception.package || 'unknown package'} has no node paths`)
    }
    if (!exception.reason?.trim()) {
      errors.push(`Audit exception for ${exception.package || 'unknown package'} has no reason`)
    }
    const expiry = Date.parse(`${exception.expiresOn}T23:59:59.999Z`)
    if (!Number.isFinite(expiry)) {
      errors.push(`Audit exception for ${exception.package || 'unknown package'} has an invalid expiry date`)
    } else if (currentTime > expiry) {
      errors.push(
        `Audit exception for ${exception.package || 'unknown package'} expired on ${exception.expiresOn}`,
      )
    }

    for (const advisoryId of exception.advisoryIds) {
      const id = String(advisoryId)
      if (entries.has(id)) errors.push(`Audit advisory ${id} is listed more than once`)
      entries.set(id, exception)
    }
  }
  return entries
}

export function validateAuditReport(report, policy, now = new Date()) {
  const errors = []
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const exceptions = policyByAdvisoryId(policy, errors, currentTime)
  const vulnerabilities = report?.vulnerabilities
  if (!vulnerabilities || typeof vulnerabilities !== 'object' || Array.isArray(vulnerabilities)) {
    errors.push('npm audit did not return a version 2 vulnerabilities object')
  }

  const usedAdvisories = new Set()
  const resolvedRoots = new Map()

  const resolveRoots = (name, trail = []) => {
    if (resolvedRoots.has(name)) return resolvedRoots.get(name)
    if (trail.includes(name)) {
      errors.push(`npm audit dependency cycle: ${[...trail, name].join(' -> ')}`)
      return new Set()
    }

    const vulnerability = vulnerabilities?.[name]
    if (!vulnerability) {
      errors.push(`npm audit references missing vulnerability ${name}`)
      return new Set()
    }

    const roots = new Set()
    for (const cause of vulnerability.via ?? []) {
      if (typeof cause === 'string') {
        for (const root of resolveRoots(cause, [...trail, name])) roots.add(root)
        continue
      }

      const id = String(cause?.source ?? '')
      if (!id) {
        errors.push(`${name} contains an unrecognized npm audit cause`)
        continue
      }
      roots.add(id)
      usedAdvisories.add(id)

      const exception = exceptions.get(id)
      if (!exception) {
        errors.push(`${name} contains unapproved advisory ${id} (${cause.url || 'no URL'})`)
        continue
      }
      if (exception.package !== (cause.name || vulnerability.name || name)) {
        errors.push(`Advisory ${id} moved from ${exception.package} to ${cause.name || name}`)
      }

      const actualRank = severityRank[cause.severity]
      if (!actualRank || actualRank > severityRank[exception.maxSeverity]) {
        errors.push(
          `Advisory ${id} severity ${cause.severity} exceeds policy maximum ${exception.maxSeverity}`,
        )
      }

      for (const node of vulnerability.nodes ?? []) {
        if (!exception.nodes.includes(node)) {
          errors.push(`Advisory ${id} appeared at unapproved dependency path ${node}`)
        }
      }
    }

    if (roots.size === 0) errors.push(`${name} does not resolve to a concrete advisory`)
    resolvedRoots.set(name, roots)
    return roots
  }

  for (const name of Object.keys(vulnerabilities ?? {})) resolveRoots(name)

  if (errors.length > 0) {
    throw new Error(`Dependency audit policy rejected the report:\n- ${errors.join('\n- ')}`)
  }

  return {
    vulnerabilityCount: Object.keys(vulnerabilities).length,
    advisoryCount: usedAdvisories.size,
    unusedAdvisories: [...exceptions.keys()].filter(id => !usedAdvisories.has(id)),
  }
}

async function main() {
  const backendRoot = new URL('../', import.meta.url)
  const policy = JSON.parse(await readFile(new URL('audit-policy.json', backendRoot), 'utf8'))
  const audit = spawnSync('npm', ['audit', '--json'], {
    cwd: backendRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })

  if (audit.error) throw audit.error
  if (![0, 1].includes(audit.status)) {
    throw new Error(audit.stderr.trim() || `npm audit exited with status ${audit.status}`)
  }

  let report
  try {
    report = JSON.parse(audit.stdout)
  } catch {
    throw new Error(`npm audit returned invalid JSON: ${audit.stderr.trim()}`)
  }

  const summary = validateAuditReport(report, policy)
  process.stdout.write(
    `Dependency audit accepted ${summary.advisoryCount} temporary upstream advisories across ${summary.vulnerabilityCount} reported packages.\n`,
  )
  if (summary.unusedAdvisories.length > 0) {
    process.stdout.write(`Remove resolved policy entries: ${summary.unusedAdvisories.join(', ')}\n`)
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`)
    process.exitCode = 1
  })
}
