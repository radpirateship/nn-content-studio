-- Create resources table for NN Content Studio
-- Stores generated images, documents, and other content resources

CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  resource_type VARCHAR(50) NOT NULL, -- 'image', 'document', 'video', 'chart'
  title VARCHAR(500) NOT NULL,
  description TEXT,
  url VARCHAR(500),
  -- Image-specific fields
  alt_text VARCHAR(255),
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  mime_type VARCHAR(50),
  -- Content metadata
  category VARCHAR(50),
  article_id INTEGER,
  placement VARCHAR(50), -- 'featured', 'inline', 'product', 'header'
  -- Generation metadata
  generated BOOLEAN DEFAULT false,
  ai_model VARCHAR(100),
  generation_prompt TEXT,
  -- Status and usage
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'approved', 'published'
  usage_count INTEGER DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP,
  -- Audit
  created_by VARCHAR(255),
  approved_by VARCHAR(255)
);

-- Create index on article_id for article-resource relationship
CREATE INDEX idx_resources_article_id ON resources(article_id);

-- Create index on resource_type for filtering
CREATE INDEX idx_resources_resource_type ON resources(resource_type);

-- Create index on status for workflow
CREATE INDEX idx_resources_status ON resources(status);

-- Create index on created_at for chronological queries
CREATE INDEX idx_resources_created_at ON resources(created_at DESC);

-- Create index on category for content organization
CREATE INDEX idx_resources_category ON resources(category);
