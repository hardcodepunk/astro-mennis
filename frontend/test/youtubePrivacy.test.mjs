import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { videoObjectJsonLd } from "../src/lib/seo.ts"

const work = overrides => ({
  slug: "privacy-test",
  title: "Privacy test",
  category: "film",
  categorySlug: "film",
  client: "Example",
  year: "2026",
  preview: {
    poster: "https://res.cloudinary.com/example/image/upload/v1/privacy-test.jpg",
  },
  ...overrides,
})

test("YouTube JSON-LD uses privacy-enhanced embed URLs", () => {
  const single = videoObjectJsonLd({
    seo: undefined,
    work: work({
      media: { mode: "single", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    }),
    title: "Privacy test",
    description: "Privacy test video",
  })
  const slider = videoObjectJsonLd({
    seo: undefined,
    work: work({
      media: {
        mode: "slider",
        reels: ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/shorts/aqz-KE-bpKQ"],
      },
    }),
    title: "Privacy test",
    description: "Privacy test reels",
  })

  assert.deepEqual(single.map(item => item.embedUrl), [
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])
  assert.deepEqual(slider.map(item => item.embedUrl), [
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
  ])
})

test("server-rendered facades do not eagerly reference YouTube infrastructure", async () => {
  const [layout, display, workPage] = await Promise.all([
    readFile(new URL("../src/layouts/Layout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/WorkMediaDisplay.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/works/[slug].astro", import.meta.url), "utf8"),
  ])

  assert.doesNotMatch(layout, /<link\b[^>]*rel=["']preconnect["'][^>]*(?:youtube|ytimg|google)/i)
  assert.doesNotMatch(display, /(?:i\.ytimg\.com|youtubePoster|youtube-nocookie\.com|youtube\.com)/i)
  assert.match(display, /src=\{facadePosterSrc\}/)
  assert.match(display, /src:\s*work\.preview\.poster/)
  assert.match(display, />Play on YouTube<\/span>/)
  assert.match(display, /aria-label=\{`Play \$\{singleMediaLabel\} on YouTube`\}/)
  assert.doesNotMatch(workPage, /youtubePoster|i\.ytimg\.com/i)
  assert.match(workPage, /src:\s*work\.preview\.poster/)
})

test("Plyr enables privacy-enhanced mode without sharing the page path", async () => {
  const script = await readFile(
    new URL("../src/scripts/workMediaDisplayScript.ts", import.meta.url),
    "utf8",
  )

  assert.match(script, /noCookie:\s*true/)
  assert.match(script, /widget_referrer:\s*window\.location\.origin/)
  assert.doesNotMatch(script, /widget_referrer:\s*window\.location\.href/)
  assert.match(
    script,
    /session\.onOverlayClick[\s\S]*ensureYouTubeNoCookiePreconnect\(\)[\s\S]*runtime[\s\S]*\.loadYouTubeApi\(\)/,
  )
})
