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
const sanityPoster = {
  url: "https://cdn.sanity.io/images/demo/production/nativeposter-1920x1080.jpg",
  crop: {top: 0.05, bottom: 0.05, left: 0.1, right: 0.1},
  hotspot: {x: 0.4, y: 0.6, width: 0.3, height: 0.3},
  dimensions: {width: 1920, height: 1080},
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
            posterImage: sanityPoster,
          },
          {
            title: "Behind the scenes",
            youtubeUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
            poster: "https://res.cloudinary.com/demo/image/upload/v1/behind-scenes.jpg",
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
  assert.deepEqual(result.media?.videos[0]?.poster, {provider: "sanity", ...sanityPoster})
  assert.deepEqual(result.media?.videos[1]?.poster, {
    provider: "cloudinary",
    url: "https://res.cloudinary.com/demo/image/upload/v1/behind-scenes.jpg",
  })
})

test("the frontend accepts per-reel posters and normalizes legacy reel URLs", () => {
  const result = validateWorkDetail(
    {
      ...baseWork,
      year: "2026",
      media: {
        mode: "slider",
        reels: [
          {
            _key: "first-reel",
            youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
            poster: "https://res.cloudinary.com/demo/image/upload/v1/first-reel.jpg",
          },
          "https://www.youtube.com/shorts/aqz-KE-bpKQ",
        ],
        reelPosters: [{_key: "first-reel", posterImage: sanityPoster}],
      },
    },
    "work",
  )

  assert.deepEqual(result.media, {
    mode: "slider",
    reels: [
      {
        youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
        poster: {provider: "sanity", ...sanityPoster},
      },
      {youtubeUrl: "https://www.youtube.com/shorts/aqz-KE-bpKQ"},
    ],
  })
})

test("the frontend rejects invalid per-reel URLs and posters", () => {
  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: {
          mode: "slider",
          reels: [{youtubeUrl: "https://example.com/video"}],
        },
      },
      "work",
    ),
    /work\.media\.reels\[0\]\.youtubeUrl/,
  )

  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: {
          mode: "slider",
          reels: [{
            youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
            poster: "https://example.com/poster.jpg",
          }],
        },
      },
      "work",
    ),
    /work\.media\.reels\[0\]\.poster must be a Cloudinary image delivery URL/,
  )

  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: {
          mode: "slider",
          reels: [{_key: "broken-poster", youtubeUrl: "https://youtu.be/dQw4w9WgXcQ"}],
          reelPosters: [{
            _key: "broken-poster",
            posterImage: {...sanityPoster, url: "https://example.com/poster.jpg"},
          }],
        },
      },
      "work",
    ),
    /work\.media\.reelPosters\[0\]\.posterImage\.url must be an HTTPS Sanity image URL/,
  )
})

test("the frontend rejects malformed native poster metadata and duplicate reel joins", () => {
  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: {
          mode: "gallery",
          videos: [{
            title: "Broken hotspot",
            youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
            posterImage: {
              ...sanityPoster,
              hotspot: {...sanityPoster.hotspot, x: 2},
            },
          }],
        },
      },
      "work",
    ),
    /work\.media\.videos\[0\]\.posterImage\.hotspot\.x/,
  )

  assert.throws(
    () => validateWorkDetail(
      {
        ...baseWork,
        year: "2026",
        media: {
          mode: "slider",
          reels: [{_key: "duplicate", youtubeUrl: "https://youtu.be/dQw4w9WgXcQ"}],
          reelPosters: [
            {_key: "duplicate", posterImage: sanityPoster},
            {_key: "duplicate", posterImage: sanityPoster},
          ],
        },
      },
      "work",
    ),
    /work\.media\.reelPosters\[1\]._key duplicates reel key/,
  )
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
    /between 1 and 4 reels/,
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
