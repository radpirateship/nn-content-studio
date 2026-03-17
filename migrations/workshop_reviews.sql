-- Workshop Reviews — tracks article review status for the Article Workshop queue mode
-- Run this in your Neon SQL console before deploying the Workshop feature

CREATE TABLE IF NOT EXISTS workshop_reviews (
  id SERIAL PRIMARY KEY,
  shopify_article_id BIGINT NOT NULL UNIQUE,
  handle TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_reviewed', -- 'not_reviewed' | 'approved' | 'needs_work'
  notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on status for filtered list queries (e.g. "show me all not_reviewed")
CREATE INDEX IF NOT EXISTS idx_workshop_reviews_status ON workshop_reviews(status);

-- Index on handle for DB sync lookups when publishing
CREATE INDEX IF NOT EXISTS idx_workshop_reviews_handle ON workshop_reviews(handle);
