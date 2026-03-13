import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { notifyManifestUpdated } from '../ws-notify.js';

const MANIFEST_PATH = join('/workspace', 'manifest.json');

// Simple mutex to prevent concurrent read-modify-write races
let writeLock: Promise<void> = Promise.resolve();

async function readManifest(): Promise<any> {
  const raw = await readFile(MANIFEST_PATH, 'utf-8');
  return JSON.parse(raw);
}

/** Raw manifest read — used by HTTP GET /manifest endpoint (NOT the agent tool). */
export async function readManifestRaw(): Promise<string> {
  return readFile(MANIFEST_PATH, 'utf-8');
}

async function writeManifest(manifest: any): Promise<void> {
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  // Notify frontend of manifest change (best-effort)
  notifyManifestUpdated().catch(() => {});
}

/** Run a read-modify-write operation with mutex to prevent concurrent overwrites. */
async function withManifestLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeLock;
  let resolve: () => void;
  writeLock = new Promise<void>((r) => { resolve = r; });
  await prev;
  try {
    return await fn();
  } finally {
    resolve!();
  }
}

// ---- Tool definitions ----

export const readManifestTool = {
  name: 'readManifest',
  description:
    'Read the manifest. No args → summary (tracks with item counts, duration, canvas, asset keys, total items). ' +
    'Pass trackId to get items on that track. Pass timeRange [start, end] to get items overlapping that range. ' +
    'Both can be combined.',
  input_schema: {
    type: 'object' as const,
    properties: {
      trackId: {
        type: 'string',
        description: 'Filter items to this track ID',
      },
      timeRange: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description: 'Filter items overlapping [startMs, endMs]',
      },
    },
    required: [] as string[],
  },
  async execute(input: { trackId?: string; timeRange?: [number, number] }): Promise<string> {
    try {
      const manifest = await readManifest();
      const hasFilter = input.trackId || input.timeRange;

      if (!hasFilter) {
        // Summary mode
        const trackSummaries = (manifest.tracks ?? []).map((t: any) => {
          const count = (manifest.items ?? []).filter((i: any) => i.trackId === t.id).length;
          return { id: t.id, type: t.type, name: t.name, position: t.position, itemCount: count };
        });
        return JSON.stringify({
          durationMs: manifest.durationMs,
          canvas: manifest.canvas,
          tracks: trackSummaries,
          totalItems: (manifest.items ?? []).length,
          assetKeys: Object.keys(manifest.assets ?? {}),
        });
      }

      // Filtered mode
      let items: any[] = manifest.items ?? [];
      if (input.trackId) {
        items = items.filter((i: any) => i.trackId === input.trackId);
      }
      if (input.timeRange) {
        const [start, end] = input.timeRange;
        items = items.filter((i: any) => i.startMs < end && i.endMs > start);
      }
      return JSON.stringify(items);
    } catch (err: any) {
      return `Failed to read manifest: ${err.message}`;
    }
  },
};

export const readItemTool = {
  name: 'readItem',
  description: 'Read a single item by its ID.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string', description: 'The item ID to read' },
    },
    required: ['itemId'],
  },
  async execute(input: { itemId: string }): Promise<string> {
    try {
      const manifest = await readManifest();
      const item = (manifest.items ?? []).find((i: any) => i.id === input.itemId);
      if (!item) return `Item not found: ${input.itemId}`;
      return JSON.stringify(item);
    } catch (err: any) {
      return `Failed to read item: ${err.message}`;
    }
  },
};

export const addTrackTool = {
  name: 'addTrack',
  description: 'Add a new track. Auto-generates an ID and assigns the next position.',
  input_schema: {
    type: 'object' as const,
    properties: {
      type: {
        type: 'string',
        enum: ['video', 'audio', 'overlay', 'caption'],
        description: 'Track type',
      },
      name: { type: 'string', description: 'Track display name' },
    },
    required: ['type', 'name'],
  },
  async execute(input: { type: string; name: string }): Promise<string> {
    return withManifestLock(async () => {
      try {
        const manifest = await readManifest();
        const tracks: any[] = manifest.tracks ?? [];
        const maxPos = tracks.reduce((max: number, t: any) => Math.max(max, t.position ?? 0), -1);
        const track = {
          id: `track-${randomUUID().slice(0, 8)}`,
          type: input.type,
          name: input.name,
          position: maxPos + 1,
        };
        tracks.push(track);
        manifest.tracks = tracks;
        await writeManifest(manifest);
        return JSON.stringify(track);
      } catch (err: any) {
        return `Failed to add track: ${err.message}`;
      }
    });
  },
};

