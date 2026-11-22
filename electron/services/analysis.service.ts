import { codeforcesService } from './codeforces.service'
import { analysisCache } from '../utils/cache'
import { logger } from '../utils/logger'
import type { AnalysisResult, BestContestRank, Platform, TopicStat, TopicStrength, Verdict } from '../../shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// analysis.service.ts — In-memory weak/strong topic detection + profile comparison.
// Computes analytics directly from Codeforces API data in memory (zero database).
//
// THRESHOLDS:
//   MIN_ATTEMPTS  = 3    — fewer than this → "insufficient data", never flagged
//   WEAK_ACCURACY = 0.40 — accuracy < 40% with ≥ MIN_ATTEMPTS → "weak"
//   STRONG_ACCURACY = 0.80 — accuracy ≥ 80% with ≥ MIN_ATTEMPTS → "strong"
//   Otherwise → "average"
// ─────────────────────────────────────────────────────────────────────────────

const MIN_ATTEMPTS    = 3
const WEAK_ACCURACY   = 0.40
const STRONG_ACCURACY = 0.80

export function classifyStrength(accuracy: number, attempts: number): TopicStrength {
  if (attempts < MIN_ATTEMPTS)  return 'insufficient'
  if (accuracy < WEAK_ACCURACY) return 'weak'
  if (accuracy >= STRONG_ACCURACY) return 'strong'
  return 'average'
}

export function buildTopicStats(
  raw: { tag: string; attempts: number; solved: number }[]
): TopicStat[] {
  return raw.map(({ tag, attempts, solved }) => {
    const accuracy = attempts > 0 ? solved / attempts : 0
    return {
      tag,
      attempts,
      solved,
      accuracy,
      strength: classifyStrength(accuracy, attempts),
    }
  })
}

