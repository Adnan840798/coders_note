import { describe, it, expect } from 'vitest'
import { parseCfProblemInput, normalizeCfImageUrl } from '../../electron/services/codeforces.service'

describe('parseCfProblemInput', () => {
  it('parses standard problem codes', () => {
    expect(parseCfProblemInput('1900A')).toEqual({ contestId: 1900, index: 'A' })
    expect(parseCfProblemInput('4A')).toEqual({ contestId: 4, index: 'A' })
    expect(parseCfProblemInput('71a')).toEqual({ contestId: 71, index: 'A' })
    expect(parseCfProblemInput('1850C')).toEqual({ contestId: 1850, index: 'C' })
    expect(parseCfProblemInput('1234D1')).toEqual({ contestId: 1234, index: 'D1' })
  })

  it('parses problem codes with separator variants', () => {
    expect(parseCfProblemInput('1900/A')).toEqual({ contestId: 1900, index: 'A' })
    expect(parseCfProblemInput('1900 A')).toEqual({ contestId: 1900, index: 'A' })
    expect(parseCfProblemInput('1900-A')).toEqual({ contestId: 1900, index: 'A' })
    expect(parseCfProblemInput('1900_B')).toEqual({ contestId: 1900, index: 'B' })
  })

  it('parses Codeforces URLs', () => {
    expect(parseCfProblemInput('https://codeforces.com/problemset/problem/1900/A')).toEqual({
      contestId: 1900,
      index: 'A',
    })
    expect(parseCfProblemInput('https://codeforces.com/contest/1900/problem/A')).toEqual({
      contestId: 1900,
      index: 'A',
    })
    expect(parseCfProblemInput('https://codeforces.com/gym/102951/problem/B')).toEqual({
      contestId: 102951,
      index: 'B',
    })
  })

  it('handles surrounding whitespace', () => {
    expect(parseCfProblemInput('   1878D   ')).toEqual({ contestId: 1878, index: 'D' })
    expect(parseCfProblemInput('  https://codeforces.com/problemset/problem/4/A/  ')).toEqual({
      contestId: 4,
      index: 'A',
    })
  })

  it('rejects invalid inputs', () => {
    expect(parseCfProblemInput('')).toBeNull()
    expect(parseCfProblemInput('   ')).toBeNull()
    expect(parseCfProblemInput('hello')).toBeNull()
    expect(parseCfProblemInput('1900')).toBeNull()
    expect(parseCfProblemInput('A')).toBeNull()
    expect(parseCfProblemInput('abc123def')).toBeNull()
  })
})

describe('normalizeCfImageUrl', () => {
  it('rewrites userpic.codeforces.org to codeforces.com/userpic', () => {
    expect(normalizeCfImageUrl('https://userpic.codeforces.org/1542827/title/2d7e4affe5c3dae3.jpg'))
      .toBe('https://codeforces.com/userpic/1542827/title/2d7e4affe5c3dae3.jpg')
    expect(normalizeCfImageUrl('http://userpic.codeforces.org/1542827/avatar/6347c25d03217640.jpg'))
      .toBe('https://codeforces.com/userpic/1542827/avatar/6347c25d03217640.jpg')
  })

  it('handles protocol-relative URLs', () => {
    expect(normalizeCfImageUrl('//userpic.codeforces.org/no-avatar.jpg'))
      .toBe('https://codeforces.com/userpic/no-avatar.jpg')
  })

  it('handles empty or missing URLs', () => {
    expect(normalizeCfImageUrl('')).toBe('')
    expect(normalizeCfImageUrl(undefined)).toBe('')
    expect(normalizeCfImageUrl(null)).toBe('')
  })
})
