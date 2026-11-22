import { ipcMain } from 'electron'
import { codeforcesService } from '../services/codeforces.service'
import { analysisService } from '../services/analysis.service'
import { storageService } from '../services/storage.service'
import { logger } from '../utils/logger'
import type { IpcResult, Platform } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// profile.ipc.ts — Profile sync, rating history, handle management (Online Mode).
// ─────────────────────────────────────────────────────────────────────────────

function ok<T>(data: T): IpcResult<T>  { return { ok: true,  data  } }
function err(e: unknown): IpcResult<never> {
  const msg = e instanceof Error ? e.message : String(e)
  const stack = e instanceof Error ? e.stack : ''
  logger.error('IPC error (profile):', msg, stack)
  console.error('IPC error (profile):', msg, stack)
  return { ok: false, error: msg }
}

export function registerProfileHandlers(): void {

  // ── profile:get ────────────────────────────────────────────────────────────
  ipcMain.handle('profile:get', async (_event, platform: Platform, username: string) => {
    try {
      const cleanUser = username.trim()
      if (platform !== 'codeforces') {
        return err(`Platform "${platform}" is not yet supported`)
      }
      const profile = await codeforcesService.getProfile(cleanUser)
      return ok(profile)
    } catch (e) { return err(e) }
  })

  // ── profile:getRatingHistory ───────────────────────────────────────────────
  ipcMain.handle('profile:getRatingHistory', async (_event, platform: Platform, username: string) => {
    try {
      const cleanUser = username.trim()
      if (platform !== 'codeforces') return err(`Platform "${platform}" not supported`)
      const history = await codeforcesService.getRatingHistory(cleanUser)
      return ok(history)
    } catch (e) { return err(e) }
  })

  // ── profile:sync ────────────────────────────────────────────────────────────
  // Online pipeline: validate profile against CF API -> record in saved handles
  // -> invalidate cache
  ipcMain.handle('profile:sync', async (_event, platform: Platform, username: string) => {
    try {
      const cleanUser = username.trim()
      logger.info(`Syncing profile online: ${platform}/${cleanUser}`)

      if (platform !== 'codeforces') {
        return err(`Platform "${platform}" not yet supported`)
      }

      // 1. Fetch and validate the profile directly from Codeforces API
      const profile = await codeforcesService.getProfile(cleanUser)

      // 2. Save handle into lightweight JSON storage for quick-switch dropdown
      storageService.saveHandle(platform, profile.handle)

      // 3. Invalidate analysis cache so next view computes fresh stats
      analysisService.invalidate(platform, profile.handle)

      return ok(undefined)
    } catch (e) { return err(e) }
  })

  // ── profile:getSavedHandles ────────────────────────────────────────────────
  ipcMain.handle('profile:getSavedHandles', async () => {
    try {
      return ok(storageService.getSavedHandles())
    } catch (e) { return err(e) }
  })

  // ── profile:removeHandle ───────────────────────────────────────────────────
  ipcMain.handle('profile:removeHandle', async (_event, handleId: number) => {
    try {
      storageService.removeHandle(handleId)
      return ok(undefined)
    } catch (e) { return err(e) }
  })

  // ── codeforces:getProblem ───────────────────────────────────────────────────
  ipcMain.handle('codeforces:getProblem', async (_event, problemRef: string) => {
    try {
      const problem = await codeforcesService.getProblem(problemRef)
      return ok(problem)
    } catch (e) { return err(e) }
  })
}
