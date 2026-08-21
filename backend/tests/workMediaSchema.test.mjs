import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../schemaTypes/work.ts', import.meta.url), 'utf8')

test('work media exposes a bounded landscape films carousel', () => {
  const galleryField = source.match(/name: 'videos'[\s\S]*?hidden: \(\{parent\}\)/)?.[0]

  assert.ok(galleryField)
  assert.match(source, /\{title: 'YouTube films carousel', value: 'gallery'\}/)
  assert.match(galleryField, /title: 'YouTube films'/)
  assert.match(source, /mode !== 'gallery'/)
  assert.match(source, /val\.length < 1/)
  assert.match(source, /val\.length > 6/)
  assert.match(
    source,
    /r\.required\(\)\.uri\(\{scheme: \['https'\]\}\)\.custom\(youtubeUrl\)/,
  )
  assert.match(source, /value\.trim\(\) \? true : 'Add a title'/)
  assert.match(galleryField, /name: 'posterImage'[\s\S]*?type: 'image'[\s\S]*?hotspot: true/)
  assert.match(galleryField, /name: 'poster'[\s\S]*?hidden: \(\{value\}\) => !value[\s\S]*?readOnly: true[\s\S]*?custom\(cloudinaryPosterUrl\)/)
  assert.match(galleryField, /legacyPoster && !posterImage[\s\S]*?uses legacy poster URL/)
  assert.match(galleryField, /media: posterImage/)
})

test('each YouTube reel can have its own optional poster', () => {
  const reelField = source.match(/name: 'reels'[\s\S]*?hidden: \(\{parent\}\)/)?.[0]

  assert.ok(reelField)
  assert.match(reelField, /title: 'YouTube reels'/)
  assert.match(reelField, /name: 'projectReel'/)
  assert.match(reelField, /name: 'youtubeUrl'[\s\S]*?r\.required\(\)[\s\S]*?custom\(youtubeUrl\)/)
  assert.match(reelField, /name: 'posterImage'[\s\S]*?type: 'image'[\s\S]*?hotspot: true/)
  assert.match(reelField, /name: 'poster'[\s\S]*?hidden: \(\{value\}\) => !value[\s\S]*?readOnly: true[\s\S]*?custom\(cloudinaryPosterUrl\)/)
  assert.match(reelField, /Falls back to the project card poster/)
  assert.match(reelField, /media: posterImage/)
  assert.doesNotMatch(reelField, /name: 'legacyReelUrl'/)
  assert.match(source, /mode !== 'slider'/)
  assert.match(source, /val\.length > 4/)
})
