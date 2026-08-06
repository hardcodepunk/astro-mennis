import assert from "node:assert/strict"
import test from "node:test"

import { cloudinaryImage } from "../src/lib/media.ts"

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
