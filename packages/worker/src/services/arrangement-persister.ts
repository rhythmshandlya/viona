import { eq } from 'drizzle-orm';
import { db, tracks, timelineItems } from '../db/index.js';
import type { ArrangementOutput } from '../agent/arrangement-types.js';

// Mirror of `packages/api/src/services/arrangement-persister.ts`. Persists an
// ArrangementOutput into the relational timeline schema: reuses existing
// tracks by position, inserts new ones for new trackIndex values, then one
// `timelineItems` row per item. Items marked with `source: 'arrangement_agent'`
// on the jsonb `data` column so future queries can target them specifically.

export async function persistArrangement(
  projectId: string,
  output: ArrangementOutput,
): Promise<void> {
  const existingTracks = await db
    .select()
    .from(tracks)
    .where(eq(tracks.projectId, projectId));

  const trackIdByPosition = new Map<number, string>();
  for (const t of existingTracks as Array<{ id: string; position: number }>) {
    trackIdByPosition.set(t.position, t.id);
  }

  const neededPositions = Array.from(
    new Set(output.timelineItems.map((i) => i.trackIndex)),
  ).sort((a, b) => a - b);

  for (const position of neededPositions) {
    if (trackIdByPosition.has(position)) continue;
    const [row] = await db
      .insert(tracks)
      .values({
        projectId,
        type: 'video',
        name: `Track ${position + 1}`,
        position,
        locked: false,
        visible: true,
      })
      .returning();
    trackIdByPosition.set(position, (row as { id: string }).id);
  }

  for (const item of output.timelineItems) {
    const trackId = trackIdByPosition.get(item.trackIndex);
    if (!trackId) continue;
    await db
      .insert(timelineItems)
      .values({
        trackId,
        type: 'video',
        startMs: item.startMs,
        endMs: item.startMs + item.durationMs,
        data: {
          assetId: item.assetId,
          sourceStartMs: item.sourceStartMs ?? 0,
          sourceDurationMs: item.sourceDurationMs ?? item.durationMs,
          source: 'arrangement_agent',
        },
      })
      .returning();
  }
}
