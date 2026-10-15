import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// analysis.service.test.ts — Unit tests for the analysis threshold logic.
// These test pure functions extracted from the analysis service.
// No DB or Electron mocks needed — pure in/out.
// ─────────────────────────────────────────────────────────────────────────────

// Re-export the classifyStrength function for testability
// (In production it's used internally by analysisService.getAnalysis)

const MIN_ATTEMPTS    = 3
const WEAK_ACCURACY   = 0.40
const STRONG_ACCURACY = 0.80

type TopicStrength = 'strong' | 'weak' | 'average' | 'insufficient'

function classifyStrength(accuracy: number, attempts: number): TopicStrength {
  if (attempts < MIN_ATTEMPTS)     return 'insufficient'
  if (accuracy < WEAK_ACCURACY)    return 'weak'
  if (accuracy >= STRONG_ACCURACY) return 'strong'
  return 'average'
}

function buildTopicStats(raw: { tag: string; attempts: number; solved: number }[]) {
  return raw.map(({ tag, attempts, solved }) => {
    const accuracy = attempts > 0 ? solved / attempts : 0
    return { tag, attempts, solved, accuracy, strength: classifyStrength(accuracy, attempts) }
  })
}

// ── classifyStrength ──────────────────────────────────────────────────────────

describe('classifyStrength', () => {
  it('returns insufficient when attempts < MIN_ATTEMPTS', () => {
    expect(classifyStrength(0.0, 0)).toBe('insufficient')
    expect(classifyStrength(0.0, 1)).toBe('insufficient')
    expect(classifyStrength(1.0, 2)).toBe('insufficient')
  })

  it('returns weak when accuracy < 40% with enough attempts', () => {
    expect(classifyStrength(0.0,  5)).toBe('weak')
    expect(classifyStrength(0.39, 4)).toBe('weak')
    expect(classifyStrength(0.39, 3)).toBe('weak')
  })

  it('returns strong when accuracy >= 80% with enough attempts', () => {
    expect(classifyStrength(0.80, 3)).toBe('strong')
    expect(classifyStrength(1.0,  10)).toBe('strong')
  })

  it('returns average for the middle band [40%, 80%)', () => {
    expect(classifyStrength(0.40, 5)).toBe('average')
    expect(classifyStrength(0.60, 5)).toBe('average')
    expect(classifyStrength(0.79, 5)).toBe('average')
  })

  it('boundary: exactly 40% is average, not weak', () => {
    expect(classifyStrength(0.40, 5)).toBe('average')
  })

  it('boundary: exactly 80% is strong', () => {
    expect(classifyStrength(0.80, 3)).toBe('strong')
  })
})

// ── buildTopicStats ───────────────────────────────────────────────────────────

describe('buildTopicStats', () => {
  it('computes accuracy correctly', () => {
    const stats = buildTopicStats([{ tag: 'dp', attempts: 10, solved: 7 }])
    expect(stats[0].accuracy).toBeCloseTo(0.7)
  })

  it('handles 0 attempts without division by zero', () => {
    const stats = buildTopicStats([{ tag: 'graphs', attempts: 0, solved: 0 }])
    expect(stats[0].accuracy).toBe(0)
    expect(stats[0].strength).toBe('insufficient')
  })

  it('filters weak topics correctly', () => {
    const raw = [
      { tag: 'dp',     attempts: 10, solved: 3 },  // 30% → weak
      { tag: 'greedy', attempts: 10, solved: 9 },  // 90% → strong
      { tag: 'math',   attempts: 1,  solved: 1 },  // insufficient
    ]
    const stats = buildTopicStats(raw)
    const weak   = stats.filter(s => s.strength === 'weak')
    const strong = stats.filter(s => s.strength === 'strong')

    expect(weak).toHaveLength(1)
    expect(weak[0].tag).toBe('dp')
    expect(strong).toHaveLength(1)
    expect(strong[0].tag).toBe('greedy')
  })
})
