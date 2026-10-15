import { getDb } from '../client'
import type { Note } from '../../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// notes.repo.ts — Personal notes per problem.
// ─────────────────────────────────────────────────────────────────────────────

interface NoteRow {
  id: number
  problem_id: string
  problem_name: string
  body: string
  tags: string   // JSON array (from migration 002)
  created_at: number
  updated_at: number
}

function rowToNote(row: NoteRow): Note {
  return {
    id:          row.id,
    problemId:   row.problem_id,
    problemName: row.problem_name,
    body:        row.body,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

export const notesRepo = {
  findAll(problemId?: string): Note[] {
    const db = getDb()
    if (problemId) {
      return (db
        .prepare('SELECT * FROM notes WHERE problem_id = ? ORDER BY updated_at DESC')
        .all(problemId) as NoteRow[])
        .map(rowToNote)
    }
    return (db
      .prepare('SELECT * FROM notes ORDER BY updated_at DESC')
      .all() as NoteRow[])
      .map(rowToNote)
  },

  /** Insert or update. If id is provided, updates; otherwise inserts. */
  upsert(note: Omit<Note, 'createdAt' | 'updatedAt'> & { id?: number }): Note {
    const db = getDb()
    const now = Math.floor(Date.now() / 1000)

    if (note.id) {
      // Update existing
      db.prepare(`
        UPDATE notes
        SET problem_id = @problemId, problem_name = @problemName,
            body = @body, updated_at = @updatedAt
        WHERE id = @id
      `).run({ ...note, updatedAt: now })
    } else {
      // Insert new
      const result = db.prepare(`
        INSERT INTO notes (problem_id, problem_name, body, created_at, updated_at)
        VALUES (@problemId, @problemName, @body, @createdAt, @updatedAt)
      `).run({ ...note, createdAt: now, updatedAt: now })
      note = { ...note, id: result.lastInsertRowid as number }
    }

    return db
      .prepare('SELECT * FROM notes WHERE id = ?')
      .get(note.id!) as Note
  },

  deleteById(id: number): void {
    getDb().prepare('DELETE FROM notes WHERE id = ?').run(id)
  },
}
