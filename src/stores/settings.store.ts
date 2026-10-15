import { writable, derived } from 'svelte/store'
import { api } from '../lib/api'
import type { AppSettings } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// settings.store.ts — Global settings reactive store.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  theme:                       'light',
  defaultHandle:               null,
  defaultPlatform:             'codeforces',
  notificationsEnabled:        true,
  reminderLeadMinutes:         30,
  cacheRefreshIntervalMinutes: 20,
}

function createSettingsStore() {
  const { subscribe, set, update } = writable<AppSettings>(DEFAULT_SETTINGS)

  return {
    subscribe,

    async load() {
      const result = await api.getSettings()
      if (result.ok) set(result.data)
    },

    async update(changes: Partial<AppSettings>) {
      const result = await api.updateSettings(changes)
      if (result.ok) set(result.data)
    },
  }
}

export const settings = createSettingsStore()

// Derived: current theme class for the <body>
export const themeClass = derived(settings, $s => $s.theme)
