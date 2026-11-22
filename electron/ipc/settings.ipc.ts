import { ipcMain } from 'electron'
import { storageService } from '../services/storage.service'
import { logger } from '../utils/logger'
import type { AppSettings, IpcResult } from '../../shared/types'

function ok<T>(data: T): IpcResult<T>  { return { ok: true,  data  } }
function err(e: unknown): IpcResult<never> {
  const msg = e instanceof Error ? e.message : String(e)
  logger.error('IPC error (settings):', msg)
  return { ok: false, error: msg }
}

export function registerSettingsHandlers(): void {

  ipcMain.handle('settings:get', async () => {
    try {
      return ok(storageService.getSettings())
    } catch (e) { return err(e) }
  })

  ipcMain.handle('settings:update', async (_event, updates: Partial<AppSettings>) => {
    try {
      const updated = storageService.updateSettings(updates)
      return ok(updated)
    } catch (e) { return err(e) }
  })
}
