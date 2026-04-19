import { db, assetEvents } from '../db/index.js';
import { redis } from './redis.js';

// Mirror of `packages/api/src/services/asset-events.ts`. Kept in sync so the
// worker can emit the same events (metadata_ready / transcript_ready / failed)
// without cross-package imports.

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
 * See `packages/api/src/services/asset-events.ts` for channel/contract notes.
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
