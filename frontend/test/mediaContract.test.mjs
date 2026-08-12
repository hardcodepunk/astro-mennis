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

test("the frontend accepts a gallery of titled landscape videos", () => {
  const result = validateWorkDetail(
    {
      ...baseWork,
      year: "2026",
      media: {
        mode: "gallery",
        videos: [
          {
            title: "Main film",
            youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
            poster: "https://res.cloudinary.com/demo/image/upload/v1/main-film.jpg",
          },
          {
            title: "Behind the scenes",
            youtubeUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
          },
        ],
      },
    },
    "work",
  )

  assert.equal(result.media?.mode, "gallery")
  assert.deepEqual(result.media?.videos.map(video => video.title), [
    "Main film",
    "Behind the scenes",
  ])
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

  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: { mode: "gallery", videos: [] },
      },
      "work",
    ),
    /between 1 and 6 videos/,
  )

  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: {
          mode: "gallery",
          videos: [{ title: "Broken", youtubeUrl: "https://example.com/video" }],
        },
      },
      "work",
    ),
    /work\.media\.videos\[0\]\.youtubeUrl/,
  )

  for (const youtubeUrl of ["dQw4w9WgXcQ", "http://youtu.be/dQw4w9WgXcQ"]) {
    assert.throws(
      () => validateWorkDetail(
        {
          ...baseWork,
          year: "2026",
          media: {
            mode: "gallery",
            videos: [{title: "Invalid URL", youtubeUrl}],
          },
        },
        "work",
      ),
      /work\.media\.videos\[0\]\.youtubeUrl/,
    )
  }

  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: {
          mode: "gallery",
          videos: [{title: "   ", youtubeUrl: "https://youtu.be/dQw4w9WgXcQ"}],
        },
      },
      "work",
    ),
    /work\.media\.videos\[0\]\.title/,
  )

  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: {
          mode: "gallery",
          videos: [{
            title: "Invalid poster",
            youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
            poster: "https://example.com/poster.jpg",
          }],
        },
      },
      "work",
    ),
    /work\.media\.videos\[0\]\.poster/,
  )

  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: {
          mode: "gallery",
          videos: Array.from({length: 7}, (_, index) => ({
            title: "Video " + (index + 1),
            youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
          })),
        },
      },
      "work",
    ),
    /between 1 and 6 videos/,
  )
})
