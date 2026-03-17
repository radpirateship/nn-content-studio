-- Guide Templates table for reusable guide configurations
-- Run this in your Neon DB console

CREATE TABLE IF NOT EXISTS guide_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  -- Template fields (same as guide config)
  collection_slug TEXT,
  topic_short TEXT,
  topic_short_plural TEXT,
  topic_full TEXT,
  breadcrumb_l2_name TEXT,
  breadcrumb_l2_slug TEXT,
  ta_sheet_name TEXT,
  related_guides JSONB DEFAULT '[]',
  -- Product role structure hint
  product_roles JSONB DEFAULT '[]',  -- e.g. [{"subcategory":"barrel","role":"best-value"},...]
  read_time_mins INTEGER DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_templates_collection ON guide_templates(collection_slug);
