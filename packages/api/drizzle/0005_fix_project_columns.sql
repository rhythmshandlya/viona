-- Fix projects table columns to match schema
-- Rename width/height to source_width/source_height and add video_settings

ALTER TABLE projects RENAME COLUMN width TO source_width;
ALTER TABLE projects RENAME COLUMN height TO source_height;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_settings JSONB;
