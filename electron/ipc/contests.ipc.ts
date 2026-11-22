import { ipcMain } from 'electron'
import { kontestsService } from '../services/kontests.service'
import { storageService } from '../services/storage.service'
import { TtlCache } from '../utils/cache'
import { logger } from '../utils/logger'
import type { ContestFilter, IpcResult, Contest } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// contests.ipc.ts — Live contests fetched directly online from Kontests/CF API.
// In-memory TTL cache (10 mins) prevents redundant API requests.
// ─────────────────────────────────────────────────────────────────────────────

const contestCache = new TtlCache<Contest[]>(10 * 60 * 1000)

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
      let rawContests = contestCache.get('all_contests')
      if (!rawContests) {
        logger.info('Fetching live contests from kontests.net / Codeforces API')
        rawContests = await kontestsService.getAll()
        contestCache.set('all_contests', rawContests)
      }

      // ── Apply live status & reminders state ─────────────────────────────────
      const now = Math.floor(Date.now() / 1000)
      const reminders = storageService.getReminders()

      let contests: Contest[] = rawContests.map(c => {
        let status: ContestStatus = 'upcoming'
        if (now < c.startTime) {
          status = 'upcoming'
        } else if (now < c.startTime + c.duration) {
          status = 'running'
        } else {
          status = 'ended'
        }

        return {
          ...c,
          status,
          hasReminder: !!reminders[c.id],
        }
      })

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

      // ── Sort: nearest startTime first for upcoming/running, newest first for ended
      if (filter?.status?.length === 1 && filter.status[0] === 'ended') {
        contests.sort((a, b) => b.startTime - a.startTime)
      } else {
        contests.sort((a, b) => a.startTime - b.startTime)
      }

      return ok(contests)
    } catch (e) {
      // Fallback to cached copy if offline
      const cached = contestCache.get('all_contests')
      if (cached && cached.length > 0) {
        logger.warn('Online fetch failed, returning in-memory cached contests')
        const now = Math.floor(Date.now() / 1000)
        const reminders = storageService.getReminders()
        const fallback = cached.map(c => ({
          ...c,
          status: (now < c.startTime ? 'upcoming' : (now < c.startTime + c.duration ? 'running' : 'ended')) as ContestStatus,
          hasReminder: !!reminders[c.id],
        }))
        return ok(fallback)
      }
      return err(e)
    }
  })

  // ── contests:setReminder ───────────────────────────────────────────────────
  ipcMain.handle('contests:setReminder', async (_event, contestId: string, remindAt: number) => {
    try {
      storageService.setReminder(contestId, remindAt)
      return ok(undefined)
    } catch (e) {
      return err(e)
    }
  })

  // ── contests:removeReminder ────────────────────────────────────────────────
  ipcMain.handle('contests:removeReminder', async (_event, contestId: string) => {
    try {
      storageService.removeReminder(contestId)
      return ok(undefined)
    } catch (e) {
      return err(e)
    }
  })
}
