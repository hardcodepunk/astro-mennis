import type {DocumentActionsResolver} from 'sanity'

export const singletonActionNames: ReadonlySet<string> = new Set([
  'publish',
  'discardChanges',
  'restore',
])

export function createSingletonDocumentActionsResolver(
  singletonTypeNames: ReadonlySet<string>,
): DocumentActionsResolver {
  return (actions, context) => {
    if (!singletonTypeNames.has(context.schemaType)) return actions

    return actions.filter(
      (action) => action.action && singletonActionNames.has(action.action),
    )
  }
}
