-- Add missing columns to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS featured_image_alt TEXT;
