import { ipcMain } from 'electron'
import { getDb } from '../db/client'
import { logger } from '../utils/logger'
import type { AppSettings, IpcResult } from '../../shared/types'

function ok<T>(data: T): IpcResult<T>  { return { ok: true,  data  } }
function err(e: unknown): IpcResult<never> {
  const msg = e instanceof Error ? e.message : String(e)
  logger.error('IPC error (settings):', msg)
  return { ok: false, error: msg }
}

// ── Read all settings as a typed AppSettings object ───────────────────────────
function readSettings(): AppSettings {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))

  return {
    theme:                       (map.theme ?? 'dark') as AppSettings['theme'],
    defaultHandle:               map.defaultHandle || null,
    defaultPlatform:             (map.defaultPlatform ?? 'codeforces') as AppSettings['defaultPlatform'],
    notificationsEnabled:        map.notificationsEnabled === 'true',
    reminderLeadMinutes:         parseInt(map.reminderLeadMinutes ?? '30', 10),
    cacheRefreshIntervalMinutes: parseInt(map.cacheRefreshIntervalMinutes ?? '20', 10),
  }
}

export function registerSettingsHandlers(): void {

  ipcMain.handle('settings:get', async () => {
    try {
      return ok(readSettings())
    } catch (e) { return err(e) }
  })

  ipcMain.handle('settings:update', async (_event, updates: Partial<AppSettings>) => {
    try {
      const db = getDb()
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')

      const upsertAll = db.transaction(() => {
        for (const [k, v] of Object.entries(updates)) {
          stmt.run(k, String(v ?? ''))
        }
      })
      upsertAll()

      return ok(readSettings())
    } catch (e) { return err(e) }
  })
}
