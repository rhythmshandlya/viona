import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tracks, timelineItems, assets } from '../db/schema.js';
import { getPresignedDownloadUrl } from './minio.js';

export interface CompositionTrack {
  id: string;
  projectId: string;
  position: number;
  type: string;
  name: string;
}

export interface CompositionItem {
  id: string;
  trackId: string;
  type: string;
  startMs: number;
  endMs: number;
  data: Record<string, unknown>;
}

export interface ResolvedAsset {
  id: string;
  filename: string;
  mimeType: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  url: string;
  thumbnailUrl: string | null;
}

export interface Composition {
  tracks: CompositionTrack[];
  timelineItems: CompositionItem[];
  assets: Record<string, ResolvedAsset>;
}

const ASSET_URL_TTL_SECONDS = 24 * 3600;

/**
 * Loads the full V2 timeline composition for a project:
 *   - tracks (all tracks for the project)
 *   - timelineItems (all items across those tracks)
 *   - assets (resolved download + thumbnail URLs, keyed by assetId)
 *
 * This is the single source of truth the V2 frontend uses to render the
 * timeline. Authorization (project ownership) is the caller's responsibility.
 */
export async function loadComposition(input: { projectId: string; userId: string }): Promise<Composition> {
  const projectTracks = await db.select().from(tracks).where(eq(tracks.projectId, input.projectId));
  if (projectTracks.length === 0) {
    return { tracks: [], timelineItems: [], assets: {} };
  }

  const trackIds = (projectTracks as Array<{ id: string }>).map((t) => t.id);
  const itemRows = await db.select().from(timelineItems).where(inArray(timelineItems.trackId, trackIds));

  const assetIds = new Set<string>();
  for (const item of itemRows as Array<{ data: unknown }>) {
    const d = item.data as { assetId?: string } | null;
    if (d && typeof d.assetId === 'string') assetIds.add(d.assetId);
  }

  const resolvedAssets: Record<string, ResolvedAsset> = {};
  if (assetIds.size > 0) {
    const assetRows = await db.select().from(assets).where(inArray(assets.id, Array.from(assetIds)));
    for (const a of assetRows as Array<{
      id: string;
      filename: string;
      mimeType: string;
      storageKey: string;
      durationMs: number | null;
      width: number | null;
      height: number | null;
      thumbnailKey: string | null;
    }>) {
      const url = await getPresignedDownloadUrl('uploads', a.storageKey, ASSET_URL_TTL_SECONDS);
      const thumbnailUrl = a.thumbnailKey
        ? await getPresignedDownloadUrl('uploads', a.thumbnailKey, ASSET_URL_TTL_SECONDS)
        : null;
      resolvedAssets[a.id] = {
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        durationMs: a.durationMs,
        width: a.width,
        height: a.height,
        url,
        thumbnailUrl,
      };
    }
  }

  return {
    tracks: projectTracks as CompositionTrack[],
    timelineItems: itemRows as CompositionItem[],
    assets: resolvedAssets,
  };
}
