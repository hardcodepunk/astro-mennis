import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const componentPath = new URL("../src/components/ContactReasons.astro", import.meta.url)

test("contact reason headings preserve line breaks entered in Sanity at every breakpoint", async () => {
  const source = await readFile(componentPath, "utf8")

  assert.match(source, /<LineBreakText text=\{safeTitle\} \/>/)
  assert.doesNotMatch(source, /flowingTitle|cr-title__formatted|cr-title__flow/)
})

test("contact reason heading lines stay together where they fit and wrap safely on narrow screens", async () => {
  const source = await readFile(componentPath, "utf8")

  assert.doesNotMatch(source, /max-width:\s*12ch/)
  assert.match(
    source,
    /\.cr-title\s*\{[^}]*max-width:\s*none;[^}]*white-space:\s*nowrap;/s,
  )
  assert.match(
    source,
    /@media \(max-width: 420px\)\s*\{\s*\.cr-title\s*\{[^}]*--ds-heading-title-size:\s*clamp\(1\.4rem, 7vw, 1\.8rem\);[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s,
  )
  assert.match(
    source,
    /@media \(min-width: 901px\)[\s\S]*?\.cr\.is-mirrored \.cr-inner:not\(\.is-list-only\)\s*\{[^}]*grid-template-columns:\s*minmax\(0, 0\.9fr\) minmax\(0, 1\.1fr\);/s,
  )
})
