-- ─────────────────────────────────────────────────────────────────────────────
-- 001_init.sql — Full initial schema for Coders Note
-- Run once at first launch. All subsequent changes go in numbered migrations.
-- ─────────────────────────────────────────────────────────────────────────────

PRAGMA journal_mode = WAL;   -- Better concurrency for reads during writes
PRAGMA foreign_keys = OFF;

-- ── handles ──────────────────────────────────────────────────────────────────
-- One row per (platform, username) pair. A user tracking both CF and LC
-- has two separate handle rows.
CREATE TABLE IF NOT EXISTS handles (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  platform       TEXT    NOT NULL CHECK (platform IN ('codeforces','leetcode','atcoder','codechef','hackerrank','other')),
  username       TEXT    NOT NULL,
  display_name   TEXT,
  avatar_url     TEXT,
  rating         INTEGER,
  rank           TEXT,
  last_synced_at INTEGER,                          -- Unix timestamp (seconds)
  UNIQUE (platform, username)
);

-- ── submissions ───────────────────────────────────────────────────────────────
-- Raw submission cache fetched from the platform API.
-- tags stored as JSON text array e.g. '["dp","graphs"]'
CREATE TABLE IF NOT EXISTS submissions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  handle_id       INTEGER NOT NULL REFERENCES handles(id) ON DELETE CASCADE,
  problem_id      TEXT    NOT NULL,                -- e.g. "1900A" for CF
  problem_name    TEXT    NOT NULL,
  tags            TEXT    NOT NULL DEFAULT '[]',   -- JSON array of strings
  verdict         TEXT    NOT NULL,
  problem_rating  INTEGER,                         -- NULL if unrated
  submitted_at    INTEGER NOT NULL                 -- Unix timestamp
);

-- Heavy query paths: profile dashboard + analysis both filter by handle + tags/verdict
CREATE INDEX IF NOT EXISTS idx_submissions_handle    ON submissions(handle_id);
CREATE INDEX IF NOT EXISTS idx_submissions_verdict   ON submissions(handle_id, verdict);
CREATE INDEX IF NOT EXISTS idx_submissions_rating    ON submissions(handle_id, problem_rating);
CREATE INDEX IF NOT EXISTS idx_submissions_time      ON submissions(handle_id, submitted_at DESC);

-- ── submission_tags (normalised join table) ────────────────────────────────────
-- Kept alongside the JSON column for clean SQL queries in analysis.
-- Populated from the JSON tags column on each sync.
CREATE TABLE IF NOT EXISTS submission_tags (
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  tag           TEXT    NOT NULL,
  PRIMARY KEY (submission_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_sub_tags_tag ON submission_tags(tag);

-- ── rating_history ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rating_history (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  handle_id               INTEGER NOT NULL REFERENCES handles(id) ON DELETE CASCADE,
  contest_id              INTEGER NOT NULL,
  contest_name            TEXT    NOT NULL,
  rank                    INTEGER,
  old_rating              INTEGER NOT NULL,
  new_rating              INTEGER NOT NULL,
  rating_update_time      INTEGER NOT NULL,         -- Unix timestamp
  UNIQUE (handle_id, contest_id)
);

CREATE INDEX IF NOT EXISTS idx_rating_history_handle ON rating_history(handle_id, rating_update_time DESC);

-- ── contests_cache ────────────────────────────────────────────────────────────
-- Cached from kontests.net / CF API. Revalidated every ~20 min via TTL check.
CREATE TABLE IF NOT EXISTS contests_cache (
  id          TEXT    PRIMARY KEY,                  -- "<site>_<platform_id>"
  site        TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  start_time  INTEGER NOT NULL,                     -- Unix timestamp (UTC)
  duration    INTEGER NOT NULL,                     -- Seconds
  fetched_at  INTEGER NOT NULL                      -- When we cached this row
);

CREATE INDEX IF NOT EXISTS idx_contests_start ON contests_cache(start_time);

-- ── reminders ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id  TEXT    NOT NULL REFERENCES contests_cache(id) ON DELETE CASCADE,
  remind_at   INTEGER NOT NULL,                     -- Unix timestamp
  fired       INTEGER NOT NULL DEFAULT 0,           -- 0 = pending, 1 = fired
  UNIQUE (contest_id)
);

-- ── resources ─────────────────────────────────────────────────────────────────
-- Seeded from static JSON in scripts/seed-resources.ts at first run.
CREATE TABLE IF NOT EXISTS resources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  topic       TEXT    NOT NULL,
  difficulty  TEXT    NOT NULL CHECK (difficulty IN ('beginner','intermediate','advanced')),
  type        TEXT    NOT NULL CHECK (type IN ('article','video','problem-set','book','course')),
  description TEXT    NOT NULL DEFAULT ''
);

-- ── bookmarks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookmarks (
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  handle_id   INTEGER NOT NULL REFERENCES handles(id)   ON DELETE CASCADE,
  PRIMARY KEY (resource_id, handle_id)
);

-- ── notes ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id   TEXT    NOT NULL,
  problem_name TEXT    NOT NULL DEFAULT '',
  body         TEXT    NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_problem ON notes(problem_id);

-- ── weak_topics_cache ─────────────────────────────────────────────────────────
-- Precomputed per-handle analysis. Invalidated on new sync (delete + reinsert).
CREATE TABLE IF NOT EXISTS weak_topics_cache (
  handle_id   INTEGER NOT NULL REFERENCES handles(id) ON DELETE CASCADE,
  tag         TEXT    NOT NULL,
  attempts    INTEGER NOT NULL,
  solved      INTEGER NOT NULL,
  accuracy    REAL    NOT NULL,   -- 0.0 – 1.0
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (handle_id, tag)
);

-- ── settings ──────────────────────────────────────────────────────────────────
-- Single-row KV table. Row always exists (inserted with defaults on first run).
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ── _migrations ───────────────────────────────────────────────────────────────
-- Tracks applied migration files so the runner never double-applies them.
CREATE TABLE IF NOT EXISTS _migrations (
  filename   TEXT    PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
