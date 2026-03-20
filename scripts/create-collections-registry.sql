-- Naked Nutrition collections registry seed
-- Matches live Shopify collections at nakednutrition.com/collections/<slug>
-- Run via /api/migrate or apply directly to the Neon database

CREATE TABLE IF NOT EXISTS collections_registry (
  slug        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  is_builtin  BOOLEAN DEFAULT FALSE,
  url         TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO collections_registry (slug, label, is_builtin, url) VALUES
  ('protein-powder',               'Protein Powder',            TRUE, 'https://nakednutrition.com/collections/protein-powder'),
  ('whey-protein',                 'Whey Protein',              TRUE, 'https://nakednutrition.com/collections/whey-protein'),
  ('collagen-peptides',            'Collagen Peptides',         TRUE, 'https://nakednutrition.com/collections/collagen-peptides'),
  ('vegan-protein-powder',         'Vegan Protein Powder',      TRUE, 'https://nakednutrition.com/collections/vegan-protein-powder'),
  ('overnight-oats',               'Overnight Oats',            TRUE, 'https://nakednutrition.com/collections/overnight-oats'),
  ('improve-performance-recovery', 'Performance & Recovery',    TRUE, 'https://nakednutrition.com/collections/improve-performance-recovery'),
  ('supplements',                  'Supplements',               TRUE, 'https://nakednutrition.com/collections/supplements'),
  ('kids',                         'Kids',                      TRUE, 'https://nakednutrition.com/collections/kids')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      is_builtin = EXCLUDED.is_builtin,
      url = EXCLUDED.url;
