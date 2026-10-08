import type { ElectronAPI } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// src/lib/api.ts — Typed wrapper around window.electronAPI.
// Import this in Svelte components instead of accessing window.electronAPI directly.
// Throws if called outside Electron (i.e., in a plain browser — catches early).
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    electronAPI: ElectronAPI
    windowControls: {
      minimize: () => void
      maximize: () => void
      close:    () => void
    }
  }
}

function getApi(): ElectronAPI {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error(
      'window.electronAPI is not available. ' +
      'Make sure you are running inside Electron with the preload script loaded.'
    )
  }
  return window.electronAPI
}

export const api = new Proxy({} as ElectronAPI, {
  get(_target, prop: string) {
    return (getApi() as Record<string, unknown>)[prop]
  }
})

export const windowControls = {
  minimize: () => window.windowControls?.minimize(),
  maximize: () => window.windowControls?.maximize(),
  close:    () => window.windowControls?.close(),
}
