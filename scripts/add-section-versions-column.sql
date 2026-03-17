-- Add section_versions JSONB column for version history / rollback per section
-- Stores: { "key-takeaways": [{ "html": "...", "ts": "2026-03-17T..." }, ...], ... }
-- Run this in your Neon DB console

ALTER TABLE ultimate_guides
ADD COLUMN IF NOT EXISTS section_versions JSONB DEFAULT '{}';
