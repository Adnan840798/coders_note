-- ─────────────────────────────────────────────────────────────────────────────
-- 003_case_insensitive_handles.sql — Deduplicate handles & enforce case-insensitive uniqueness
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Remove duplicate submission tags for older duplicate handles
DELETE FROM submission_tags
WHERE submission_id IN (
  SELECT s.id FROM submissions s
  JOIN handles h ON s.handle_id = h.id
  WHERE h.id NOT IN (
    SELECT MAX(id) FROM handles GROUP BY platform, LOWER(username)
  )
);

-- 2. Remove duplicate submissions for older duplicate handles
DELETE FROM submissions
WHERE handle_id NOT IN (
  SELECT MAX(id) FROM handles GROUP BY platform, LOWER(username)
);

-- 3. Remove duplicate rating history entries
DELETE FROM rating_history
WHERE handle_id NOT IN (
  SELECT MAX(id) FROM handles GROUP BY platform, LOWER(username)
);

-- 4. Remove duplicate bookmarks
DELETE FROM bookmarks
WHERE handle_id NOT IN (
  SELECT MAX(id) FROM handles GROUP BY platform, LOWER(username)
);

-- 5. Remove duplicate weak topics cache entries
DELETE FROM weak_topics_cache
WHERE handle_id NOT IN (
  SELECT MAX(id) FROM handles GROUP BY platform, LOWER(username)
);

-- 6. Remove duplicate handle rows, keeping the latest one
DELETE FROM handles
WHERE id NOT IN (
  SELECT MAX(id) FROM handles GROUP BY platform, LOWER(username)
);

-- 7. Add case-insensitive unique index on (platform, username)
CREATE UNIQUE INDEX IF NOT EXISTS uq_handles_platform_username_nocase
  ON handles (platform, username COLLATE NOCASE);
