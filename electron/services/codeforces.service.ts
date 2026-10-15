import { httpGet, HttpError } from '../utils/http'
import { profileCache, TtlCache } from '../utils/cache'
import { logger } from '../utils/logger'
import type { CodeforcesProfile, RatingChange, Submission, Verdict, PracticeProblem } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// codeforces.service.ts — Codeforces API integration.
//
// Docs: https://codeforces.com/apiHelp
// All endpoints return { status: "OK"|"FAILED", result|comment }.
// ALWAYS check status — HTTP 200 does NOT mean valid data.
// Rate limit: undocumented, ~1 req/s to be safe. Don't fan-out requests.
// ─────────────────────────────────────────────────────────────────────────────

const CF_API = 'https://codeforces.com/api'

const problemCache = new TtlCache<PracticeProblem>(60 * 60 * 1000)
const problemsetCache = new TtlCache<{ problems: CfProblem[] }>(60 * 60 * 1000)

// ── Internal API response shapes ─────────────────────────────────────────────

interface CfResponse<T> {
  status: 'OK' | 'FAILED'
  result?: T
  comment?: string
}

interface CfProblem {
  contestId?: number
  index: string
  name: string
  rating?: number
  tags: string[]
}

interface CfUser {
  handle: string
  rating?: number
  maxRating?: number
  rank?: string
  maxRank?: string
  avatar: string
  titlePhoto?: string  // Full-size profile picture (preferred over avatar)
  country?: string
  city?: string
  organization?: string
  contribution: number
  friendOfCount: number
  registrationTimeSeconds: number
}

interface CfRatingChange {
  contestId: number
  contestName: string
  handle: string
  rank: number
  oldRating: number
  newRating: number
  ratingUpdateTimeSeconds: number
}

