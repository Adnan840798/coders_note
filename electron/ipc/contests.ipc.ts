import { ipcMain } from 'electron'
import { kontestsService } from '../services/kontests.service'
import { contestsRepo } from '../db/repositories/contests.repo'
import { logger } from '../utils/logger'
import type { ContestFilter, IpcResult, Contest } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// contests.ipc.ts — IPC handlers for contest-related operations.
// Pattern: thin handlers, call into services/repos, always return IpcResult.
// ─────────────────────────────────────────────────────────────────────────────

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function err(error: unknown): IpcResult<never> {
  const msg = error instanceof Error ? error.message : String(error)
  logger.error('IPC error (contests):', msg)
  return { ok: false, error: msg }
}

export function registerContestHandlers(): void {

  // ── contests:getAll ────────────────────────────────────────────────────────
  ipcMain.handle('contests:getAll', async (_event, filter?: ContestFilter) => {
    try {
      // If cache is stale, fetch fresh data from API and store it
      if (!contestsRepo.isCacheValid()) {
        logger.info('Contest cache stale — fetching from kontests.net')
        const fresh = await kontestsService.getAll()
        contestsRepo.replaceAll(fresh)
      }

      let contests = contestsRepo.findAll()

      // ── Apply filters ──────────────────────────────────────────────────────
      if (filter?.sites?.length) {
        contests = contests.filter(c => filter.sites!.includes(c.site))
      }
      if (filter?.status?.length) {
        contests = contests.filter(c => filter.status!.includes(c.status))
      }
      if (filter?.search) {
        const q = filter.search.toLowerCase()
        contests = contests.filter(c =>
          c.title.toLowerCase().includes(q) || c.site.toLowerCase().includes(q)
        )
      }

      return ok(contests)
    } catch (e) {
      // If API is down, still return whatever is in the cache
      try {
        const cached = contestsRepo.findAll()
        if (cached.length > 0) {
          logger.warn('API failed, returning stale contest cache')
          return ok(cached)
        }
      } catch { /* DB also failed */ }

      return err(e)
    }
  })

  // ── contests:setReminder ───────────────────────────────────────────────────
  ipcMain.handle('contests:setReminder', async (_event, contestId: string, remindAt: number) => {
    try {
      contestsRepo.setReminder(contestId, remindAt)
      return ok(undefined)
    } catch (e) {
      return err(e)
    }
  })

  // ── contests:removeReminder ────────────────────────────────────────────────
  ipcMain.handle('contests:removeReminder', async (_event, contestId: string) => {
    try {
      contestsRepo.removeReminder(contestId)
      return ok(undefined)
    } catch (e) {
      return err(e)
    }
  })
}
