import { ipcMain } from 'electron'
import { CURATED_RESOURCES } from '../data/resources.data'
import { storageService } from '../services/storage.service'
import { logger } from '../utils/logger'
import type { IpcResult, ResourceFilter, Resource } from '../../shared/types'

function ok<T>(data: T): IpcResult<T>  { return { ok: true,  data  } }
function err(e: unknown): IpcResult<never> {
  const msg = e instanceof Error ? e.message : String(e)
  logger.error('IPC error (resources):', msg)
  return { ok: false, error: msg }
}

export function registerResourceHandlers(): void {

  ipcMain.handle('resources:getAll', async (_event, filter?: ResourceFilter) => {
    try {
      const bookmarkedIds = storageService.getBookmarks()

      let resources: Resource[] = CURATED_RESOURCES.map(r => ({
        ...r,
        isBookmarked: bookmarkedIds.has(r.id),
      }))

      if (filter?.topic) {
        resources = resources.filter(r => r.topic === filter.topic)
      }
      if (filter?.difficulty) {
        resources = resources.filter(r => r.difficulty === filter.difficulty)
      }
      if (filter?.type) {
        resources = resources.filter(r => r.type === filter.type)
      }
      if (filter?.bookmarkedOnly) {
        resources = resources.filter(r => r.isBookmarked)
      }
      if (filter?.search) {
        const q = filter.search.toLowerCase()
        resources = resources.filter(r =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.topic.toLowerCase().includes(q)
        )
      }

      return ok(resources)
    } catch (e) { return err(e) }
  })

  ipcMain.handle('resources:bookmark', async (_event, resourceId: number) => {
    try {
      storageService.addBookmark(resourceId)
      return ok(undefined)
    } catch (e) { return err(e) }
  })

  ipcMain.handle('resources:unbookmark', async (_event, resourceId: number) => {
    try {
      storageService.removeBookmark(resourceId)
      return ok(undefined)
    } catch (e) { return err(e) }
  })
}
