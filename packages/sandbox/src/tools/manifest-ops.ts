import { readFile, writeFile, rename } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { notifyManifestUpdated } from '../ws-notify.js';
import { syncTranscript, syncCaptions } from './transcript-sync.js';

// ---- Inline item data schemas (mirrors @viona/shared/manifest-v2) ----
// Defined here to avoid runtime dependency on @viona/shared inside Docker container.

const captionWordSchema = z.object({
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  classification: z.enum(['power', 'medium', 'filler']).optional(),
  styleOverrides: z.record(z.string(), z.unknown()).optional(),
});

const itemDataSchemas: Record<string, z.ZodTypeAny> = {
  video: z.object({
    src: z.string(),
    startFrom: z.number().min(0).default(0),
    volume: z.number().min(0).max(2).default(1),
    playbackRate: z.number().min(0.25).max(4).default(1),
    fadeInMs: z.number().min(0).optional(),
    fadeOutMs: z.number().min(0).optional(),
    crop: z.object({
      x: z.number().min(0).max(100).default(50),
      y: z.number().min(0).max(100).default(50),
      scale: z.number().min(0.5).max(3).default(1),
    }).optional(),
  }),
  audio: z.object({
    src: z.string(),
    startFrom: z.number().min(0).default(0),
    volume: z.number().min(0).max(2).default(1),
    playbackRate: z.number().min(0.25).max(4).default(1),
    fadeInMs: z.number().min(0).optional(),
    fadeOutMs: z.number().min(0).optional(),
  }),
  text: z.object({
    text: z.string(),
    fontFamily: z.string().default('Inter'),
    fontSize: z.number().min(1).default(48),
    fontWeight: z.number().min(100).max(900).default(600),
    color: z.string().default('#FFFFFF'),
    backgroundColor: z.string().optional(),
    borderRadius: z.number().optional(),
    padding: z.number().optional(),
    textAlign: z.enum(['left', 'center', 'right']).default('center'),
    lineHeight: z.number().optional(),
    letterSpacing: z.number().optional(),
    textTransform: z.enum(['none', 'uppercase', 'lowercase']).default('none'),
  }),
  image: z.object({ src: z.string() }),
  scene: z.object({
    sceneFile: z.string(),
    displayMode: z.enum(['fullscreen', 'split-screen', 'overlay']).optional(),
    sceneName: z.string().optional(),
    sceneType: z.string().optional(),
  }),
  caption: z.object({ words: z.array(captionWordSchema) }),
  shape: z.object({
    shape: z.enum(['rectangle', 'circle', 'line']),
    fill: z.string().default('#FFFFFF'),
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
    borderRadius: z.number().optional(),
    // Layout Editor uses shape items as mockup placeholders with scene metadata
    sceneFile: z.string().optional(),
    displayMode: z.enum(['fullscreen', 'split-screen', 'overlay']).optional(),
  }),
};

// ---- Normalization helpers ----

/**
 * Normalize keyframes from flat {timeMs, y, height, opacity, ...} to
 * canonical {timeMs, props: {y, height, opacity, ...}, easing?} format.
 * Agents often write flat keyframes; this prevents Zod validation errors on the frontend.
 */
function normalizeKeyframes(keyframes: any[]): any[] {
  if (!keyframes || keyframes.length === 0) return keyframes;
  return keyframes.map(kf => {
    if (kf.props && typeof kf.props === 'object') return kf; // already canonical
    const { timeMs, easing, props, ...rest } = kf;
    // If there are extra fields beyond timeMs/easing, they're flat transform props
    if (Object.keys(rest).length > 0) {
      return { timeMs, props: rest, ...(easing ? { easing } : {}) };
    }
    return kf;
  });
}

/**
 * Ensure sceneFile has .tsx extension. Agents write "Scene1" but the
 * scene-registry keys use "Scene1.tsx", so lookups fail without this.
 */
