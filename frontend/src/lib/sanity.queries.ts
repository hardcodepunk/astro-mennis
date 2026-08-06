import {readFile} from "node:fs/promises"
import {resolve} from "node:path"

import {createContentRepository} from "./contentSnapshot"

export type {
  Category,
  SeoSettings,
  WorkDetail,
  WorkSummary,
} from "./sanity.contract"
export type {ContentSnapshot} from "./contentSnapshot"
export {
  selectFeaturedWorks,
  selectRecentWorks,
  selectWorksByCategorySlug,
} from "./contentSnapshot"

const snapshotPath = resolve(process.cwd(), ".content-snapshot.json")

async function loadPreparedSnapshot() {
  let source: string
  try {
    source = await readFile(snapshotPath, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "Content snapshot is missing. Start the frontend with `npm run dev` or build it with `npm run build`.",
        {cause: error},
      )
    }
    throw error
  }

  try {
    return JSON.parse(source) as unknown
  } catch (error) {
    throw new Error("Content snapshot is not valid JSON. Run the content preparation step again.", {
      cause: error,
    })
  }
}

const repository = createContentRepository(loadPreparedSnapshot)

export const {
  getAllWorksForGrid,
  getBioWithPreview,
  getCategories,
  getContactPage,
  getContentSnapshot,
  getFeaturedWorks,
  getLogoMarquee,
  getRecentWorks,
  getSeoSettings,
  getSiteSettings,
  getVideoHeroSettings,
  getWorkBySlug,
  getWorks,
  getWorksByCategorySlug,
} = repository
