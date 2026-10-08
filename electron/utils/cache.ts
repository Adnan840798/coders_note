// ─────────────────────────────────────────────────────────────────────────────
// cache.ts — In-memory TTL cache for the main process.
// Used to avoid hammering external APIs between IPC calls within the same
// session. SQLite is the persistent layer; this is just a hot in-memory layer.
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T
  expiresAt: number  // Unix ms
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>()

  constructor(private defaultTtlMs: number) {}

  get(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    })
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }

  invalidateAll(): void {
    this.store.clear()
  }

  /** Purge all expired entries (call periodically to avoid memory growth). */
  prune(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
  }
}

// ── Shared cache instances (one per service, exported as singletons) ──────────
export const contestsCache  = new TtlCache<unknown>(20 * 60 * 1000)  // 20 min
export const profileCache   = new TtlCache<unknown>(5  * 60 * 1000)  // 5 min
export const analysisCache  = new TtlCache<unknown>(10 * 60 * 1000)  // 10 min