export const updateTrackTool = {
  name: 'updateTrack',
  description: 'Update an existing track\'s name or position.',
  input_schema: {
    type: 'object' as const,
    properties: {
      trackId: { type: 'string', description: 'Track ID to update' },
      name: { type: 'string', description: 'New track name' },
      position: { type: 'number', description: 'New track position' },
    },
    required: ['trackId'],
  },
  async execute(input: { trackId: string; name?: string; position?: number }): Promise<string> {
    return withManifestLock(async () => {
      try {
        const manifest = await readManifest();
        const tracks: any[] = manifest.tracks ?? [];
        const track = tracks.find((t: any) => t.id === input.trackId);
        if (!track) return `Track not found: ${input.trackId}`;
        if (input.name !== undefined) track.name = input.name;
        if (input.position !== undefined) track.position = input.position;
        await writeManifest(manifest);
        return JSON.stringify(track);
      } catch (err: any) {
        return `Failed to update track: ${err.message}`;
      }
    });
  },
};

export const removeTrackTool = {
  name: 'removeTrack',
  description: 'Remove a track and all items on it.',
  input_schema: {
    type: 'object' as const,
    properties: {
      trackId: { type: 'string', description: 'Track ID to remove' },
    },
    required: ['trackId'],
  },
  async execute(input: { trackId: string }): Promise<string> {
    return withManifestLock(async () => {
      try {
        const manifest = await readManifest();
        const trackIdx = (manifest.tracks ?? []).findIndex((t: any) => t.id === input.trackId);
        if (trackIdx === -1) return `Track not found: ${input.trackId}`;
        manifest.tracks.splice(trackIdx, 1);
        const removedCount = (manifest.items ?? []).filter((i: any) => i.trackId === input.trackId).length;
        manifest.items = (manifest.items ?? []).filter((i: any) => i.trackId !== input.trackId);
        await writeManifest(manifest);
        return `Removed track ${input.trackId} and ${removedCount} item(s).`;
      } catch (err: any) {
        return `Failed to remove track: ${err.message}`;
      }
    });
  },
};

export const addItemTool = {
  name: 'addItem',
  description: 'Add a new item to a track. Auto-generates an ID. Optional transform.',
  input_schema: {
    type: 'object' as const,
    properties: {
      type: {
        type: 'string',
        enum: ['video', 'audio', 'text', 'image', 'scene', 'caption', 'shape'],
        description: 'Item type',
      },
      trackId: { type: 'string', description: 'Track ID to place the item on' },
      startMs: { type: 'number', description: 'Start time in milliseconds' },
      endMs: { type: 'number', description: 'End time in milliseconds' },
      id: { type: 'string', description: 'Optional item ID (if not provided, auto-generates one)' },
      data: { type: 'object', description: 'Type-specific data (src, text, etc.)' },
      transform: {
        type: 'object',
        description: 'Optional spatial transform (x, y, width, height, rotation, opacity)',
      },
      keyframes: {
        type: 'array',
        items: { type: 'object' },
        description: 'Optional keyframes array',
      },
      filters: {
        type: 'object',
        description: 'Optional filters (brightness, contrast, saturation, blur, hue, grayscale, sepia)',
      },
    },
    required: ['type', 'trackId', 'startMs', 'endMs', 'data'],
  },
  async execute(input: {
    id?: string;
    type: string;
    trackId: string;
    startMs: number;
    endMs: number;
    data: object;
    transform?: object;
    keyframes?: any[];
    filters?: object;
  }): Promise<string> {
    return withManifestLock(async () => {
      try {
        const manifest = await readManifest();
        const item: any = {
          id: input.id ?? `item-${randomUUID().slice(0, 8)}`,
          type: input.type,
          trackId: input.trackId,
          startMs: input.startMs,
          endMs: input.endMs,
          data: input.data,
          keyframes: input.keyframes ?? [],
        };
        if (input.transform) item.transform = input.transform;
        if (input.filters) item.filters = input.filters;
        manifest.items = manifest.items ?? [];
        manifest.items.push(item);
        await writeManifest(manifest);
        return JSON.stringify(item);
      } catch (err: any) {
        return `Failed to add item: ${err.message}`;
      }
    });
  },
};

export const updateItemTool = {
  name: 'updateItem',
  description:
    'Update an existing item. Deep-merges nested objects (data, transform, filters). ' +
    'Replaces keyframes array if provided. Top-level scalars (startMs, endMs, trackId) set directly.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string', description: 'Item ID to update' },
      startMs: { type: 'number', description: 'New start time' },
      endMs: { type: 'number', description: 'New end time' },
      trackId: { type: 'string', description: 'Move to a different track' },
      data: { type: 'object', description: 'Partial data to deep-merge' },
      transform: { type: 'object', description: 'Partial transform to deep-merge' },
      filters: { type: 'object', description: 'Partial filters to deep-merge' },
      keyframes: {
        type: 'array',
        items: { type: 'object' },
        description: 'Replace keyframes array entirely',
      },
    },
    required: ['itemId'],
  },
  async execute(input: {
    itemId: string;
    startMs?: number;
    endMs?: number;
    trackId?: string;
    data?: object;
    transform?: object;
    filters?: object;
    keyframes?: any[];
  }): Promise<string> {
    return withManifestLock(async () => {
      try {
        const manifest = await readManifest();
        const items: any[] = manifest.items ?? [];
        const item = items.find((i: any) => i.id === input.itemId);
        if (!item) return `Item not found: ${input.itemId}`;

        // Top-level scalars
        if (input.startMs !== undefined) item.startMs = input.startMs;
        if (input.endMs !== undefined) item.endMs = input.endMs;
        if (input.trackId !== undefined) item.trackId = input.trackId;

        // Deep-merge nested objects
        if (input.data) item.data = { ...item.data, ...input.data };
        if (input.transform) item.transform = { ...(item.transform ?? {}), ...input.transform };
        if (input.filters) item.filters = { ...(item.filters ?? {}), ...input.filters };

        // Replace keyframes array
        if (input.keyframes !== undefined) item.keyframes = input.keyframes;

        await writeManifest(manifest);
        return JSON.stringify(item);
      } catch (err: any) {
        return `Failed to update item: ${err.message}`;
      }
    });
  },
};

