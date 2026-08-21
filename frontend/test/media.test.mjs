import assert from "node:assert/strict"
import test from "node:test"

import {
  LANDSCAPE_POSTER_PRESET,
  REEL_POSTER_PRESET,
  cloudinaryImage,
  cloudinaryVideo,
  imageAttributes,
} from "../src/lib/media.ts"

test("adds transforms before a versioned Cloudinary asset", () => {
  assert.equal(
    cloudinaryImage(
      "https://res.cloudinary.com/demo/image/upload/v123/folder/image.jpg?download=1#preview",
      800,
    ),
    "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800/v123/folder/image.jpg?download=1#preview",
  )
})

test("preserves poster offsets while replacing image transforms", () => {
  assert.equal(
    cloudinaryImage(
      "https://res.cloudinary.com/demo/video/upload/c_fill,so_0,q_50,w_100/v123/folder/poster.jpg",
      1200,
      "auto:eco",
    ),
    "https://res.cloudinary.com/demo/video/upload/so_0,f_auto,q_auto:eco,w_1200/v123/folder/poster.jpg",
  )
})

test("does not mistake unversioned folders for transforms", () => {
  assert.equal(
    cloudinaryImage(
      "https://res.cloudinary.com/demo/image/upload/folder/subfolder/image.jpg",
      640,
    ),
    "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/folder/subfolder/image.jpg",
  )
})

test("replaces recognized transforms on unversioned URLs", () => {
  assert.equal(
    cloudinaryImage(
      "https://res.cloudinary.com/demo/image/upload/c_fill,w_100/folder/image.jpg",
      640,
    ),
    "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640/folder/image.jpg",
  )
})

test("leaves non-Cloudinary and non-image URLs unchanged", () => {
  const lookalike = "https://res.cloudinary.com.evil.test/image/upload/v1/image.jpg"
  const video = "https://res.cloudinary.com/demo/video/upload/v1/video.mp4"
  assert.equal(cloudinaryImage(lookalike, 640), lookalike)
  assert.equal(cloudinaryImage(video, 640), video)
})

test("requests broadly compatible codecs for Cloudinary background video", () => {
  assert.equal(
    cloudinaryVideo(
      "https://res.cloudinary.com/demo/video/upload/v123/folder/preview.webm",
      "webm",
    ),
    "https://res.cloudinary.com/demo/video/upload/q_auto:eco,vc_vp9,ac_none,f_webm/v123/folder/preview.webm",
  )
  assert.equal(
    cloudinaryVideo(
      "https://res.cloudinary.com/demo/video/upload/v123/folder/preview.mp4",
      "mp4",
    ),
    "https://res.cloudinary.com/demo/video/upload/q_auto:eco,vc_h264,ac_none,f_mp4/v123/folder/preview.mp4",
  )
})

test("replaces incompatible video delivery settings while preserving layout transforms", () => {
  assert.equal(
    cloudinaryVideo(
      "https://res.cloudinary.com/demo/video/upload/c_fill,w_800,q_50,vc_av1,ac_aac,f_webm/v123/preview.webm?download=1#clip",
      "webm",
    ),
    "https://res.cloudinary.com/demo/video/upload/c_fill,w_800,q_auto:eco,vc_vp9,ac_none,f_webm/v123/preview.webm?download=1#clip",
  )
})

test("leaves non-Cloudinary video URLs unchanged", () => {
  const external = "https://media.example.test/preview.webm"
  const lookalike = "https://res.cloudinary.com.evil.test/video/upload/v1/preview.webm"

  assert.equal(cloudinaryVideo(external, "webm"), external)
  assert.equal(cloudinaryVideo(lookalike, "webm"), lookalike)
})

test("builds responsive Sanity poster URLs with the editor crop and hotspot", () => {
  const poster = {
    provider: "sanity",
    url: "https://cdn.sanity.io/images/demo/production/nativeposter-1920x1080.jpg",
    crop: {top: 0.05, bottom: 0.05, left: 0.1, right: 0.1},
    hotspot: {x: 0.4, y: 0.6, width: 0.3, height: 0.3},
    dimensions: {width: 1920, height: 1080},
  }

  const landscape = imageAttributes({src: poster, ...LANDSCAPE_POSTER_PRESET})
  const reel = imageAttributes({src: poster, ...REEL_POSTER_PRESET})
  const landscapeUrl = new URL(landscape.src)
  const reelUrl = new URL(reel.src)

  assert.equal(landscapeUrl.searchParams.get("w"), "1280")
  assert.equal(landscapeUrl.searchParams.get("h"), "720")
  assert.equal(reelUrl.searchParams.get("w"), "720")
  assert.equal(reelUrl.searchParams.get("h"), "1280")
  assert.equal(reelUrl.searchParams.get("fit"), "crop")
  assert.equal(reelUrl.searchParams.get("auto"), "format")
  assert.notEqual(landscapeUrl.searchParams.get("rect"), reelUrl.searchParams.get("rect"))
  assert.match(reel.srcset, /w=320&h=569/)
  assert.equal(reel.srcset.split(", ").length, REEL_POSTER_PRESET.widths.length)
})
