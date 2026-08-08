import {createClient} from "@sanity/client"
import {rename, unlink, writeFile} from "node:fs/promises"
import {fileURLToPath} from "node:url"

import {
  CONTENT_SNAPSHOT_QUERY,
  validateContentSnapshot,
} from "../src/lib/contentSnapshot.ts"

const source = process.env.SANITY_CONTENT_SOURCE?.trim() || "sanity"
const snapshotPath = fileURLToPath(new URL("../.content-snapshot.json", import.meta.url))
const temporaryPath = `${snapshotPath}.${process.pid}.tmp`

if (source !== "sanity" && source !== "fixture") {
  throw new Error('SANITY_CONTENT_SOURCE must be either "sanity" or "fixture"')
}

if (source === "fixture" && (process.env.VERCEL || process.env.VERCEL_ENV)) {
  throw new Error("Fixture content is forbidden in Vercel preview and production builds")
}

const rawSnapshot = source === "fixture"
  ? (await import("../test/fixtures/content-snapshot.js")).default
  : await fetchPublishedSnapshot()
const snapshot = validateContentSnapshot(rawSnapshot)
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`

try {
  await writeFile(temporaryPath, serialized, {encoding: "utf8", mode: 0o600})
  await rename(temporaryPath, snapshotPath)
} catch (error) {
  await unlink(temporaryPath).catch(() => {})
  throw error
}

console.log(
  `Prepared ${source} content snapshot with ${snapshot.categories.length} categories and ${snapshot.works.length} works.`,
)

async function fetchPublishedSnapshot() {
  const projectId = requiredEnvironment("PUBLIC_SANITY_PROJECT_ID")
  const dataset = requiredEnvironment("PUBLIC_SANITY_DATASET")
  const client = createClient({
    projectId,
    dataset,
    apiVersion: "2024-01-01",
    useCdn: false,
    perspective: "published",
  })

  return client.fetch(CONTENT_SNAPSHOT_QUERY)
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}
