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
  const gallery = videoObjectJsonLd({
    seo: undefined,
    work: work({
      media: {
        mode: "gallery",
        videos: [
          {title: "Main film", youtubeUrl: "https://youtu.be/dQw4w9WgXcQ"},
          {title: "Second cut", youtubeUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ"},
        ],
      },
    }),
    title: "Privacy test",
    description: "Privacy test gallery",
  })

  assert.deepEqual(single.map(item => item.embedUrl), [
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])
  assert.deepEqual(slider.map(item => item.embedUrl), [
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
  ])
  assert.deepEqual(gallery.map(item => [item.name, item.embedUrl]), [
    ["Main film", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["Second cut", "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ"],
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
  assert.doesNotMatch(display, /yt-overlay__provider|>Play on YouTube<\/span>/)
  assert.match(display, /aria-label=\{`Play \$\{singleMediaLabel\} on YouTube`\}/)
  assert.match(display, /class="yt-rail yt-rail--landscape" data-yt-rail/)
  assert.match(display, /class="yt-slide yt-slide--landscape"/)
  assert.match(display, /class="yt-gallery__pagination" data-yt-pagination/)
  assert.match(display, /data-yt-dot/)
  assert.match(display, /\.yt-gallery__dot\s*\{[\s\S]*?width:\s*10px;[\s\S]*?height:\s*10px;[\s\S]*?var\(--color-brand-secondary\)/)
  assert.match(display, /\.yt-gallery__dot\.is-active\s*\{[\s\S]*?var\(--color-brand-accent\)/)
  assert.doesNotMatch(display, /\.yt-gallery__dot\s*\{[^}]*opacity:/)
  assert.doesNotMatch(display, /\{index \+ 1\} \/ \{galleryItems\.length\}/)
  assert.match(display, /src:\s*video\.poster \?\? work\.preview\.poster/)
  assert.match(display, /\.yt-slide--landscape\s*\{[\s\S]*?flex:\s*0 0 100%/)
  assert.doesNotMatch(workPage, /youtubePoster|i\.ytimg\.com/i)
  assert.match(workPage, /work\.media\.videos\[0\]\?\.poster \?\? work\.preview\.poster/)
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
