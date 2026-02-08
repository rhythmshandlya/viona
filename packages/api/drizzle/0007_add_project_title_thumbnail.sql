-- Add title and thumbnailKey columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS thumbnail_key VARCHAR(255);
