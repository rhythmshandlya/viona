-- Add visuals table for AI-generated visual compositions

CREATE TABLE IF NOT EXISTS visuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  composition_id VARCHAR(255) NOT NULL,
  bundle_url VARCHAR(500) NOT NULL,
  duration_frames INTEGER NOT NULL,
  fps INTEGER NOT NULL DEFAULT 30,
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  style_preset VARCHAR(50),
  timestamps JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_visuals_project_id ON visuals(project_id);