interface CfSubmission {
  id: number
  problem: {
    contestId?: number
    index: string
    name: string
    rating?: number
    tags: string[]
  }
  verdict?: string
  creationTimeSeconds: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseCfProblemInput(input: string): { contestId: number; index: string } | null {
  const clean = input.trim()
  if (!clean) return null

  // 1. URL format:
  // e.g. https://codeforces.com/problemset/problem/1900/A
  // e.g. https://codeforces.com/contest/1900/problem/A
  // e.g. https://codeforces.com/gym/102951/problem/A
  const urlMatch = clean.match(/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([A-Za-z0-9]+)/i)
  if (urlMatch) {
    return { contestId: parseInt(urlMatch[1], 10), index: urlMatch[2].toUpperCase() }
  }

  // 2. Direct code format:
  // e.g. "1900A", "1900/A", "1900 A", "1900-A", "4A", "1850C", "1234D1"
  const codeMatch = clean.match(/^(\d+)\s*[/_\-\s]?\s*([A-Za-z]\d*)$/)
  if (codeMatch) {
    return { contestId: parseInt(codeMatch[1], 10), index: codeMatch[2].toUpperCase() }
  }

  return null
}

function mapVerdict(v: string | undefined): Verdict {
  const map: Record<string, Verdict> = {
    OK:                     'OK',
    WRONG_ANSWER:           'WRONG_ANSWER',
    TIME_LIMIT_EXCEEDED:    'TIME_LIMIT_EXCEEDED',
    MEMORY_LIMIT_EXCEEDED:  'MEMORY_LIMIT_EXCEEDED',
    RUNTIME_ERROR:          'RUNTIME_ERROR',
    COMPILATION_ERROR:      'COMPILATION_ERROR',
    SKIPPED:                'SKIPPED',
    CHALLENGED:             'CHALLENGED',
  }
  return map[v ?? ''] ?? 'OTHER'
}

function cfProblemId(sub: CfSubmission): string {
  return `${sub.problem.contestId ?? 'gym'}_${sub.problem.index}`
}

export function normalizeCfImageUrl(url: string | undefined | null): string {
  if (!url) return ''
  let clean = url.trim()
  if (clean.startsWith('//')) {
    clean = 'https:' + clean
  }
  clean = clean.replace(/^http:\/\//i, 'https://')
  // userpic.codeforces.org returns 503 Service Unavailable.
  // codeforces.com/userpic/ reliably serves Codeforces avatars & titlePhotos with HTTP 200.
  clean = clean.replace(/^https?:\/\/userpic\.codeforces\.org\//i, 'https://codeforces.com/userpic/')
  return clean
}

// ── Public service API ────────────────────────────────────────────────────────

export const codeforcesService = {
  async getProfile(handle: string): Promise<CodeforcesProfile> {
    const cacheKey = `cf:profile:${handle.toLowerCase()}`
    const cached = profileCache.get(cacheKey) as CodeforcesProfile | null
    if (cached) return cached

    logger.info(`CF: fetching profile for ${handle}`)

    let data: CfResponse<CfUser[]>
    try {
      data = await httpGet<CfResponse<CfUser[]>>(
        `${CF_API}/user.info?handles=${encodeURIComponent(handle)}`
      )
    } catch (e) {
      // CF returns 400 for invalid/non-existent handles
      if (e instanceof HttpError && (e.status === 400 || e.status === 404)) {
        throw new Error(`No Codeforces account found for "${handle}". Please check the handle and try again.`)
      }
      throw e
    }

    if (data.status === 'FAILED' || !data.result?.length) {
      const cfComment = data.comment ?? ''
      if (cfComment.toLowerCase().includes('not found') || cfComment.toLowerCase().includes('illegal')) {
        throw new Error(`No Codeforces account found for "${handle}". Please check the handle and try again.`)
      }
      throw new Error(cfComment || `No Codeforces account found for "${handle}".`)
    }

    const u = data.result[0]
    logger.info(`CF avatar URL: ${u.avatar}`)
    logger.info(`CF titlePhoto URL: ${u.titlePhoto ?? '(none)'}`)

    const isPlaceholder = (s?: string) => !s || s.includes('no-title.jpg') || s.includes('no-avatar.jpg')
    const rawPhoto = (u.titlePhoto && !isPlaceholder(u.titlePhoto))
      ? u.titlePhoto
      : (u.avatar && !isPlaceholder(u.avatar))
        ? u.avatar
        : (u.titlePhoto || u.avatar || '')

    const profile: CodeforcesProfile = {
      handle:                   u.handle,
      rating:                   u.rating ?? null,
      maxRating:                u.maxRating ?? null,
      rank:                     u.rank ?? null,
      maxRank:                  u.maxRank ?? null,
      avatar:                   normalizeCfImageUrl(rawPhoto),
      country:                  u.country ?? null,
      city:                     u.city ?? null,
      organization:             u.organization ?? null,
      contribution:             u.contribution,
      friendOfCount:            u.friendOfCount,
      registrationTimeSeconds:  u.registrationTimeSeconds,
    }

    profileCache.set(cacheKey, profile)
    return profile
  },

  async getRatingHistory(handle: string): Promise<RatingChange[]> {
    const cacheKey = `cf:rating:${handle.toLowerCase()}`
    const cached = profileCache.get(cacheKey) as RatingChange[] | null
    if (cached) return cached

    logger.info(`CF: fetching rating history for ${handle}`)
    const data = await httpGet<CfResponse<CfRatingChange[]>>(
      `${CF_API}/user.rating?handle=${encodeURIComponent(handle)}`
    )

    if (data.status === 'FAILED') {
      throw new Error(data.comment ?? `Failed to fetch rating history for: ${handle}`)
    }

    const history: RatingChange[] = (data.result ?? []).map(r => ({ ...r }))
    profileCache.set(cacheKey, history)
    return history
  },

  /**
   * Fetch submissions newer than afterTimestamp (Unix seconds).
   * Pass null to fetch all (expensive for veteran users!).
   * CF doesn't support server-side pagination by time, so we fetch a large
   * batch and filter client-side.
   */
  async getSubmissions(handle: string, afterTimestamp: number | null): Promise<Omit<Submission, 'id' | 'handleId'>[]> {
    logger.info(`CF: fetching submissions for ${handle} (after=${afterTimestamp})`)

    // Fetch up to 10,000 submissions per call — CF default is 10
    const data = await httpGet<CfResponse<CfSubmission[]>>(
      `${CF_API}/user.status?handle=${encodeURIComponent(handle)}&from=1&count=10000`
    )

    if (data.status === 'FAILED') {
      throw new Error(data.comment ?? `Failed to fetch submissions for: ${handle}`)
    }

    return (data.result ?? [])
      .filter(s => {
        // Only keep judged submissions (skip In Queue / Testing)
        if (!s.verdict) return false
        // Incremental sync: skip anything we already have
        if (afterTimestamp && s.creationTimeSeconds <= afterTimestamp) return false
        return true
      })
      .map(s => ({
        problemId:     cfProblemId(s),
        problemName:   s.problem.name ?? '',
        tags:          Array.isArray(s.problem.tags) ? s.problem.tags : [],
        verdict:       mapVerdict(s.verdict),
        problemRating: s.problem.rating ?? null,
        submittedAt:   s.creationTimeSeconds,
      }))
  },

  /**
   * Fetch problem information by problem reference (e.g. "1900A", "4A", or Codeforces URL).
   */
  async getProblem(problemRef: string): Promise<PracticeProblem> {
    const parsed = parseCfProblemInput(problemRef)
    if (!parsed) {
      throw new Error(
        `Invalid problem format "${problemRef}". Please use a format like "1900A", "4A", "1850C", or paste a Codeforces problem URL.`
      )
    }

    const { contestId, index } = parsed
    const cacheKey = `cf:problem:${contestId}_${index}`
    const cached = problemCache.get(cacheKey)
    if (cached) return cached

    logger.info(`CF: fetching problem ${contestId}${index}`)

    // 1. Try contest.standings (returns all problems for this contest with ratings & tags)
    try {
      const data = await httpGet<CfResponse<{ problems: CfProblem[] }>>(
        `${CF_API}/contest.standings?contestId=${contestId}`
      )
      if (data.status === 'OK' && Array.isArray(data.result?.problems)) {
        const problems = data.result.problems
        const found = problems.find(p => p.index.toUpperCase() === index)
        if (found) {
          const problem: PracticeProblem = {
            id: `${contestId}${found.index.toUpperCase()}`,
            contestId,
            index: found.index.toUpperCase(),
            name: found.name,
            rating: found.rating ?? null,
            tags: Array.isArray(found.tags) ? found.tags : [],
            url: `https://codeforces.com/problemset/problem/${contestId}/${found.index.toUpperCase()}`,
          }
          problemCache.set(cacheKey, problem)
          return problem
        } else {
          const available = problems.map(p => p.index).join(', ')
          throw new Error(
            `Problem ${contestId}${index} not found in Contest ${contestId}. Available problems: ${available}`
          )
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Available problems:')) {
        throw e
      }
      logger.warn(`contest.standings lookup failed for contest ${contestId}:`, e)
    }

    // 2. Fallback to problemset.problems (cached in memory)
    try {
      let ps = problemsetCache.get('all')
      if (!ps) {
        const psRes = await httpGet<CfResponse<{ problems: CfProblem[] }>>(`${CF_API}/problemset.problems`)
        if (psRes.status === 'OK' && psRes.result?.problems) {
          ps = psRes.result
          problemsetCache.set('all', ps)
        }
      }

      if (ps?.problems) {
        const found = ps.problems.find(
          p => p.contestId === contestId && p.index.toUpperCase() === index
        )
        if (found) {
          const problem: PracticeProblem = {
            id: `${contestId}${found.index.toUpperCase()}`,
            contestId,
            index: found.index.toUpperCase(),
            name: found.name,
            rating: found.rating ?? null,
            tags: Array.isArray(found.tags) ? found.tags : [],
            url: `https://codeforces.com/problemset/problem/${contestId}/${found.index.toUpperCase()}`,
          }
          problemCache.set(cacheKey, problem)
          return problem
        }
      }
    } catch (e) {
      logger.warn('problemset.problems lookup fallback failed:', e)
    }

    throw new Error(
      `Problem "${contestId}${index}" could not be found on Codeforces. Please check the problem number and try again.`
    )
  },
}
