import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSingletonDocumentActionsResolver,
  singletonActionNames,
} from '../singletonActions.ts'

const singletonTypeNames = [
  'seo',
  'siteSettings',
  'deploymentStatus',
  'bioWithPreview',
  'contactPage',
  'logoMarquee',
]

const editorialSingletonTypeNames = singletonTypeNames.filter(
  (schemaType) => schemaType !== 'deploymentStatus',
)

const expectedActionNames = ['publish', 'discardChanges', 'restore']

function documentAction(action) {
  const component = () => null
  component.action = action
  return component
}

function allDocumentActions() {
  return [
    documentAction('delete'),
    documentAction('publish'),
    documentAction('duplicate'),
    documentAction('discardChanges'),
    documentAction('unpublish'),
    documentAction('restore'),
    documentAction('unknown'),
    () => null,
  ]
}

test('allows only the safe singleton document actions', () => {
  assert.deepEqual([...singletonActionNames], expectedActionNames)
})

for (const schemaType of editorialSingletonTypeNames) {
  test(`protects the ${schemaType} singleton`, () => {
    const resolver = createSingletonDocumentActionsResolver(new Set(singletonTypeNames))
    const actions = allDocumentActions()

    const resolved = resolver(actions, {schemaType})

    assert.deepEqual(
      resolved.map((action) => action.action),
      expectedActionNames,
    )
    assert.equal(resolved[0], actions[1])
    assert.equal(resolved[1], actions[3])
    assert.equal(resolved[2], actions[5])
  })
}

test('exposes no document actions for the automation-owned deployment status', () => {
  const resolver = createSingletonDocumentActionsResolver(new Set(singletonTypeNames))

  assert.deepEqual(resolver(allDocumentActions(), {schemaType: 'deploymentStatus'}), [])
})

test('leaves non-singleton document actions unchanged', () => {
  const resolver = createSingletonDocumentActionsResolver(new Set(singletonTypeNames))
  const actions = allDocumentActions()

  const resolved = resolver(actions, {schemaType: 'work'})

  assert.equal(resolved, actions)
})
