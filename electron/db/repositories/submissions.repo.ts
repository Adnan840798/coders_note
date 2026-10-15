import { getDb } from '../client'
import type { Submission, Verdict } from '../../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// submissions.repo.ts — All SQL for `submissions` + `submission_tags`.
// ─────────────────────────────────────────────────────────────────────────────

interface SubmissionRow {
  id: number
  handle_id: number
  problem_id: string
  problem_name: string
  tags: string         // JSON text
  verdict: string
  problem_rating: number | null
  submitted_at: number
}

function rowToSubmission(row: SubmissionRow): Submission {
  return {
    id:            row.id,
    handleId:      row.handle_id,
    problemId:     row.problem_id,
    problemName:   row.problem_name,
    tags:          JSON.parse(row.tags) as string[],
    verdict:       row.verdict as Verdict,
    problemRating: row.problem_rating,
    submittedAt:   row.submitted_at,
  }
}

export const submissionsRepo = {
  /**
   * Bulk-insert submissions for a handle.
   * Uses INSERT OR IGNORE so re-syncing is idempotent.
   * Also populates submission_tags join table.
   */
  bulkInsert(submissions: Omit<Submission, 'id'>[]): void {
    const db = getDb()

    const insertSub = db.prepare(`
      INSERT INTO submissions
        (handle_id, problem_id, problem_name, tags, verdict, problem_rating, submitted_at)
      VALUES
        (@handleId, @problemId, @problemName, @tags, @verdict, @problemRating, @submittedAt)
    `)

    const bulkInsertAll = db.transaction((subs: Omit<Submission, 'id'>[]) => {
      for (const sub of subs) {
        insertSub.run({
          ...sub,
          tags: JSON.stringify(sub.tags ?? []),
        })
      }
    })

    bulkInsertAll(submissions)
  },

  /** Latest submitted_at timestamp for a handle — used for incremental sync. */
  getLatestTimestamp(handleId: number): number | null {
    const row = getDb()
      .prepare('SELECT MAX(submitted_at) AS ts FROM submissions WHERE handle_id = ?')
      .get(handleId) as { ts: number | null }
    return row?.ts ?? null
  },

  findByHandle(handleId: number): Submission[] {
    return (getDb()
      .prepare('SELECT * FROM submissions WHERE handle_id = ? ORDER BY submitted_at DESC')
      .all(handleId) as SubmissionRow[])
      .map(rowToSubmission)
  },

  /** Returns submissions where verdict = 'OK', deduplicated by problem_id (first AC only). */
  findSolvedByHandle(handleId: number): Submission[] {
    return (getDb()
      .prepare(`
        SELECT * FROM submissions
        WHERE handle_id = ? AND verdict = 'OK'
        GROUP BY problem_id
        ORDER BY submitted_at DESC
      `)
      .all(handleId) as SubmissionRow[])
      .map(rowToSubmission)
  },

  /** Verdict counts for a handle, e.g. { OK: 120, WRONG_ANSWER: 45, ... } */
  getVerdictBreakdown(handleId: number): Record<string, number> {
    const rows = getDb()
      .prepare(`
        SELECT verdict, COUNT(*) AS cnt
        FROM submissions
        WHERE handle_id = ?
        GROUP BY verdict
      `)
      .all(handleId) as { verdict: string; cnt: number }[]

    return Object.fromEntries(rows.map(r => [r.verdict, r.cnt]))
  },

  /** Unique problems solved by handle */
  getUniqueSolvedCount(handleId: number): number {
    const row = getDb()
      .prepare(`
        SELECT COUNT(DISTINCT problem_id) AS cnt
        FROM submissions
        WHERE handle_id = ? AND verdict = 'OK'
      `)
      .get(handleId) as { cnt: number }
    return row?.cnt ?? 0
  },

  /** Unique problems attempted by handle */
  getUniqueAttemptedCount(handleId: number): number {
    const row = getDb()
      .prepare(`
        SELECT COUNT(DISTINCT problem_id) AS cnt
        FROM submissions
        WHERE handle_id = ?
      `)
      .get(handleId) as { cnt: number }
    return row?.cnt ?? 0
  },

  /** Solve counts grouped by problem_rating band (100-point buckets). */
  getSolvesByRating(handleId: number): Record<string, number> {
    const rows = getDb()
      .prepare(`
        SELECT problem_rating, COUNT(DISTINCT problem_id) AS cnt
        FROM submissions
        WHERE handle_id = ? AND verdict = 'OK' AND problem_rating IS NOT NULL
        GROUP BY problem_rating
        ORDER BY problem_rating ASC
      `)
      .all(handleId) as { problem_rating: number; cnt: number }[]

    return Object.fromEntries(rows.map(r => [String(r.problem_rating), r.cnt]))
  },

  /** Daily solve counts (format YYYY-MM-DD) for consistency heatmap. */
  getDailySolves(handleId: number): Record<string, number> {
    const rows = getDb()
      .prepare(`
        SELECT date(submitted_at, 'unixepoch', 'localtime') AS day, COUNT(DISTINCT problem_id) AS cnt
        FROM submissions
        WHERE handle_id = ? AND verdict = 'OK'
        GROUP BY day
        ORDER BY day ASC
      `)
      .all(handleId) as { day: string; cnt: number }[]

    return Object.fromEntries(rows.map(r => [r.day, r.cnt]))
  },

  /**
   * Per-tag stats: attempts and solved count.
   * Uses SQLite's built-in json_each() to aggregate over the tags array column.
   */
  getTagStats(handleId: number): { tag: string; attempts: number; solved: number }[] {
    return getDb()
      .prepare(`
        SELECT
          json_each.value                                                   AS tag,
          COUNT(DISTINCT s.problem_id)                                     AS attempts,
          COUNT(DISTINCT CASE WHEN s.verdict = 'OK' THEN s.problem_id END) AS solved
        FROM submissions s, json_each(s.tags)
        WHERE s.handle_id = ?
        GROUP BY json_each.value
        ORDER BY attempts DESC
      `)
      .all(handleId) as { tag: string; attempts: number; solved: number }[]
  },

  deleteByHandle(handleId: number): void {
    const db = getDb()
    const del = db.transaction(() => {
      db.prepare(`
        DELETE FROM submission_tags
        WHERE submission_id IN (SELECT id FROM submissions WHERE handle_id = ?)
      `).run(handleId)
      db.prepare('DELETE FROM submissions WHERE handle_id = ?').run(handleId)
      db.prepare('DELETE FROM weak_topics_cache WHERE handle_id = ?').run(handleId)
    })
    del()
  },
}
