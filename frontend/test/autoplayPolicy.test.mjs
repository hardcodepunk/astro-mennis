import assert from "node:assert/strict"
import test from "node:test"

import { resolveAutoplayAllowed } from "../src/lib/autoplayPolicy.ts"

test("autoplay follows the system motion preference by default", () => {
  assert.equal(resolveAutoplayAllowed({
    reducedMotion: false,
    saveData: false,
  }), true)
  assert.equal(resolveAutoplayAllowed({
    reducedMotion: true,
    saveData: false,
  }), false)
})

test("data saver prevents background video", () => {
  assert.equal(resolveAutoplayAllowed({
    reducedMotion: false,
    saveData: true,
  }), false)
})
