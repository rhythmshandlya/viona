-- Add indexes for frequently-queried columns to support 50+ concurrent users

-- Projects by user (dashboard project list)
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id);

-- Note: idx_jobs_project_id_status already exists from 0015_add_indexes_and_status.sql

-- Conversations by project (agent chat load)
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations (project_id);

-- Timeline items by track (editor load)
CREATE INDEX IF NOT EXISTS idx_timeline_items_track_id ON timeline_items (track_id);

-- Project assets by project (media panel)
CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON project_assets (project_id);
