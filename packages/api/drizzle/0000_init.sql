-- Initial database schema for Reelify

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'uploading',
  video_key VARCHAR(255),
  output_key VARCHAR(255),
  duration_ms INTEGER,
  fps INTEGER DEFAULT 30,
  width INTEGER DEFAULT 1920,
  height INTEGER DEFAULT 1080,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  locked BOOLEAN DEFAULT FALSE NOT NULL,
  visible BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  raw_output JSONB,
  words JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0 NOT NULL,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tracks_project_id ON tracks(project_id);
CREATE INDEX IF NOT EXISTS idx_timeline_items_track_id ON timeline_items(track_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_project_id ON transcripts(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
