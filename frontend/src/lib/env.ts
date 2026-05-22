function requiredPublicEnv(name: string, value: string | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return normalized
}

export const sanityProjectId = requiredPublicEnv(
  "PUBLIC_SANITY_PROJECT_ID",
  import.meta.env.PUBLIC_SANITY_PROJECT_ID,
)

export const sanityDataset = requiredPublicEnv(
  "PUBLIC_SANITY_DATASET",
  import.meta.env.PUBLIC_SANITY_DATASET,
)
