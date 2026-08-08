import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { extname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const frontendRoot = fileURLToPath(new URL("../", import.meta.url))
const sourceRoot = join(frontendRoot, "src")
const vercelConfig = JSON.parse(readFileSync(join(frontendRoot, "vercel.json"), "utf8"))
const allRoutesRule = vercelConfig.headers?.find(rule => rule.source === "/(.*)")
const responseHeaders = Object.fromEntries(
  (allRoutesRule?.headers ?? []).map(({ key, value }) => [key.toLowerCase(), value]),
)

function parseCsp(value) {
  return Object.fromEntries(
    value
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [directive, ...sources] = part.split(/\s+/)
        return [directive, sources]
      }),
  )
}

function collectFiles(directory, extension) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectFiles(path, extension)
    return extname(entry.name) === extension ? [path] : []
  })
}

test("applies the required browser security headers to every deployment path", () => {
  assert.ok(allRoutesRule, "vercel.json must define an all-routes header rule")
  assert.equal(responseHeaders["x-content-type-options"], "nosniff")
  assert.equal(responseHeaders["referrer-policy"], "strict-origin-when-cross-origin")
  assert.equal(responseHeaders["x-frame-options"], "DENY")
  assert.equal(
    responseHeaders["permissions-policy"],
    "browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  )
})

test("keeps the CSP script policy strict and limits runtime origins", () => {
  const csp = parseCsp(responseHeaders["content-security-policy"] ?? "")

  assert.deepEqual(csp["default-src"], ["'self'"])
  assert.deepEqual(csp["base-uri"], ["'self'"])
  assert.deepEqual(csp["object-src"], ["'none'"])
  assert.deepEqual(csp["frame-ancestors"], ["'none'"])
  assert.deepEqual(csp["form-action"], ["'self'"])
  assert.deepEqual(csp["script-src"], ["'self'", "https://www.youtube.com"])
  assert.deepEqual(csp["script-src-attr"], ["'none'"])
  assert.equal(csp["script-src"].includes("'unsafe-inline'"), false)
  assert.equal(csp["script-src"].includes("'unsafe-eval'"), false)
  assert.equal(csp["script-src"].includes("*"), false)

  assert.deepEqual(csp["img-src"], [
    "'self'",
    "data:",
    "blob:",
    "https://res.cloudinary.com",
    "https://cdn.sanity.io",
  ])
  assert.deepEqual(csp["media-src"], ["'self'", "blob:", "https://res.cloudinary.com"])
  assert.deepEqual(csp["connect-src"], [
    "'self'",
    "https://res.cloudinary.com",
    "https://cdn.plyr.io",
    "https://noembed.com",
    "https://www.youtube-nocookie.com",
  ])
  assert.deepEqual(csp["frame-src"], ["https://www.youtube-nocookie.com"])
  assert.deepEqual(csp["font-src"], ["'self'"])
  assert.deepEqual(csp["manifest-src"], ["'self'"])
  assert.deepEqual(csp["worker-src"], ["'self'", "blob:"])
  assert.deepEqual(csp["upgrade-insecure-requests"], [])
})

test("Astro templates contain no executable inline scripts or event handlers", () => {
  for (const path of collectFiles(sourceRoot, ".astro")) {
    const source = readFileSync(path, "utf8")
    const relativePath = path.slice(frontendRoot.length)

    for (const match of source.matchAll(/<script\b([^>]*)>/gi)) {
      const attributes = match[1]
      const isJsonLd = /\btype\s*=\s*["']application\/ld\+json["']/i.test(attributes)
      const hasBundledSource = /\bsrc\s*=/.test(attributes)
      assert.ok(
        isJsonLd || hasBundledSource,
        `${relativePath} contains an executable script without a bundled src`,
      )
    }

    assert.doesNotMatch(source, /<script\b[^>]*\bdefine:vars\b/i, relativePath)
    assert.doesNotMatch(source, /\son[a-z][\w:-]*\s*=/i, relativePath)
  }
})

test("dynamic component data is passed to bundled modules through inert data attributes", () => {
  const header = readFileSync(join(sourceRoot, "components", "Header.astro"), "utf8")
  const contact = readFileSync(join(sourceRoot, "components", "ContactTypewriter.astro"), "utf8")
  const layout = readFileSync(join(sourceRoot, "layouts", "Layout.astro"), "utf8")
  const siteScript = readFileSync(join(sourceRoot, "scripts", "site.ts"), "utf8")

  assert.match(header, /data-transparent-paths=/)
  assert.match(contact, /data-sentences=/)
  assert.match(layout, /<script src="\.\.\/scripts\/site\.ts"><\/script>/)
  assert.match(siteScript, /import "\.\/header"/)
  assert.match(siteScript, /import "\.\/contactTypewriter"/)
  assert.match(siteScript, /import "\.\/videoAutoplay"/)
})
