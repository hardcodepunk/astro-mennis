import assert from "node:assert/strict"
import test from "node:test"

import {
  validateWorkDetail,
  validateWorkSummary,
} from "../src/lib/sanity.contract.ts"

const summary = {
  slug: "example",
  title: "Example",
  category: "Brand",
  categorySlug: "brand",
  client: "Acme",
  preview: {
    poster: "https://res.cloudinary.com/demo/image/upload/v1/poster.jpg",
  },
}

test("work summaries may omit detail-only fields", () => {
  assert.equal(validateWorkSummary(summary, "work").year, undefined)
})

test("work details require a non-empty year with a precise field path", () => {
  assert.throws(
    () => validateWorkDetail(summary, "work"),
    /work\.year expected non-empty string/,
  )
  assert.throws(
    () => validateWorkDetail({ ...summary, year: " " }, "work"),
    /work\.year expected non-empty string/,
  )
})

test("work details retain validated detail media", () => {
  const detail = validateWorkDetail(
    {
      ...summary,
      year: "2026",
      media: { mode: "preview" },
    },
    "work",
  )
  assert.equal(detail.year, "2026")
  assert.deepEqual(detail.media, { mode: "preview" })
})
