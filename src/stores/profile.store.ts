import { writable } from 'svelte/store'
import { api } from '../lib/api'
import type { CodeforcesProfile, RatingChange, AnalysisResult, Handle, Platform } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// profile.store.ts — Active profile, rating history, and analysis.
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileState {
  handle:       string | null
  platform:     Platform
  profile:      CodeforcesProfile | null
  ratingHistory: RatingChange[]
  analysis:     AnalysisResult | null
  savedHandles: Handle[]
  syncing:      boolean
  loading:      boolean
  error:        string | null
}

function sanitizeError(msg: string | undefined | null): string {
  if (!msg) return 'An unexpected error occurred. Please try again.'
  // Only rewrite raw HTTP 5xx / network errors — not 4xx which already have clean messages
  if (/^HTTP [5]\d{2}/.test(msg)) return 'Could not reach Codeforces. Please check your connection and try again.'
  // Remove raw URLs from any remaining HTTP error messages as a safety net
  if (/^HTTP \d{3}/.test(msg)) return 'Invalid Codeforces handle. Please verify the username and try again.'
  return msg
}

function createProfileStore() {
  const { subscribe, set, update } = writable<ProfileState>({
    handle:        null,
    platform:      'codeforces',
    profile:       null,
    ratingHistory: [],
    analysis:      null,
    savedHandles:  [],
    syncing:       false,
    loading:       false,
    error:         null,
  })

  return {
    subscribe,

    async loadSavedHandles() {
      const result = await api.getSavedHandles()
      if (result.ok) update(s => ({ ...s, savedHandles: result.data }))
    },

    async sync(platform: Platform, username: string) {
      update(s => ({ ...s, syncing: true, error: null }))
      const result = await api.syncProfile(platform, username)

      if (result.ok) {
        update(s => ({ ...s, handle: username, platform, syncing: false, error: null }))
        // Load everything fresh after sync
        await this.load(platform, username)
        await this.loadSavedHandles()
      } else {
        update(s => ({ ...s, syncing: false, error: sanitizeError(result.error) }))
      }
    },

    async load(platform: Platform, username: string) {
      update(s => ({ ...s, loading: true, error: null }))

      const [profileRes, historyRes, analysisRes] = await Promise.all([
        api.getProfile(platform, username),
        api.getRatingHistory(platform, username),
        api.getAnalysis(platform, username),
      ])

      const error = !profileRes.ok
        ? sanitizeError(profileRes.error)
        : (!analysisRes.ok ? sanitizeError(analysisRes.error) : null)

      update(s => ({
        ...s,
        loading:       false,
        handle:        username,
        platform,
        profile:       profileRes.ok  ? profileRes.data  : null,
        ratingHistory: historyRes.ok  ? historyRes.data  : [],
        analysis:      analysisRes.ok ? analysisRes.data : null,
        error,
      }))
    },

    async removeHandle(handleId: number) {
      await api.removeHandle(handleId)
      await this.loadSavedHandles()
    },

    clearError() {
      update(s => ({ ...s, error: null }))
    },
  }
}

export const profileStore = createProfileStore()
