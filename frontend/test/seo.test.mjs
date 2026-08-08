import assert from "node:assert/strict"
import test from "node:test"

import {
  categorySeoDescription,
  workSeoDescription,
} from "../src/lib/seo.ts"

const work = (overrides = {}) => ({
  slug: "example",
  title: "Example",
  category: "music video",
  categorySlug: "music-video",
  client: "Acme",
  preview: { poster: "https://example.com/poster.jpg" },
  ...overrides,
})

test("category descriptions use grammatically neutral wording", () => {
  const description = categorySeoDescription(undefined, "events")
  assert.equal(
    description,
    "Explore De Mennis projects in events, created by a videographer and editor based in Gent, Belgium.",
  )
  assert.doesNotMatch(description, /a events|video video/i)
})

test("legacy stored templates are upgraded at render time", () => {
  const description = workSeoDescription(
    {
      workDescriptionTemplate:
        "%title% is a %category% video project for %client% by De Mennis, a videographer and editor in Gent, Belgium.",
    },
    work({ client: "-" }),
  )

  assert.equal(
    description,
    "Explore Example in the music video category, a project by De Mennis, a videographer and editor in Gent, Belgium.",
  )
  assert.doesNotMatch(description, /video video|for\s+[-–—]|for\s+by/i)
})

test("real clients produce a complete optional clause", () => {
  assert.match(workSeoDescription(undefined, work()), /category for Acme, a project/)
})

test("custom templates retain the original tokens", () => {
  assert.equal(
    workSeoDescription(
      { workDescriptionTemplate: "%title% — %client% — %year%" },
      work({ year: "2026" }),
    ),
    "Example — Acme — 2026",
  )
})
