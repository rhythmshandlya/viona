import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { config } from '../config.js';
import {
  pgTable,
  uuid,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  text,
} from 'drizzle-orm/pg-core';

// Schema (duplicated from API for now - could be shared)
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  status: varchar('status', { length: 50 }).notNull().default('uploading'),
  projectType: varchar('project_type', { length: 20 }).notNull().default('video'),
  videoKey: varchar('video_key', { length: 255 }),
  audioKey: varchar('audio_key', { length: 255 }),
  outputKey: varchar('output_key', { length: 255 }),
  durationMs: integer('duration_ms'),
  fps: integer('fps').default(30),
  sourceWidth: integer('source_width').default(1920),
  sourceHeight: integer('source_height').default(1080),
  videoSettings: jsonb('video_settings'),
  headTrackingData: jsonb('head_tracking_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tracks = pgTable('tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  position: integer('position').notNull().default(0),
  locked: boolean('locked').default(false).notNull(),
  visible: boolean('visible').default(true).notNull(),
});

export const timelineItems = pgTable('timeline_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id').references(() => tracks.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  startMs: integer('start_ms').notNull(),
  endMs: integer('end_ms').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const transcripts = pgTable('transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  rawOutput: jsonb('raw_output'),
  words: jsonb('words'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  progress: integer('progress').default(0).notNull(),
  progressMessage: varchar('progress_message', { length: 500 }),
  progressMeta: jsonb('progress_meta').$type<Record<string, unknown>>(),
  error: text('error'),
  metrics: jsonb('metrics'),
  logs: text('logs').array(),
  planData: jsonb('plan_data').$type<{
    scenePlan: string;
    scenes: Record<string, unknown>;
  } | null>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const projectAssets = pgTable('project_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  label: varchar('label', { length: 255 }),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  contentType: varchar('content_type', { length: 100 }).notNull(),
  fileSize: integer('file_size'),
  durationMs: integer('duration_ms'),
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const visuals = pgTable('visuals', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  compositionId: varchar('composition_id', { length: 255 }).notNull(),
  bundleUrl: varchar('bundle_url', { length: 500 }).notNull(),
  sourceUrl: varchar('source_url', { length: 500 }), // Source project files in MinIO for AI context restoration
  durationFrames: integer('duration_frames').notNull(),
  fps: integer('fps').notNull().default(30),
  width: integer('width').notNull().default(1920),
  height: integer('height').notNull().default(1080),
  stylePreset: varchar('style_preset', { length: 50 }),
  llmModel: varchar('llm_model', { length: 100 }),
  timestamps: jsonb('timestamps'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  aspectRatio: varchar('aspect_ratio', { length: 10 }).notNull().default('16:9'),
  durationFrames: integer('duration_frames').notNull().default(360),
  fps: integer('fps').notNull().default(30),
  width: integer('width').notNull().default(1920),
  height: integer('height').notNull().default(1080),
  propsSchema: jsonb('props_schema').$type<Record<string, unknown>>(),
  defaultProps: jsonb('default_props').$type<Record<string, unknown>>(),
  screenshotUrl: varchar('screenshot_url', { length: 1024 }),
  bundleKey: varchar('bundle_key', { length: 1024 }),
  sourceKey: varchar('source_key', { length: 1024 }),
  version: integer('version').notNull().default(1),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const templateExports = pgTable('template_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  props: jsonb('props').$type<Record<string, unknown>>(),
  status: varchar('status', { length: 50 }).notNull().default('queued'),
  outputUrl: varchar('output_url', { length: 1024 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Mirror of packages/api/src/db/schema.ts `inferenceJobs`. The worker writes
// status/output/metrics/error on this table when INFERENCE_PROVIDER=worker.
// Keep column definitions in sync with the API schema.
export const inferenceJobs = pgTable('inference_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sandboxSessionId: uuid('sandbox_session_id'),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  capability: varchar('capability', { length: 64 }).notNull(),
  provider: varchar('provider', { length: 16 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  runpodJobId: varchar('runpod_job_id', { length: 128 }),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  error: jsonb('error'),
  metrics: jsonb('metrics'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// User-owned assets (mirror of api schema — keep columns in sync).
// Added for Task 8 asset-metadata processor which probes uploaded files and
// fills in durationMs/width/height/thumbnailKey/waveformKey/status columns.
export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  parentAssetIds: uuid('parent_asset_ids').array().notNull().default(sql`ARRAY[]::uuid[]`),

  source: varchar('source', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),

  sha256: varchar('sha256', { length: 64 }).notNull(),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),

  label: varchar('label', { length: 255 }).notNull(),
  userDescription: text('user_description'),
  userIntent: text('user_intent'),
  autoDescription: text('auto_description'),
  tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),

  durationMs: integer('duration_ms'),
  width: integer('width'),
  height: integer('height'),

  thumbnailKey: varchar('thumbnail_key', { length: 500 }),
  waveformKey: varchar('waveform_key', { length: 500 }),
  thumbnailStatus: varchar('thumbnail_status', { length: 20 }).notNull().default('pending'),
  waveformStatus: varchar('waveform_status', { length: 20 }).notNull().default('pending'),

  transcriptAssetId: uuid('transcript_asset_id'),
  transcriptStatus: varchar('transcript_status', { length: 20 }).notNull().default('pending'),

  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Asset events (mirror of api schema). Used by the worker's emitAssetEvent.
export const assetEvents = pgTable('asset_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').notNull(),
  projectId: uuid('project_id'),
  userId: varchar('user_id', { length: 255 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const pool = new pg.Pool({
  connectionString: config.database.url,
  max: 10,                      // Workers have fewer concurrent queries
  min: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, {
  schema: { projects, tracks, timelineItems, transcripts, jobs, projectAssets, visuals, templates, templateExports, inferenceJobs, assets, assetEvents },
});
