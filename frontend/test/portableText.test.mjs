import assert from "node:assert/strict"
import test from "node:test"

import {
  portableTextToHtml,
  sanitizePortableTextHtml,
} from "../src/lib/portableText.ts"
import { validatePortableTextBody } from "../src/lib/sanity.contract.ts"

const sanityImageUrl = "https://cdn.sanity.io/images/454gxa26/production/example-1200x800.jpg"

function textBlock(overrides = {}) {
  return {
    _key: "block-1",
    _type: "block",
    style: "normal",
    markDefs: [],
    children: [{ _key: "span-1", _type: "span", text: "Safe text", marks: [] }],
    ...overrides,
  }
}

test("validates and renders the supported Portable Text allowlist", () => {
  const body = validatePortableTextBody(
    [
      textBlock({
        style: "h2",
        markDefs: [{ _key: "link-1", _type: "link", href: "https://example.com/work" }],
        children: [
          {
            _key: "span-1",
            _type: "span",
            text: "Hello <world>",
            marks: ["strong", "em", "code", "underline", "strike-through", "link-1"],
          },
        ],
      }),
      {
        _key: "image-1",
        _type: "inlineImage",
        alt: 'Portrait "detail" <test>',
        caption: "Caption <script>alert(1)</script>",
        crop: { top: 0.1, bottom: 0.1, left: 0.2, right: 0.2 },
        hotspot: { x: 0.5, y: 0.5, width: 0.4, height: 0.4 },
        asset: {
          url: sanityImageUrl,
          metadata: { dimensions: { width: 1200, height: 800 } },
        },
      },
    ],
    "work.body",
  )

  const html = portableTextToHtml(body)

  assert.match(html, /<h2>/)
  assert.match(html, /<strong>/)
  assert.match(html, /<em>/)
  assert.match(html, /<code>/)
  assert.match(html, /<u>/)
  assert.match(html, /<del>/)
  assert.match(html, /href="https:\/\/example\.com\/work"/)
  assert.match(html, /Hello &lt;world&gt;/)
  assert.equal(html.includes(`src="${sanityImageUrl}?auto=format`), true)
  assert.match(html, /rect=240%2C80%2C720%2C640/)
  assert.deepEqual(body[1].hotspot, { x: 0.5, y: 0.5, width: 0.4, height: 0.4 })
  assert.match(html, /alt="Portrait &quot;detail&quot; &lt;test&gt;"/)
  assert.match(html, /Caption &lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

test("rejects and safely drops unknown top-level types", () => {
  const body = [{ _key: "attack", _type: 'evil"><img src=x onerror=alert(1)>' }]

  assert.throws(() => validatePortableTextBody(body, "work.body"), /work\.body\[0\]\._type/)
  assert.equal(portableTextToHtml(body), "")
})

test("rejects and safely unwraps unknown decorators and mark definitions", () => {
  const unknownDecorator = [
    textBlock({
      children: [
        {
          _key: "span-1",
          _type: "span",
          text: "Still safe",
          marks: ['evil"><img src=x onerror=alert(1)>'],
        },
      ],
    }),
  ]
  const unknownMarkDefinition = [
    textBlock({
      markDefs: [{ _key: "attack", _type: 'evil"><img src=x onerror=alert(1)>' }],
      children: [{ _key: "span-1", _type: "span", text: "Still safe", marks: ["attack"] }],
    }),
  ]

  assert.throws(() => validatePortableTextBody(unknownDecorator, "work.body"), /marks\[0\] references an unknown mark/)
  assert.throws(() => validatePortableTextBody(unknownMarkDefinition, "work.body"), /markDefs\[0\]\._type/)

  for (const body of [unknownDecorator, unknownMarkDefinition]) {
    const html = portableTextToHtml(body)
    assert.match(html, /Still safe/)
    assert.equal(/<img|onerror|unknown__pt__/i.test(html), false)
  }
})

test("unwraps unsupported links and rejects unsafe images at the content boundary", () => {
  for (const href of ["", "javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.example/path"]) {
    const body = [
      textBlock({
        markDefs: [{ _key: "link-1", _type: "link", href }],
        children: [{ _key: "span-1", _type: "span", text: "Link", marks: ["link-1"] }],
      }),
    ]
    const validated = validatePortableTextBody(body, "work.body")
    assert.equal(validated[0].markDefs[0].href, undefined)
    assert.equal(/href=/i.test(portableTextToHtml(validated)), false)
  }

  const unsafeImage = [
    {
      _key: "image-1",
      _type: "inlineImage",
      alt: "Unsafe image",
      asset: { url: "https://evil.example/attack.svg" },
    },
  ]
  assert.throws(() => validatePortableTextBody(unsafeImage, "work.body"), /asset\.url/)
  assert.equal(portableTextToHtml(unsafeImage), "")
})

test("sanitizes the final HTML with explicit tag, attribute, and URL allowlists", () => {
  const dirty = `
    </ScRiPt><script>alert(1)</script>
    <svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>
    <math><mtext><img src=x onerror=alert(1)></mtext></math>
    <p style="background:url(javascript:alert(1))" onclick="alert(1)">safe</p>
    <a href="javascript:alert(1)" class="attack">bad link</a>
    <a href="https://example.com/path">good link</a>
    <img src="data:image/svg+xml,<svg onload=alert(1)>" onerror="alert(1)">
    <img src="${sanityImageUrl}" srcset="https://attacker.example/pixel.jpg 1x, ${sanityImageUrl} 2x" alt="safe">
  `

  const clean = sanitizePortableTextHtml(dirty)

  assert.equal(/<script|<svg|<foreignObject|<math|onerror|onclick|style=|javascript:|data:/i.test(clean), false)
  assert.match(clean, /<p>safe<\/p>/)
  assert.match(clean, /<a>bad link<\/a>/)
  assert.match(clean, /<a href="https:\/\/example\.com\/path">good link<\/a>/)
  assert.match(clean, new RegExp(`<img src="${sanityImageUrl.replaceAll(".", "\\.")}"`))
  assert.equal(clean.includes("srcset="), false)
  assert.equal(clean.includes("attacker.example"), false)
})

test("preserves safe relative and contact links", () => {
  const clean = sanitizePortableTextHtml(
    '<a href="/projects">Projects</a><a href="mailto:hello@example.com">Email</a><a href="tel:+321234">Call</a>',
  )

  assert.match(clean, /href="\/projects"/)
  assert.match(clean, /href="mailto:hello@example\.com"/)
  assert.match(clean, /href="tel:\+321234"/)
})
