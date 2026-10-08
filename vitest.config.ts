import { defineConfig } from 'vitest/config'

// ─────────────────────────────────────────────────────────────────────────────
// vitest.config.ts — Separate Vitest config so unit tests don't try to
// load the electron-vite config (which uses ESM-only Svelte plugin).
// Unit tests are pure TypeScript — no Electron, no Svelte needed.
// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      '@shared': new URL('./shared', import.meta.url).pathname,
    }
  }
})
