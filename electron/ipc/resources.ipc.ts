import { ipcMain } from 'electron'
import { resourcesRepo } from '../db/repositories/resources.repo'
import { handlesRepo } from '../db/repositories/handles.repo'
import { logger } from '../utils/logger'
import type { IpcResult, ResourceFilter, Platform } from '../../shared/types'

function ok<T>(data: T): IpcResult<T>  { return { ok: true,  data  } }
function err(e: unknown): IpcResult<never> {
  const msg = e instanceof Error ? e.message : String(e)
  logger.error('IPC error (resources):', msg)
  return { ok: false, error: msg }
}

// Helper: resolve the active handle id from settings (or use -1 for no handle)
function getActiveHandleId(): number {
  try {
    const { getDb } = require('../db/client')
    const row = getDb()
      .prepare("SELECT value FROM settings WHERE key = 'defaultHandle'")
      .get() as { value: string } | undefined

    if (!row?.value) return -1

    // defaultHandle is stored as "platform:username"
    const [platform, username] = row.value.split(':')
    const handle = handlesRepo.findByPlatformAndUsername(platform as Platform, username)
    return handle?.id ?? -1
  } catch { return -1 }
}

export function registerResourceHandlers(): void {

  ipcMain.handle('resources:getAll', async (_event, filter?: ResourceFilter) => {
    try {
      const handleId = getActiveHandleId()
      return ok(resourcesRepo.findAll(filter, handleId))
    } catch (e) { return err(e) }
  })

  ipcMain.handle('resources:bookmark', async (_event, resourceId: number) => {
    try {
      const handleId = getActiveHandleId()
      if (handleId < 0) return err('No active handle — add a profile first')
      resourcesRepo.bookmark(resourceId, handleId)
      return ok(undefined)
    } catch (e) { return err(e) }
  })

  ipcMain.handle('resources:unbookmark', async (_event, resourceId: number) => {
    try {
      const handleId = getActiveHandleId()
      if (handleId < 0) return err('No active handle')
      resourcesRepo.unbookmark(resourceId, handleId)
      return ok(undefined)
    } catch (e) { return err(e) }
  })
}
