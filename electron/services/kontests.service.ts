import { httpGet } from '../utils/http'
import { contestsCache } from '../utils/cache'
import { logger } from '../utils/logger'
import type { Contest } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// kontests.service.ts — Fetches contests from kontests.net (free aggregator).
//
// Endpoint: https://kontests.net/api/v1/all  (returns all platforms)
// This is an UNOFFICIAL API — it can change without notice.
// Treat it as best-effort; if it's down, show cached data.
// ─────────────────────────────────────────────────────────────────────────────

const KONTESTS_API = 'https://kontests.net/api/v1'
const CACHE_KEY = 'kontests:all'

// Platform name normalisations (what kontests returns → our platform keys)
const SITE_MAP: Record<string, string> = {
  'CodeForces':       'codeforces',
  'CodeForces::Gym':  'codeforces',
  'LeetCode':         'leetcode',
  'AtCoder':          'atcoder',
  'CodeChef':         'codechef',
  'HackerRank':       'hackerrank',
  'HackerEarth':      'hackerearth',
  'TopCoder':         'topcoder',
  'CS Academy':       'csacademy',
  'Kick Start':       'kickstart',
}

interface KontestsContest {
  name: string
  url: string
  start_time: string   // ISO 8601, always UTC
  end_time: string
  duration: string     // seconds as string e.g. "7200.0"
  site: string
  in_24_hours: string  // "Yes" | "No"
  status: string       // "BEFORE" | "CODING" | "FINISHED"
}

function parseKontestsContest(raw: KontestsContest): Omit<Contest, 'status' | 'hasReminder'> | null {
  try {
    const startMs  = new Date(raw.start_time).getTime()
    const duration = Math.round(parseFloat(raw.duration))

    // Skip invalid entries
    if (isNaN(startMs) || isNaN(duration) || duration <= 0) return null

    const id = `${(SITE_MAP[raw.site] ?? raw.site).replace(/\s/g, '_')}_${startMs}`

    return {
      id,
      site:      SITE_MAP[raw.site] ?? raw.site.toLowerCase(),
      title:     raw.name,
      url:       raw.url,
      startTime: Math.floor(startMs / 1000),   // → Unix seconds UTC
      duration,
    }
  } catch {
    return null
  }
}

interface CfContestItem {
  id: number
  name: string
  type: string
  phase: 'BEFORE' | 'CODING' | 'PENDING_SYSTEM_TEST' | 'SYSTEM_TEST' | 'FINISHED'
  frozen: boolean
  durationSeconds: number
  startTimeSeconds?: number
  relativeTimeSeconds?: number
}

interface CfContestListResponse {
  status: 'OK' | 'FAILED'
  result?: CfContestItem[]
  comment?: string
}

export const kontestsService = {
  async getAll(): Promise<Omit<Contest, 'status' | 'hasReminder'>[]> {
    const cached = contestsCache.get(CACHE_KEY) as Omit<Contest, 'status' | 'hasReminder'>[] | null
    if (cached) {
      logger.debug('Returning cached contests from memory')
      return cached
    }

    try {
      logger.info('Fetching contests from kontests.net')
      const raw = await httpGet<KontestsContest[]>(`${KONTESTS_API}/all`)

      const contests = raw
        .map(parseKontestsContest)
        .filter((c): c is Omit<Contest, 'status' | 'hasReminder'> => c !== null)

      if (contests.length > 0) {
        contestsCache.set(CACHE_KEY, contests)
        logger.info(`Fetched ${contests.length} contests from kontests.net`)
        return contests
      }
    } catch (err) {
      logger.warn(`kontests.net fetch failed: ${err} — falling back to Codeforces API`)
    }

    // Fallback: Fetch directly from Codeforces API
    try {
      const res = await httpGet<CfContestListResponse>('https://codeforces.com/api/contest.list?gym=false')
      if (res.status === 'OK' && res.result) {
        const cfContests: Omit<Contest, 'status' | 'hasReminder'>[] = res.result
          .filter(c => c.startTimeSeconds && c.phase !== 'FINISHED')
          .map(c => ({
            id:        `codeforces_${c.id}`,
            site:      'codeforces',
            title:     c.name,
            url:       `https://codeforces.com/contest/${c.id}`,
            startTime: c.startTimeSeconds!,
            duration:  c.durationSeconds,
          }))

        if (cfContests.length > 0) {
          contestsCache.set(CACHE_KEY, cfContests)
          logger.info(`Fallback: Loaded ${cfContests.length} contests from Codeforces API`)
          return cfContests
        }
      }
    } catch (cfErr) {
      logger.error(`Codeforces contest fallback also failed: ${cfErr}`)
    }

    return []
  },
}
