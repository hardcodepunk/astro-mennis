import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizeStoredAutoplayChoice,
  resolveAutoplayAllowed,
} from "../src/lib/autoplayPolicy.ts"

test("a newly enabled reduced-motion preference wins over a stored play choice", () => {
  assert.equal(normalizeStoredAutoplayChoice("play", true), "default")
  assert.equal(normalizeStoredAutoplayChoice("play", false), "play")
  assert.equal(normalizeStoredAutoplayChoice("pause", true), "pause")
})

test("autoplay follows the system motion preference by default", () => {
  assert.equal(resolveAutoplayAllowed({
    choice: "default",
    reducedMotion: false,
    saveData: false,
  }), true)
  assert.equal(resolveAutoplayAllowed({
    choice: "default",
    reducedMotion: true,
    saveData: false,
  }), false)
})

test("an explicit pause wins over the system motion preference", () => {
  assert.equal(resolveAutoplayAllowed({
    choice: "pause",
    reducedMotion: false,
    saveData: false,
  }), false)
})

test("an explicit play can opt into motion", () => {
  assert.equal(resolveAutoplayAllowed({
    choice: "play",
    reducedMotion: true,
    saveData: false,
  }), true)
})

test("data saver prevents background video even after an explicit play", () => {
  assert.equal(resolveAutoplayAllowed({
    choice: "play",
    reducedMotion: false,
    saveData: true,
  }), false)
})
