-- Add user-owned asset model: assets, asset_project_links, asset_events
-- Replaces the projectAssets-only path. Legacy project_assets table remains untouched.

CREATE TABLE IF NOT EXISTS "assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "parent_asset_ids" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],

  "source" varchar(20) NOT NULL,          -- upload|generated|chat|derived
  "status" varchar(20) NOT NULL,          -- uploading|ready|failed|deleted

  "sha256" varchar(64) NOT NULL,
  "storage_key" varchar(500) NOT NULL,
  "filename" varchar(255) NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "file_size" bigint NOT NULL,

  "label" varchar(255) NOT NULL,
  "user_description" text,
  "user_intent" text,
  "auto_description" text,
  "tags" text[] NOT NULL DEFAULT ARRAY[]::text[],

  "duration_ms" integer,
  "width" integer,
  "height" integer,

  "thumbnail_key" varchar(500),
  "waveform_key" varchar(500),
  "thumbnail_status" varchar(20) NOT NULL DEFAULT 'pending',
  "waveform_status" varchar(20) NOT NULL DEFAULT 'pending',

  "transcript_asset_id" uuid,
  "transcript_status" varchar(20) NOT NULL DEFAULT 'pending',

  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "assets_user_sha256_uniq" ON "assets" ("user_id", "sha256");
CREATE INDEX IF NOT EXISTS "assets_user_id_idx" ON "assets" ("user_id");
CREATE INDEX IF NOT EXISTS "assets_status_idx" ON "assets" ("status");

CREATE TABLE IF NOT EXISTS "asset_project_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "added_via" varchar(20) NOT NULL,       -- upload|chat|generated|library
  "added_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "asset_project_links_uniq" ON "asset_project_links" ("asset_id", "project_id");
CREATE INDEX IF NOT EXISTS "asset_project_links_project_idx" ON "asset_project_links" ("project_id");

CREATE TABLE IF NOT EXISTS "asset_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL,
  "project_id" uuid,
  "user_id" varchar(255) NOT NULL,
  "type" varchar(30) NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "asset_events_user_created_idx" ON "asset_events" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "asset_events_project_created_idx" ON "asset_events" ("project_id", "created_at");
