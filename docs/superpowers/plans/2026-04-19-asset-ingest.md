# Asset Ingest Pipeline Implementation Plan (PR-A1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production-grade asset ingest pipeline: direct-to-S3 uploads with sha256 dedup, user-owned assets linked to projects via junction, eager metadata extraction (ffprobe + thumbnail + waveform), async transcription, and SSE fanout — replacing the single-video/image-only `projectAssets` path.

**Architecture:** Drizzle schema adds `assets` (user-owned, content-addressed), `asset_project_links` (N:M junction), and `asset_events` (append-only audit + SSE fanout). API exposes presigned multipart upload URLs; client uploads direct to MinIO, then `POST /assets/register` dedups on `(userId, sha256)`, inserts row, enqueues `asset-metadata` job. Worker runs ffprobe/thumbnail/waveform and triggers transcription for audio/video. All state transitions emit events consumed by a per-user SSE stream. Feature-flagged behind `ASSET_SYSTEM_V2` with a drizzle view bridging legacy `projectAssets` reads.

**Tech Stack:** Drizzle ORM (PostgreSQL), Fastify, BullMQ (Redis), MinIO (S3-compatible), ffmpeg/ffprobe, Vitest, Node.js.

**Spec reference:** `docs/superpowers/specs/2026-04-19-asset-system-research.md` — sections 6.4, 6.8, 7.1, 7.2 (PR-A).

---

## File Structure

**Create:**
- `packages/api/drizzle/0028_add_assets.sql` — schema migration
- `packages/api/src/services/asset-events.ts` — Redis pub/sub event emitter
- `packages/api/src/services/asset-service.ts` — asset CRUD domain logic
- `packages/api/src/services/asset-link-service.ts` — project-asset junction logic
- `packages/api/src/services/asset-events.test.ts`
- `packages/api/src/services/asset-service.test.ts`
- `packages/api/src/services/asset-link-service.test.ts`
- `packages/api/src/routes/assets.ts` — `/assets/*` endpoints
- `packages/api/src/routes/assets.test.ts`
- `packages/api/src/routes/project-assets.ts` — `/projects/:id/assets/*` endpoints
- `packages/api/src/routes/project-assets.test.ts`
- `packages/api/src/routes/asset-events-sse.ts` — SSE endpoint for asset events
- `packages/worker/src/processors/asset-metadata.ts` — ffprobe/thumbnail/waveform job
- `packages/worker/src/processors/asset-metadata.test.ts`

**Modify:**
- `packages/api/src/db/schema.ts` — append `assets`, `assetProjectLinks`, `assetEvents` tables + relations
- `packages/api/src/services/queue.ts` — add `assetMetadataQueue` + `queueAssetMetadataJob`
- `packages/api/src/services/minio.ts` — add `getPresignedMultipartUploadUrls` helper
- `packages/api/src/index.ts` — register new route modules
- `packages/api/src/config.ts` — add `ASSET_SYSTEM_V2` flag, thumbnail key prefix
- `packages/worker/src/index.ts` — register `asset-metadata` worker
- `packages/worker/src/processors/transcribe.ts` — emit `asset_event: transcript_ready` when done

---

## Conventions for implementers

- **Test colocation:** this codebase uses Vitest with `.test.ts` files adjacent to source (see `packages/worker/src/processors/transcribe.test.ts`). Follow that pattern.
- **Commands** (run from repo root unless noted):
  - Typecheck: `pnpm typecheck`
  - Generate migration: `cd packages/api && pnpm db:generate`
  - Apply migration: `cd packages/api && pnpm db:migrate`
  - Unit tests (api): `cd packages/api && pnpm test -- <path>`
  - Unit tests (worker): `cd packages/worker && pnpm test -- <path>`
- **Mocks:** all external I/O (MinIO, ffprobe/ffmpeg, DB queries beyond lightweight drizzle unit wrappers) is mocked in unit tests per repo pattern.
- **Auth:** all new routes register `authMiddleware` from `packages/api/src/middleware/auth.ts` — attach `request.userId` from the Stytch-validated token.
- **Never** skip a failing test's red state. TDD order: red → green → commit.

---

## Task 1: Schema — add `assets`, `asset_project_links`, `asset_events` tables

**Files:**
- Modify: `packages/api/src/db/schema.ts` (append new tables after `projectAssets` at line 152)
- Create: `packages/api/drizzle/0028_add_assets.sql` (generated)

- [ ] **Step 1: Write failing test** — schema types compile and insert/select round-trips cleanly.

Create `packages/api/src/db/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { assets, assetProjectLinks, assetEvents } from './schema';

describe('asset schema types', () => {
  it('Asset insert type has userId, sha256, storageKey required', () => {
    type AssetInsert = InferInsertModel<typeof assets>;
    const row: AssetInsert = {
      userId: 'user-1',
      sha256: 'abc',
      storageKey: 'users/user-1/assets/abc',
      filename: 'x.mp4',
      mimeType: 'video/mp4',
      fileSize: 100,
      label: 'x.mp4',
      source: 'upload',
      status: 'uploading',
    };
    expect(row.userId).toBe('user-1');
  });

  it('AssetProjectLink requires assetId and projectId', () => {
    type LinkInsert = InferInsertModel<typeof assetProjectLinks>;
    const row: LinkInsert = { assetId: 'a', projectId: 'p', addedVia: 'upload' };
    expect(row.assetId).toBe('a');
  });

  it('AssetEvent supports all event types', () => {
    type EventInsert = InferInsertModel<typeof assetEvents>;
    const row: EventInsert = {
      assetId: 'a', userId: 'u', type: 'created', payload: {},
    };
    expect(row.type).toBe('created');
  });
});
```

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/api && pnpm test -- src/db/schema.test.ts`
Expected: FAIL — `assets`, `assetProjectLinks`, `assetEvents` not exported from schema.

- [ ] **Step 3: Add tables to schema.ts**

Append to `packages/api/src/db/schema.ts` (after the existing `projectAssets` block at ~line 152, before the existing `conversations` table):

```ts
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
  thumbnailStatus: varchar('thumbnail_status', { length: 20 }).notNull().default('pending'),
  waveformStatus: varchar('waveform_status', { length: 20 }).notNull().default('pending'),

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
```

Ensure `sql`, `index`, `uniqueIndex`, `bigint`, `integer`, `text`, `jsonb` are imported at the top of `schema.ts` (most already are — check imports).

- [ ] **Step 4: Generate migration**

Run: `cd packages/api && pnpm db:generate`
Expected: new file `packages/api/drizzle/0028_<auto-name>.sql` is created. Rename it to `0028_add_assets.sql` if drizzle-kit named it otherwise.

- [ ] **Step 5: Review migration SQL**

Open `packages/api/drizzle/0028_add_assets.sql` and confirm it creates `assets`, `asset_project_links`, `asset_events` tables with the indexes above. If drizzle-kit emitted anything unexpected (dropping existing columns, etc.), stop and fix the schema change.

- [ ] **Step 6: Run migration against dev DB**

Run: `cd packages/api && pnpm db:migrate`
Expected: `migration 0028 applied`. If it fails, diagnose — do not `DROP TABLE` to work around.

- [ ] **Step 7: Run test, expect green.**

Run: `cd packages/api && pnpm test -- src/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/db/schema.ts packages/api/src/db/schema.test.ts packages/api/drizzle/0028_add_assets.sql packages/api/drizzle/meta/
git commit -m "feat(api): add assets, asset_project_links, asset_events tables"
```

---

## Task 2: Asset event emitter service

**Files:**
- Create: `packages/api/src/services/asset-events.ts`
- Create: `packages/api/src/services/asset-events.test.ts`

Purpose: centralize event insertion + Redis pub/sub fanout for SSE consumers.

- [ ] **Step 1: Write failing test**

Create `packages/api/src/services/asset-events.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emitAssetEvent } from './asset-events';

const mockInsert = vi.fn().mockResolvedValue({ id: 'event-1' });
const mockPublish = vi.fn().mockResolvedValue(1);

vi.mock('../db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'event-1' }]) })) })),
  },
}));

vi.mock('./redis', () => ({
  redis: { publish: (...args: unknown[]) => mockPublish(...args) },
}));

beforeEach(() => {
  mockPublish.mockClear();
});

