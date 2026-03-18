import { db, tracks as tracksTable, timelineItems, projects } from '../db/index.js';
import { eq, and, notInArray, inArray } from 'drizzle-orm';
import { logger } from '../logger.js';

/** Convert v2 manifest track type to DB track type */
function manifestTrackTypeToDb(type: string): string {
  switch (type) {
    case 'caption': return 'subtitle';
    case 'overlay': return 'overlay';
    default: return type; // video, audio stay the same
  }
}

/** Convert v2 manifest item type to DB item type */
function manifestItemTypeToDb(type: string): string {
  switch (type) {
    case 'scene': return 'visual';
    case 'caption': return 'subtitle';
    default: return type; // video, audio, text, image, shape stay the same
  }
}

export async function syncManifestToDb(
  projectId: string,
  manifest: any,
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Get existing track IDs for this project (needed for item orphan cleanup)
    const existingTracks = await tx
      .select({ id: tracksTable.id })
      .from(tracksTable)
      .where(eq(tracksTable.projectId, projectId));
    const existingTrackIds = existingTracks.map((t) => t.id);

    // 2. Upsert tracks
    const manifestTrackIds = (manifest.tracks ?? []).map((t: any) => t.id);
    for (const track of manifest.tracks ?? []) {
      const dbType = manifestTrackTypeToDb(track.type);
      await tx
        .insert(tracksTable)
        .values({
          id: track.id,
          projectId,
          type: dbType,
          name: track.name,
          position: track.position,
        })
        .onConflictDoUpdate({
          target: tracksTable.id,
          set: { type: dbType, name: track.name, position: track.position },
        });
    }
    // Remove orphan tracks
    if (manifestTrackIds.length > 0) {
      await tx.delete(tracksTable)
        .where(and(
          eq(tracksTable.projectId, projectId),
          notInArray(tracksTable.id, manifestTrackIds),
        ));
    } else {
      await tx.delete(tracksTable)
        .where(eq(tracksTable.projectId, projectId));
    }

    // 3. Upsert items
    const manifestItemIds = (manifest.items ?? []).map((i: any) => i.id);
    for (const item of manifest.items ?? []) {
      const dbType = manifestItemTypeToDb(item.type);
      const data = {
        ...item.data,
        ...(item.transform ? { _transform: item.transform } : {}),
        ...(item.keyframes?.length ? { _keyframes: item.keyframes } : {}),
        ...(item.filters ? { _filters: item.filters } : {}),
      };
      await tx
        .insert(timelineItems)
        .values({
          id: item.id,
          trackId: item.trackId,
          type: dbType,
          startMs: item.startMs,
          endMs: item.endMs,
          data,
        })
        .onConflictDoUpdate({
          target: timelineItems.id,
          set: {
            trackId: item.trackId,
            type: dbType,
            startMs: item.startMs,
            endMs: item.endMs,
            data,
          },
        });
    }
    // Remove orphan items — via trackId membership
    if (existingTrackIds.length > 0) {
      if (manifestItemIds.length > 0) {
        await tx.delete(timelineItems)
          .where(and(
            inArray(timelineItems.trackId, existingTrackIds),
            notInArray(timelineItems.id, manifestItemIds),
          ));
      } else {
        await tx.delete(timelineItems)
          .where(inArray(timelineItems.trackId, existingTrackIds));
      }
    }

    // 4. Update project metadata
    await tx
      .update(projects)
      .set({
        durationMs: manifest.durationMs,
        fps: manifest.fps,
      })
      .where(eq(projects.id, projectId));
  });
}
