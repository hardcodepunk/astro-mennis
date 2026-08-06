import type {DocumentActionsResolver} from 'sanity'

export const singletonActionNames: ReadonlySet<string> = new Set([
  'publish',
  'discardChanges',
  'restore',
])

const automationOwnedSingletonTypeNames: ReadonlySet<string> = new Set(['deploymentStatus'])

export function createSingletonDocumentActionsResolver(
  singletonTypeNames: ReadonlySet<string>,
): DocumentActionsResolver {
  return (actions, context) => {
    if (!singletonTypeNames.has(context.schemaType)) return actions
    if (automationOwnedSingletonTypeNames.has(context.schemaType)) return []

    return actions.filter(
      (action) => action.action && singletonActionNames.has(action.action),
    )
  }
}
