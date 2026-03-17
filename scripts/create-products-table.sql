-- Products table for persistent product catalog storage
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  handle TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  price TEXT,
  compare_at_price TEXT,
  sku TEXT,
  vendor TEXT,
  product_type TEXT,
  tags TEXT,
  category TEXT,
  image_url TEXT,
  url TEXT,
  status TEXT DEFAULT 'active',
  inventory_qty TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
