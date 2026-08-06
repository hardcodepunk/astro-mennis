import assert from "node:assert/strict"
import test from "node:test"

import { serializeJsonLd } from "../src/lib/jsonLd.ts"

test("escapes every less-than sign while preserving the JSON-LD value", () => {
  const value = {
    name: "</ScRiPt><script>alert(1)</script>",
    nested: ["<svg onload=alert(1)>", { "<key": "safe" }],
  }

  const serialized = serializeJsonLd(value)

  assert.equal(serialized.includes("<"), false)
  assert.match(serialized, /\\u003c\/ScRiPt>/)
  assert.deepEqual(JSON.parse(serialized), value)
})

test("rejects values that JSON.stringify cannot serialize", () => {
  assert.throws(() => serializeJsonLd(undefined), {
    name: "TypeError",
    message: "JSON-LD must be serializable",
  })
})
