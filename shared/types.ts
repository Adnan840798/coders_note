// ─────────────────────────────────────────────────────────────────────────────
// shared/types.ts — Types shared between Electron main process and Svelte renderer
// ─────────────────────────────────────────────────────────────────────────────

// ── Generic IPC response envelope ────────────────────────────────────────────
export type IpcOk<T> = { ok: true; data: T }
export type IpcError = { ok: false; error: string }
export type IpcResult<T> = IpcOk<T> | IpcError

// ── Platform identifiers ──────────────────────────────────────────────────────
export type Platform =
  | 'codeforces'
  | 'leetcode'
  | 'atcoder'
  | 'codechef'
  | 'hackerrank'
  | 'other'

// ── Contest ───────────────────────────────────────────────────────────────────
export type ContestStatus = 'upcoming' | 'running' | 'ended'

export interface Contest {
  id: string
  site: Platform | string
  title: string
  url: string
  startTime: number   // Unix timestamp (UTC seconds)
  duration: number    // Duration in seconds
  status: ContestStatus
  hasReminder?: boolean
}

// ── Handle / Profile ──────────────────────────────────────────────────────────
export interface Handle {
  id: number
  platform: Platform
  username: string
  lastSyncedAt: number | null  // Unix timestamp
}

export interface CodeforcesProfile {
  handle: string
  rating: number | null
  maxRating: number | null
  rank: string | null
  maxRank: string | null
  avatar: string
  country: string | null
  city: string | null
  organization: string | null
  contribution: number
  friendOfCount: number
  registrationTimeSeconds: number
}

export interface RatingChange {
  contestId: number
  contestName: string
  handle: string
  rank: number
  oldRating: number
  newRating: number
  ratingUpdateTimeSeconds: number
}

// ── Submission ────────────────────────────────────────────────────────────────
export type Verdict =
  | 'OK'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'RUNTIME_ERROR'
  | 'COMPILATION_ERROR'
  | 'SKIPPED'
  | 'CHALLENGED'
  | 'OTHER'

export interface Submission {
  id: number
  handleId: number
  problemId: string
  problemName: string
  tags: string[]          // stored as JSON text in SQLite
  verdict: Verdict
  problemRating: number | null
  submittedAt: number     // Unix timestamp
}

// ── Analysis ──────────────────────────────────────────────────────────────────
export type TopicStrength = 'strong' | 'weak' | 'average' | 'insufficient'

export interface TopicStat {
  tag: string
  attempts: number
  solved: number
  accuracy: number        // 0–1
  strength: TopicStrength
}

export interface BestContestRank {
  rank: number
  contestName: string
  contestId: number
}

export interface AnalysisResult {
  handle: string
  platform: Platform
  weakTopics: TopicStat[]
  strongTopics: TopicStat[]
  allTopics: TopicStat[]
  verdictBreakdown: Record<Verdict, number>
  solvesByRating: Record<string, number>   // e.g. { "800": 12, "1000": 8, ... }
  dailySolves: Record<string, number>      // e.g. { "2023-10-14": 3 }
  totalSolved: number
  totalSubmissions: number
  overallAccuracy: number                 // 0–100%
  maxSolvedRating: number | null
  mostSolvedRating: { rating: string; count: number } | null
  mostSolvedTopic: { tag: string; solved: number } | null
  totalContests: number
  bestContestRank: BestContestRank | null
  maxRatingGain: number | null
  computedAt: number
}

// ── Resources ─────────────────────────────────────────────────────────────────
export type ResourceType = 'article' | 'video' | 'problem-set' | 'book' | 'course'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export interface Resource {
  id: number
  title: string
  url: string
  topic: string
  difficulty: Difficulty
  type: ResourceType
  description: string
  isBookmarked?: boolean
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export interface Note {
  id: number
  problemId: string
  problemName: string
  body: string
  createdAt: number
  updatedAt: number
}

// ── Practice ──────────────────────────────────────────────────────────────────
export interface PracticeProblem {
  id: string              // e.g. "1900A"
  contestId: number       // e.g. 1900
  index: string           // e.g. "A"
  name: string            // e.g. "Cover in Water"
  rating: number | null   // e.g. 800
  tags: string[]          // e.g. ["greedy", "implementation"]
  url: string             // e.g. "https://codeforces.com/problemset/problem/1900/A"
  solved?: boolean
  addedAt?: number
}

// ── Reminder ──────────────────────────────────────────────────────────────────
export interface Reminder {
  id: number
  contestId: string
  remindAt: number   // Unix timestamp
  fired: boolean
}

// ── Settings ──────────────────────────────────────────────────────────────────
export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  defaultHandle: string | null
  defaultPlatform: Platform
  notificationsEnabled: boolean
  reminderLeadMinutes: number    // How many minutes before contest to notify
  cacheRefreshIntervalMinutes: number
}

// ── Electron API surface (exposed via contextBridge) ─────────────────────────
export interface ElectronAPI {
  // Contests
  getContests: (filter?: ContestFilter) => Promise<IpcResult<Contest[]>>
  setReminder: (contestId: string, remindAt: number) => Promise<IpcResult<void>>
  removeReminder: (contestId: string) => Promise<IpcResult<void>>

  // Profile
  getProfile: (platform: Platform, username: string) => Promise<IpcResult<CodeforcesProfile>>
  getRatingHistory: (platform: Platform, username: string) => Promise<IpcResult<RatingChange[]>>
  syncProfile: (platform: Platform, username: string) => Promise<IpcResult<void>>
  getSavedHandles: () => Promise<IpcResult<Handle[]>>
  removeHandle: (handleId: number) => Promise<IpcResult<void>>

  // Analysis
  getAnalysis: (platform: Platform, username: string) => Promise<IpcResult<AnalysisResult>>
  compareProfiles: (a: { platform: Platform; username: string }, b: { platform: Platform; username: string }) => Promise<IpcResult<{ a: AnalysisResult; b: AnalysisResult }>>

  // Resources
  getResources: (filter?: ResourceFilter) => Promise<IpcResult<Resource[]>>
  bookmarkResource: (resourceId: number) => Promise<IpcResult<void>>
  unbookmarkResource: (resourceId: number) => Promise<IpcResult<void>>

  // Notes
  getNotes: (problemId?: string) => Promise<IpcResult<Note[]>>
  upsertNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }) => Promise<IpcResult<Note>>
  deleteNote: (noteId: number) => Promise<IpcResult<void>>

  // Practice / Problems
  getCFProblem: (problemRef: string) => Promise<IpcResult<PracticeProblem>>

  // Settings
  getSettings: () => Promise<IpcResult<AppSettings>>
  updateSettings: (settings: Partial<AppSettings>) => Promise<IpcResult<AppSettings>>
}

// ── Filter shapes ─────────────────────────────────────────────────────────────
export interface ContestFilter {
  sites?: string[]
  status?: ContestStatus[]
  search?: string
}

export interface ResourceFilter {
  topic?: string
  difficulty?: Difficulty
  type?: ResourceType
  bookmarkedOnly?: boolean
  search?: string
}
