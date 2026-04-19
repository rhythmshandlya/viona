import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tracks, timelineItems } from '../db/schema.js';
import type { ArrangementOutput } from '../agent/arrangement-types.js';

/**
 * Persists an ArrangementOutput into the relational timeline schema.
 *
 * Strategy:
 * - Look up existing tracks for the project.
 * - Create new tracks for any `trackIndex` not covered by an existing `position`.
 * - Insert one `timelineItems` row per arrangement item, linked to its track by id.
 *   The asset reference lives on `data` (jsonb), alongside source-range metadata
 *   and a `source: 'arrangement_agent'` marker so future queries can target
 *   arrangement-generated items specifically.
 *
 * @remarks
 * First-pass landing: items are APPENDED to the timeline. If a prior arrangement-
 * generated item exists at overlapping times, the caller is responsible for
 * clearing them before re-running.
 */
export async function persistArrangement(
  projectId: string,
  output: ArrangementOutput,
): Promise<void> {
  // 1. Snapshot the existing tracks for this project so we can reuse any that
  //    already cover a requested `trackIndex` (mapped onto `tracks.position`).
  const existingTracks = await db
    .select()
    .from(tracks)
    .where(eq(tracks.projectId, projectId));

  const trackIdByPosition = new Map<number, string>();
  for (const t of existingTracks as Array<{ id: string; position: number }>) {
    trackIdByPosition.set(t.position, t.id);
  }

  // 2. Create missing tracks — one per unique `trackIndex` not already covered.
  //    Iterate in ascending order so the assigned names/positions are stable.
  const neededPositions = Array.from(
    new Set(output.timelineItems.map((i) => i.trackIndex)),
  ).sort((a, b) => a - b);

  for (const position of neededPositions) {
    if (trackIdByPosition.has(position)) continue;
    // `tracks.type` is a free-form varchar(50); existing insert sites use
    // 'video' and 'audio'. Arrangement items are treated as generic visual
    // assets today → 'video' is the closest match. (Schema is NOT an enum.)
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

  // 3. Insert one timelineItems row per arrangement item.
  for (const item of output.timelineItems) {
    const trackId = trackIdByPosition.get(item.trackIndex);
    if (!trackId) continue;
    await db
      .insert(timelineItems)
      .values({
        trackId,
        // `timelineItems.type` is also a free-form varchar(50). Existing sites
        // use 'video' / 'audio' based on the item's media kind. Since the
        // arrangement schema doesn't carry media-kind today, we use 'video'
        // as the generic default to match the track type.
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
