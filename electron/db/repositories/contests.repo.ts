import { getDb } from '../client'
import type { Contest, ContestStatus } from '../../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// contests.repo.ts — Cache layer for contests_cache + reminders tables.
// Status (upcoming/running/ended) is NEVER stored — always recomputed from
// start_time + duration vs. current time to avoid stale cached status.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 20 * 60  // 20 minutes

interface ContestRow {
  id: string
  site: string
  title: string
  url: string
  start_time: number
  duration: number
  fetched_at: number
}

interface ReminderRow {
  id: number
  contest_id: string
  remind_at: number
  fired: number
}

function computeStatus(startTime: number, duration: number): ContestStatus {
  const now = Math.floor(Date.now() / 1000)
  if (now < startTime) return 'upcoming'
  if (now < startTime + duration) return 'running'
  return 'ended'
}

function rowToContest(row: ContestRow, reminderContestIds: Set<string>): Contest {
  return {
    id:          row.id,
    site:        row.site,
    title:       row.title,
    url:         row.url,
    startTime:   row.start_time,
    duration:    row.duration,
    status:      computeStatus(row.start_time, row.duration),
    hasReminder: reminderContestIds.has(row.id),
  }
}

export const contestsRepo = {
  /** True if the cache is still fresh (youngest row within TTL). */
  isCacheValid(): boolean {
    const row = getDb()
      .prepare('SELECT MAX(fetched_at) AS latest FROM contests_cache')
      .get() as { latest: number | null }
    if (!row?.latest) return false
    return Math.floor(Date.now() / 1000) - row.latest < CACHE_TTL_SECONDS
  },

  /** Replace all cached contests with fresh data from the API. */
  replaceAll(contests: Omit<Contest, 'status' | 'hasReminder'>[]): void {
    const db = getDb()
    const now = Math.floor(Date.now() / 1000)

    const replace = db.transaction(() => {
      db.prepare('DELETE FROM contests_cache').run()
      const insert = db.prepare(`
        INSERT INTO contests_cache (id, site, title, url, start_time, duration, fetched_at)
        VALUES (@id, @site, @title, @url, @startTime, @duration, @fetchedAt)
      `)
      for (const c of contests) {
        insert.run({ ...c, fetchedAt: now })
      }
    })

    replace()
  },

  /** Return all cached contests, with status recomputed and reminder flags attached. */
  findAll(): Contest[] {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM contests_cache ORDER BY start_time ASC')
      .all() as ContestRow[]

    const reminderIds = new Set(
      (db.prepare('SELECT contest_id FROM reminders WHERE fired = 0').all() as { contest_id: string }[])
        .map(r => r.contest_id)
    )

    return rows.map(r => rowToContest(r, reminderIds))
  },

  // ── Reminders ───────────────────────────────────────────────────────────────

  setReminder(contestId: string, remindAt: number): void {
    getDb()
      .prepare(`
        INSERT INTO reminders (contest_id, remind_at, fired)
        VALUES (?, ?, 0)
        ON CONFLICT (contest_id) DO UPDATE SET remind_at = excluded.remind_at, fired = 0
      `)
      .run(contestId, remindAt)
  },

  removeReminder(contestId: string): void {
    getDb().prepare('DELETE FROM reminders WHERE contest_id = ?').run(contestId)
  },

  /** Returns pending (unfired) reminders whose remind_at <= now. */
  getDueReminders(): { id: number; contestId: string; remindAt: number }[] {
    const now = Math.floor(Date.now() / 1000)
    return (getDb()
      .prepare(`
        SELECT id, contest_id AS contestId, remind_at AS remindAt
        FROM reminders
        WHERE fired = 0 AND remind_at <= ?
      `)
      .all(now) as { id: number; contestId: string; remindAt: number }[])
  },

  markReminderFired(reminderId: number): void {
    getDb().prepare('UPDATE reminders SET fired = 1 WHERE id = ?').run(reminderId)
  },
}
