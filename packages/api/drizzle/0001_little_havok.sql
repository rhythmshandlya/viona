CREATE TABLE IF NOT EXISTS "sandbox_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'creating' NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "sdk_session_id" varchar(255);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "progress_meta" jsonb;--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "label" varchar(255);--> statement-breakpoint
ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workspace_status" varchar(50) DEFAULT 'inactive' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "workspace_last_activity" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "active_bundle_url" varchar(1024);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "visuals" ADD COLUMN IF NOT EXISTS "source_scene_ids" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