export const analysisService = {
  /**
   * Compute full analysis for a handle directly in memory from Codeforces APIs.
   */
  async getAnalysis(platform: Platform, username: string): Promise<AnalysisResult> {
    const cleanUser = username.trim()
    logger.info(`Computing analysis for ${platform}:${cleanUser}`)

    const cacheKey = `analysis:${platform}:${cleanUser.toLowerCase()}`
    const cached = analysisCache.get(cacheKey) as AnalysisResult | null
    if (cached) {
      logger.info(`Returning cached analysis for ${cleanUser}`)
      return cached
    }

    if (platform !== 'codeforces') {
      throw new Error(`Platform "${platform}" is not yet supported`)
    }

    // 1. Fetch all submissions from Codeforces API
    const allSubs = await codeforcesService.getSubmissions(cleanUser, null)

    // 2. Initialize aggregations
    const verdictBreakdown: Record<Verdict, number> = {
      OK:                    0,
      WRONG_ANSWER:          0,
      TIME_LIMIT_EXCEEDED:   0,
      MEMORY_LIMIT_EXCEEDED: 0,
      RUNTIME_ERROR:         0,
      COMPILATION_ERROR:     0,
      SKIPPED:               0,
      CHALLENGED:            0,
      OTHER:                 0,
    }

    const tagMap = new Map<string, { attempts: number; solved: number }>()
    const solvesByRating: Record<number, number> = {}
    const dailySolves: Record<string, number> = {}
    const solvedProblemIds = new Set<string>()
    const attemptedProblemIds = new Set<string>()

    for (const sub of allSubs) {
      // Verdict count
      const v = sub.verdict as Verdict
      if (verdictBreakdown[v] !== undefined) {
        verdictBreakdown[v]++
      } else {
        verdictBreakdown.OTHER++
      }

      attemptedProblemIds.add(sub.problemId)
      const isOk = sub.verdict === 'OK'

      // Tag statistics
      if (Array.isArray(sub.tags)) {
        for (const tag of sub.tags) {
          if (!tag) continue
          let stat = tagMap.get(tag)
          if (!stat) {
            stat = { attempts: 0, solved: 0 }
            tagMap.set(tag, stat)
          }
          stat.attempts++
          if (isOk) {
            stat.solved++
          }
        }
      }

      // Solves breakdown & heatmap (only for accepted solutions)
      if (isOk && !solvedProblemIds.has(sub.problemId)) {
        solvedProblemIds.add(sub.problemId)

        // Rating distribution
        if (sub.problemRating && sub.problemRating > 0) {
          solvesByRating[sub.problemRating] = (solvesByRating[sub.problemRating] || 0) + 1
        }

        // Daily solves heatmap: YYYY-MM-DD
        if (sub.submittedAt) {
          const date = new Date(sub.submittedAt * 1000).toISOString().slice(0, 10)
          dailySolves[date] = (dailySolves[date] || 0) + 1
        }
      }
    }

    // 3. Build topic stats
    const rawTagStats = Array.from(tagMap.entries()).map(([tag, stat]) => ({
      tag,
      attempts: stat.attempts,
      solved: stat.solved,
    }))

    const allTopics = buildTopicStats(rawTagStats)
    const weakTopics = allTopics.filter(t => t.strength === 'weak')
    const strongTopics = allTopics.filter(t => t.strength === 'strong')

    const totalSubmissions = allSubs.length
    const totalSolved = solvedProblemIds.size
    const uniqueAttempted = attemptedProblemIds.size
    const overallAccuracy = uniqueAttempted > 0
      ? (totalSolved / uniqueAttempted) * 100
      : (totalSubmissions > 0 ? (verdictBreakdown.OK / totalSubmissions) * 100 : 0)

    // Rating measurements
    const ratingNums = Object.keys(solvesByRating).map(Number).filter(n => !isNaN(n) && n > 0)
    const maxSolvedRating = ratingNums.length > 0 ? Math.max(...ratingNums) : null

    let mostSolvedRating: { rating: string; count: number } | null = null
    let maxRatingCount = 0
    for (const [rating, count] of Object.entries(solvesByRating)) {
      if (count > maxRatingCount) {
        maxRatingCount = count
        mostSolvedRating = { rating, count }
      }
    }

    let mostSolvedTopic: { tag: string; solved: number } | null = null
    const sortedBySolved = [...allTopics].sort((a, b) => b.solved - a.solved)
    if (sortedBySolved.length > 0 && sortedBySolved[0].solved > 0) {
      mostSolvedTopic = { tag: sortedBySolved[0].tag, solved: sortedBySolved[0].solved }
    }

    // 4. Contest & Rating History
    let totalContests = 0
    let bestContestRank: BestContestRank | null = null
    let maxRatingGain: number | null = null

    try {
      const history = await codeforcesService.getRatingHistory(cleanUser)
      totalContests = history.length
      if (history.length > 0) {
        const best = history.reduce((prev, curr) => curr.rank < prev.rank ? curr : prev, history[0])
        bestContestRank = {
          rank: best.rank,
          contestName: best.contestName,
          contestId: best.contestId,
        }
        const gains = history.map(h => h.newRating - h.oldRating)
        const maxGain = Math.max(...gains)
        if (maxGain > 0) maxRatingGain = maxGain
      }
    } catch (e) {
      logger.warn(`Could not fetch rating history for ${cleanUser}:`, e)
    }

    const result: AnalysisResult = {
      handle: cleanUser,
      platform,
      weakTopics,
      strongTopics,
      allTopics,
      verdictBreakdown,
      solvesByRating,
      dailySolves,
      totalSolved,
      totalSubmissions,
      overallAccuracy,
      maxSolvedRating,
      mostSolvedRating,
      mostSolvedTopic,
      totalContests,
      bestContestRank,
      maxRatingGain,
      computedAt: Math.floor(Date.now() / 1000),
    }

    // Cache in memory for 15 minutes
    analysisCache.set(cacheKey, result)
    return result
  },

  /**
   * Compare two handles side-by-side in memory.
   */
  async compareProfiles(
    a: { platform: Platform; username: string },
    b: { platform: Platform; username: string }
  ): Promise<{ a: AnalysisResult; b: AnalysisResult }> {
    let resultA: AnalysisResult
    try {
      resultA = await this.getAnalysis(a.platform, a.username)
    } catch (e) {
      throw new Error(`HANDLE_A:${e instanceof Error ? e.message : String(e)}`)
    }
    let resultB: AnalysisResult
    try {
      resultB = await this.getAnalysis(b.platform, b.username)
    } catch (e) {
      throw new Error(`HANDLE_B:${e instanceof Error ? e.message : String(e)}`)
    }
    return { a: resultA, b: resultB }
  },

  /** Invalidate cached analysis for a handle */
  invalidate(platform: Platform, username: string): void {
    const key = `analysis:${platform}:${username.toLowerCase()}`
    analysisCache.invalidate(key)
  },
}
