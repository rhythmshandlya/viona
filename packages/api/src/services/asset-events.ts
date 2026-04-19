import { db } from '../db/index.js';
import { assetEvents } from '../db/schema.js';
import { redis } from './redis.js';

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

/**
 * Inserts an asset event row and fans out to Redis pub/sub channels for SSE consumers.
 *
 * Channels:
 * - Always publishes to `asset-events:{userId}` for user-scoped SSE streams.
 * - When `projectId` is set, also publishes to `asset-events:project:{projectId}` for
 *   project-scoped streams.
 *
 * Reuses the shared `redis` client from `./redis.ts` (same IORedis instance used
 * elsewhere in the API). Do not duplicate Redis connections here.
 *
 * @remarks
 * Redis publish is best-effort. If `redis.publish` throws, the DB row is already
 * committed and the thrown error propagates to the caller. If the user-channel
 * publish succeeds but the project-channel publish fails, the first fanout still
 * landed. SSE reconnecting clients should reconcile by re-reading from the
 * `asset_events` table on resubscribe rather than relying on the live stream being
 * lossless.
 */
export async function emitAssetEvent(
  input: EmitAssetEventInput,
): Promise<AssetEventRow> {
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
