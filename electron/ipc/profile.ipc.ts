import { ipcMain } from 'electron'
import { codeforcesService } from '../services/codeforces.service'
import { analysisService } from '../services/analysis.service'
import { handlesRepo } from '../db/repositories/handles.repo'
import { submissionsRepo } from '../db/repositories/submissions.repo'
import { logger } from '../utils/logger'
import type { IpcResult, Platform } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// profile.ipc.ts — Profile sync, rating history, handle management.
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
  // Full pipeline: fetch profile → upsert handle → incremental submission sync
  // → invalidate analysis cache
  ipcMain.handle('profile:sync', async (_event, platform: Platform, username: string) => {
    try {
      const cleanUser = username.trim()
      logger.info(`Syncing profile: ${platform}/${cleanUser}`)

      if (platform !== 'codeforces') {
        return err(`Platform "${platform}" not yet supported`)
      }

      // 1. Fetch and validate the profile (throws on bad handle)
      const profile = await codeforcesService.getProfile(cleanUser)

      // 2. Upsert handle row with canonical handle name
      const handleId = handlesRepo.upsert(platform, profile.handle, {
        displayName: profile.handle,
        avatarUrl:   profile.avatar,
        rating:      profile.rating ?? undefined,
        rank:        profile.rank ?? undefined,
      })

      // 3. Fetch full submissions (CF user.status allows up to 10k submissions in 1 call)
      const allSubs = await codeforcesService.getSubmissions(username, null)

      if (allSubs.length > 0) {
        submissionsRepo.deleteByHandle(handleId)
        submissionsRepo.bulkInsert(
          allSubs.map(s => ({ ...s, handleId }))
        )
        logger.info(`Synced ${allSubs.length} submissions for ${username}`)
      } else {
        logger.info(`No submissions found for ${username}`)
      }

      // 4. Update last_synced_at
      handlesRepo.touchSyncedAt(handleId)

      // 5. Invalidate stale analysis cache
      analysisService.invalidate(platform, username)

      return ok(undefined)
    } catch (e) { return err(e) }
  })

  // ── profile:getSavedHandles ────────────────────────────────────────────────
  ipcMain.handle('profile:getSavedHandles', async () => {
    try {
      return ok(handlesRepo.findAll())
    } catch (e) { return err(e) }
  })

  // ── profile:removeHandle ───────────────────────────────────────────────────
  ipcMain.handle('profile:removeHandle', async (_event, handleId: number) => {
    try {
      handlesRepo.deleteById(handleId)  // CASCADE removes submissions etc.
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
