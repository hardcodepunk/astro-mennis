import assert from "node:assert/strict"
import test from "node:test"

import {validateContentSnapshot} from "../src/lib/contentSnapshot.ts"
import {selectSitemapUrls, serializeSitemap} from "../src/lib/sitemap.ts"
import fixture from "./fixtures/content-snapshot.js"

test("selects only indexable singleton, category, and work routes", () => {
  const snapshot = validateContentSnapshot(fixture)

  assert.deepEqual(selectSitemapUrls(snapshot), [
    "https://example.test/",
    "https://example.test/projects/",
    "https://example.test/about/",
    "https://example.test/contact/",
    "https://example.test/projects/film/",
    "https://example.test/works/fixture-preview/",
    "https://example.test/works/fixture-single/",
  ])
})

test("applies every singleton noindex flag independently", () => {
  const snapshot = validateContentSnapshot({
    ...fixture,
    seoSettings: {
      ...fixture.seoSettings,
      homeNoindex: true,
      projectsNoindex: false,
      aboutNoindex: true,
      contactNoindex: true,
    },
  })
  const urls = selectSitemapUrls(snapshot)

  assert.equal(urls.includes("https://example.test/"), false)
  assert.equal(urls.includes("https://example.test/projects/"), true)
  assert.equal(urls.includes("https://example.test/about/"), false)
  assert.equal(urls.includes("https://example.test/contact/"), false)
})

test("honors self-canonical same-site targets and omits external canonicals", () => {
  const snapshot = validateContentSnapshot({
    ...fixture,
    seoSettings: {...fixture.seoSettings, siteUrl: "https://example.test///"},
    categories: fixture.categories.map(category => category.slug === "film"
      ? {...category, seo: {...category.seo, canonicalUrl: "/projects"}}
      : category),
    works: fixture.works.map(work => {
      if (work.slug === "fixture-preview") {
        return {
          ...work,
          seo: {
            ...work.seo,
            canonicalUrl: "https://example.test/works/fixture-preview?part=one&view=full#details",
          },
        }
      }
      if (work.slug === "fixture-single") {
        return {
          ...work,
          seo: {...work.seo, canonicalUrl: "https://elsewhere.test/fixture-single"},
        }
      }
      return work
    }),
  })
  const urls = selectSitemapUrls(snapshot)
  const xml = serializeSitemap(snapshot)

  assert.equal(urls.includes("https://example.test/projects/"), true)
  assert.equal(urls.includes("https://example.test/projects"), false)
  assert.equal(
    urls.includes("https://example.test/works/fixture-preview?part=one&view=full"),
    true,
  )
  assert.equal(urls.some(url => url.includes("elsewhere.test")), false)
  assert.match(xml, /part=one&amp;view=full/)
})

test("canonical overrides cannot reintroduce a noindex or unknown route", () => {
  const snapshot = validateContentSnapshot({
    ...fixture,
    works: fixture.works.map(work => {
      if (work.slug === "fixture-preview") {
        return {...work, seo: {...work.seo, canonicalUrl: "/projects/events"}}
      }
      if (work.slug === "fixture-single") {
        return {...work, seo: {...work.seo, canonicalUrl: "/not-a-generated-route"}}
      }
      return work
    }),
  })
  const urls = selectSitemapUrls(snapshot)

  assert.equal(urls.some(url => new URL(url).pathname === "/projects/events"), false)
  assert.equal(urls.some(url => new URL(url).pathname === "/not-a-generated-route"), false)
})

test("canonical overrides cannot reintroduce a route canonicalized elsewhere", () => {
  const snapshot = validateContentSnapshot({
    ...fixture,
    works: fixture.works.map(work => {
      if (work.slug === "fixture-preview") {
        return {...work, seo: {...work.seo, canonicalUrl: "/works/fixture-single"}}
      }
      if (work.slug === "fixture-single") {
        return {...work, seo: {...work.seo, canonicalUrl: "https://elsewhere.test/work"}}
      }
      return work
    }),
  })
  const urls = selectSitemapUrls(snapshot)

  assert.equal(urls.some(url => new URL(url).pathname === "/works/fixture-single"), false)
})

test("serializes a standards-based URL set without noindex fixture routes", () => {
  const xml = serializeSitemap(validateContentSnapshot(fixture))

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
  assert.doesNotMatch(xml, /projects\/events/)
  assert.doesNotMatch(xml, /works\/fixture-slider/)
})
