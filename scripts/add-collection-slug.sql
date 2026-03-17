ALTER TABLE topical_authority ADD COLUMN IF NOT EXISTS collection_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_ta_collection ON topical_authority(collection_slug);

ALTER TABLE products ADD COLUMN IF NOT EXISTS collection_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection_slug);

ALTER TABLE collections ADD COLUMN IF NOT EXISTS collection_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(collection_slug);
