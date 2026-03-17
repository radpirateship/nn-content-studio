-- Create revamp_sources table for NN Content Studio
-- Tracks original Shopify articles being revamped and their new AI-generated versions

CREATE TABLE IF NOT EXISTS revamp_sources (
  id SERIAL PRIMARY KEY,
  -- Original article metadata
  original_shopify_id BIGINT NOT NULL,
  original_title VARCHAR(500),
  original_slug VARCHAR(500),
  original_url VARCHAR(500),
  original_published_at TIMESTAMP,
  original_content TEXT,
  -- New generated article
  new_article_id INTEGER, -- Foreign key to articles table
  new_title VARCHAR(500),
  new_slug VARCHAR(500),
  -- Revamp metadata
  category VARCHAR(50),
  keyword VARCHAR(255),
  revamp_reason VARCHAR(255), -- 'outdated-content', 'seo-improvement', 'format-update', 'product-refresh'
  -- Comparison metrics
  content_improvement_score DECIMAL(3, 2), -- 0-1 scale
  seo_improvement BOOLEAN,
  product_updates_added INTEGER DEFAULT 0,
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in-progress', 'completed', 'published'
  approved BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT false,
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revamp_started_at TIMESTAMP,
  revamp_completed_at TIMESTAMP,
  published_at TIMESTAMP,
  -- Audit
  created_by VARCHAR(255),
  approved_by VARCHAR(255)
);

-- Create index on original_shopify_id to track source articles
CREATE INDEX idx_revamp_sources_original_shopify_id ON revamp_sources(original_shopify_id);

-- Create index on new_article_id to link to generated articles
CREATE INDEX idx_revamp_sources_new_article_id ON revamp_sources(new_article_id);

-- Create index on category for revamp tracking by category
CREATE INDEX idx_revamp_sources_category ON revamp_sources(category);

-- Create index on status for workflow
CREATE INDEX idx_revamp_sources_status ON revamp_sources(status);

-- Create index on created_at for chronological queries
CREATE INDEX idx_revamp_sources_created_at ON revamp_sources(created_at DESC);

-- Create index on published for tracking published revamps
CREATE INDEX idx_revamp_sources_published ON revamp_sources(published);
