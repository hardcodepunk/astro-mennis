import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const componentPaths = [
  new URL("../src/components/CinematicHero.astro", import.meta.url),
  new URL("../src/components/VideoPreview.astro", import.meta.url),
  new URL("../src/components/WorkThumbnailCard.astro", import.meta.url),
  new URL("../src/pages/about.astro", import.meta.url),
]

test("background videos cannot start or fetch media before policy hydration", async () => {
  for (const path of componentPaths) {
    const source = await readFile(path, "utf8")
    const videoTags = source.match(/<video\b[\s\S]*?>/g) ?? []

    assert.ok(videoTags.length > 0, `${path.pathname} should contain a video`)
    videoTags.forEach(tag => {
      assert.doesNotMatch(tag, /\sautoplay(?:\s|=|>)/i, `${path.pathname} has native autoplay`)
      assert.match(tag, /\spreload="none"/, `${path.pathname} should start with preload=none`)
    })

    const sourceTags = source.match(/<source\b[\s\S]*?>/g) ?? []
    sourceTags.forEach(tag => {
      assert.doesNotMatch(tag, /\ssrc=/i, `${path.pathname} has an eager media source`)
      assert.match(tag, /\sdata-src=/i, `${path.pathname} should defer its media source`)
    })
  }
})

test("WebM sources are offered before MP4 fallbacks", async () => {
  for (const path of componentPaths) {
    const source = await readFile(path, "utf8")
    const webmIndex = source.indexOf('type="video/webm"')
    const mp4Index = source.indexOf('type="video/mp4"')

    if (webmIndex === -1 || mp4Index === -1) continue
    assert.ok(webmIndex < mp4Index, `${path.pathname} should prefer WebM`)
  }
})