function normalizeSceneFile(data: any, type: string): void {
  if ((type === 'scene' || type === 'shape') && typeof data?.sceneFile === 'string') {
    if (data.sceneFile && !data.sceneFile.endsWith('.tsx')) {
      data.sceneFile += '.tsx';
    }
  }
}

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
  // Atomic write: write to temp file then rename, so concurrent reads
  // never see a truncated manifest.json
  const tmpPath = `${MANIFEST_PATH}.${randomUUID()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(manifest, null, 2));
  await rename(tmpPath, MANIFEST_PATH);
  // Notify frontend of manifest change (best-effort)
  notifyManifestUpdated().catch(() => {});
}

/** Run a read-modify-write operation with mutex to prevent concurrent overwrites. */
export async function withManifestLock<T>(fn: () => Promise<T>): Promise<T> {
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
  name: 'read_manifest',
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
          captionPreset: manifest.captionPreset ?? manifest.captionStyle ?? null,
          videoSettings: manifest.videoSettings ?? null,
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
  name: 'read_item',
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
  name: 'add_track',
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
          id: randomUUID(),
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
  name: 'update_track',
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
  name: 'remove_track',
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
        if (trackIdx === -1) {
          // Idempotent: track already gone — treat as success
          return JSON.stringify({ removed: input.trackId, removedItems: 0, alreadyGone: true });
        }
        manifest.tracks.splice(trackIdx, 1);
        const removedCount = (manifest.items ?? []).filter((i: any) => i.trackId === input.trackId).length;
        manifest.items = (manifest.items ?? []).filter((i: any) => i.trackId !== input.trackId);
        await writeManifest(manifest);
        return JSON.stringify({ removed: input.trackId, removedItems: removedCount });
      } catch (err: any) {
        return `Failed to remove track: ${err.message}`;
      }
    });
  },
};

export const addItemTool = {
  name: 'add_item',
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
      style: {
        type: 'object',
        description: 'Optional CSS-like styling (border, borderRadius, boxShadow, background, overflow, etc.)',
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
    style?: object;
  }): Promise<string> {
    return withManifestLock(async () => {
      try {
        // Validate data against type-specific schema
        const schema = itemDataSchemas[input.type];
        if (schema) {
          const result = schema.safeParse(input.data);
          if (!result.success) {
            const issues = result.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ');
            return `Invalid data for ${input.type} item: ${issues}`;
          }
          input.data = result.data as object; // use parsed data (with defaults applied)
        }

        // Normalize sceneFile extension
        normalizeSceneFile(input.data, input.type);

        const manifest = await readManifest();
        const item: any = {
          id: input.id ?? randomUUID(),
          type: input.type,
          trackId: input.trackId,
          startMs: input.startMs,
          endMs: input.endMs,
          data: input.data,
          keyframes: normalizeKeyframes(input.keyframes ?? []),
        };
        if (input.transform) item.transform = input.transform;
        if (input.filters) item.filters = input.filters;
        if (input.style) item.style = input.style;
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
  name: 'update_item',
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
      style: { type: 'object', description: 'Partial style to deep-merge (border, borderRadius, boxShadow, etc.)' },
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
    style?: object;
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
        if (input.data) {
          item.data = { ...item.data, ...input.data };
          normalizeSceneFile(item.data, item.type);
        }
        if (input.transform) item.transform = { ...(item.transform ?? {}), ...input.transform };
        if (input.filters) item.filters = { ...(item.filters ?? {}), ...input.filters };
        if (input.style) item.style = { ...(item.style ?? {}), ...input.style };

        // Replace keyframes array (normalize flat → canonical format)
        if (input.keyframes !== undefined) item.keyframes = normalizeKeyframes(input.keyframes);

        await writeManifest(manifest);
        // Auto-sync transcript after update (timing changes shift the timeline)
        if (input.startMs !== undefined || input.endMs !== undefined || input.data) {
          syncTranscript().then(() => syncCaptions()).catch(() => {});
        }
        return JSON.stringify(item);
      } catch (err: any) {
        return `Failed to update item: ${err.message}`;
      }
    });
  },
};

export const removeItemTool = {
  name: 'remove_item',
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
        if (idx === -1) {
          // Idempotent: item already gone — treat as success
          return JSON.stringify({ removed: input.itemId, alreadyGone: true });
        }
        items.splice(idx, 1);
        await writeManifest(manifest);
        // Auto-sync transcript and captions after remove
        syncTranscript().then(() => syncCaptions()).catch(() => {});
        return JSON.stringify({ removed: input.itemId });
      } catch (err: any) {
        return `Failed to remove item: ${err.message}`;
      }
    });
  },
};

export const splitItemTool = {
  name: 'split_item',
  description:
    'Split a video or audio item at a given time. The original item ends at atMs; a new item starts at atMs. ' +
    'Adjusts startFrom for media items and redistributes keyframes. Returns both item IDs.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string', description: 'Item ID to split (must be video or audio)' },
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
        const SPLITTABLE = new Set(['video', 'audio']);
        if (!SPLITTABLE.has(item.type)) {
          return `Item ${input.itemId} is not splittable (type: ${item.type}). Only video and audio items can be split.`;
        }
        if (input.atMs <= item.startMs || input.atMs >= item.endMs) {
          return `atMs (${input.atMs}) must be between startMs (${item.startMs}) and endMs (${item.endMs})`;
        }

        const splitOffset = input.atMs - item.startMs;
        const newId = randomUUID();

        // Normalize existing keyframes before redistributing
        const existingKeyframes = normalizeKeyframes(item.keyframes ?? []);

        // Build the new (right) item
        const newItem: any = {
          id: newId,
          type: item.type,
          trackId: item.trackId,
          startMs: input.atMs,
          endMs: item.endMs,
          data: {
            ...item.data,
            startFrom: (item.data.startFrom ?? 0) + splitOffset,
          },
          keyframes: existingKeyframes
            .filter((kf: any) => kf.timeMs >= splitOffset)
            .map((kf: any) => ({ ...kf, timeMs: kf.timeMs - splitOffset })),
        };
        if (item.transform) newItem.transform = { ...item.transform };
        if (item.filters) newItem.filters = { ...item.filters };
        if (item.style) newItem.style = { ...item.style };
        if (item.data.crop) newItem.data.crop = { ...item.data.crop };

        // Trim the original (left) item
        item.endMs = input.atMs;
        item.keyframes = existingKeyframes.filter((kf: any) => kf.timeMs < splitOffset);

        items.push(newItem);
        await writeManifest(manifest);
        // Auto-sync transcript and captions after split
        syncTranscript().then(() => syncCaptions()).catch(() => {});
        return JSON.stringify({ originalId: item.id, newId });
      } catch (err: any) {
        return `Failed to split item: ${err.message}`;
      }
    });
  },
};

export const updateCaptionPresetTool = {
  name: 'update_caption_preset',
  description:
    'Update the global caption preset. Deep-merges with existing preset. ' +
    'Fields: displayMode (word-by-word|phrase|karaoke), wordsPerPhrase, ' +
    'fontFamily, fontSize, fontWeight, color, activeColor, backgroundColor, activeBackgroundColor, ' +
    'backgroundPadding ({x,y}), backgroundRadius, letterSpacing, textTransform (none|uppercase|lowercase), ' +
    'opacity, lineHeight, stroke ({width,color}), presetId, ' +
    'animation ({in,active,out,easing}), position ({anchor,offsetX,offsetY,textAlign,rotation}), ' +
    'effects ({shadow,shadowSecondary,glow}).',
  input_schema: {
    type: 'object' as const,
    properties: {
      updates: {
        type: 'object',
        description: 'Partial caption preset fields to merge',
      },
    },
    required: ['updates'],
  },
  async execute(input: { updates: Record<string, unknown> }): Promise<string> {
    return withManifestLock(async () => {
      try {
        const manifest = await readManifest();
        // Migrate: if captionPreset is undefined but captionStyle exists, migrate it
        if (manifest.captionPreset === undefined && manifest.captionStyle !== undefined) {
          manifest.captionPreset = manifest.captionStyle;
          delete manifest.captionStyle;
        }
        const existing = manifest.captionPreset ?? {};
        // Deep-merge nested objects (animation, position, effects)
        for (const [key, value] of Object.entries(input.updates)) {
          if (value && typeof value === 'object' && !Array.isArray(value) && existing[key] && typeof existing[key] === 'object') {
            existing[key] = { ...existing[key], ...value };
          } else {
            existing[key] = value;
          }
        }
        manifest.captionPreset = existing;
        await writeManifest(manifest);
        return JSON.stringify(manifest.captionPreset);
      } catch (err: any) {
        return `Failed to update caption preset: ${err.message}`;
      }
    });
  },
};

export const updateManifestTool = {
  name: 'update_manifest',
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
    return withManifestLock(async () => {
      try {
        await writeFile(MANIFEST_PATH, JSON.stringify(input.manifest, null, 2));
        await notifyManifestUpdated();
        const { triggerRebuild } = await import('../esbuild-watcher.js');
        triggerRebuild();
        return 'Manifest updated and rebuild triggered.';
      } catch (err: any) {
        return `Failed to update manifest: ${err.message}`;
      }
    });
  },
};

/** All manifest tools for registration with the agent.
 *  NOTE: update_manifest is intentionally excluded — it replaces the entire
 *  manifest in one call and has caused full data loss (Issue #9). The agent
 *  must use granular tools (add_item, update_item, etc.) instead.
 *  update_manifest is still available for the HTTP PATCH /manifest endpoint. */
export const generateCaptionsTool = {
  name: 'generate_captions',
  description:
    'Generate caption items from the transcript. Syncs transcript timing with current manifest edits, ' +
    'creates a caption track if none exists, and builds phrase-grouped caption items. ' +
    'Optionally accepts a captionPreset to apply (deep-merged with existing). ' +
    'Call this after transcription is done or when the user wants captions added/regenerated.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wordsPerPhrase: {
        type: 'number',
        description: 'Words per caption phrase (default: uses existing captionPreset.wordsPerPhrase or 5)',
      },
      captionPreset: {
        type: 'object',
        description: 'Optional caption preset to apply (deep-merged with existing). ' +
          'Fields: displayMode, fontFamily, fontSize, fontWeight, color, activeColor, ' +
          'backgroundColor, activeBackgroundColor, stroke, animation, position, effects, etc.',
      },
    },
    required: [],
  },
  async execute(input: { wordsPerPhrase?: number; captionPreset?: Record<string, unknown> }): Promise<string> {
    return withManifestLock(async () => {
      try {
        // 1. Sync transcript timing with current manifest edits
        await syncTranscript();

        // 2. Ensure caption track exists
        const manifest = await readManifest();
        let captionTrack = (manifest.tracks ?? []).find((t: any) => t.type === 'caption');
        if (!captionTrack) {
          const maxPos = Math.max(0, ...(manifest.tracks ?? []).map((t: any) => t.position ?? 0));
          captionTrack = {
            id: `track-caption-${randomUUID().slice(0, 8)}`,
            type: 'caption',
            name: 'Captions',
            position: maxPos + 1,
          };
          manifest.tracks = [...(manifest.tracks ?? []), captionTrack];
        }

        // Migrate: read captionPreset with fallback to captionStyle
        const currentPreset = manifest.captionPreset ?? manifest.captionStyle ?? {};

        // 3. Apply wordsPerPhrase override
        if (input.wordsPerPhrase) {
          currentPreset.wordsPerPhrase = input.wordsPerPhrase;
        }

        // 4. Apply caption preset if provided (deep-merge)
        if (input.captionPreset) {
          for (const [key, value] of Object.entries(input.captionPreset)) {
            if (value && typeof value === 'object' && !Array.isArray(value) && currentPreset[key] && typeof currentPreset[key] === 'object') {
              currentPreset[key] = { ...currentPreset[key], ...value };
            } else {
              currentPreset[key] = value;
            }
          }
        }

        // Write to captionPreset; clean up legacy captionStyle if it existed
        manifest.captionPreset = currentPreset;
        if (manifest.captionStyle !== undefined) {
          delete manifest.captionStyle;
        }

        // Write manifest with track + preset changes before syncCaptions reads it
        await writeManifest(manifest);

        // 5. Generate caption items from synced transcript
        await syncCaptions();

        // Re-read to get final state with captions
        const final = await readManifest();
        const captionCount = (final.items ?? []).filter((i: any) => i.type === 'caption').length;
        return JSON.stringify({ ok: true, captionCount, trackId: captionTrack.id });
      } catch (err: any) {
        return `Failed to generate captions: ${err.message}`;
      }
    });
  },
};

export const rippleDeleteTool = {
  name: 'ripple_delete',
  description:
    'Remove an item and shift all later items on the SAME track backward to close the gap. ' +
    'Optionally leave a gap (gapMs, default 150ms). Also shifts items on paired tracks — ' +
    'e.g., if you ripple-delete a video item, matching audio items after that point shift too. ' +
    'Use this instead of remove_item when trimming fillers to keep the timeline tight.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string', description: 'Item ID to remove' },
      gapMs: {
        type: 'number',
        description: 'Gap to leave at the cut point (default 150ms). Set to 0 for no gap.',
      },
    },
    required: ['itemId'],
  },
  async execute(input: { itemId: string; gapMs?: number }): Promise<string> {
    return withManifestLock(async () => {
      try {
        const manifest = await readManifest();
        const items: any[] = manifest.items ?? [];
        const item = items.find((i: any) => i.id === input.itemId);
        if (!item) {
          return JSON.stringify({ removed: input.itemId, alreadyGone: true });
        }

        const gapMs = input.gapMs ?? 150;
        const removedDuration = item.endMs - item.startMs;
        const shiftMs = Math.max(0, removedDuration - gapMs);
        const cutPointMs = item.startMs;

        // Determine which tracks to ripple. Video and audio tracks are paired —
        // if you ripple on a video track, also ripple audio tracks and vice versa.
        const tracks: any[] = manifest.tracks ?? [];
        const sourceTrack = tracks.find((t: any) => t.id === item.trackId);
        const MEDIA_TYPES = new Set(['video', 'audio']);
        const isMediaTrack = sourceTrack && MEDIA_TYPES.has(sourceTrack.type);

        const tracksToRipple = new Set<string>();
        tracksToRipple.add(item.trackId);
        if (isMediaTrack) {
          // Also ripple all other media tracks (audio ↔ video pairing)
          for (const t of tracks) {
            if (MEDIA_TYPES.has(t.type)) {
              tracksToRipple.add(t.id);
            }
          }
        }

        // Remove the item
        const idx = items.indexOf(item);
        items.splice(idx, 1);

        // Shift all items on rippled tracks that start AFTER the cut point
        let shifted = 0;
        for (const i of items) {
          if (tracksToRipple.has(i.trackId) && i.startMs >= cutPointMs) {
            i.startMs = Math.max(0, i.startMs - shiftMs);
            i.endMs = Math.max(i.startMs + 1, i.endMs - shiftMs);
            shifted++;
          }
        }

        await writeManifest(manifest);
        // Auto-sync transcript and captions
        syncTranscript().then(() => syncCaptions()).catch(() => {});
        return JSON.stringify({
          removed: input.itemId,
          shiftMs,
          gapMs,
          itemsShifted: shifted,
        });
      } catch (err: any) {
        return `Failed to ripple delete: ${err.message}`;
      }
    });
  },
};

export const allManifestTools = [
  readManifestTool,
  readItemTool,
  addTrackTool,
  updateTrackTool,
  removeTrackTool,
  addItemTool,
  updateItemTool,
  removeItemTool,
  splitItemTool,
  rippleDeleteTool,
  updateCaptionPresetTool,
  generateCaptionsTool,
];
