CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  section TEXT,
  slug TEXT NOT NULL,
  category TEXT,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr NUMERIC(5,2) DEFAULT 0,
  position NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
