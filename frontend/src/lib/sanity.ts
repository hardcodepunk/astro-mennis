import { createClient } from "@sanity/client"
import { sanityDataset, sanityProjectId } from "./env"

export const sanity = createClient({
  projectId: sanityProjectId,
  dataset: sanityDataset,
  apiVersion: "2024-01-01",
  useCdn: false,
})
