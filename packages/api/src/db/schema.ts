import { pgTable, uuid, varchar, integer, boolean, timestamp, jsonb, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  stytchUserId: varchar('stytch_user_id', { length: 255 }).unique().notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull().default('uploading'),
  videoKey: varchar('video_key', { length: 255 }),
  thumbnailKey: varchar('thumbnail_key', { length: 255 }),
  outputKey: varchar('output_key', { length: 255 }),
  durationMs: integer('duration_ms'),
  fps: integer('fps').default(30),
  sourceWidth: integer('source_width').default(1920),
  sourceHeight: integer('source_height').default(1080),
  videoSettings: jsonb('video_settings'),
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
  error: text('error'),
  metrics: jsonb('metrics').$type<{
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
    durationMs?: number;
    llmModel?: string;
    filesWritten?: number;
    screenshotsTaken?: number;
  }>(),
  logs: text('logs').array(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const visuals = pgTable('visuals', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  compositionId: varchar('composition_id', { length: 255 }).notNull(),
  bundleUrl: varchar('bundle_url', { length: 500 }).notNull(),
  sourceUrl: varchar('source_url', { length: 500 }), // Source project files in MinIO for AI context restoration
  videoUrl: varchar('video_url', { length: 500 }), // Rendered video URL for playback
  durationFrames: integer('duration_frames').notNull(),
  fps: integer('fps').notNull().default(30),
  width: integer('width').notNull().default(1920),
  height: integer('height').notNull().default(1080),
  stylePreset: varchar('style_preset', { length: 50 }),
  llmModel: varchar('llm_model', { length: 100 }),
  timestamps: jsonb('timestamps').$type<Array<{
    startMs: number;
    endMs: number;
    type: string;
    description: string;
    elements?: Array<{
      id: string;
      name: string;
      type: string;
      x: string;
      y: string;
      width: string;
      height: string;
    }>;
  }>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Type exports for Drizzle
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Track = typeof tracks.$inferSelect;
export type NewTrack = typeof tracks.$inferInsert;
export type TimelineItem = typeof timelineItems.$inferSelect;
export type NewTimelineItem = typeof timelineItems.$inferInsert;
export type Transcript = typeof transcripts.$inferSelect;
export type NewTranscript = typeof transcripts.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Visual = typeof visuals.$inferSelect;
export type NewVisual = typeof visuals.$inferInsert;
