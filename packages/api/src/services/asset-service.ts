import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { assets } from '../db/schema.js';
import { emitAssetEvent } from './asset-events.js';

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

/**
 * Creates a new asset or returns the existing one when the `(userId, sha256)` pair
 * is already present. Emits a `created` asset event only when a new row is inserted.
 *
 * Ownership is implicit: dedup is scoped to the caller's `userId`, so two different
 * users uploading the same file each get their own asset row.
 */
export async function createOrDedupAsset(
  input: CreateAssetInput,
): Promise<CreateAssetResult> {
  const existing = await db
    .select()
    .from(assets)
    .where(and(eq(assets.userId, input.userId), eq(assets.sha256, input.sha256)));
  if (existing.length > 0) {
    return { asset: existing[0], deduped: true };
  }

  const [row] = await db
    .insert(assets)
    .values({
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
    })
    .returning();

  await emitAssetEvent({
    assetId: row.id,
    userId: input.userId,
    projectId: input.projectIdForEvent ?? null,
    type: 'created',
    payload: {
      mimeType: row.mimeType,
      filename: row.filename,
      source: row.source,
    },
  });

  return { asset: row, deduped: false };
}

/**
 * Fetches an asset by id, returning `null` when either the asset does not exist
 * or it is owned by a different user. Callers MUST rely on this ownership check
 * rather than filtering at the route layer.
 */
export async function getAssetById(
  id: string,
  userId: string,
): Promise<typeof assets.$inferSelect | null> {
  const rows = await db.select().from(assets).where(eq(assets.id, id));
  if (rows.length === 0) return null;
  if (rows[0].userId !== userId) return null;
  return rows[0];
}

/**
 * Lists the caller's non-deleted assets, newest first. Limit defaults to 200.
 */
export async function listUserAssets(
  userId: string,
  opts?: { limit?: number },
): Promise<(typeof assets.$inferSelect)[]> {
  return db
    .select()
    .from(assets)
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

/**
 * Updates user-editable metadata fields on an asset the caller owns. Returns the
 * updated row or `null` when the asset does not exist / belongs to another user.
 * Emits a `renamed` event on success.
 */
export async function updateAssetMetadata(
  id: string,
  userId: string,
  patch: UpdateAssetInput,
): Promise<typeof assets.$inferSelect | null> {
  const [row] = await db
    .update(assets)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
    .returning();
  if (!row) return null;
  await emitAssetEvent({
    assetId: row.id,
    userId,
    projectId: null,
    type: 'renamed',
    payload: { patch },
  });
  return row;
}

/**
 * Soft-deletes an asset by flipping its status to `deleted`. Returns `false`
 * when the asset is missing or owned by a different user. Emits a `deleted`
 * event on success.
 */
export async function softDeleteAsset(
  id: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .update(assets)
    .set({ status: 'deleted', updatedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
    .returning();
  if (!row) return false;
  await emitAssetEvent({
    assetId: row.id,
    userId,
    projectId: null,
    type: 'deleted',
    payload: {},
  });
  return true;
}

/**
 * Marks an asset as `ready`. Used by workers once ingest finishes. Does not
 * enforce ownership because it is called from trusted background jobs with an
 * asset id the worker already resolved.
 */
export async function setAssetReady(id: string): Promise<void> {
  await db
    .update(assets)
    .set({ status: 'ready', updatedAt: new Date() })
    .where(eq(assets.id, id));
}
