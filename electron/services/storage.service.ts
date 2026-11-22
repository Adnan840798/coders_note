import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { AppSettings, Handle, Platform } from '../../shared/types'
import { logger } from '../utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// storage.service.ts — Lightweight JSON storage for settings and saved handles.
// Stored in user's AppData directory. Completely replaces SQLite.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  defaultHandle: '',
  defaultPlatform: 'codeforces',
  notificationsEnabled: true,
  reminderLeadMinutes: 30,
  cacheRefreshIntervalMinutes: 20,
}

interface StorageData {
  settings: AppSettings
  savedHandles: Handle[]
  bookmarkedResourceIds: number[]
  reminders: Record<string, number> // contestId -> remindAt timestamp
}

const DEFAULT_DATA: StorageData = {
  settings: DEFAULT_SETTINGS,
  savedHandles: [],
  bookmarkedResourceIds: [],
  reminders: {},
}

function getFilePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return join(dir, 'app-storage.json')
}

let _cache: StorageData | null = null

function loadData(): StorageData {
  if (_cache) return _cache

  const file = getFilePath()
  if (!existsSync(file)) {
    _cache = { ...DEFAULT_DATA }
    saveData(_cache)
    return _cache
  }

  try {
    const raw = readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<StorageData>
    _cache = {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      savedHandles: Array.isArray(parsed.savedHandles) ? parsed.savedHandles : [],
      bookmarkedResourceIds: Array.isArray(parsed.bookmarkedResourceIds) ? parsed.bookmarkedResourceIds : [],
      reminders: parsed.reminders || {},
    }
  } catch (err) {
    logger.warn('Failed to parse app-storage.json, resetting to defaults:', err)
    _cache = { ...DEFAULT_DATA }
  }

  return _cache
}

function saveData(data: StorageData): void {
  try {
    _cache = data
    const file = getFilePath()
    writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    logger.error('Failed to write app-storage.json:', err)
  }
}

export const storageService = {
  getSettings(): AppSettings {
    return { ...loadData().settings }
  },

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    const data = loadData()
    data.settings = { ...data.settings, ...updates }
    saveData(data)
    return { ...data.settings }
  },

  getSavedHandles(): Handle[] {
    return [...loadData().savedHandles]
  },

  saveHandle(platform: Platform, username: string): Handle {
    const data = loadData()
    const cleanUser = username.trim()
    const existingIndex = data.savedHandles.findIndex(
      h => h.platform === platform && h.username.toLowerCase() === cleanUser.toLowerCase()
    )

    const now = Math.floor(Date.now() / 1000)
    let handle: Handle

    if (existingIndex >= 0) {
      data.savedHandles[existingIndex].lastSyncedAt = now
      handle = data.savedHandles[existingIndex]
    } else {
      const nextId = data.savedHandles.length > 0
        ? Math.max(...data.savedHandles.map(h => h.id)) + 1
        : 1
      handle = {
        id: nextId,
        platform,
        username: cleanUser,
        lastSyncedAt: now,
      }
      data.savedHandles.push(handle)
    }

    saveData(data)
    return handle
  },

  removeHandle(handleId: number): void {
    const data = loadData()
    data.savedHandles = data.savedHandles.filter(h => h.id !== handleId)
    saveData(data)
  },

  getBookmarks(): Set<number> {
    return new Set(loadData().bookmarkedResourceIds)
  },

  addBookmark(resourceId: number): void {
    const data = loadData()
    if (!data.bookmarkedResourceIds.includes(resourceId)) {
      data.bookmarkedResourceIds.push(resourceId)
      saveData(data)
    }
  },

  removeBookmark(resourceId: number): void {
    const data = loadData()
    data.bookmarkedResourceIds = data.bookmarkedResourceIds.filter(id => id !== resourceId)
    saveData(data)
  },

  getReminders(): Record<string, number> {
    return { ...loadData().reminders }
  },

  setReminder(contestId: string, remindAt: number): void {
    const data = loadData()
    data.reminders[contestId] = remindAt
    saveData(data)
  },

  removeReminder(contestId: string): void {
    const data = loadData()
    delete data.reminders[contestId]
    saveData(data)
  },
}
