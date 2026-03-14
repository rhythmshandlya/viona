ALTER TABLE projects
ADD COLUMN workspace_status VARCHAR(50) NOT NULL DEFAULT 'inactive',
ADD COLUMN workspace_last_activity TIMESTAMP,
ADD COLUMN active_bundle_url VARCHAR(1024);

ALTER TABLE visuals
ADD COLUMN source_scene_ids JSONB;
