CREATE TABLE IF NOT EXISTS "inference_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sandbox_session_id" uuid REFERENCES "sandbox_sessions"("id") ON DELETE SET NULL,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "capability" varchar(64) NOT NULL,
  "provider" varchar(16) NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "runpod_job_id" varchar(128),
  "input" jsonb NOT NULL,
  "output" jsonb,
  "error" jsonb,
  "metrics" jsonb,
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "inference_jobs_status_idx"
  ON "inference_jobs" ("status", "submitted_at")
  WHERE "status" IN ('pending', 'running');

-- Reconciler targets only RunPod-provider rows
CREATE INDEX IF NOT EXISTS "inference_jobs_runpod_pending_idx"
  ON "inference_jobs" ("submitted_at")
  WHERE "provider" = 'runpod' AND "status" IN ('pending', 'running');
