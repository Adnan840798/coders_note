import { writable } from 'svelte/store'
import { api } from '../lib/api'
import type { Contest, ContestFilter } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// contests.store.ts — Reactive contest list with loading/error state.
// ─────────────────────────────────────────────────────────────────────────────

interface ContestsState {
  contests: Contest[]
  loading:  boolean
  error:    string | null
  lastFetch: number | null
}

function createContestsStore() {
  const { subscribe, set, update } = writable<ContestsState>({
    contests:  [],
    loading:   false,
    error:     null,
    lastFetch: null,
  })

  return {
    subscribe,

    async fetch(filter?: ContestFilter) {
      update(s => ({ ...s, loading: true, error: null }))
      const result = await api.getContests(filter)

      if (result.ok) {
        set({ contests: result.data, loading: false, error: null, lastFetch: Date.now() })
      } else {
        update(s => ({ ...s, loading: false, error: result.error }))
      }
    },

    async setReminder(contestId: string, remindAt: number) {
      await api.setReminder(contestId, remindAt)
      // Optimistically update hasReminder flag
      update(s => ({
        ...s,
        contests: s.contests.map(c =>
          c.id === contestId ? { ...c, hasReminder: true } : c
        ),
      }))
    },

    async removeReminder(contestId: string) {
      await api.removeReminder(contestId)
      update(s => ({
        ...s,
        contests: s.contests.map(c =>
          c.id === contestId ? { ...c, hasReminder: false } : c
        ),
      }))
    },
  }
}

export const contestsStore = createContestsStore()
