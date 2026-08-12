import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../schemaTypes/work.ts', import.meta.url), 'utf8')

test('work media exposes a bounded landscape films carousel', () => {
  assert.match(source, /\{title: 'YouTube films carousel', value: 'gallery'\}/)
  assert.match(source, /name: 'videos'[\s\S]*?title: 'YouTube films'/)
  assert.match(source, /mode !== 'gallery'/)
  assert.match(source, /val\.length < 1/)
  assert.match(source, /val\.length > 6/)
  assert.match(
    source,
    /r\.required\(\)\.uri\(\{scheme: \['https'\]\}\)\.custom\(youtubeUrl\)/,
  )
  assert.match(source, /value\.trim\(\) \? true : 'Add a title'/)
  assert.match(source, /\.custom\(cloudinaryPosterUrl\)/)
})
