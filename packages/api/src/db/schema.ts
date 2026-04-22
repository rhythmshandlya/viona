import { pgTable, uuid, varchar, integer, bigint, boolean, timestamp, jsonb, text, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
  projectType: varchar('project_type', { length: 20 }).notNull().default('video'),
  videoKey: varchar('video_key', { length: 255 }),
  audioKey: varchar('audio_key', { length: 255 }),
  thumbnailKey: varchar('thumbnail_key', { length: 255 }),
  outputKey: varchar('output_key', { length: 255 }),
  durationMs: integer('duration_ms'),
  fps: integer('fps').default(30),
  sourceWidth: integer('source_width').default(1920),
  sourceHeight: integer('source_height').default(1080),
  videoSettings: jsonb('video_settings'),
  headTrackingData: jsonb('head_tracking_data'),
  workspaceStatus: varchar('workspace_status', { length: 50 }).default('inactive').notNull(),
  workspaceLastActivity: timestamp('workspace_last_activity'),
  activeBundleUrl: varchar('active_bundle_url', { length: 1024 }),
  description: text('description'),
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
  progressMeta: jsonb('progress_meta').$type<{
    phase?: string;
    phaseName?: string;
    scene?: number;
    totalScenes?: number;
    iteration?: number;
    maxIterations?: number;
    score?: number;
    detail?: string;
    sceneId?: string;
    outputKey?: string;
  }>(),
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
  planData: jsonb('plan_data').$type<{
    scenePlan: string;
    scenes: Record<string, unknown>;
  } | null>(),
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
    /** Original 1-indexed scene file ID (scenes/SceneN.tsx). Survives timeline splits. */
    sourceSceneId?: number;
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
  sourceSceneIds: jsonb('source_scene_ids').$type<number[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Project assets (uploaded images, audio, etc.)
export const projectAssets = pgTable('project_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  label: varchar('label', { length: 255 }),
  description: text('description'),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  contentType: varchar('content_type', { length: 100 }).notNull(),
  fileSize: integer('file_size'),
  durationMs: integer('duration_ms'),
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User-owned assets (new model, replaces projectAssets-only path)
export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  parentAssetIds: uuid('parent_asset_ids').array().notNull().default(sql`ARRAY[]::uuid[]`),

  source: varchar('source', { length: 20 }).notNull(),          // upload|generated|chat|derived
  status: varchar('status', { length: 20 }).notNull(),          // uploading|ready|failed|deleted

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
  proxyKey: varchar('proxy_key', { length: 500 }),
  thumbnailStatus: varchar('thumbnail_status', { length: 20 }).notNull().default('pending'),
  waveformStatus: varchar('waveform_status', { length: 20 }).notNull().default('pending'),
  proxyStatus: varchar('proxy_status', { length: 20 }).notNull().default('pending'),

  transcriptAssetId: uuid('transcript_asset_id'),
  transcriptStatus: varchar('transcript_status', { length: 20 }).notNull().default('pending'),

  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userSha256Unique: uniqueIndex('assets_user_sha256_uniq').on(table.userId, table.sha256),
  userIdIdx: index('assets_user_id_idx').on(table.userId),
  statusIdx: index('assets_status_idx').on(table.status),
}));

export const assetProjectLinks = pgTable('asset_project_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  addedVia: varchar('added_via', { length: 20 }).notNull(),   // upload|chat|generated|library
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (table) => ({
  assetProjectUnique: uniqueIndex('asset_project_links_uniq').on(table.assetId, table.projectId),
  projectIdx: index('asset_project_links_project_idx').on(table.projectId),
}));

export const assetEvents = pgTable('asset_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').notNull(),
  projectId: uuid('project_id'),
  userId: varchar('user_id', { length: 255 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userCreatedIdx: index('asset_events_user_created_idx').on(table.userId, table.createdAt),
  projectCreatedIdx: index('asset_events_project_created_idx').on(table.projectId, table.createdAt),
}));

// Conversations for Creative Director agent
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  sdkSessionId: varchar('sdk_session_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const conversationMessages = pgTable('conversation_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // 'user' | 'assistant'
  content: jsonb('content').notNull(), // Array of MessageContent blocks
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Sandbox sessions — one per project, tracks sandbox lifecycle
export const sandboxSessions = pgTable('sandbox_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('creating'),
  railwayServiceId: varchar('railway_service_id', { length: 255 }),
  railwayVolumeId: varchar('railway_volume_id', { length: 255 }),
  railwayVolumeInstanceId: varchar('railway_volume_instance_id', { length: 255 }),
  backupId: varchar('backup_id', { length: 255 }),
  sandboxSecret: varchar('sandbox_secret', { length: 255 }).notNull(),
  internalUrl: varchar('internal_url', { length: 512 }),
  agentUrl: varchar('agent_url', { length: 512 }),
  provider: varchar('provider', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  suspendedAt: timestamp('suspended_at'),
  suspendReason: varchar('suspend_reason', { length: 50 }), // 'idle' | 'user' | 'health_failure' | 'limit_exceeded' | 'api_shutdown'
  metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
});

// Templates — reusable video templates with bundled Remotion compositions
export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  type: varchar('type', { length: 20 }).default('scene'),
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
  dependencies: jsonb('dependencies').$type<Record<string, string>>(),
  version: integer('version').notNull().default(1),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Template exports — user-initiated renders from templates
export const templateExports = pgTable('template_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  props: jsonb('props').$type<Record<string, unknown>>(),
  status: varchar('status', { length: 50 }).notNull().default('queued'),
  outputUrl: varchar('output_url', { length: 1024 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Themes — creative direction collections for templates
export const themes = pgTable('themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  colorPalette: jsonb('color_palette').$type<Record<string, string>>(),
  fontRecommendations: jsonb('font_recommendations').$type<Record<string, string>>(),
  styleGuidance: text('style_guidance'),
  previewUrl: varchar('preview_url', { length: 1024 }),
  isPublished: boolean('is_published').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Template-Theme join table (many-to-many)
export const templateThemes = pgTable('template_themes', {
  themeId: uuid('theme_id').notNull().references(() => themes.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.themeId, table.templateId] }),
}));

// Waitlist signups
export const waitlist = pgTable('waitlist', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
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
export type ProjectAsset = typeof projectAssets.$inferSelect;
export type NewProjectAsset = typeof projectAssets.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;
export type SandboxSession = typeof sandboxSessions.$inferSelect;
export type NewSandboxSession = typeof sandboxSessions.$inferInsert;
export type WaitlistEntry = typeof waitlist.$inferSelect;
export type NewWaitlistEntry = typeof waitlist.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type TemplateExport = typeof templateExports.$inferSelect;
export type NewTemplateExport = typeof templateExports.$inferInsert;
export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;

export const inferenceJobs = pgTable('inference_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sandboxSessionId: uuid('sandbox_session_id').references(() => sandboxSessions.id, { onDelete: 'set null' }),
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

export type InferenceJob = typeof inferenceJobs.$inferSelect;
export type NewInferenceJob = typeof inferenceJobs.$inferInsert;
export type InferenceProvider = 'runpod' | 'worker';
export type InferenceJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timed_out';
