-- Ultimate Guides table for PPW Content Studio
-- Run this in your Neon DB console after deploying

CREATE TABLE IF NOT EXISTS ultimate_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Config (from setup form)
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  topic_short TEXT NOT NULL,
  topic_short_plural TEXT NOT NULL,
  topic_full TEXT NOT NULL,
  breadcrumb_l2_name TEXT NOT NULL,
  breadcrumb_l2_slug TEXT NOT NULL,
  collection_slug TEXT NOT NULL,
  hero_image_url TEXT,
  date_published DATE DEFAULT CURRENT_DATE,
  date_modified DATE DEFAULT CURRENT_DATE,
  read_time_mins INTEGER DEFAULT 15,
  related_guides JSONB DEFAULT '[]',   -- [{title, slug, desc}]
  ta_sheet_name TEXT,                  -- Topical authority plan tab name

  -- Products (from product selection step)
  selected_products JSONB DEFAULT '[]',  -- curated list with roles

  -- Generated content (filled section by section)
  html_content TEXT,
  meta_description TEXT,
  key_takeaways JSONB DEFAULT '[]',
  faq_pairs JSONB DEFAULT '[]',          -- [{q, a}]
  cluster_links JSONB DEFAULT '[]',      -- [{title, slug}]

  -- Image state
  hero_image_cdn_url TEXT,
  has_images BOOLEAN DEFAULT FALSE,
  image_count INTEGER DEFAULT 0,

  -- Workflow progress flags
  config_complete BOOLEAN DEFAULT FALSE,
  products_complete BOOLEAN DEFAULT FALSE,
  content_complete BOOLEAN DEFAULT FALSE,
  images_complete BOOLEAN DEFAULT FALSE,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  shopify_page_id TEXT,               -- filled after publish
  published_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ultimate_guides_status ON ultimate_guides(status);
CREATE INDEX IF NOT EXISTS idx_ultimate_guides_created_at ON ultimate_guides(created_at DESC);

-- Reuse the existing updated_at trigger function (already created by articles migration)
DROP TRIGGER IF EXISTS update_ultimate_guides_updated_at ON ultimate_guides;
CREATE TRIGGER update_ultimate_guides_updated_at
  BEFORE UPDATE ON ultimate_guides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