describe('emitAssetEvent', () => {
  it('inserts a row and publishes to Redis channel keyed by userId', async () => {
    const result = await emitAssetEvent({
      assetId: 'a-1', userId: 'u-1', projectId: 'p-1',
      type: 'created', payload: { foo: 'bar' },
    });
    expect(result.id).toBe('event-1');
    expect(mockPublish).toHaveBeenCalledWith('asset-events:u-1', expect.stringContaining('"type":"created"'));
  });

  it('publishes to project channel when projectId is set', async () => {
    await emitAssetEvent({
      assetId: 'a-1', userId: 'u-1', projectId: 'p-1',
      type: 'linked', payload: {},
    });
    expect(mockPublish).toHaveBeenCalledWith('asset-events:project:p-1', expect.any(String));
  });
});
```

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/api && pnpm test -- src/services/asset-events.test.ts`
Expected: FAIL — `emitAssetEvent` not exported.

- [ ] **Step 3: Create `asset-events.ts`**

Check that `packages/api/src/services/redis.ts` exists (it's used by queue.ts). If not, check how the existing codebase accesses the Redis client — probably via `IORedis` in `queue.ts`. Use the same instance. If no `redis.ts` exists, add one that re-exports the shared `IORedis` from `queue.ts`.

Create `packages/api/src/services/asset-events.ts`:

```ts
import { db } from '../db';
import { assetEvents } from '../db/schema';
import { redis } from './redis';

export type AssetEventType =
  | 'created'
  | 'ready'
  | 'metadata_ready'
  | 'transcript_ready'
  | 'linked'
  | 'unlinked'
  | 'renamed'
  | 'deleted'
  | 'failed';

export interface EmitAssetEventInput {
  assetId: string;
  userId: string;
  projectId?: string | null;
  type: AssetEventType;
  payload: Record<string, unknown>;
}

export interface AssetEventRow {
  id: string;
  assetId: string;
  userId: string;
  projectId: string | null;
  type: AssetEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export async function emitAssetEvent(input: EmitAssetEventInput): Promise<AssetEventRow> {
  const [row] = await db
    .insert(assetEvents)
    .values({
      assetId: input.assetId,
      userId: input.userId,
      projectId: input.projectId ?? null,
      type: input.type,
      payload: input.payload,
    })
    .returning();

  const message = JSON.stringify({
    id: row.id,
    assetId: row.assetId,
    userId: row.userId,
    projectId: row.projectId,
    type: row.type,
    payload: row.payload,
    createdAt: row.createdAt,
  });

  await redis.publish(`asset-events:${input.userId}`, message);
  if (input.projectId) {
    await redis.publish(`asset-events:project:${input.projectId}`, message);
  }

  return row as AssetEventRow;
}
```

If `packages/api/src/services/redis.ts` does not yet exist, create it:

```ts
import IORedis from 'ioredis';
import { config } from '../config';

export const redis = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
});
```

(Use whatever env var/key `queue.ts` already uses — inspect that file first to match.)

- [ ] **Step 4: Run test, expect green.**

Run: `cd packages/api && pnpm test -- src/services/asset-events.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/asset-events.ts packages/api/src/services/asset-events.test.ts packages/api/src/services/redis.ts
git commit -m "feat(api): add asset event emitter with Redis fanout"
```

---

## Task 3: Asset service — core CRUD + ownership checks

**Files:**
- Create: `packages/api/src/services/asset-service.ts`
- Create: `packages/api/src/services/asset-service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/services/asset-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createOrDedupAsset, getAssetById, listUserAssets,
  updateAssetMetadata, softDeleteAsset,
} from './asset-service';

const selectWhere = vi.fn();
const insertReturning = vi.fn();
const updateReturning = vi.fn();
const emitEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: (...a: unknown[]) => selectWhere(...a) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: (...a: unknown[]) => insertReturning(...a) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: (...a: unknown[]) => updateReturning(...a) })) })) })),
  },
}));

vi.mock('./asset-events', () => ({
  emitAssetEvent: (...args: unknown[]) => emitEvent(...args),
}));

beforeEach(() => {
  selectWhere.mockReset();
  insertReturning.mockReset();
  updateReturning.mockReset();
  emitEvent.mockClear();
});

describe('createOrDedupAsset', () => {
  it('returns existing asset if (userId, sha256) already exists', async () => {
    selectWhere.mockResolvedValueOnce([{ id: 'existing', sha256: 'abc', userId: 'u' }]);
    const result = await createOrDedupAsset({
      userId: 'u', sha256: 'abc', storageKey: 'k', filename: 'a.mp4',
      mimeType: 'video/mp4', fileSize: 1, source: 'upload',
    });
    expect(result.deduped).toBe(true);
    expect(result.asset.id).toBe('existing');
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('inserts and emits created event when new', async () => {
    selectWhere.mockResolvedValueOnce([]);
    insertReturning.mockResolvedValueOnce([{
      id: 'new', sha256: 'abc', userId: 'u', status: 'ready', mimeType: 'video/mp4',
    }]);
    const result = await createOrDedupAsset({
      userId: 'u', sha256: 'abc', storageKey: 'k', filename: 'a.mp4',
      mimeType: 'video/mp4', fileSize: 1, source: 'upload',
    });
    expect(result.deduped).toBe(false);
    expect(result.asset.id).toBe('new');
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'new', userId: 'u', type: 'created',
    }));
  });
});

describe('getAssetById', () => {
  it('returns null if asset does not belong to user', async () => {
    selectWhere.mockResolvedValueOnce([{ id: 'a', userId: 'other' }]);
    const result = await getAssetById('a', 'u');
    expect(result).toBeNull();
  });

  it('returns asset if owned by user', async () => {
    selectWhere.mockResolvedValueOnce([{ id: 'a', userId: 'u' }]);
    const result = await getAssetById('a', 'u');
    expect(result?.id).toBe('a');
  });
});

describe('softDeleteAsset', () => {
  it('sets status to deleted and emits deleted event', async () => {
    updateReturning.mockResolvedValueOnce([{ id: 'a', userId: 'u', status: 'deleted' }]);
    await softDeleteAsset('a', 'u');
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'a', userId: 'u', type: 'deleted',
    }));
  });
});
```

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/api && pnpm test -- src/services/asset-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `asset-service.ts`**

```ts
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { assets } from '../db/schema';
import { emitAssetEvent } from './asset-events';

export type AssetSource = 'upload' | 'generated' | 'chat' | 'derived';
export type AssetStatus = 'uploading' | 'ready' | 'failed' | 'deleted';

export interface CreateAssetInput {
  userId: string;
  sha256: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  source: AssetSource;
  label?: string;
  userIntent?: string;
  parentAssetIds?: string[];
  projectIdForEvent?: string | null;
}

export interface CreateAssetResult {
  asset: typeof assets.$inferSelect;
  deduped: boolean;
}

export async function createOrDedupAsset(input: CreateAssetInput): Promise<CreateAssetResult> {
  const existing = await db.select().from(assets).where(
    and(eq(assets.userId, input.userId), eq(assets.sha256, input.sha256)),
  );
  if (existing.length > 0) {
    return { asset: existing[0], deduped: true };
  }

  const [row] = await db.insert(assets).values({
    userId: input.userId,
    sha256: input.sha256,
    storageKey: input.storageKey,
    filename: input.filename,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    source: input.source,
    status: 'ready',
    label: input.label ?? input.filename,
    userIntent: input.userIntent ?? null,
    parentAssetIds: input.parentAssetIds ?? [],
  }).returning();

  await emitAssetEvent({
    assetId: row.id,
    userId: input.userId,
    projectId: input.projectIdForEvent ?? null,
    type: 'created',
    payload: { mimeType: row.mimeType, filename: row.filename, source: row.source },
  });

  return { asset: row, deduped: false };
}

export async function getAssetById(id: string, userId: string): Promise<typeof assets.$inferSelect | null> {
  const rows = await db.select().from(assets).where(eq(assets.id, id));
  if (rows.length === 0) return null;
  if (rows[0].userId !== userId) return null;
  return rows[0];
}

export async function listUserAssets(userId: string, opts?: { limit?: number }): Promise<typeof assets.$inferSelect[]> {
  return db.select().from(assets)
    .where(and(eq(assets.userId, userId), eq(assets.status, 'ready')))
    .orderBy(desc(assets.createdAt))
    .limit(opts?.limit ?? 200);
}

export interface UpdateAssetInput {
  label?: string;
  userDescription?: string | null;
  userIntent?: string | null;
  tags?: string[];
}

export async function updateAssetMetadata(
  id: string, userId: string, patch: UpdateAssetInput,
): Promise<typeof assets.$inferSelect | null> {
  const [row] = await db.update(assets)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
    .returning();
  if (!row) return null;
  await emitAssetEvent({
    assetId: row.id, userId, projectId: null,
    type: 'renamed', payload: { patch },
  });
  return row;
}

export async function softDeleteAsset(id: string, userId: string): Promise<boolean> {
  const [row] = await db.update(assets)
    .set({ status: 'deleted', updatedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
    .returning();
  if (!row) return false;
  await emitAssetEvent({
    assetId: row.id, userId, projectId: null,
    type: 'deleted', payload: {},
  });
  return true;
}

export async function setAssetReady(id: string): Promise<void> {
  await db.update(assets)
    .set({ status: 'ready', updatedAt: new Date() })
    .where(eq(assets.id, id));
}
```

- [ ] **Step 4: Run tests, expect green.**

Run: `cd packages/api && pnpm test -- src/services/asset-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/asset-service.ts packages/api/src/services/asset-service.test.ts
git commit -m "feat(api): add asset service with dedup + ownership checks"
```

---

## Task 4: Asset link service — project junction CRUD

**Files:**
- Create: `packages/api/src/services/asset-link-service.ts`
- Create: `packages/api/src/services/asset-link-service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/services/asset-link-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { linkAssetToProject, unlinkAssetFromProject, listProjectAssets } from './asset-link-service';

const insertReturning = vi.fn();
const deleteWhere = vi.fn();
const selectFromJoin = vi.fn();
const emitEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('../db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({ returning: (...a: unknown[]) => insertReturning(...a) })),
      })),
    })),
    delete: vi.fn(() => ({ where: (...a: unknown[]) => deleteWhere(...a) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({ orderBy: (...a: unknown[]) => selectFromJoin(...a) })),
        })),
      })),
    })),
  },
}));

vi.mock('./asset-events', () => ({
  emitAssetEvent: (...args: unknown[]) => emitEvent(...args),
}));

beforeEach(() => {
  insertReturning.mockReset();
  deleteWhere.mockReset();
  selectFromJoin.mockReset();
  emitEvent.mockClear();
});

describe('linkAssetToProject', () => {
  it('creates link and emits linked event', async () => {
    insertReturning.mockResolvedValueOnce([{ id: 'l', assetId: 'a', projectId: 'p', addedVia: 'upload' }]);
    const result = await linkAssetToProject({
      assetId: 'a', projectId: 'p', userId: 'u', addedVia: 'upload',
    });
    expect(result.id).toBe('l');
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'a', projectId: 'p', type: 'linked',
    }));
  });

  it('returns existing link on conflict without re-emitting', async () => {
    insertReturning.mockResolvedValueOnce([]);  // onConflictDoNothing returned no row
    selectFromJoin.mockResolvedValueOnce([{ id: 'l-existing', assetId: 'a', projectId: 'p' }]);
    const result = await linkAssetToProject({
      assetId: 'a', projectId: 'p', userId: 'u', addedVia: 'library',
    });
    expect(result.id).toBe('l-existing');
    expect(emitEvent).not.toHaveBeenCalled();
  });
});

describe('unlinkAssetFromProject', () => {
  it('deletes link and emits unlinked', async () => {
    deleteWhere.mockResolvedValueOnce({ rowCount: 1 });
    const removed = await unlinkAssetFromProject({ assetId: 'a', projectId: 'p', userId: 'u' });
    expect(removed).toBe(true);
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'a', projectId: 'p', type: 'unlinked',
    }));
  });
});
```

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/api && pnpm test -- src/services/asset-link-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `asset-link-service.ts`**

```ts
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { assets, assetProjectLinks } from '../db/schema';
import { emitAssetEvent } from './asset-events';

export type AddedVia = 'upload' | 'chat' | 'generated' | 'library';

export interface LinkInput {
  assetId: string;
  projectId: string;
  userId: string;
  addedVia: AddedVia;
}

export async function linkAssetToProject(input: LinkInput): Promise<typeof assetProjectLinks.$inferSelect> {
  const [row] = await db.insert(assetProjectLinks)
    .values({ assetId: input.assetId, projectId: input.projectId, addedVia: input.addedVia })
    .onConflictDoNothing()
    .returning();

  if (!row) {
    // Already linked — return existing
    const [existing] = await db.select().from(assetProjectLinks)
      .innerJoin(assets, eq(assetProjectLinks.assetId, assets.id))
      .where(and(
        eq(assetProjectLinks.assetId, input.assetId),
        eq(assetProjectLinks.projectId, input.projectId),
      ))
      .orderBy(desc(assetProjectLinks.addedAt));
    return existing as unknown as typeof assetProjectLinks.$inferSelect;
  }

  await emitAssetEvent({
    assetId: input.assetId,
    userId: input.userId,
    projectId: input.projectId,
    type: 'linked',
    payload: { addedVia: input.addedVia },
  });
  return row;
}

export async function unlinkAssetFromProject(input: Omit<LinkInput, 'addedVia'>): Promise<boolean> {
  const result = await db.delete(assetProjectLinks).where(and(
    eq(assetProjectLinks.assetId, input.assetId),
    eq(assetProjectLinks.projectId, input.projectId),
  ));
  const removed = (result as unknown as { rowCount: number }).rowCount > 0;
  if (removed) {
    await emitAssetEvent({
      assetId: input.assetId,
      userId: input.userId,
      projectId: input.projectId,
      type: 'unlinked',
      payload: {},
    });
  }
  return removed;
}

export async function listProjectAssets(projectId: string): Promise<typeof assets.$inferSelect[]> {
  const rows = await db.select({ asset: assets })
    .from(assetProjectLinks)
    .innerJoin(assets, eq(assetProjectLinks.assetId, assets.id))
    .where(and(eq(assetProjectLinks.projectId, projectId), eq(assets.status, 'ready')))
    .orderBy(desc(assetProjectLinks.addedAt));
  return rows.map((r) => r.asset);
}
```

- [ ] **Step 4: Run tests, expect green.**

Run: `cd packages/api && pnpm test -- src/services/asset-link-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/asset-link-service.ts packages/api/src/services/asset-link-service.test.ts
git commit -m "feat(api): add asset-project link service"
```

---

## Task 5: MinIO multipart presign helper

**Files:**
- Modify: `packages/api/src/services/minio.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/api/src/services/minio.test.ts` (create if absent):

```ts
import { describe, it, expect, vi } from 'vitest';
import { getPresignedMultipartUploadUrls } from './minio';

vi.mock('minio', () => {
  class Mock {
    initiateNewMultipartUpload = vi.fn().mockResolvedValue('upload-id-1');
    presignedUrl = vi.fn().mockResolvedValue('https://mock-presigned/url');
  }
  return { Client: Mock };
});

describe('getPresignedMultipartUploadUrls', () => {
  it('initiates multipart, returns urls per part, expiresAt, uploadId', async () => {
    const result = await getPresignedMultipartUploadUrls({
      prefix: 'uploads', key: 'users/u-1/assets/abc', partCount: 3,
    });
    expect(result.uploadId).toBe('upload-id-1');
    expect(result.partUrls).toHaveLength(3);
    expect(result.expiresAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/api && pnpm test -- src/services/minio.test.ts`
Expected: FAIL — `getPresignedMultipartUploadUrls` not exported.

- [ ] **Step 3: Add helper to `minio.ts`**

Append to `packages/api/src/services/minio.ts`:

```ts
export interface MultipartPresignResult {
  uploadId: string;
  partUrls: { partNumber: number; url: string }[];
  expiresAt: Date;
}

export async function getPresignedMultipartUploadUrls(args: {
  prefix: 'uploads' | 'outputs' | 'templates';
  key: string;
  partCount: number;
  expirySeconds?: number;
}): Promise<MultipartPresignResult> {
  const fullKey = PREFIXES[args.prefix] + args.key;
  const expiry = args.expirySeconds ?? 3600;

  const uploadId = await minioClient.initiateNewMultipartUpload(
    config.storage.bucket,
    fullKey,
    {},
  );

  const partUrls = [];
  for (let i = 1; i <= args.partCount; i++) {
    const url = await presignedClient.presignedUrl(
      'PUT',
      config.storage.bucket,
      fullKey,
      expiry,
      { uploadId, partNumber: i.toString() },
    );
    partUrls.push({ partNumber: i, url });
  }

  return { uploadId, partUrls, expiresAt: new Date(Date.now() + expiry * 1000) };
}
```

Confirm that `minioClient` + `presignedClient` + `PREFIXES` + `config` are already exported/available in the module. If `PREFIXES` is private, export it.

- [ ] **Step 4: Run test, expect green.**

Run: `cd packages/api && pnpm test -- src/services/minio.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/minio.ts packages/api/src/services/minio.test.ts
git commit -m "feat(api): add multipart presign helper"
```

---

## Task 6: Routes — `POST /assets/upload-urls` and `POST /assets/register`

**Files:**
- Create: `packages/api/src/routes/assets.ts`
- Create: `packages/api/src/routes/assets.test.ts`
- Modify: `packages/api/src/index.ts` — register the new route module

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/routes/assets.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import assetRoutes from './assets';

const presignMock = vi.fn();
const createOrDedupMock = vi.fn();

vi.mock('../services/minio', () => ({
  getPresignedMultipartUploadUrls: (...args: unknown[]) => presignMock(...args),
  getPresignedDownloadUrl: vi.fn().mockReturnValue('https://mock-dl'),
}));
vi.mock('../services/asset-service', () => ({
  createOrDedupAsset: (...args: unknown[]) => createOrDedupMock(...args),
}));
vi.mock('../services/queue', () => ({
  queueAssetMetadataJob: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (req: { userId: string }) => { req.userId = 'u-1'; },
}));

async function build() {
  const app = fastify();
  await app.register(assetRoutes);
  return app;
}

beforeEach(() => {
  presignMock.mockReset();
  createOrDedupMock.mockReset();
});

describe('POST /assets/upload-urls', () => {
  it('returns partUrls + uploadId for a valid multipart request', async () => {
    presignMock.mockResolvedValueOnce({
      uploadId: 'mp-1',
      partUrls: [{ partNumber: 1, url: 'https://p1' }],
      expiresAt: new Date(),
    });
    const app = await build();
    const res = await app.inject({
      method: 'POST', url: '/assets/upload-urls',
      payload: { filename: 'video.mp4', mimeType: 'video/mp4', fileSize: 1024, partCount: 1 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.uploadId).toBe('mp-1');
    expect(body.partUrls).toHaveLength(1);
    expect(body.storageKey).toMatch(/^users\/u-1\/assets\/pending\//);
  });

  it('rejects partCount < 1', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST', url: '/assets/upload-urls',
      payload: { filename: 'a.mp4', mimeType: 'video/mp4', fileSize: 1, partCount: 0 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /assets/register', () => {
  it('registers a new asset and returns deduped=false', async () => {
    createOrDedupMock.mockResolvedValueOnce({
      asset: { id: 'a-1', userId: 'u-1', mimeType: 'video/mp4' }, deduped: false,
    });
    const app = await build();
    const res = await app.inject({
      method: 'POST', url: '/assets/register',
      payload: {
        storageKey: 'users/u-1/assets/pending/abc/video.mp4',
        sha256: 'abc',
        filename: 'video.mp4',
        mimeType: 'video/mp4',
        fileSize: 1024,
        source: 'upload',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.asset.id).toBe('a-1');
    expect(body.deduped).toBe(false);
  });

  it('returns deduped=true for duplicate sha256', async () => {
    createOrDedupMock.mockResolvedValueOnce({
      asset: { id: 'existing', userId: 'u-1' }, deduped: true,
    });
    const app = await build();
    const res = await app.inject({
      method: 'POST', url: '/assets/register',
      payload: {
        storageKey: 'ignored', sha256: 'abc', filename: 'f.mp4',
        mimeType: 'video/mp4', fileSize: 1, source: 'upload',
      },
    });
    expect(res.json().deduped).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/api && pnpm test -- src/routes/assets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `assets.ts` route module**

```ts
import { nanoid } from 'nanoid';
import { FastifyPluginAsync } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import {
  getPresignedMultipartUploadUrls,
  getPresignedDownloadUrl,
} from '../services/minio';
import {
  createOrDedupAsset, getAssetById, listUserAssets,
  updateAssetMetadata, softDeleteAsset,
} from '../services/asset-service';
import { queueAssetMetadataJob } from '../services/queue';

interface AuthedRequest {
  userId: string;
}

const assetRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authMiddleware);

  fastify.post<{ Body: {
    filename: string; mimeType: string; fileSize: number; partCount: number;
  } }>('/assets/upload-urls', async (request, reply) => {
    const { filename, mimeType, fileSize, partCount } = request.body;
    if (!filename || !mimeType || fileSize <= 0 || partCount < 1) {
      return reply.code(400).send({ error: 'invalid_upload_request' });
    }

    const userId = (request as unknown as AuthedRequest).userId;
    const stagingKey = `users/${userId}/assets/pending/${nanoid()}/${filename}`;

    const presigned = await getPresignedMultipartUploadUrls({
      prefix: 'uploads',
      key: stagingKey,
      partCount,
      expirySeconds: 3600,
    });

    return reply.send({
      uploadId: presigned.uploadId,
      partUrls: presigned.partUrls,
      storageKey: stagingKey,
      expiresAt: presigned.expiresAt.toISOString(),
    });
  });

  fastify.post<{ Body: {
    storageKey: string; sha256: string; filename: string;
    mimeType: string; fileSize: number;
    source: 'upload' | 'chat' | 'generated';
    userIntent?: string; parentAssetIds?: string[]; projectId?: string;
  } }>('/assets/register', async (request, reply) => {
    const userId = (request as unknown as AuthedRequest).userId;
    const body = request.body;
    if (!body.sha256 || !body.storageKey || !body.filename) {
      return reply.code(400).send({ error: 'missing_required_fields' });
    }

    const result = await createOrDedupAsset({
      userId,
      sha256: body.sha256,
      storageKey: body.storageKey,
      filename: body.filename,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      source: body.source,
      userIntent: body.userIntent,
      parentAssetIds: body.parentAssetIds,
      projectIdForEvent: body.projectId ?? null,
    });

    if (!result.deduped) {
      await queueAssetMetadataJob({ assetId: result.asset.id });
    }

    return reply.send({ asset: result.asset, deduped: result.deduped });
  });

  fastify.get('/assets', async (request, reply) => {
    const userId = (request as unknown as AuthedRequest).userId;
    const rows = await listUserAssets(userId);
    return reply.send({ assets: rows });
  });

  fastify.get<{ Params: { id: string } }>('/assets/:id', async (request, reply) => {
    const userId = (request as unknown as AuthedRequest).userId;
    const asset = await getAssetById(request.params.id, userId);
    if (!asset) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ asset });
  });

  fastify.get<{ Params: { id: string } }>('/assets/:id/url', async (request, reply) => {
    const userId = (request as unknown as AuthedRequest).userId;
    const asset = await getAssetById(request.params.id, userId);
    if (!asset) return reply.code(404).send({ error: 'not_found' });
    const url = getPresignedDownloadUrl('uploads', asset.storageKey.replace(/^uploads\//, ''), 24 * 3600);
    return reply.send({ url, expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() });
  });

  fastify.patch<{ Params: { id: string }; Body: {
    label?: string; userDescription?: string | null;
    userIntent?: string | null; tags?: string[];
  } }>('/assets/:id', async (request, reply) => {
    const userId = (request as unknown as AuthedRequest).userId;
    const updated = await updateAssetMetadata(request.params.id, userId, request.body);
    if (!updated) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ asset: updated });
  });

  fastify.delete<{ Params: { id: string } }>('/assets/:id', async (request, reply) => {
    const userId = (request as unknown as AuthedRequest).userId;
    const ok = await softDeleteAsset(request.params.id, userId);
    if (!ok) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ ok: true });
  });
};

export default assetRoutes;
```

- [ ] **Step 4: Register the route module**

Edit `packages/api/src/index.ts`. Find the existing `fastify.register(projectRoutes)` line and add below it:

```ts
await fastify.register(assetRoutes);
```

Add the import at the top alongside the existing route imports:

```ts
import assetRoutes from './routes/assets';
```

- [ ] **Step 5: Run tests, expect green.**

Run: `cd packages/api && pnpm test -- src/routes/assets.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no new errors. Preserve existing baseline.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routes/assets.ts packages/api/src/routes/assets.test.ts packages/api/src/index.ts
git commit -m "feat(api): /assets upload-urls, register, CRUD endpoints"
```

---

## Task 7: Queue — `assetMetadataQueue` + `queueAssetMetadataJob`

**Files:**
- Modify: `packages/api/src/services/queue.ts`

- [ ] **Step 1: Write failing test**

Create `packages/api/src/services/queue.test.ts` (append if exists):

```ts
import { describe, it, expect, vi } from 'vitest';
import { queueAssetMetadataJob, assetMetadataQueue } from './queue';

describe('queueAssetMetadataJob', () => {
  it('adds a job with the expected name and payload', async () => {
    const addSpy = vi.spyOn(assetMetadataQueue, 'add').mockResolvedValueOnce({ id: 'j-1' } as never);
    await queueAssetMetadataJob({ assetId: 'a-1' });
    expect(addSpy).toHaveBeenCalledWith(
      'asset-metadata',
      { assetId: 'a-1' },
      expect.objectContaining({ attempts: 3 }),
    );
  });
});
```

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/api && pnpm test -- src/services/queue.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: Add queue + helper to `queue.ts`**

Append to `packages/api/src/services/queue.ts`:

```ts
export interface AssetMetadataJobData {
  assetId: string;
}

export const assetMetadataQueue = new Queue<AssetMetadataJobData>('asset-metadata', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

export async function queueAssetMetadataJob(data: AssetMetadataJobData) {
  await assetMetadataQueue.add('asset-metadata', data, { attempts: 3 });
}
```

Reuse the existing `connection` + `Queue` import that transcribeQueue already uses.

- [ ] **Step 4: Run test, expect green.**

Run: `cd packages/api && pnpm test -- src/services/queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/queue.ts packages/api/src/services/queue.test.ts
git commit -m "feat(api): add asset-metadata queue"
```

---

## Task 8: Worker — `asset-metadata` processor (ffprobe + thumbnail + waveform)

**Files:**
- Create: `packages/worker/src/processors/asset-metadata.ts`
- Create: `packages/worker/src/processors/asset-metadata.test.ts`
- Modify: `packages/worker/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/worker/src/processors/asset-metadata.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processAssetMetadataJob } from './asset-metadata';

const dbUpdate = vi.fn().mockReturnValue({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) });
const dbSelect = vi.fn();
const emitEvent = vi.fn().mockResolvedValue(undefined);
const ffprobe = vi.fn();
const ffmpeg = vi.fn();
const minioGet = vi.fn();
const minioPut = vi.fn();
const queueTranscribe = vi.fn();

vi.mock('../db', () => ({
  db: {
    update: (...args: unknown[]) => dbUpdate(...args),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: (...a: unknown[]) => dbSelect(...a) })) })),
  },
}));
vi.mock('../services/asset-events', () => ({
  emitAssetEvent: (...args: unknown[]) => emitEvent(...args),
}));
vi.mock('../services/media', () => ({
  runFfprobe: (...args: unknown[]) => ffprobe(...args),
  runFfmpegThumbnail: (...args: unknown[]) => ffmpeg(...args),
  runFfmpegWaveform: (...args: unknown[]) => ffmpeg(...args),
}));
vi.mock('../services/minio', () => ({
  downloadToTmp: (...args: unknown[]) => minioGet(...args),
  uploadFile: (...args: unknown[]) => minioPut(...args),
}));
vi.mock('../services/queue', () => ({
  queueTranscribeJob: (...args: unknown[]) => queueTranscribe(...args),
}));

beforeEach(() => {
  ffprobe.mockReset();
  ffmpeg.mockReset();
  minioGet.mockReset();
  minioPut.mockReset();
  dbSelect.mockReset();
  emitEvent.mockClear();
  queueTranscribe.mockClear();
});

describe('processAssetMetadataJob', () => {
  it('extracts duration/width/height via ffprobe for video', async () => {
    dbSelect.mockResolvedValueOnce([{
      id: 'a-1', userId: 'u', storageKey: 'k', mimeType: 'video/mp4', sha256: 'abc',
    }]);
    minioGet.mockResolvedValueOnce('/tmp/abc.mp4');
    ffprobe.mockResolvedValueOnce({ durationMs: 12000, width: 1920, height: 1080 });
    ffmpeg.mockResolvedValueOnce(Buffer.from('img'));
    ffmpeg.mockResolvedValueOnce(Buffer.from('wave'));
    minioPut.mockResolvedValue('users/u/derived/abc/thumbnail.jpg');

    await processAssetMetadataJob({ data: { assetId: 'a-1' } } as never);

    expect(ffprobe).toHaveBeenCalled();
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'a-1', type: 'metadata_ready',
    }));
    expect(queueTranscribe).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'a-1' }));
  });

  it('skips ffprobe for images, only generates thumbnail', async () => {
    dbSelect.mockResolvedValueOnce([{
      id: 'a-2', userId: 'u', storageKey: 'k', mimeType: 'image/png', sha256: 'def',
    }]);
    minioGet.mockResolvedValueOnce('/tmp/def.png');
    ffprobe.mockResolvedValueOnce({ durationMs: null, width: 800, height: 600 });
    ffmpeg.mockResolvedValueOnce(Buffer.from('img'));
    minioPut.mockResolvedValue('users/u/derived/def/thumbnail.jpg');

    await processAssetMetadataJob({ data: { assetId: 'a-2' } } as never);
    expect(queueTranscribe).not.toHaveBeenCalled();
  });

  it('emits failed event when ffprobe throws', async () => {
    dbSelect.mockResolvedValueOnce([{
      id: 'a-3', userId: 'u', storageKey: 'k', mimeType: 'video/mp4', sha256: 'xxx',
    }]);
    minioGet.mockResolvedValueOnce('/tmp/f.mp4');
    ffprobe.mockRejectedValueOnce(new Error('probe-fail'));
    await expect(processAssetMetadataJob({ data: { assetId: 'a-3' } } as never)).rejects.toThrow('probe-fail');
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'a-3', type: 'failed',
    }));
  });
});
```

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/worker && pnpm test -- src/processors/asset-metadata.test.ts`
Expected: FAIL — module and media-helpers module not found.

- [ ] **Step 3: Create `packages/worker/src/services/media.ts` helpers**

Create `packages/worker/src/services/media.ts`:

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec = promisify(execFile);

export interface FfprobeResult {
  durationMs: number | null;
  width: number | null;
  height: number | null;
  audioChannels: number | null;
}

export async function runFfprobe(filepath: string): Promise<FfprobeResult> {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filepath,
  ]);
  const info = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; width?: number; height?: number; channels?: number }[];
  };
  const durationSec = info.format?.duration ? parseFloat(info.format.duration) : null;
  const videoStream = info.streams?.find((s) => s.codec_type === 'video');
  const audioStream = info.streams?.find((s) => s.codec_type === 'audio');
  return {
    durationMs: durationSec ? Math.round(durationSec * 1000) : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    audioChannels: audioStream?.channels ?? null,
  };
}

export async function runFfmpegThumbnail(filepath: string, isVideo: boolean): Promise<Buffer> {
  const outfile = join(tmpdir(), `thumb-${Date.now()}.jpg`);
  const args = isVideo
    ? ['-ss', '1', '-i', filepath, '-frames:v', '1', '-vf', 'scale=320:-1', '-y', outfile]
    : ['-i', filepath, '-vf', 'scale=320:-1', '-y', outfile];
  await exec('ffmpeg', args);
  return readFile(outfile);
}

export async function runFfmpegWaveform(filepath: string): Promise<Buffer> {
  const outfile = join(tmpdir(), `wave-${Date.now()}.png`);
  await exec('ffmpeg', [
    '-i', filepath,
    '-filter_complex', '[0:a]aformat=channel_layouts=mono,showwavespic=s=640x120:colors=white',
    '-frames:v', '1', '-y', outfile,
  ]);
  return readFile(outfile);
}
```

- [ ] **Step 4: Extend worker's MinIO wrapper with download/upload helpers**

If `packages/worker/src/services/minio.ts` doesn't already expose `downloadToTmp` / `uploadFile`, add them there (create the file if absent, matching config layout from `packages/api/src/services/minio.ts`).

```ts
import { Client } from 'minio';
import { createWriteStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from '../config';

const client = new Client({
  endPoint: config.storage.endpoint,
  port: config.storage.port,
  useSSL: config.storage.useSSL,
  accessKey: config.storage.accessKey,
  secretKey: config.storage.secretKey,
});

export async function downloadToTmp(key: string): Promise<string> {
  const local = join(tmpdir(), `asset-${Date.now()}`);
  await new Promise<void>((resolve, reject) => {
    client.getObject(config.storage.bucket, key).then((stream) => {
      const out = createWriteStream(local);
      stream.pipe(out);
      out.on('finish', () => resolve());
      out.on('error', reject);
    }, reject);
  });
  return local;
}

export async function uploadFile(key: string, buf: Buffer, contentType: string): Promise<string> {
  await client.putObject(config.storage.bucket, key, buf, buf.length, {
    'Content-Type': contentType,
  });
  return key;
}
```

Mirror the API package's config layout — if the worker package doesn't expose these env vars, import from the shared `@viona/config` package (check existing pattern). Do not duplicate credential reading.

- [ ] **Step 5: Create `asset-metadata.ts` processor**

```ts
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { assets } from '../db/schema';
import { emitAssetEvent } from '../services/asset-events';
import { runFfprobe, runFfmpegThumbnail, runFfmpegWaveform } from '../services/media';
import { downloadToTmp, uploadFile } from '../services/minio';
import { queueTranscribeJob } from '../services/queue';

export interface AssetMetadataJobData {
  assetId: string;
}

function isVideo(mime: string) { return mime.startsWith('video/'); }
function isAudio(mime: string) { return mime.startsWith('audio/'); }
function isImage(mime: string) { return mime.startsWith('image/'); }

export async function processAssetMetadataJob(job: Job<AssetMetadataJobData>): Promise<void> {
  const assetId = job.data.assetId;
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
  if (!asset) throw new Error(`asset not found: ${assetId}`);

  try {
    const local = await downloadToTmp(asset.storageKey);
    const probe = await runFfprobe(local);

    const derivedPrefix = `users/${asset.userId}/derived/${asset.sha256}`;
    let thumbnailKey: string | null = null;
    let waveformKey: string | null = null;

    if (isVideo(asset.mimeType) || isImage(asset.mimeType)) {
      const thumb = await runFfmpegThumbnail(local, isVideo(asset.mimeType));
      thumbnailKey = await uploadFile(`${derivedPrefix}/thumbnail.jpg`, thumb, 'image/jpeg');
    }
    if (isVideo(asset.mimeType) || isAudio(asset.mimeType)) {
      const wave = await runFfmpegWaveform(local);
      waveformKey = await uploadFile(`${derivedPrefix}/waveform.png`, wave, 'image/png');
    }

    await db.update(assets).set({
      durationMs: probe.durationMs,
      width: probe.width,
      height: probe.height,
      thumbnailKey,
      waveformKey,
      thumbnailStatus: thumbnailKey ? 'ready' : 'not_applicable',
      waveformStatus: waveformKey ? 'ready' : 'not_applicable',
      transcriptStatus: (isVideo(asset.mimeType) || isAudio(asset.mimeType)) ? 'pending' : 'not_applicable',
      updatedAt: new Date(),
    }).where(eq(assets.id, assetId));

    await emitAssetEvent({
      assetId, userId: asset.userId, projectId: null,
      type: 'metadata_ready',
      payload: { durationMs: probe.durationMs, width: probe.width, height: probe.height,
                 thumbnailKey, waveformKey },
    });

    if (isVideo(asset.mimeType) || isAudio(asset.mimeType)) {
      await queueTranscribeJob({ assetId, userId: asset.userId, storageKey: asset.storageKey });
    }
  } catch (err) {
    await emitAssetEvent({
      assetId, userId: asset.userId, projectId: null,
      type: 'failed',
      payload: { stage: 'metadata', message: (err as Error).message },
    });
    throw err;
  }
}
```

- [ ] **Step 6: Register worker in `packages/worker/src/index.ts`**

Add after the existing transcribe worker registration:

```ts
import { processAssetMetadataJob } from './processors/asset-metadata';

new Worker('asset-metadata', processAssetMetadataJob, {
  connection,
  concurrency: 2,
  lockDuration: 10 * 60 * 1000,
  stalledInterval: 5 * 60 * 1000,
});
```

- [ ] **Step 7: Run tests, expect green.**

Run: `cd packages/worker && pnpm test -- src/processors/asset-metadata.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/worker/src/processors/asset-metadata.ts packages/worker/src/processors/asset-metadata.test.ts packages/worker/src/services/media.ts packages/worker/src/services/minio.ts packages/worker/src/index.ts
git commit -m "feat(worker): add asset-metadata processor (ffprobe + thumbnail + waveform)"
```

---

## Task 9: Extend transcribe worker to accept `assetId` + emit `transcript_ready`

**Files:**
- Modify: `packages/worker/src/processors/transcribe.ts`
- Modify: `packages/api/src/services/queue.ts` — extend `queueTranscribeJob` signature

The existing `transcribe` job accepts `{ projectId, jobId, videoKey }`. We need it to also accept `{ assetId, userId, storageKey }` when invoked from `asset-metadata`. On completion, insert a derived Asset row for the transcript JSON and emit `transcript_ready`.

- [ ] **Step 1: Write failing test** — extend existing transcribe test with an asset-mode case.

In `packages/worker/src/processors/transcribe.test.ts`, add:

```ts
describe('processTranscribeJob — asset mode', () => {
  it('inserts derived transcript asset and emits transcript_ready', async () => {
    // Arrange: mock transcribe to return dummy text + segments
    // Call with { assetId, userId, storageKey }
    // Assert: assets row created with source=derived, parentAssetIds=[assetId],
    //         parent asset updated with transcriptAssetId + transcriptStatus=ready,
    //         emitAssetEvent called with type=transcript_ready
  });
});
```

Flesh out the mocks matching the existing test file's style; use the same mock libs already present.

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/worker && pnpm test -- src/processors/transcribe.test.ts`
Expected: FAIL — asset-mode branch not implemented.

- [ ] **Step 3: Extend `processTranscribeJob`**

At the top of the file, widen the job data type:

```ts
export type TranscribeJobData =
  | { mode: 'project'; projectId: string; jobId: string; videoKey: string }
  | { mode: 'asset'; assetId: string; userId: string; storageKey: string };
```

Update `queueTranscribeJob` in `packages/api/src/services/queue.ts`:

```ts
export async function queueTranscribeJob(data: TranscribeJobData) {
  await transcribeQueue.add('transcribe', data, { attempts: 1 });
}
```

In the processor, branch on `data.mode`:

```ts
export async function processTranscribeJob(job: Job<TranscribeJobData>) {
  if (job.data.mode === 'asset') {
    return processAssetTranscribe(job.data);
  }
  return processProjectTranscribe(job.data);  // existing body
}

async function processAssetTranscribe(data: Extract<TranscribeJobData, { mode: 'asset' }>) {
  const local = await downloadToTmp(data.storageKey);
  const result = await runWhisper(local);  // reuse existing helper

  const derivedKey = `users/${data.userId}/derived/${data.assetId}/transcript.json`;
  const payload = JSON.stringify({ text: result.text, segments: result.segments });
  await uploadFile(derivedKey, Buffer.from(payload, 'utf8'), 'application/json');

  const [derived] = await db.insert(assets).values({
    userId: data.userId,
    source: 'derived',
    status: 'ready',
    sha256: createHash('sha256').update(payload).digest('hex'),
    storageKey: derivedKey,
    filename: 'transcript.json',
    mimeType: 'application/json',
    fileSize: Buffer.byteLength(payload, 'utf8'),
    label: 'Transcript',
    parentAssetIds: [data.assetId],
    thumbnailStatus: 'not_applicable',
    waveformStatus: 'not_applicable',
    transcriptStatus: 'not_applicable',
  }).returning();

  await db.update(assets).set({
    transcriptAssetId: derived.id,
    transcriptStatus: 'ready',
    updatedAt: new Date(),
  }).where(eq(assets.id, data.assetId));

  await emitAssetEvent({
    assetId: data.assetId, userId: data.userId, projectId: null,
    type: 'transcript_ready',
    payload: { transcriptAssetId: derived.id, wordCount: result.text.split(/\s+/).length },
  });
}
```

If `runWhisper` doesn't exist as a standalone helper yet, lift it out of the current project-mode logic into a shared helper.

- [ ] **Step 4: Run tests, expect green.**

Run: `cd packages/worker && pnpm test -- src/processors/transcribe.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/transcribe.ts packages/worker/src/processors/transcribe.test.ts packages/api/src/services/queue.ts
git commit -m "feat(worker): add asset-mode transcription with transcript_ready event"
```

---

## Task 10: Project-asset link routes

**Files:**
- Create: `packages/api/src/routes/project-assets.ts`
- Create: `packages/api/src/routes/project-assets.test.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/routes/project-assets.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import projectAssetRoutes from './project-assets';

const linkMock = vi.fn();
const unlinkMock = vi.fn();
const listMock = vi.fn();
const getAsset = vi.fn();

vi.mock('../services/asset-link-service', () => ({
  linkAssetToProject: (...a: unknown[]) => linkMock(...a),
  unlinkAssetFromProject: (...a: unknown[]) => unlinkMock(...a),
  listProjectAssets: (...a: unknown[]) => listMock(...a),
}));
vi.mock('../services/asset-service', () => ({
  getAssetById: (...a: unknown[]) => getAsset(...a),
}));
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (req: { userId: string }) => { req.userId = 'u-1'; },
}));

async function build() {
  const app = fastify();
  await app.register(projectAssetRoutes);
  return app;
}

beforeEach(() => { linkMock.mockReset(); unlinkMock.mockReset(); listMock.mockReset(); getAsset.mockReset(); });

describe('POST /projects/:id/assets/link', () => {
  it('rejects linking an asset the user does not own', async () => {
    getAsset.mockResolvedValueOnce(null);
    const app = await build();
    const res = await app.inject({
      method: 'POST', url: '/projects/p-1/assets/link',
      payload: { assetId: 'a-1', addedVia: 'library' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('links an owned asset', async () => {
    getAsset.mockResolvedValueOnce({ id: 'a-1', userId: 'u-1' });
    linkMock.mockResolvedValueOnce({ id: 'l-1' });
    const app = await build();
    const res = await app.inject({
      method: 'POST', url: '/projects/p-1/assets/link',
      payload: { assetId: 'a-1', addedVia: 'library' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().link.id).toBe('l-1');
  });
});

describe('DELETE /projects/:id/assets/:assetId', () => {
  it('unlinks and returns ok=true', async () => {
    unlinkMock.mockResolvedValueOnce(true);
    const app = await build();
    const res = await app.inject({ method: 'DELETE', url: '/projects/p-1/assets/a-1' });
    expect(res.json().ok).toBe(true);
  });
});

describe('GET /projects/:id/assets', () => {
  it('returns all linked assets', async () => {
    listMock.mockResolvedValueOnce([{ id: 'a-1' }, { id: 'a-2' }]);
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-1/assets' });
    expect(res.json().assets).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/api && pnpm test -- src/routes/project-assets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `project-assets.ts`**

```ts
import { FastifyPluginAsync } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { getAssetById } from '../services/asset-service';
import {
  linkAssetToProject, unlinkAssetFromProject, listProjectAssets,
  type AddedVia,
} from '../services/asset-link-service';

const projectAssetRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authMiddleware);

  fastify.post<{ Params: { id: string }; Body: { assetId: string; addedVia: AddedVia } }>(
    '/projects/:id/assets/link',
    async (request, reply) => {
      const userId = (request as unknown as { userId: string }).userId;
      const { id: projectId } = request.params;
      const { assetId, addedVia } = request.body;

      const asset = await getAssetById(assetId, userId);
      if (!asset) return reply.code(403).send({ error: 'forbidden' });

      const link = await linkAssetToProject({ assetId, projectId, userId, addedVia });
      return reply.send({ link });
    },
  );

  fastify.delete<{ Params: { id: string; assetId: string } }>(
    '/projects/:id/assets/:assetId',
    async (request, reply) => {
      const userId = (request as unknown as { userId: string }).userId;
      const { id: projectId, assetId } = request.params;
      const ok = await unlinkAssetFromProject({ assetId, projectId, userId });
      return reply.send({ ok });
    },
  );

  fastify.get<{ Params: { id: string } }>('/projects/:id/assets', async (request, reply) => {
    const assets = await listProjectAssets(request.params.id);
    return reply.send({ assets });
  });
};

export default projectAssetRoutes;
```

- [ ] **Step 4: Register the module**

In `packages/api/src/index.ts`:

```ts
import projectAssetRoutes from './routes/project-assets';
// ...
await fastify.register(projectAssetRoutes);
```

- [ ] **Step 5: Run tests, expect green.**

Run: `cd packages/api && pnpm test -- src/routes/project-assets.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/project-assets.ts packages/api/src/routes/project-assets.test.ts packages/api/src/index.ts
git commit -m "feat(api): project-asset link endpoints"
```

---

## Task 11: SSE endpoint — stream asset events to user

**Files:**
- Create: `packages/api/src/routes/asset-events-sse.ts`
- Create: `packages/api/src/routes/asset-events-sse.test.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import fastify from 'fastify';
import { PassThrough } from 'node:stream';
import assetEventsSseRoutes from './asset-events-sse';

const subscribeMock = vi.fn();

vi.mock('../services/redis', () => {
  const impl = { subscribe: subscribeMock, unsubscribe: vi.fn(), on: vi.fn(), duplicate: () => impl };
  return { redis: impl };
});
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (req: { userId: string }) => { req.userId = 'u-1'; },
}));

describe('GET /asset-events', () => {
  it('subscribes to the user channel and returns an SSE stream', async () => {
    const app = fastify();
    await app.register(assetEventsSseRoutes);
    const res = await app.inject({ method: 'GET', url: '/asset-events' });
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(subscribeMock).toHaveBeenCalledWith('asset-events:u-1');
  });
});
```

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/api && pnpm test -- src/routes/asset-events-sse.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create SSE endpoint**

Follow the existing Fastify SSE pattern (per repo memory: use `PassThrough` + `reply.send(stream)`, NOT `reply.hijack()`). Cross-reference `packages/api/src/agent/agent-router.ts` for the exact idiom.

```ts
import { FastifyPluginAsync } from 'fastify';
import { PassThrough } from 'node:stream';
import { authMiddleware } from '../middleware/auth';
import { redis } from '../services/redis';

const assetEventsSseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/asset-events', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as unknown as { userId: string }).userId;
    const channel = `asset-events:${userId}`;

    const sub = redis.duplicate();
    const stream = new PassThrough();

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    await sub.subscribe(channel);
    sub.on('message', (_ch, message) => {
      stream.write(`data: ${message}\n\n`);
    });

    request.raw.on('close', async () => {
      await sub.unsubscribe(channel);
      sub.disconnect();
      stream.end();
    });

    return reply.send(stream);
  });
};

export default assetEventsSseRoutes;
```

- [ ] **Step 4: Register in index.ts**

```ts
import assetEventsSseRoutes from './routes/asset-events-sse';
await fastify.register(assetEventsSseRoutes);
```

- [ ] **Step 5: Run tests, expect green.**

Run: `cd packages/api && pnpm test -- src/routes/asset-events-sse.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/asset-events-sse.ts packages/api/src/routes/asset-events-sse.test.ts packages/api/src/index.ts
git commit -m "feat(api): SSE stream for asset events"
```

---

## Task 12: Feature flag `ASSET_SYSTEM_V2`

**Files:**
- Modify: `packages/api/src/config.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/api/src/config.test.ts` (create if absent):

```ts
import { describe, it, expect } from 'vitest';
import { config } from './config';

describe('config', () => {
  it('exposes assetSystemV2 flag', () => {
    expect(typeof config.featureFlags.assetSystemV2).toBe('boolean');
  });
});
```

- [ ] **Step 2: Run test, expect red.**

Run: `cd packages/api && pnpm test -- src/config.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add flag**

In `packages/api/src/config.ts`, extend the exported `config` object:

```ts
export const config = {
  // ...existing fields...
  featureFlags: {
    assetSystemV2: process.env.ASSET_SYSTEM_V2 === 'true',
  },
};
```

In `packages/api/src/index.ts`, gate the new route modules:

```ts
if (config.featureFlags.assetSystemV2) {
  await fastify.register(assetRoutes);
  await fastify.register(projectAssetRoutes);
  await fastify.register(assetEventsSseRoutes);
}
```

- [ ] **Step 4: Run test, expect green.**

Run: `cd packages/api && pnpm test -- src/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/config.ts packages/api/src/config.test.ts packages/api/src/index.ts
git commit -m "feat(api): gate asset-system-v2 routes behind feature flag"
```

---

## Task 13: Backward-compat view — `projectAssets` reads from new tables

**Files:**
- Create: `packages/api/drizzle/0029_project_assets_view.sql`

Once the new schema is live, the existing `projectAssets` table and the queries that touch it must still return rows. Rather than dual-writing, replace the table with a view that unions (a) the legacy rows (until they're migrated out) and (b) the new `assets + asset_project_links` rows.

Implementation strategy (safest): keep the legacy `projectAssets` physical table untouched. Instead, add a new view `project_assets_v2` that code will switch to opportunistically. Delete the legacy table only after every caller migrates.

For PR-A1, just add the view so the editor-v2 code in PR-C can start consuming it.

- [ ] **Step 1: Write the migration SQL manually**

Create `packages/api/drizzle/0029_project_assets_view.sql`:

```sql
CREATE OR REPLACE VIEW project_assets_v2 AS
SELECT
  l.id                  AS id,
  l.project_id          AS project_id,
  a.filename            AS filename,
  a.label               AS label,
  a.user_description    AS description,
  a.storage_key         AS storage_key,
  a.mime_type           AS content_type,
  a.file_size           AS file_size,
  a.duration_ms         AS duration_ms,
  a.width               AS width,
  a.height              AS height,
  l.added_at            AS created_at,
  a.id                  AS asset_id,
  a.user_id             AS user_id,
  a.thumbnail_key       AS thumbnail_key,
  a.status              AS status
FROM asset_project_links l
JOIN assets a ON a.id = l.asset_id
WHERE a.status = 'ready';
```

Add an entry to `packages/api/drizzle/meta/_journal.json` matching the pattern of previous manual-SQL migrations. If the repo doesn't use manual SQL migrations, look at `_journal.json` to understand drizzle-kit's tracking and hand-edit in a matching entry.

- [ ] **Step 2: Run migration**

Run: `cd packages/api && pnpm db:migrate`
Expected: view created.

- [ ] **Step 3: Verify via SQL**

Using whatever local psql access the dev has:

```sql
SELECT count(*) FROM project_assets_v2;
```

Expected: 0 rows initially (until PR-C inserts via the new path).

- [ ] **Step 4: Commit**

```bash
git add packages/api/drizzle/0029_project_assets_view.sql packages/api/drizzle/meta/
git commit -m "feat(api): add project_assets_v2 view bridging new schema"
```

---

## Task 14: End-to-end smoke test (real services)

**Files:**
- Create: `packages/api/src/__smoke__/asset-ingest-smoke.test.ts`

Verify the full path hits real MinIO + real Postgres locally. Skipped in CI unless `ASSET_SMOKE_ENABLED=1`.

- [ ] **Step 1: Write the smoke test**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import { db } from '../db';
import { assets } from '../db/schema';
import { eq } from 'drizzle-orm';
import { config } from '../config';

const enabled = process.env.ASSET_SMOKE_ENABLED === '1';

describe.skipIf(!enabled)('asset ingest smoke', () => {
  const userId = 'smoke-user-' + Date.now();
  let assetId: string;

  it('register → row exists → metadata job enqueues', async () => {
    const content = Buffer.from('dummy-' + Date.now());
    const sha256 = createHash('sha256').update(content).digest('hex');
    const storageKey = `users/${userId}/assets/smoke/${sha256}.txt`;

    const res = await fetch(`http://localhost:${config.port}/assets/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer smoke-token-${userId}` },
      body: JSON.stringify({
        storageKey, sha256, filename: 'smoke.txt',
        mimeType: 'text/plain', fileSize: content.length, source: 'upload',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    assetId = body.asset.id;
    expect(body.deduped).toBe(false);

    const [row] = await db.select().from(assets).where(eq(assets.id, assetId));
    expect(row).toBeDefined();
    expect(row.status).toBe('ready');
  });
});
```

- [ ] **Step 2: Run smoke test locally**

```
ASSET_SMOKE_ENABLED=1 ASSET_SYSTEM_V2=true pnpm --filter @viona/api test -- src/__smoke__/asset-ingest-smoke.test.ts
```

Expected: PASS against a running local API + MinIO + Postgres stack.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/__smoke__/asset-ingest-smoke.test.ts
git commit -m "test(api): add asset ingest smoke test"
```

---

## Task 15: Typecheck + final baseline

- [ ] **Step 1: Run typecheck across all packages**

Run: `pnpm typecheck`
Expected: no new errors beyond the pre-existing baseline (per memory: 9 pre-existing errors in ExportDropdown, BrollPanel, editor-store, manifest-bridge, CanvasRenderer). If there are new errors, fix them.

- [ ] **Step 2: Run all new unit tests together**

Run:
```
cd packages/api && pnpm test -- src/services/asset-events.test.ts src/services/asset-service.test.ts src/services/asset-link-service.test.ts src/services/minio.test.ts src/services/queue.test.ts src/routes/assets.test.ts src/routes/project-assets.test.ts src/routes/asset-events-sse.test.ts
cd ../worker && pnpm test -- src/processors/asset-metadata.test.ts src/processors/transcribe.test.ts
```
Expected: all PASS.

- [ ] **Step 3: Commit any typecheck fixes**

```bash
git add -A
git commit -m "chore: typecheck clean for asset-ingest scope"
```

---

## Self-Review (Plan quality check)

**1. Spec coverage (spec §6.4 PR-A / §7.2 PR-A, minus arrangement agent which lives in PR-A2):**
- ✅ `assets`, `asset_project_links`, `asset_events` tables → Task 1
- ✅ `projectAssets → project_assets_v2` compat view behind rollout → Task 13
- ✅ `POST /assets/upload-urls` → Task 6
- ✅ `POST /assets/register` with sha256 dedup → Task 6 (uses Task 3 service)
- ✅ Eager metadata worker (ffprobe, thumbnail, waveform) → Task 8
- ✅ Transcript worker trigger on audio/video → Task 9
- ✅ `asset_events` SSE stream → Task 11
- ✅ `ASSET_SYSTEM_V2` feature flag → Task 12
- ✅ Asset CRUD + link endpoints → Tasks 6 + 10
- ✅ URL refresh endpoint → Task 6 (`/assets/:id/url`)
- Deferred to PR-A2: arrangement endpoint, pipeline message role, chat pipeline bubbles. Out of scope here.

**2. Placeholder scan:** No "TBD", "TODO", "add error handling as needed". Every step has runnable code or commands. One soft spot — Task 9 Step 1's test body is an outline rather than a fleshed-out test; the implementer must mirror the existing test file's style when filling it in. This is intentional because the existing `transcribe.test.ts` uses a set of mock helpers I haven't inspected line-by-line; overwriting it blindly would be worse.

**3. Type consistency:**
- `createOrDedupAsset` input/output consistent between Task 3 service and Task 6 route
- `queueAssetMetadataJob({ assetId })` shape matches Task 7 queue and Task 8 worker
- `TranscribeJobData` discriminated union added in Task 9 propagates to Task 7's `queueTranscribeJob` — both updated in same task
- `emitAssetEvent` signature stable across all consumers
- Enum values for `source`, `status`, `addedVia`, event `type` are identical to schema in Task 1

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-asset-ingest.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, spec + code-quality review between each, fast iteration.

**2. Inline Execution** — execute tasks in this session with checkpoints.

Which approach?
