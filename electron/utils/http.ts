import { logger } from './logger'

// ─────────────────────────────────────────────────────────────────────────────
// http.ts — fetch wrapper with timeout + exponential backoff retry.
// All external API calls go through this. Never call fetch() directly.
// ─────────────────────────────────────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  timeoutMs?: number   // default 10s
  retries?: number     // default 1 retry (2 total attempts)
  retryDelayMs?: number // base delay, doubles each retry
}

export class HttpError extends Error {
  constructor(public readonly status: number, url: string) {
    super(`HTTP ${status} — ${url}`)
    this.name = 'HttpError'
  }
}

export async function httpGet<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const {
    timeoutMs    = 10_000,
    retries      = 1,
    retryDelayMs = 1_000,
    ...fetchOpts
  } = opts

  let lastError: Error = new Error('Unknown error')

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = retryDelayMs * Math.pow(2, attempt - 1)
      logger.warn(`Retrying ${url} (attempt ${attempt + 1}) after ${delay}ms`)
      await sleep(delay)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        ...fetchOpts,
        signal: controller.signal,
        headers: {
          'User-Agent': 'CodersNote/0.1 (university project)',
          'Accept': 'application/json',
          ...fetchOpts.headers,
        }
      })

      if (!res.ok) {
        const e = new HttpError(res.status, url)
        // 4xx errors are client errors — retrying won't help, throw immediately
        if (res.status >= 400 && res.status < 500) throw e
        lastError = e
        continue
      }

      return (await res.json()) as T
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
      logger.warn(`Request failed (attempt ${attempt + 1}): ${lastError.message}`)
    } finally {
      clearTimeout(timer)
    }
  }

  logger.error(`All attempts failed for: ${url}`, lastError.message)
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
