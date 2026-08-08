import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_APPROACH_PANEL,
  resolveTextPanel,
} from "../src/lib/contentDefaults.ts"

test("a missing text panel always uses the advertised defaults", () => {
  assert.deepEqual(
    resolveTextPanel(undefined, DEFAULT_APPROACH_PANEL, {
      useFallbackOnBlankText: false,
    }),
    DEFAULT_APPROACH_PANEL,
  )
})

test("an existing panel can intentionally keep blank text", () => {
  assert.deepEqual(
    resolveTextPanel(
      {
        kicker: " ",
        title: "",
        body: "\n",
        mirrorLayout: true,
      },
      DEFAULT_APPROACH_PANEL,
      { useFallbackOnBlankText: false },
    ),
    {
      kicker: "",
      title: "",
      body: "",
      mirrorLayout: true,
    },
  )
})
