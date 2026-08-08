import assert from "node:assert/strict"
import test from "node:test"

import { validateWorkDetail, validateWorkSummary } from "../src/lib/sanity.contract.ts"

const baseWork = {
  _id: "work-example",
  slug: "example",
  title: "Example",
  category: "Brand",
  categorySlug: "brand",
  client: "Acme",
  preview: {
    poster: "https://res.cloudinary.com/demo/image/upload/v1/poster.jpg",
  },
}

test("the frontend accepts Studio-supported YouTube embed URLs", () => {
  const result = validateWorkDetail(
    {
      ...baseWork,
      year: "2026",
      media: {
        mode: "single",
        youtubeUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      },
    },
    "work",
  )

  assert.equal(result.media?.mode, "single")
  assert.equal(result.media?.youtubeUrl, "https://www.youtube.com/embed/dQw4w9WgXcQ")
})

test("the frontend rejects MP4 deliveries used as poster images", () => {
  assert.throws(
    () => validateWorkSummary(
      {
        ...baseWork,
        preview: {
          poster: "https://res.cloudinary.com/demo/video/upload/v1/not-a-poster.mp4",
        },
      },
      "work",
    ),
    /work\.preview\.poster must be a Cloudinary image delivery URL/,
  )
})

test("conditional YouTube media is complete", () => {
  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: { mode: "single" },
      },
      "work",
    ),
    /work\.media\.youtubeUrl/,
  )

  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: { mode: "slider", reels: [] },
      },
      "work",
    ),
    /between 1 and 4 YouTube URLs/,
  )
})
