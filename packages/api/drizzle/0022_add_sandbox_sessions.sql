CREATE TABLE IF NOT EXISTS "sandbox_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'creating',
  "railway_service_id" varchar(255),
  "railway_volume_id" varchar(255),
  "railway_volume_instance_id" varchar(255),
  "backup_id" varchar(255),
  "sandbox_secret" varchar(255) NOT NULL,
  "internal_url" varchar(512),
  "sandbox_port" integer,
  "provider" varchar(20) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_activity_at" timestamp DEFAULT now() NOT NULL,
  "suspended_at" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_sandbox_sessions_project" ON "sandbox_sessions" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_sandbox_sessions_user_status" ON "sandbox_sessions" ("user_id", "status");
