import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

test('document SEO fields contain only public page metadata', () => {
  const source = readFileSync(new URL('../schemaTypes/shared.ts', import.meta.url), 'utf8')
  const start = source.indexOf('export function defineDocumentSeoFields')
  const end = source.indexOf('type CloudinaryVideoFieldOptions', start)
  const fieldNames = Array.from(source.slice(start, end).matchAll(/name: '([^']+)'/g), (match) =>
    match[1],
  )

  assert.deepEqual(fieldNames, [
    'title',
    'description',
    'socialImage',
    'socialImageAlt',
    'canonicalUrl',
    'noindex',
  ])
})
