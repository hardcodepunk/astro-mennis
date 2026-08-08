import assert from "node:assert/strict"
import test from "node:test"

import {
  isCloudinaryPosterUrl,
  isCloudinaryVideoUrl,
  parseYouTubeId,
  validateYouTubeUrl,
} from "./index.js"

const youtubeId = "dQw4w9WgXcQ"

test("parses every YouTube shape accepted by Studio", () => {
  const urls = [
    `https://www.youtube.com/watch?v=${youtubeId}`,
    `https://youtu.be/${youtubeId}`,
    `https://www.youtube.com/shorts/${youtubeId}`,
    `https://www.youtube.com/embed/${youtubeId}`,
    `https://www.youtube-nocookie.com/embed/${youtubeId}`,
  ]

  urls.forEach(url => {
    assert.equal(validateYouTubeUrl(url), true)
    assert.equal(parseYouTubeId(url), youtubeId)
  })
})

test("rejects lookalike hosts and missing video IDs", () => {
  assert.equal(parseYouTubeId("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"), undefined)
  assert.equal(parseYouTubeId("https://www.youtube.com/embed/"), undefined)
  assert.notEqual(validateYouTubeUrl("http://youtu.be/dQw4w9WgXcQ"), true)
})

test("requires image output for Cloudinary video posters", () => {
  assert.equal(
    isCloudinaryPosterUrl("https://res.cloudinary.com/demo/video/upload/v1/example.mp4"),
    false,
  )
  assert.equal(
    isCloudinaryPosterUrl("https://res.cloudinary.com/demo/video/upload/so_0,f_jpg/v1/example.mp4"),
    true,
  )
  assert.equal(
    isCloudinaryPosterUrl("https://res.cloudinary.com/demo/image/upload/v1/example"),
    true,
  )
})

test("validates Cloudinary video formats independently", () => {
  assert.equal(
    isCloudinaryVideoUrl("https://res.cloudinary.com/demo/video/upload/v1/example.webm", "webm"),
    true,
  )
  assert.equal(
    isCloudinaryVideoUrl("https://res.cloudinary.com/demo/video/upload/v1/example.mp4", "webm"),
    false,
  )
})
