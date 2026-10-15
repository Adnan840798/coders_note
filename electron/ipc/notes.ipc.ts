import { ipcMain } from 'electron'
import { notesRepo } from '../db/repositories/notes.repo'
import { logger } from '../utils/logger'
import type { IpcResult, Note } from '../../shared/types'

function ok<T>(data: T): IpcResult<T>  { return { ok: true,  data  } }
function err(e: unknown): IpcResult<never> {
  const msg = e instanceof Error ? e.message : String(e)
  logger.error('IPC error (notes):', msg)
  return { ok: false, error: msg }
}

export function registerNoteHandlers(): void {

  ipcMain.handle('notes:getAll', async (_event, problemId?: string) => {
    try {
      return ok(notesRepo.findAll(problemId))
    } catch (e) { return err(e) }
  })

  ipcMain.handle('notes:upsert', async (_event, note: Omit<Note, 'createdAt' | 'updatedAt'> & { id?: number }) => {
    try {
      const saved = notesRepo.upsert(note)
      return ok(saved)
    } catch (e) { return err(e) }
  })

  ipcMain.handle('notes:delete', async (_event, noteId: number) => {
    try {
      notesRepo.deleteById(noteId)
      return ok(undefined)
    } catch (e) { return err(e) }
  })
}
