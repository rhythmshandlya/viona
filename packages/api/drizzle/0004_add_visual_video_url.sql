-- Add video_url column to visuals table for rendered video playback
ALTER TABLE visuals ADD COLUMN IF NOT EXISTS video_url VARCHAR(500);
