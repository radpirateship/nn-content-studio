CREATE TABLE IF NOT EXISTS collections_registry (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  is_builtin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO collections_registry (slug, label, is_builtin) VALUES
  ('saunas', 'Saunas', TRUE),
  ('cold-plunges', 'Cold Plunges', TRUE),
  ('red-light-therapy', 'Red Light Therapy', TRUE),
  ('hyperbaric-chambers', 'Hyperbaric Chambers', TRUE),
  ('massage-equipment', 'Massage Equipment', TRUE),
  ('recovery-tools', 'Recovery Tools', TRUE),
  ('general-wellness', 'General Wellness', TRUE),
  ('steam', 'Steam', TRUE),
  ('sensory-deprivation-tanks', 'Sensory Deprivation Tanks', TRUE),
  ('elliptical-machines', 'Elliptical Machines', TRUE),
  ('exercise-bikes', 'Exercise Bikes', TRUE),
  ('treadmills', 'Treadmills', TRUE),
  ('stair-climbers', 'Stair Climbers', TRUE),
  ('vertical-climbers', 'Vertical Climbers', TRUE),
  ('pilates', 'Pilates', TRUE)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, is_builtin = EXCLUDED.is_builtin;
