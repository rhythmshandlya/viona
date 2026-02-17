-- #10: Index on jobs(project_id, status) for active-job lookups
CREATE INDEX IF NOT EXISTS idx_jobs_project_id_status ON jobs(project_id, status);

-- #22: Normalize 'completed' → 'complete' everywhere
UPDATE jobs SET status = 'complete' WHERE status = 'completed';
