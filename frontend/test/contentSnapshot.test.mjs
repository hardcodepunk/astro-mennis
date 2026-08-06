import assert from "node:assert/strict"
import {fileURLToPath} from "node:url"
import {spawnSync} from "node:child_process"
import test from "node:test"

import {
  CONTENT_SNAPSHOT_QUERY,
  createContentRepository,
  selectFeaturedWorks,
  selectRecentWorks,
  selectWorksByCategorySlug,
  validateContentSnapshot,
} from "../src/lib/contentSnapshot.ts"
import fixture from "./fixtures/content-snapshot.js"

test("fixture content cannot be selected for a Vercel deployment", () => {
  const scriptPath = fileURLToPath(new URL(
    "../scripts/prepare-content-snapshot.mjs",
    import.meta.url,
  ))
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      SANITY_CONTENT_SOURCE: "fixture",
      VERCEL: "1",
    },
  })

  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /Fixture content is forbidden/)
})

test("validates and freezes a complete build snapshot", () => {
  const snapshot = validateContentSnapshot(fixture)

  assert.equal(Object.isFrozen(snapshot), true)
  assert.equal(Object.isFrozen(snapshot.categories), true)
  assert.equal(Object.isFrozen(snapshot.works), true)
  assert.equal(snapshot.works.length, 3)
  assert.match(CONTENT_SNAPSHOT_QUERY, /"works": \*\[_type == "work"\]/)
  assert.match(CONTENT_SNAPSHOT_QUERY, /"siteSettings": \*\[_id == "siteSettings"\]\[0\]/)
})

test("all repository getters share one in-flight load", async () => {
  let loadCount = 0
  const repository = createContentRepository(async () => {
    loadCount += 1
    await Promise.resolve()
    return fixture
  })

  const [firstSnapshot, secondSnapshot, settings, categories, works, featured, recent] =
    await Promise.all([
      repository.getContentSnapshot(),
      repository.getContentSnapshot(),
      repository.getSiteSettings(),
      repository.getCategories(),
      repository.getWorks(),
      repository.getFeaturedWorks(3),
      repository.getRecentWorks(2, "fixture-preview"),
    ])

  assert.equal(loadCount, 1)
  assert.equal(firstSnapshot, secondSnapshot)
  assert.equal(settings?.homeSeoH1, "Fixture home")
  assert.notEqual(categories, firstSnapshot.categories)
  assert.notEqual(works, firstSnapshot.works)
  assert.deepEqual(featured.map(work => work.slug), ["fixture-single", "fixture-preview"])
  assert.deepEqual(recent.map(work => work.slug), ["fixture-single", "fixture-slider"])
})

test("pure selectors preserve snapshot order while filtering", () => {
  const snapshot = validateContentSnapshot(fixture)

  assert.deepEqual(
    selectFeaturedWorks(snapshot, 1).map(work => work.slug),
    ["fixture-single"],
  )
  assert.deepEqual(
    selectWorksByCategorySlug(snapshot, "film").map(work => work.slug),
    ["fixture-preview", "fixture-single"],
  )
  assert.deepEqual(
    selectRecentWorks(snapshot, 2, "fixture-preview").map(work => work.slug),
    ["fixture-single", "fixture-slider"],
  )
})

test("nullable singletons remain explicit", () => {
  const snapshot = validateContentSnapshot({
    ...fixture,
    siteSettings: null,
    seoSettings: null,
    contactPage: null,
    logoMarquee: null,
    bioWithPreview: null,
  })

  assert.equal(snapshot.siteSettings, null)
  assert.equal(snapshot.seoSettings, null)
  assert.equal(snapshot.contactPage, null)
  assert.equal(snapshot.logoMarquee, null)
  assert.equal(snapshot.bioWithPreview, null)
})

test("snapshot failures retain precise contract paths", () => {
  assert.throws(() => validateContentSnapshot([]), /contentSnapshot expected an object/)
  assert.throws(
    () => validateContentSnapshot({...fixture, categories: {}}),
    /contentSnapshot\.categories expected array/,
  )
  assert.throws(
    () => validateContentSnapshot({
      ...fixture,
      works: [{...fixture.works[0], year: ""}],
    }),
    /contentSnapshot\.works\[0\]\.year expected non-empty string/,
  )
})
