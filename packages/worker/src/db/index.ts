import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';
import {
  pgTable,
  uuid,
  varchar,
  integer,
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

const pool = new pg.Pool({
  connectionString: config.database.url,
});

export const db = drizzle(pool, {
  schema: { projects, tracks, timelineItems, transcripts, jobs, projectAssets, visuals },
});
