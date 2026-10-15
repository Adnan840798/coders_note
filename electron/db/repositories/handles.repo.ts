import { getDb } from '../client'
import type { Handle, Platform } from '../../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// handles.repo.ts — All SQL for the `handles` table.
// Services call these functions; SQL lives here, not scattered in business logic.
// ─────────────────────────────────────────────────────────────────────────────

interface HandleRow {
  id: number
  platform: string
  username: string
  display_name: string | null
  avatar_url: string | null
  rating: number | null
  rank: string | null
  last_synced_at: number | null
}

function rowToHandle(row: HandleRow): Handle {
  return {
    id: row.id,
    platform: row.platform as Platform,
    username: row.username,
    lastSyncedAt: row.last_synced_at,
  }
}

export const handlesRepo = {
  /** Insert or update a handle row. Returns the row id. */
  upsert(platform: Platform, username: string, extra?: {
    displayName?: string
    avatarUrl?: string
    rating?: number
    rank?: string
  }): number {
    const db = getDb()
    const handleName = username.trim()

    // Check if handle already exists (case-insensitive)
    const existingRows = db.prepare(
      'SELECT id FROM handles WHERE platform = ? AND LOWER(username) = LOWER(?) ORDER BY id DESC'
    ).all(platform, handleName) as { id: number }[]

    if (existingRows.length > 0) {
      const primaryId = existingRows[0].id

      // Remove any duplicate rows with differing case
      for (let i = 1; i < existingRows.length; i++) {
        handlesRepo.deleteById(existingRows[i].id)
      }

      db.prepare(`
        UPDATE handles SET
          username     = @username,
          display_name = @displayName,
          avatar_url   = @avatarUrl,
          rating       = @rating,
          rank         = @rank
        WHERE id = @id
      `).run({
        id:          primaryId,
        username:    handleName,
        displayName: extra?.displayName ?? handleName,
        avatarUrl:   extra?.avatarUrl   ?? null,
        rating:      extra?.rating      ?? null,
        rank:        extra?.rank        ?? null,
      })
      return primaryId
    }

    const insertResult = db.prepare(`
      INSERT INTO handles (platform, username, display_name, avatar_url, rating, rank)
      VALUES (@platform, @username, @displayName, @avatarUrl, @rating, @rank)
    `).run({
      platform,
      username:    handleName,
      displayName: extra?.displayName ?? handleName,
      avatarUrl:   extra?.avatarUrl   ?? null,
      rating:      extra?.rating      ?? null,
      rank:        extra?.rank        ?? null,
    })

    return Number(insertResult.lastInsertRowid)
  },

  /** Mark a handle as just synced. */
  touchSyncedAt(handleId: number): void {
    getDb()
      .prepare('UPDATE handles SET last_synced_at = ? WHERE id = ?')
      .run(Math.floor(Date.now() / 1000), handleId)
  },

  findById(id: number): Handle | null {
    const row = getDb()
      .prepare('SELECT * FROM handles WHERE id = ?')
      .get(id) as HandleRow | undefined
    return row ? rowToHandle(row) : null
  },

  findByPlatformAndUsername(platform: Platform, username: string): Handle | null {
    const row = getDb()
      .prepare('SELECT * FROM handles WHERE platform = ? AND LOWER(username) = LOWER(?) ORDER BY id DESC')
      .get(platform, username.trim()) as HandleRow | undefined
    return row ? rowToHandle(row) : null
  },

  findAll(): Handle[] {
    return (getDb()
      .prepare('SELECT * FROM handles ORDER BY platform, username COLLATE NOCASE')
      .all() as HandleRow[])
      .map(rowToHandle)
  },

  deleteById(id: number): void {
    const db = getDb()
    db.prepare('DELETE FROM submission_tags WHERE submission_id IN (SELECT id FROM submissions WHERE handle_id = ?)').run(id)
    db.prepare('DELETE FROM submissions WHERE handle_id = ?').run(id)
    db.prepare('DELETE FROM rating_history WHERE handle_id = ?').run(id)
    db.prepare('DELETE FROM bookmarks WHERE handle_id = ?').run(id)
    db.prepare('DELETE FROM weak_topics_cache WHERE handle_id = ?').run(id)
    db.prepare('DELETE FROM handles WHERE id = ?').run(id)
  },
}