export const removeItemTool = {
  name: 'removeItem',
  description: 'Remove an item by ID.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string', description: 'Item ID to remove' },
    },
    required: ['itemId'],
  },
  async execute(input: { itemId: string }): Promise<string> {
    return withManifestLock(async () => {
      try {
        const manifest = await readManifest();
        const items: any[] = manifest.items ?? [];
        const idx = items.findIndex((i: any) => i.id === input.itemId);
        if (idx === -1) return `Item not found: ${input.itemId}`;
        items.splice(idx, 1);
        await writeManifest(manifest);
        return `Removed item ${input.itemId}.`;
      } catch (err: any) {
        return `Failed to remove item: ${err.message}`;
      }
    });
  },
};

export const splitVideoTool = {
  name: 'splitVideo',
  description:
    'Split a video item at a given time. The original item ends at atMs; a new item starts at atMs. ' +
    'Keyframes are adjusted accordingly. Returns both item IDs.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string', description: 'Video item ID to split' },
      atMs: { type: 'number', description: 'Time (in timeline ms) to split at' },
    },
    required: ['itemId', 'atMs'],
  },
  async execute(input: { itemId: string; atMs: number }): Promise<string> {
    return withManifestLock(async () => {
      try {
        const manifest = await readManifest();
        const items: any[] = manifest.items ?? [];
        const item = items.find((i: any) => i.id === input.itemId);
        if (!item) return `Item not found: ${input.itemId}`;
        if (item.type !== 'video') return `Item ${input.itemId} is not a video (type: ${item.type})`;
        if (input.atMs <= item.startMs || input.atMs >= item.endMs) {
          return `atMs (${input.atMs}) must be between startMs (${item.startMs}) and endMs (${item.endMs})`;
        }

        const splitOffset = input.atMs - item.startMs;
        const newId = `item-${randomUUID().slice(0, 8)}`;

        // Build the new (right) item
        const newItem: any = {
          id: newId,
          type: 'video',
          trackId: item.trackId,
          startMs: input.atMs,
          endMs: item.endMs,
          data: {
            ...item.data,
            startFrom: (item.data.startFrom ?? 0) + splitOffset,
          },
          keyframes: (item.keyframes ?? [])
            .filter((kf: any) => kf.timeMs >= splitOffset)
            .map((kf: any) => ({ ...kf, timeMs: kf.timeMs - splitOffset })),
        };
        if (item.transform) newItem.transform = { ...item.transform };
        if (item.filters) newItem.filters = { ...item.filters };
        if (item.data.crop) newItem.data.crop = { ...item.data.crop };

        // Trim the original (left) item
        item.endMs = input.atMs;
        item.keyframes = (item.keyframes ?? []).filter((kf: any) => kf.timeMs < splitOffset);

        items.push(newItem);
        await writeManifest(manifest);
        return JSON.stringify({ originalId: item.id, newId });
      } catch (err: any) {
        return `Failed to split video: ${err.message}`;
      }
    });
  },
};

export const updateManifestTool = {
  name: 'updateManifest',
  description: 'Replace the entire manifest and trigger a preview rebuild. Use sparingly — prefer granular tools.',
  input_schema: {
    type: 'object' as const,
    properties: {
      manifest: {
        type: 'object',
        description: 'The complete updated manifest object',
      },
    },
    required: ['manifest'],
  },
  async execute(input: { manifest: object }): Promise<string> {
    try {
      await writeFile(MANIFEST_PATH, JSON.stringify(input.manifest, null, 2));
      // Trigger rebuild so preview picks up manifest changes
      const { triggerRebuild } = await import('../esbuild-watcher.js');
      triggerRebuild();
      return 'Manifest updated and rebuild triggered.';
    } catch (err: any) {
      return `Failed to update manifest: ${err.message}`;
    }
  },
};

/** All manifest tools for registration with the agent. */
export const allManifestTools = [
  readManifestTool,
  readItemTool,
  addTrackTool,
  updateTrackTool,
  removeTrackTool,
  addItemTool,
  updateItemTool,
  removeItemTool,
  splitVideoTool,
  updateManifestTool,
];
