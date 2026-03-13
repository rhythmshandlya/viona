import { db, timelineItems } from '../db/index.js';
import { eq } from 'drizzle-orm';

/**
 * Migrate existing visual items from displayMode to overlayZone
 *
 * Migration rules:
 * - displayMode: 'overlay' -> overlayZone: 'behind'
 * - displayMode: 'fullscreen' -> overlayZone: 'background'
 * - displayMode: 'default' or undefined -> overlayZone: 'none'
 */
export async function migrateOverlayZones(): Promise<{ migrated: number; skipped: number }> {
  let migrated = 0;
  let skipped = 0;

  try {
    // Find all visual timeline items
    const visuals = await db.query.timelineItems.findMany({
      where: eq(timelineItems.type, 'visual'),
    });

    console.log(`[migrate-overlay-zones] Starting migration. Total visuals: ${visuals.length}`);

    for (const item of visuals) {
      const data = item.data as Record<string, unknown>;

      // Skip if already has overlayZone set
      if (data.overlayZone) {
        skipped++;
        continue;
      }

      // Migrate displayMode to overlayZone
      let overlayZone = 'none';
      const displayMode = data.displayMode as string | undefined;

      if (displayMode === 'overlay') {
        overlayZone = 'behind';
      } else if (displayMode === 'fullscreen') {
        overlayZone = 'background';
      }

      // Only update if we're setting a non-default zone
      if (overlayZone !== 'none') {
        await db.update(timelineItems)
          .set({
            data: {
              ...data,
              overlayZone,
            },
          })
          .where(eq(timelineItems.id, item.id));
        migrated++;
      } else {
        skipped++;
      }
    }

    console.log(`[migrate-overlay-zones] Completed. Migrated: ${migrated}, Skipped: ${skipped}`);
    return { migrated, skipped };
  } catch (error) {
    console.error('[migrate-overlay-zones] Failed to migrate overlay zones:', error);
    throw error;
  }
}
