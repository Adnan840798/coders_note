-- ─────────────────────────────────────────────────────────────────────────────
-- 002_add_notes.sql — Add tags column to notes for better filtering
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE notes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';  -- JSON array
