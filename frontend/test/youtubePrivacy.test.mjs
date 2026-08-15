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
  const [layout, display, workPage, globalStyles, projectGrid] = await Promise.all([
    readFile(new URL("../src/layouts/Layout.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/WorkMediaDisplay.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/works/[slug].astro", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/global.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/ProjectGrid.astro", import.meta.url), "utf8"),
  ])

  assert.doesNotMatch(layout, /<link\b[^>]*rel=["']preconnect["'][^>]*(?:youtube|ytimg|google)/i)
  assert.doesNotMatch(display, /(?:i\.ytimg\.com|youtubePoster|youtube-nocookie\.com|youtube\.com)/i)
  assert.match(display, /src=\{facadePosterSrc\}/)
  assert.match(display, /src:\s*work\.preview\.poster/)
  assert.doesNotMatch(display, /yt-overlay__provider|>Play on YouTube<\/span>/)
  assert.match(display, /aria-label=\{`Play \$\{singleMediaLabel\} on YouTube`\}/)
  assert.match(display, /class="yt-rail yt-rail--landscape" data-yt-rail/)
  assert.match(display, /class="yt-slide yt-slide--landscape"/)
  const paginationTag = display.match(
    /<div\s+class="yt-gallery__pagination"[\s\S]*?>/,
  )?.[0]
  assert.ok(paginationTag)
  assert.match(paginationTag, /data-yt-pagination/)
  assert.match(paginationTag, /role="group"/)
  assert.match(paginationTag, /aria-label="Choose a video"/)
  assert.doesNotMatch(paginationTag, /aria-hidden/)
  assert.match(
    display,
    /<button[\s\S]*?type="button"[\s\S]*?class:list=\{\["yt-gallery__dot"[\s\S]*?aria-label=\{`Go to video \$\{index \+ 1\}: \$\{video\.title\}`\}[\s\S]*?aria-current=\{index === 0 \? "true" : undefined\}[\s\S]*?data-yt-dot/,
  )
  assert.match(
    display,
    /class="yt-status sr-only"[\s\S]*?data-yt-status[\s\S]*?role="status"[\s\S]*?aria-live="polite"/,
  )
  assert.match(
    display,
    /class="yt-retry ds-pill ds-kicker ds-kicker--compact"[\s\S]*?data-yt-retry/,
  )
  assert.doesNotMatch(display, /data-yt-fallback|class="yt-fallback|\.yt-fallback/)
  assert.match(
    display,
    /class="yt-gallery__control yt-gallery__control--prev ds-pill ds-kicker ds-kicker--compact"[\s\S]*?class="yt-gallery__control-icon yt-gallery__control-icon--prev"[\s\S]*?<path d="M8 4L16 12L8 20" \/>[\s\S]*?<\/button>/,
  )
  assert.match(display, /aria-label="Previous video"\s+data-yt-prev\s+hidden/)
  assert.match(display, /aria-label="Previous reel"\s+data-yt-prev\s+hidden/)
  assert.match(
    display,
    /class="yt-gallery__control yt-gallery__control--next ds-pill ds-kicker ds-kicker--compact"[\s\S]*?class="yt-gallery__control-icon"[\s\S]*?<path d="M8 4L16 12L8 20" \/>[\s\S]*?<\/button>/,
  )
  assert.match(
    display,
    /\.yt-gallery__control-icon\s*\{[\s\S]*?stroke:\s*currentColor;[\s\S]*?stroke-width:\s*3;[\s\S]*?stroke-linecap:\s*round;[\s\S]*?stroke-linejoin:\s*round;/,
  )
  assert.doesNotMatch(display, /yt-gallery__control[^\"]*ds-progress-link/)
  assert.match(projectGrid, /class="ds-pill ds-kicker ds-kicker--compact/)
  assert.match(
    globalStyles,
    /\.ds-pill\s*\{[\s\S]*?min-height:\s*48px;[\s\S]*?border-radius:\s*999px;[\s\S]*?transition:/,
  )
  assert.match(
    globalStyles,
    /\.ds-pill:not\(\.is-active\):hover,[\s\S]*?\.ds-pill:not\(\.is-active\):focus-visible[\s\S]*?background:\s*var\(--color-brand-secondary\);[\s\S]*?color:\s*var\(--color-brand-primary\);/,
  )
  const feedbackRule = display.match(/\.yt-feedback\s*\{[^}]*\}/)?.[0]
  assert.ok(feedbackRule)
  assert.match(feedbackRule, /position:\s*absolute;/)
  assert.match(feedbackRule, /inset:\s*0;/)
  assert.match(feedbackRule, /align-items:\s*center;/)
  assert.match(feedbackRule, /justify-content:\s*center;/)
  assert.match(feedbackRule, /pointer-events:\s*none;/)
  assert.doesNotMatch(feedbackRule, /(?:top|left):\s*12px;/)
  const feedbackControlRule = display.match(
    /\.yt-retry\s*\{[^}]*\}/,
  )?.[0]
  assert.ok(feedbackControlRule)
  assert.match(feedbackControlRule, /min-height:\s*48px;/)
  assert.match(feedbackControlRule, /background:\s*var\(--color-brand-primary\);/)
  assert.match(feedbackControlRule, /pointer-events:\s*auto;/)
  assert.doesNotMatch(feedbackControlRule, /rgba\(0,\s*0,\s*0/)
  assert.match(
    display,
    /\.yt-retry:hover,\s*\.yt-retry:focus-visible\s*\{[^}]*background:\s*var\(--color-brand-secondary\);[^}]*color:\s*var\(--color-brand-primary\);/,
  )
  assert.match(
    display,
    /\.yt-frame\[data-yt-feedback-state="error"\] \.yt-overlay__play,\s*\.yt-frame\[data-yt-feedback-state="unavailable"\] \.yt-overlay__play\s*\{\s*display:\s*none;/,
  )
  const facadePlayRule = display.match(/\.yt-overlay__play\s*\{[^}]*\}/)?.[0]
  assert.ok(facadePlayRule)
  assert.match(facadePlayRule, /width:\s*64px;/)
  assert.match(facadePlayRule, /height:\s*64px;/)
  assert.match(facadePlayRule, /border:\s*2px solid var\(--color-brand-secondary\);/)
  assert.match(facadePlayRule, /border-radius:\s*50%;/)
  assert.match(facadePlayRule, /background-color:\s*var\(--color-brand-secondary\);/)
  assert.match(
    facadePlayRule,
    /transition:\s*border-color 220ms ease,\s*background-color 220ms ease;/,
  )
  assert.doesNotMatch(facadePlayRule, /box-shadow/)
  const facadePlayIconRule = display.match(/\.yt-overlay__play::after\s*\{[^}]*\}/)?.[0]
  assert.ok(facadePlayIconRule)
  assert.match(facadePlayIconRule, /border-left:\s*18px solid #fff;/)
  assert.match(facadePlayIconRule, /transition:\s*border-left-color 220ms ease;/)
  const facadePlayInteractionRule = display.match(
    /\.yt-overlay:hover \.yt-overlay__play,\s*\.yt-overlay:focus-visible \.yt-overlay__play\s*\{[^}]*\}/,
  )?.[0]
  assert.ok(facadePlayInteractionRule)
  assert.match(
    facadePlayInteractionRule,
    /border-color:\s*var\(--color-brand-secondary\);/,
  )
  assert.match(
    facadePlayInteractionRule,
    /background-color:\s*var\(--color-brand-accent\);/,
  )
  assert.doesNotMatch(facadePlayInteractionRule, /box-shadow/)
  assert.match(
    display,
    /\.yt-overlay:hover \.yt-overlay__play::after,\s*\.yt-overlay:focus-visible \.yt-overlay__play::after\s*\{[^}]*border-left-color:\s*var\(--color-brand-secondary\);/,
  )
  assert.match(
    display,
    /\.yt-gallery__dot\s*\{[\s\S]*?appearance:\s*none;[\s\S]*?display:\s*grid;[\s\S]*?flex:\s*0 0 32px;[\s\S]*?width:\s*32px;[\s\S]*?height:\s*32px;[\s\S]*?cursor:\s*pointer;[\s\S]*?touch-action:\s*manipulation;/,
  )
  assert.match(
    display,
    /\.yt-gallery__dot::before\s*\{[\s\S]*?box-sizing:\s*content-box;[\s\S]*?width:\s*10px;[\s\S]*?height:\s*10px;[\s\S]*?border:\s*2px solid transparent;[\s\S]*?background-color:\s*var\(--color-brand-secondary\);[\s\S]*?background-clip:\s*padding-box;[\s\S]*?transition:\s*border-color 220ms ease,\s*background-color 220ms ease;/,
  )
  const dotInteractionRule = display.match(
    /\.yt-gallery__dot(?:\.is-active|:hover|:focus-visible)::before,\s*\.yt-gallery__dot(?:\.is-active|:hover|:focus-visible)::before,\s*\.yt-gallery__dot(?:\.is-active|:hover|:focus-visible)::before\s*\{[^}]*\}/,
  )?.[0]
  assert.ok(dotInteractionRule)
  assert.match(dotInteractionRule, /\.yt-gallery__dot\.is-active::before/)
  assert.match(dotInteractionRule, /\.yt-gallery__dot:hover::before/)
  assert.match(dotInteractionRule, /\.yt-gallery__dot:focus-visible::before/)
  assert.match(dotInteractionRule, /border-color:\s*var\(--color-brand-secondary\);/)
  assert.match(dotInteractionRule, /background-color:\s*var\(--color-brand-accent\);/)
  assert.doesNotMatch(dotInteractionRule, /(?:opacity|width|height|transform)\s*:/)
  assert.match(
    display,
    /\.yt-gallery__dot:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--color-brand-accent\);[\s\S]*?outline-offset:\s*-4px;/,
  )
  assert.match(
    display,
    /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.yt-gallery__dot::before\s*\{[\s\S]*?transition:\s*none;/,
  )
  assert.match(
    display,
    /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.yt-overlay__play\s*\{[\s\S]*?transition:\s*none;/,
  )
  assert.match(
    display,
    /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.yt-overlay__play::after\s*\{[\s\S]*?transition:\s*none;/,
  )
  assert.doesNotMatch(display, /\.yt-gallery__dot\s*\{[^}]*opacity:/)
  assert.doesNotMatch(display, /\{index \+ 1\} \/ \{galleryItems\.length\}/)
  assert.match(display, /src:\s*video\.poster \?\? work\.preview\.poster/)
  assert.match(display, /\.yt-slide--landscape\s*\{[\s\S]*?flex:\s*0 0 100%/)
  assert.match(
    display,
    /class="yt-embed"[\s\S]*?data-yt-embed[\s\S]*?data-yt-video-id=\{youtubeId\}[\s\S]*?inert[\s\S]*?aria-hidden="true"/,
  )
  assert.match(
    display,
    /\.yt-embed\[inert\]\s*\{[\s\S]*?pointer-events:\s*none;/,
  )
  assert.match(
    display,
    /\.yt-embed\s+:global\(iframe\)\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?border:\s*0;/,
  )
  assert.match(display, /\.yt-overlay\[hidden\]\s*\{\s*display:\s*none;/)
  assert.doesNotMatch(display, /plyr/i)
  assert.doesNotMatch(workPage, /youtubePoster|i\.ytimg\.com/i)
  assert.match(workPage, /work\.media\.videos\[0\]\?\.poster \?\? work\.preview\.poster/)
})

test("media galleries share circular pill-chevron navigation without Plyr", async () => {
  const [display, script, packageSource, lockSource] = await Promise.all([
    readFile(new URL("../src/components/WorkMediaDisplay.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/workMediaDisplayScript.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
  ])

  const reelBranchStart = display.indexOf(") : hasSlider ? (")
  const reelBranchEnd = display.indexOf(") : (", reelBranchStart + 1)
  assert.notEqual(reelBranchStart, -1)
  assert.notEqual(reelBranchEnd, -1)
  const reelBranch = display.slice(reelBranchStart, reelBranchEnd)

  assert.match(reelBranch, /<section class="yt-gallery yt-gallery--reels" aria-label="Reels">/)

  const railIndex = reelBranch.indexOf('<div class="yt-rail" data-yt-rail>')
  const controlsIndex = reelBranch.indexOf(
    '<div class="yt-gallery__controls--reels" role="group" aria-label="Reel navigation">',
  )
  assert.notEqual(railIndex, -1)
  assert.ok(controlsIndex > railIndex, "the reel controls must follow the reel rail in DOM order")

  const controls = reelBranch.match(
    /<div class="yt-gallery__controls--reels" role="group" aria-label="Reel navigation">[\s\S]*?<\/div>/,
  )?.[0]
  assert.ok(controls)
  assert.match(
    controls,
    /class="yt-gallery__control yt-gallery__control--prev ds-pill ds-kicker ds-kicker--compact"[\s\S]*?aria-label="Previous reel"[\s\S]*?data-yt-prev[\s\S]*?hidden[\s\S]*?class="yt-gallery__control-icon yt-gallery__control-icon--prev"[\s\S]*?<path d="M8 4L16 12L8 20" \/>/,
  )
  assert.match(
    controls,
    /class="yt-gallery__control yt-gallery__control--next ds-pill ds-kicker ds-kicker--compact"[\s\S]*?aria-label="Next reel"[\s\S]*?data-yt-next[\s\S]*?class="yt-gallery__control-icon"[\s\S]*?<path d="M8 4L16 12L8 20" \/>/,
  )
  assert.doesNotMatch(reelBranch, /data-yt-dot|yt-gallery__pagination/)
  assert.doesNotMatch(display, /(?:class="yt-nav|\.yt-nav(?:__|--|\s|\{))/)

  const controlsRule = display.match(/\.yt-gallery__controls--reels\s*\{[^}]*\}/)?.[0]
  assert.ok(controlsRule)
  assert.match(controlsRule, /position:\s*absolute;/)
  assert.match(controlsRule, /inset:\s*0 -29px;/)
  assert.match(controlsRule, /z-index:\s*30;/)
  assert.match(controlsRule, /display:\s*grid;/)
  assert.match(controlsRule, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/)
  assert.match(controlsRule, /align-items:\s*center;/)
  assert.match(controlsRule, /pointer-events:\s*none;/)
  assert.doesNotMatch(controlsRule, /(?:margin-top|min-height|padding-top):/)
  assert.match(
    display,
    /\.yt-gallery__controls--reels \.yt-gallery__control\s*\{[^}]*position:\s*static;[^}]*pointer-events:\s*auto;/,
  )
  assert.match(
    display,
    /\.yt-gallery__controls--reels \.yt-gallery__control--prev\s*\{[^}]*grid-column:\s*1;[^}]*justify-self:\s*start;/,
  )
  assert.match(
    display,
    /\.yt-gallery__controls--reels \.yt-gallery__control--next\s*\{[^}]*grid-column:\s*2;[^}]*justify-self:\s*end;/,
  )
  assert.match(
    display,
    /@media \(max-width:\s*700px\)\s*\{[\s\S]*?\.yt-gallery__controls--reels\s*\{[^}]*inset-inline:\s*12px;/,
  )
  assert.match(
    display,
    /@media \(max-width:\s*700px\)\s*\{[\s\S]*?\.yt-gallery__controls--reels \.yt-gallery__control\s*\{[^}]*border-color:\s*var\(--color-brand-accent\);/,
  )

  const sharedControlRule = display.match(/\.yt-gallery__control\s*\{[^}]*\}/)?.[0]
  assert.ok(sharedControlRule)
  assert.match(sharedControlRule, /position:\s*absolute;/)
  assert.match(sharedControlRule, /bottom:\s*10px;/)
  assert.match(sharedControlRule, /display:\s*grid;/)
  assert.match(sharedControlRule, /place-items:\s*center;/)
  assert.match(sharedControlRule, /width:\s*48px;/)
  assert.match(sharedControlRule, /height:\s*48px;/)
  assert.match(sharedControlRule, /min-height:\s*48px;/)
  assert.match(sharedControlRule, /padding:\s*0;/)
  assert.match(
    sharedControlRule,
    /border:\s*2px solid var\(--color-brand-secondary\);/,
  )
  assert.match(sharedControlRule, /border-radius:\s*50%;/)
  assert.match(
    sharedControlRule,
    /background-color:\s*var\(--color-brand-secondary\);/,
  )
  assert.match(sharedControlRule, /color:\s*#fff;/)
  assert.match(
    sharedControlRule,
    /transition:\s*border-color 220ms ease,\s*background-color 220ms ease,\s*color 220ms ease;/,
  )
  assert.match(
    display,
    /\.yt-gallery__control\[hidden\]\s*\{\s*display:\s*none;/,
    "the component display rule must not override the native hidden state",
  )

  const sharedControlInteractionRule = display.match(
    /\.yt-gallery__control:hover,\s*\.yt-gallery__control:focus-visible\s*\{[^}]*\}/,
  )?.[0]
  assert.ok(sharedControlInteractionRule)
  assert.match(
    sharedControlInteractionRule,
    /background-color:\s*var\(--color-brand-accent\);/,
  )
  assert.match(
    sharedControlInteractionRule,
    /color:\s*var\(--color-brand-secondary\);/,
  )

  const railRule = display.match(/\.yt-rail\s*\{[^}]*\}/)?.[0]
  assert.ok(railRule)
  assert.match(railRule, /overflow-x:\s*auto;/)
  assert.match(railRule, /touch-action:\s*auto;/)
  assert.doesNotMatch(railRule, /touch-action:\s*pan-x;/)

  assert.match(display, /\.yt-rail--landscape\s*\{[^}]*padding-bottom:\s*38px;/)
  assert.match(
    display,
    /@media \(max-width:\s*700px\)\s*\{[\s\S]*?\.yt-gallery__control\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;[^}]*min-height:\s*40px;/,
  )
  assert.match(
    display,
    /@media \(max-width:\s*700px\)\s*\{[\s\S]*?\.yt-gallery--landscape \.yt-gallery__control\s*\{[^}]*bottom:\s*14px;/,
  )
  assert.match(
    display,
    /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.yt-gallery__control\s*\{[^}]*transition:\s*none;/,
  )

  const packageJson = JSON.parse(packageSource)
  const packageLock = JSON.parse(lockSource)
  assert.equal(packageJson.dependencies?.plyr, undefined)
  assert.equal(packageJson.devDependencies?.plyr, undefined)
  assert.equal(packageLock.packages?.["node_modules/plyr"], undefined)
  assert.doesNotMatch(display, /plyr/i)
  assert.doesNotMatch(script, /(?:import\s+Plyr|new\s+Plyr|plyr\/dist)/)
})

test("native YouTube uses privacy-enhanced embeds without sharing the page path", async () => {
  const [script, playerState] = await Promise.all([
    readFile(new URL("../src/scripts/workMediaDisplayScript.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/workMediaPlayerState.ts", import.meta.url), "utf8"),
  ])

  assert.doesNotMatch(script, /(?:import\s+Plyr|new\s+Plyr|plyr\/dist)/)
  assert.match(script, /youtubeNoCookieOrigin\s*=\s*"https:\/\/www\.youtube-nocookie\.com"/)
  assert.match(script, /controls:\s*"1"/)
  assert.match(script, /playsinline:\s*"1"/)
  assert.match(script, /enablejsapi:\s*"1"/)
  assert.match(script, /rel:\s*"0"/)
  assert.match(script, /origin:\s*window\.location\.origin/)
  assert.match(script, /widget_referrer:\s*window\.location\.origin/)
  assert.doesNotMatch(script, /widget_referrer:\s*window\.location\.href/)
  assert.match(script, /iframe\.referrerPolicy\s*=\s*"strict-origin-when-cross-origin"/)
  assert.match(script, /iframe\.allowFullscreen\s*=\s*true/)
  assert.match(script, /runtime\.createPlayer\(iframe,\s*\{[\s\S]*?events:/)
  assert.match(script, /session\.frame\.dataset\.ytFeedbackState\s*=\s*state/)
  assert.match(script, /delete session\.frame\.dataset\.ytFeedbackState/)
  assert.doesNotMatch(script, /\[data-yt-fallback\]|\.fallback\b/)
  assert.doesNotMatch(playerState, /\bfallback\b/)
  assert.match(
    script,
    /session\.onOverlayClick[\s\S]*ensureYouTubeNoCookiePreconnect\(\)[\s\S]*runtime[\s\S]*\.loadYouTubeApi\(\)/,
  )
})
