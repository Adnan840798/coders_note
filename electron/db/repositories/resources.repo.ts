import { getDb } from '../client'
import type { Resource, ResourceFilter } from '../../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// resources.repo.ts — Resources table + bookmarks.
// ─────────────────────────────────────────────────────────────────────────────

interface ResourceRow {
  id: number
  title: string
  url: string
  topic: string
  difficulty: string
  type: string
  description: string
  is_bookmarked: number  // 0 or 1 (from LEFT JOIN)
}

function rowToResource(row: ResourceRow): Resource {
  return {
    id:           row.id,
    title:        row.title,
    url:          row.url,
    topic:        row.topic,
    difficulty:   row.difficulty as Resource['difficulty'],
    type:         row.type as Resource['type'],
    description:  row.description,
    isBookmarked: row.is_bookmarked === 1,
  }
}

export const resourcesRepo = {
  findAll(filter?: ResourceFilter, handleId?: number): Resource[] {
    const db = getDb()

    let sql = `
      SELECT r.*,
        CASE WHEN b.resource_id IS NOT NULL THEN 1 ELSE 0 END AS is_bookmarked
      FROM resources r
      LEFT JOIN bookmarks b ON b.resource_id = r.id AND b.handle_id = @handleId
      WHERE 1=1
    `
    const params: Record<string, unknown> = { handleId: handleId ?? -1 }

    if (filter?.topic) {
      sql += ' AND r.topic = @topic'
      params.topic = filter.topic
    }
    if (filter?.difficulty) {
      sql += ' AND r.difficulty = @difficulty'
      params.difficulty = filter.difficulty
    }
    if (filter?.type) {
      sql += ' AND r.type = @type'
      params.type = filter.type
    }
    if (filter?.bookmarkedOnly) {
      sql += ' AND b.resource_id IS NOT NULL'
    }
    if (filter?.search) {
      sql += ' AND (r.title LIKE @search OR r.description LIKE @search OR r.topic LIKE @search)'
      params.search = `%${filter.search}%`
    }

    sql += ' ORDER BY r.topic, r.difficulty, r.title'

    return (db.prepare(sql).all(params) as ResourceRow[]).map(rowToResource)
  },

  /** Returns all distinct topics for the filter sidebar. */
  getTopics(): string[] {
    return (getDb()
      .prepare('SELECT DISTINCT topic FROM resources ORDER BY topic')
      .all() as { topic: string }[])
      .map(r => r.topic)
  },

  bookmark(resourceId: number, handleId: number): void {
    getDb()
      .prepare('INSERT OR IGNORE INTO bookmarks (resource_id, handle_id) VALUES (?, ?)')
      .run(resourceId, handleId)
  },

  unbookmark(resourceId: number, handleId: number): void {
    getDb()
      .prepare('DELETE FROM bookmarks WHERE resource_id = ? AND handle_id = ?')
      .run(resourceId, handleId)
  },

  /** Seed resources from a list (called once from a seed script). Uses INSERT OR IGNORE. */
  seed(resources: Omit<Resource, 'id' | 'isBookmarked'>[]): void {
    const insert = getDb().prepare(`
      INSERT OR IGNORE INTO resources (title, url, topic, difficulty, type, description)
      VALUES (@title, @url, @topic, @difficulty, @type, @description)
    `)
    const seedAll = getDb().transaction(() => {
      for (const r of resources) insert.run(r)
    })
    seedAll()
  },
}
