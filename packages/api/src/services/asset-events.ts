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
 * Insert an asset event row and fan out to Redis pub/sub channels for SSE consumers.
 *
 * Publishes to:
 *   - `asset-events:<userId>` — always
 *   - `asset-events:project:<projectId>` — only when projectId is set
 *
 * Reuses the shared `redis` client from `./redis.ts` (same IORedis instance used
 * elsewhere in the API). Do not duplicate Redis connections here.
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
