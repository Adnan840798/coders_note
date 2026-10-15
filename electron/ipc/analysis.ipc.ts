import { ipcMain } from 'electron'
import { analysisService } from '../services/analysis.service'
import { logger } from '../utils/logger'
import type { IpcResult, Platform } from '../../shared/types'

function ok<T>(data: T): IpcResult<T>  { return { ok: true,  data  } }
function err(e: unknown): IpcResult<never> {
  const msg = e instanceof Error ? e.message : String(e)
  logger.error('IPC error (analysis):', msg)
  return { ok: false, error: msg }
}

export function registerAnalysisHandlers(): void {

  // ── analysis:get ───────────────────────────────────────────────────────────
  ipcMain.handle('analysis:get', async (_event, platform: Platform, username: string) => {
    try {
      const cleanUser = username.trim()
      const result = await analysisService.getAnalysis(platform, cleanUser)
      return ok(result)
    } catch (e) { return err(e) }
  })

  // ── analysis:compare ───────────────────────────────────────────────────────
  ipcMain.handle('analysis:compare',
    async (_event,
      a: { platform: Platform; username: string },
      b: { platform: Platform; username: string }
    ) => {
      try {
        const cleanA = { platform: a.platform, username: a.username.trim() }
        const cleanB = { platform: b.platform, username: b.username.trim() }
        const result = await analysisService.compareProfiles(cleanA, cleanB)
        return ok(result)
      } catch (e) { return err(e) }
    }
  )
}
