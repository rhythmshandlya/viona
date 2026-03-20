import { z } from 'zod';
import { nanoid } from 'nanoid';
import type { ManifestV2 as Manifest, ManifestItemV2 as ManifestItem } from './manifest-v2.js';

// ---- Operation schemas ----

export const manifestOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('update_item'),
    itemId: z.string(),
    updates: z.object({
      startMs: z.number().min(0).optional(),
      endMs: z.number().min(0).optional(),
      trackId: z.string().optional(),
    }),
  }),
  z.object({
    op: z.literal('update_item_data'),
    itemId: z.string(),
    dataUpdates: z.record(z.string(), z.unknown()),
  }),
  z.object({
    op: z.literal('delete_item'),
    itemId: z.string(),
  }),
  z.object({
    op: z.literal('set_transition'),
    itemId: z.string(),
    enter: z.object({ type: z.string(), durationMs: z.number() }).optional(),
    exit: z.object({ type: z.string(), durationMs: z.number() }).optional(),
  }),
  z.object({
    op: z.literal('move_item'),
    itemId: z.string(),
    startMs: z.number().min(0),
    endMs: z.number().min(0),
  }),
  z.object({
    op: z.literal('update_caption_preset'),
    updates: z.record(z.string(), z.unknown()),
  }),
  /** @deprecated Use `update_caption_preset` instead */
  z.object({
    op: z.literal('update_caption_style'),
    updates: z.record(z.string(), z.unknown()),
  }),
  z.object({
    op: z.literal('split_item'),
    itemId: z.string(),
    atMs: z.number().min(0),
  }),
  z.object({
    op: z.literal('reorder_tracks'),
    trackIds: z.array(z.string()),
  }),
  z.object({
    op: z.literal('update_video_settings'),
    updates: z.record(z.string(), z.unknown()),
  }),
  z.object({
    op: z.literal('update_transform'),
    itemId: z.string(),
    transform: z.record(z.string(), z.union([z.number(), z.string()])),
  }),
]);

export type ManifestOp = z.infer<typeof manifestOpSchema>;

// ---- Apply function ----

export function applyManifestOp(manifest: Manifest, op: ManifestOp): Manifest {
  // Deep clone to avoid mutation
  const m = structuredClone(manifest);

  switch (op.op) {
    case 'update_item': {
      const item = m.items.find(i => i.id === op.itemId);
      if (!item) throw new Error(`Item not found: ${op.itemId}`);
      if (op.updates.startMs !== undefined) item.startMs = op.updates.startMs;
      if (op.updates.endMs !== undefined) item.endMs = op.updates.endMs;
      if (op.updates.trackId !== undefined) item.trackId = op.updates.trackId;
      break;
    }

    case 'update_item_data': {
      const item = m.items.find(i => i.id === op.itemId);
      if (!item) throw new Error(`Item not found: ${op.itemId}`);
      item.data = { ...item.data, ...op.dataUpdates } as any;
      break;
    }

    case 'delete_item': {
      const idx = m.items.findIndex(i => i.id === op.itemId);
      if (idx === -1) throw new Error(`Item not found: ${op.itemId}`);
      m.items.splice(idx, 1);
      break;
    }

    case 'set_transition': {
      const item = m.items.find(i => i.id === op.itemId);
      if (!item) throw new Error(`Item not found: ${op.itemId}`);
      if (item.type !== 'scene') throw new Error(`Item ${op.itemId} is not a scene`);
      const data = item.data as any;
      if (!data.transition) data.transition = {};
      if (op.enter) data.transition.enter = op.enter;
      if (op.exit) data.transition.exit = op.exit;
      break;
    }

    case 'move_item': {
      const item = m.items.find(i => i.id === op.itemId);
      if (!item) throw new Error(`Item not found: ${op.itemId}`);
      item.startMs = op.startMs;
      item.endMs = op.endMs;
      break;
    }

    case 'update_caption_preset':
    case 'update_caption_style': { // deprecated alias — falls through to same logic
      const existing: Record<string, any> = m.captionPreset ?? {};
      const updates: Record<string, any> = op.updates;
      // Deep merge nested objects, shallow replace scalars.
      // When a nested key exists in updates but not in existing, the ...updates spread
      // provides the full replacement (the conditional spread evaluates to {}).
      m.captionPreset = {
        ...existing,
        ...updates,
        ...(updates.position && existing.position ? { position: { ...existing.position, ...updates.position } } : {}),
        ...(updates.animation && existing.animation && typeof existing.animation === 'object' ? { animation: { ...existing.animation, ...updates.animation } } : {}),
        ...(updates.effects && existing.effects ? { effects: { ...existing.effects, ...updates.effects } } : {}),
        ...(updates.wordEmphasis && existing.wordEmphasis ? {
          wordEmphasis: {
            ...existing.wordEmphasis,
            ...updates.wordEmphasis,
            roles: { ...existing.wordEmphasis?.roles, ...updates.wordEmphasis?.roles },
          },
        } : {}),
        ...(updates.backgroundPadding && existing.backgroundPadding ? { backgroundPadding: { ...existing.backgroundPadding, ...updates.backgroundPadding } } : {}),
      } as any;
      break;
    }

    case 'split_item': {
      const idx = m.items.findIndex(i => i.id === op.itemId);
      if (idx === -1) throw new Error(`Item not found: ${op.itemId}`);
      const item = m.items[idx];
      if (op.atMs <= item.startMs || op.atMs >= item.endMs) {
        throw new Error(`Split point ${op.atMs} is outside item bounds [${item.startMs}, ${item.endMs}]`);
      }

      // Create second half
      const newId = `split_${nanoid(10)}`;
      const secondHalf: ManifestItem = structuredClone(item);
      secondHalf.id = newId;
      secondHalf.startMs = op.atMs;

      // If scene, set frameOffset on second half
      if (item.type === 'scene') {
        const fps = manifest.fps || 30;
        const offsetFrames = Math.round(((op.atMs - item.startMs) / 1000) * fps);
        (secondHalf.data as any).frameOffset = ((item.data as any).frameOffset || 0) + offsetFrames;
      }

      // Trim first half
      item.endMs = op.atMs;

      // Insert second half after first
      m.items.splice(idx + 1, 0, secondHalf);
      break;
    }

    case 'reorder_tracks': {
      for (let i = 0; i < op.trackIds.length; i++) {
        const track = m.tracks.find(t => t.id === op.trackIds[i]);
        if (track) track.position = i;
      }
      break;
    }

    case 'update_video_settings': {
      m.videoSettings = { ...m.videoSettings, ...op.updates } as any;
      break;
    }

    case 'update_transform': {
      const item = m.items.find((i: any) => i.id === op.itemId);
      if (item) {
        (item as any).transform = { ...((item as any).transform || {}), ...op.transform };
      }
      break;
    }
  }

  // Recompute duration
  m.durationMs = m.items.length > 0
    ? Math.max(...m.items.map(i => i.endMs))
    : 0;

  return m;
}
