import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, Platform, ContestFilter, ResourceFilter } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// preload.ts — The ONLY surface the renderer can touch.
// All calls go through ipcRenderer.invoke → ipcMain.handle in the main process.
// Never import Node modules directly here (they must not leak into the renderer).
// ─────────────────────────────────────────────────────────────────────────────

const api: ElectronAPI = {
  // ── Contests ────────────────────────────────────────────────────────────────
  getContests: (filter?: ContestFilter) =>
    ipcRenderer.invoke('contests:getAll', filter),

  setReminder: (contestId: string, remindAt: number) =>
    ipcRenderer.invoke('contests:setReminder', contestId, remindAt),

  removeReminder: (contestId: string) =>
    ipcRenderer.invoke('contests:removeReminder', contestId),

  // ── Profile ─────────────────────────────────────────────────────────────────
  getProfile: (platform: Platform, username: string) =>
    ipcRenderer.invoke('profile:get', platform, username),

  getRatingHistory: (platform: Platform, username: string) =>
    ipcRenderer.invoke('profile:getRatingHistory', platform, username),

  syncProfile: (platform: Platform, username: string) =>
    ipcRenderer.invoke('profile:sync', platform, username),

  getSavedHandles: () =>
    ipcRenderer.invoke('profile:getSavedHandles'),

  removeHandle: (handleId: number) =>
    ipcRenderer.invoke('profile:removeHandle', handleId),

  // ── Analysis ────────────────────────────────────────────────────────────────
  getAnalysis: (platform: Platform, username: string) =>
    ipcRenderer.invoke('analysis:get', platform, username),

  compareProfiles: (
    a: { platform: Platform; username: string },
    b: { platform: Platform; username: string }
  ) => ipcRenderer.invoke('analysis:compare', a, b),

  // ── Resources ───────────────────────────────────────────────────────────────
  getResources: (filter?: ResourceFilter) =>
    ipcRenderer.invoke('resources:getAll', filter),

  bookmarkResource: (resourceId: number) =>
    ipcRenderer.invoke('resources:bookmark', resourceId),

  unbookmarkResource: (resourceId: number) =>
    ipcRenderer.invoke('resources:unbookmark', resourceId),

  // ── Notes ───────────────────────────────────────────────────────────────────
  getNotes: (problemId?: string) =>
    ipcRenderer.invoke('notes:getAll', problemId),

  upsertNote: (note: Parameters<ElectronAPI['upsertNote']>[0]) =>
    ipcRenderer.invoke('notes:upsert', note),

  deleteNote: (noteId: number) =>
    ipcRenderer.invoke('notes:delete', noteId),

  // ── Practice / Problems ─────────────────────────────────────────────────────
  getCFProblem: (problemRef: string) =>
    ipcRenderer.invoke('codeforces:getProblem', problemRef),

  // ── Settings ────────────────────────────────────────────────────────────────
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),

  updateSettings: (settings: Parameters<ElectronAPI['updateSettings']>[0]) =>
    ipcRenderer.invoke('settings:update', settings),
}

// ── Window controls (custom titlebar) ────────────────────────────────────────
const windowControls = {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close:    () => ipcRenderer.send('window:close'),
}

// ── Expose to renderer via contextBridge ─────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', api)
contextBridge.exposeInMainWorld('windowControls', windowControls)
