-- Topical Authority table
CREATE TABLE IF NOT EXISTS topical_authority (
  id SERIAL PRIMARY KEY,
  type TEXT,
  title TEXT NOT NULL,
  primary_keyword TEXT,
  intent TEXT,
  format TEXT,
  word_count INTEGER DEFAULT 2000,
  priority TEXT,
  action TEXT,
  existing_url TEXT,
  optimize BOOLEAN DEFAULT FALSE,
  notes TEXT,
  search_volume TEXT,
  title_tag TEXT,
  meta_description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id SERIAL PRIMARY KEY,
  url TEXT,
  category TEXT NOT NULL,
  primary_keyword TEXT,
  search_volume TEXT,
  keyword_difficulty TEXT,
  secondary_keywords TEXT,
  optimized_title_tag TEXT,
  optimized_meta_description TEXT,
  current_position TEXT,
  current_impressions TEXT,
  priority TEXT,
  estimated_impact TEXT,
  optimized_ec BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
