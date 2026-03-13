# Performant Preview Architecture — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the proxy-based preview with a data-driven Remotion renderer that reads a rich manifest v2, loads media via presigned S3 URLs, and gives AI full creative control via manifest tools + scene files.

**Architecture:** A generic `PlayerComposition.tsx` renders items from a manifest JSON (tracks, items, transforms, keyframes, filters). Media loads directly from S3 via presigned URLs in an `assets` map. AI edits the manifest via structured tools (never raw JSON) and can write scene `.tsx` files for custom visuals. The esbuild watcher generates a scene registry, syncs assets to MinIO, and bundles everything into one CJS file.

**Tech Stack:** Remotion 4, Zod, esbuild (CJS), MinIO SDK, Express, React, Fastify, WebSockets

**Spec:** `docs/superpowers/specs/2026-03-13-performant-preview-architecture-design.md`

---

## Chunk 1: Manifest v2 Schema + Migration

### Task 1: Manifest v2 Zod Schema

**Files:**
- Create: `packages/shared/src/manifest-v2.ts`
- Modify: `packages/shared/src/index.ts`

This task defines the v2 manifest schema with transforms, keyframes, filters, assets map, and new item types. The v1 schema in `manifest.ts` is kept intact — both coexist.

- [ ] **Step 1: Create the v2 schema file**

Create `packages/shared/src/manifest-v2.ts` with all Zod schemas:

```typescript
import { z } from 'zod';
import { captionWordSchema, manifestCaptionStyleSchema } from './manifest.js';

// ---- Transform & Keyframes ----

export const transformSchema = z.object({
  x: z.union([z.number(), z.string()]).default(0),
  y: z.union([z.number(), z.string()]).default(0),
  width: z.union([z.number(), z.string()]).default('100%'),
  height: z.union([z.number(), z.string()]).default('100%'),
  rotation: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
});

export const keyframeSchema = z.object({
  timeMs: z.number().min(0),
  props: transformSchema.partial(),
  easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']).default('linear'),
});

export const filtersSchema = z.object({
  brightness: z.number().min(0).max(2).default(1),
  contrast: z.number().min(0).max(2).default(1),
  saturation: z.number().min(0).max(2).default(1),
  blur: z.number().min(0).default(0),
  hue: z.number().default(0),
  grayscale: z.number().min(0).max(1).default(0),
  sepia: z.number().min(0).max(1).default(0),
}).partial();

// ---- Track ----

export const trackTypeV2 = z.enum(['video', 'audio', 'overlay', 'caption']);

export const manifestTrackV2Schema = z.object({
  id: z.string(),
  type: trackTypeV2,
  name: z.string(),
  position: z.number().int(),
});

// ---- Item type data schemas ----

export const videoItemDataV2Schema = z.object({
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
});

export const audioItemDataV2Schema = z.object({
  src: z.string(),
  volume: z.number().min(0).max(2).default(1),
  playbackRate: z.number().min(0.25).max(4).default(1),
  fadeInMs: z.number().min(0).optional(),
  fadeOutMs: z.number().min(0).optional(),
});

export const textItemDataV2Schema = z.object({
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
});

export const imageItemDataV2Schema = z.object({
  src: z.string(),
});

export const sceneItemDataV2Schema = z.object({
  sceneFile: z.string(),
});

export const shapeItemDataV2Schema = z.object({
  shape: z.enum(['rectangle', 'circle', 'line']),
  fill: z.string().default('#FFFFFF'),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  borderRadius: z.number().optional(),
});

export const captionItemDataV2Schema = z.object({
  words: z.array(captionWordSchema),
});

// ---- Item (discriminated by type) ----

export const itemTypeV2 = z.enum(['video', 'audio', 'text', 'image', 'scene', 'caption', 'shape']);

const itemBaseV2 = {
  id: z.string(),
  trackId: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  transform: transformSchema.optional(),
  keyframes: z.array(keyframeSchema).default([]),
  filters: filtersSchema.optional(),
};

export const manifestItemV2Schema = z.discriminatedUnion('type', [
  z.object({ ...itemBaseV2, type: z.literal('video'), data: videoItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('audio'), data: audioItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('text'), data: textItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('image'), data: imageItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('scene'), data: sceneItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('caption'), data: captionItemDataV2Schema }),
  z.object({ ...itemBaseV2, type: z.literal('shape'), data: shapeItemDataV2Schema }),
]);

// ---- Video Settings v2 (simplified — crop moved to per-item) ----

export const videoSettingsV2Schema = z.object({
  sourceWidth: z.number().default(1920),
  sourceHeight: z.number().default(1080),
});

// ---- Top-level Manifest v2 ----

export const manifestV2Schema = z.object({
  version: z.literal(2),
  fps: z.number().int().min(1).max(120).default(30),
  durationMs: z.number().min(0),
  canvas: z.object({
    width: z.number().int().min(1),
    height: z.number().int().min(1),
  }),
  tracks: z.array(manifestTrackV2Schema),
  items: z.array(manifestItemV2Schema),
  assets: z.record(z.string(), z.string()).default({}),
  captionStyle: manifestCaptionStyleSchema.default(() => ({
    displayMode: 'phrase' as const,
    wordsPerPhrase: 5,
    fontFamily: 'Inter',
    fontSize: 56,
    fontWeight: 800,
    color: '#FFFFFF',
    activeColor: '#FFD700',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    animation: { in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' },
    position: { anchor: 'bottom' as const, offsetX: 0, offsetY: 0, textAlign: 'center' as const, rotation: 0 },
  })),
  videoSettings: videoSettingsV2Schema.default(() => ({
    sourceWidth: 1920,
    sourceHeight: 1080,
  })),
});

// ---- TypeScript types ----

export type ManifestV2 = z.infer<typeof manifestV2Schema>;
export type ManifestTrackV2 = z.infer<typeof manifestTrackV2Schema>;
export type ManifestItemV2 = z.infer<typeof manifestItemV2Schema>;
export type TransformV2 = z.infer<typeof transformSchema>;
export type KeyframeV2 = z.infer<typeof keyframeSchema>;
export type FiltersV2 = z.infer<typeof filtersSchema>;
export type ManifestTrackTypeV2 = z.infer<typeof trackTypeV2>;
export type ManifestItemTypeV2 = z.infer<typeof itemTypeV2>;

// Per-item data types
export type VideoItemDataV2 = z.infer<typeof videoItemDataV2Schema>;
export type AudioItemDataV2 = z.infer<typeof audioItemDataV2Schema>;
export type TextItemDataV2 = z.infer<typeof textItemDataV2Schema>;
export type ImageItemDataV2 = z.infer<typeof imageItemDataV2Schema>;
export type SceneItemDataV2 = z.infer<typeof sceneItemDataV2Schema>;
export type ShapeItemDataV2 = z.infer<typeof shapeItemDataV2Schema>;
export type CaptionItemDataV2 = z.infer<typeof captionItemDataV2Schema>;

// ---- Validation helpers ----

export function validateManifestV2(data: unknown): ManifestV2 {
  return manifestV2Schema.parse(data);
}

export function safeValidateManifestV2(data: unknown) {
  return manifestV2Schema.safeParse(data);
}
```

- [ ] **Step 2: Export from shared index**

In `packages/shared/src/index.ts`, add:

```typescript
export * from './manifest-v2';
```

- [ ] **Step 3: Verify it compiles**

Run: `cd packages/shared && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/manifest-v2.ts packages/shared/src/index.ts
git commit -m "feat: add manifest v2 Zod schema with transforms, keyframes, filters, assets map"
```

---

### Task 2: v1 → v2 Migration Function

**Files:**
- Create: `packages/shared/src/manifest-migrate.ts`
- Modify: `packages/shared/src/index.ts`

Converts any v1 manifest to v2 format. Handles all v1 fields documented in the spec's migration section.

- [ ] **Step 1: Create the migration function**

Create `packages/shared/src/manifest-migrate.ts`:

```typescript
import type { Manifest } from './manifest.js';
import type { ManifestV2, ManifestItemV2, ManifestTrackV2 } from './manifest-v2.js';
import { manifestV2Schema } from './manifest-v2.js';

/**
 * Migrate a v1 manifest to v2 format.
 * Handles: layout → transforms, visual → scene, broll → video,
 * text/image position → transform, videoSettings crop → per-item crop.
 */
export function migrateManifestV1toV2(v1: Manifest): ManifestV2 {
  const tracks: ManifestTrackV2[] = v1.tracks.map(t => ({
    id: t.id,
    name: t.name,
    position: t.position,
    type: migrateTrackType(t.type),
  }));

  // Determine PiP video items (second video track in pip mode)
  const layout = v1.layout || { mode: 'stacked' };
  const videoTrackIds = v1.tracks.filter(t => t.type === 'video').map(t => t.id);
  const pipTrackId = layout.mode === 'pip' && videoTrackIds.length > 1 ? videoTrackIds[1] : null;

  const items: ManifestItemV2[] = v1.items.map(item => {
    const migrated = migrateItem(item, v1);
    // Override PiP video items with computed transform from pip settings
    if (pipTrackId && item.trackId === pipTrackId && item.type === 'video') {
      const pip = (layout as any).pip || {};
      const sizePct = pip.size || 25;
      const offsetX = pip.offsetX || 0;
      const offsetY = pip.offsetY || 0;
      const pos = pip.position || 'bottom-right';
      let x: string, y: string;
      if (pos.includes('right')) x = `${100 - sizePct - offsetX}%`; else x = `${offsetX}%`;
      if (pos.includes('bottom')) y = `${100 - sizePct - offsetY}%`; else y = `${offsetY}%`;
      migrated.transform = { x, y, width: `${sizePct}%`, height: `${sizePct}%`, rotation: pip.rotation || 0, opacity: pip.opacity ?? 1 };
      // Migrate pip.crop to video item crop
      if (pip.crop && migrated.type === 'video') {
        (migrated.data as any).crop = { x: pip.crop.cropX ?? 50, y: pip.crop.cropY ?? 50, scale: pip.crop.zoom ?? 1 };
      }
    }
    return migrated;
  });

  const raw = {
    version: 2 as const,
    fps: v1.fps,
    durationMs: v1.durationMs,
    canvas: v1.canvas,
    tracks,
    items,
    assets: {},
    captionStyle: v1.captionStyle,
    videoSettings: {
      sourceWidth: v1.videoSettings.sourceWidth,
      sourceHeight: v1.videoSettings.sourceHeight,
    },
  };

  return manifestV2Schema.parse(raw);
}

function migrateTrackType(type: string): ManifestTrackV2['type'] {
  switch (type) {
    case 'visual': return 'overlay';
    case 'broll': return 'video';
    case 'text': return 'overlay';
    case 'image': return 'overlay';
    case 'video': return 'video';
    case 'audio': return 'audio';
    case 'caption': return 'caption';
    default: return 'overlay';
  }
}

function migrateItem(item: any, v1: Manifest): ManifestItemV2 {
  switch (item.type) {
    case 'video':
      return migrateVideoItem(item, v1);
    case 'audio':
      return migrateAudioItem(item);
    case 'visual':
      return migrateVisualItem(item);
    case 'broll':
      return migrateBrollItem(item);
    case 'caption':
      return migrateCaptionItem(item);
    case 'text':
      return migrateTextItem(item);
    case 'image':
      return migrateImageItem(item);
    default:
      // Unknown type — treat as scene with fullscreen transform
      return {
        id: item.id,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        type: 'scene',
        data: { sceneFile: item.data?.sceneFile || 'scenes/Unknown.tsx' },
        transform: { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 },
        keyframes: [],
      };
  }
}

function migrateVideoItem(item: any, v1: Manifest): ManifestItemV2 {
  const data = item.data || {};
  const layout = v1.layout || { mode: 'stacked' };
  let transform = { x: 0, y: 0, width: '100%' as string | number, height: '100%' as string | number, rotation: 0, opacity: 1 };

  // Apply layout-based transform
  if (layout.mode === 'pip') {
    // Default: fullscreen. The caller (migrateManifestV1toV2) marks pip items
    // and overrides their transform — see isPipItem logic below.
    transform = { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 };
  } else if (layout.mode === 'stacked') {
    const split = layout.split || { position: 'visuals-first', ratio: 50, gap: 0 };
    const ratio = split.ratio || 50;
    // Video gets the non-visual portion
    if (split.position === 'visuals-first') {
      transform = { x: 0, y: `${ratio}%`, width: '100%', height: `${100 - ratio}%`, rotation: 0, opacity: 1 };
    } else {
      transform = { x: 0, y: 0, width: '100%', height: `${100 - ratio}%`, rotation: 0, opacity: 1 };
    }
  }

  // Migrate crop from v1 videoSettings global or per-item
  const crop = data.crop ? {
    x: data.crop.x ?? v1.videoSettings.cropX ?? 50,
    y: data.crop.y ?? v1.videoSettings.cropY ?? 50,
    scale: data.crop.scale ?? v1.videoSettings.scale ?? 1,
  } : {
    x: v1.videoSettings.cropX ?? 50,
    y: v1.videoSettings.cropY ?? 50,
    scale: v1.videoSettings.scale ?? 1,
  };

  return {
    id: item.id,
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    type: 'video',
    data: {
      src: data.src || 'source.mp4',
      startFrom: 0,
      volume: data.volume ?? 1,
      playbackRate: data.playbackRate ?? 1,
      crop,
    },
    transform,
    keyframes: [],
  };
}

function migrateAudioItem(item: any): ManifestItemV2 {
  const data = item.data || {};
  return {
    id: item.id,
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    type: 'audio',
    data: {
      src: data.enhancedSrc || data.src || 'source.mp4', // Prefer enhanced audio
      volume: data.volume ?? 1,
      playbackRate: 1,
    },
    keyframes: [],
    // No transform for audio
  };
}

function migrateVisualItem(item: any): ManifestItemV2 {
  const data = item.data || {};
  let transform = { x: 0, y: 0, width: '100%' as string | number, height: '100%' as string | number, rotation: 0, opacity: 1 };

  if (data.displayMode === 'fullscreen') {
    transform = { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 };
  } else if (data.displayMode === 'overlay') {
    switch (data.overlayZone) {
      case 'lower-third':
        transform = { x: 0, y: '70%', width: '100%', height: '30%', rotation: 0, opacity: 1 };
        break;
      case 'top':
        transform = { x: 0, y: 0, width: '100%', height: '30%', rotation: 0, opacity: 1 };
        break;
      case 'frame':
      case 'behind':
      case 'background':
        transform = { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 };
        break;
      default:
        transform = { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 };
    }
  }

  return {
    id: item.id,
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    type: 'scene',
    data: {
      sceneFile: data.sceneFile || 'scenes/Scene1.tsx',
    },
    transform,
    keyframes: [],
  };
}

function migrateBrollItem(item: any): ManifestItemV2 {
  const data = item.data || {};
  return {
    id: item.id,
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    type: 'video',
    data: {
      src: data.src || data.previewUrl || data.filename || 'broll.mp4',
      startFrom: 0,
      volume: data.volume ?? 1,
      playbackRate: 1,
    },
    transform: { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 },
    keyframes: [],
  };
}

function migrateCaptionItem(item: any): ManifestItemV2 {
  const data = item.data || {};
  return {
    id: item.id,
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    type: 'caption',
    data: {
      words: (data.words || []).map((w: any) => ({
        text: w.text,
        startMs: w.startMs,
        endMs: w.endMs,
        classification: w.classification,
        styleOverrides: w.styleOverrides,
      })),
    },
    transform: { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 },
    keyframes: [],
  };
}

function migrateTextItem(item: any): ManifestItemV2 {
  const data = item.data || {};
  const style = (data.style || {}) as Record<string, any>;
  const pos = data.position || { x: 0, y: 0 };
  const size = data.size || { width: '100%', height: '100%' };

  return {
    id: item.id,
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    type: 'text',
    data: {
      text: data.text || '',
      fontFamily: style.fontFamily || 'Inter',
      fontSize: style.fontSize || 48,
      fontWeight: style.fontWeight || 600,
      color: style.color || '#FFFFFF',
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      padding: style.padding,
      textAlign: style.textAlign || 'center',
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform || 'none',
    },
    transform: {
      x: pos.x || 0,
      y: pos.y || 0,
      width: size.width || '100%',
      height: size.height || '100%',
      rotation: 0,
      opacity: 1,
    },
    keyframes: [],
  };
}

function migrateImageItem(item: any): ManifestItemV2 {
  const data = item.data || {};
  return {
    id: item.id,
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
    type: 'image',
    data: {
      src: data.src || '',
    },
    transform: {
      x: data.position?.x || 0,
      y: data.position?.y || 0,
      width: data.width || '100%',
      height: data.height || '100%',
      rotation: 0,
      opacity: data.opacity ?? 1,
    },
    keyframes: [],
  };
}
```

- [ ] **Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './manifest-migrate';
```

- [ ] **Step 3: Verify it compiles**

Run: `cd packages/shared && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/manifest-migrate.ts packages/shared/src/index.ts
git commit -m "feat: add v1→v2 manifest migration function"
```

---

### Task 3: Test Manifest v2 Schema + Migration

**Files:**
- Create: `scripts/temp/test-manifest-v2.ts`

- [ ] **Step 1: Write the test script**

Create `scripts/temp/test-manifest-v2.ts`:

```typescript
import { validateManifestV2, migrateManifestV1toV2, validateManifest } from '@viona/shared';

// --- Test 1: v2 schema validates a valid manifest ---
console.log('Test 1: v2 schema validates a valid manifest');
const validV2 = {
  version: 2,
  fps: 30,
  durationMs: 60000,
  canvas: { width: 1080, height: 1920 },
  tracks: [
    { id: 't1', type: 'video', name: 'Main Video', position: 0 },
    { id: 't2', type: 'audio', name: 'Audio', position: 1 },
    { id: 't3', type: 'overlay', name: 'Overlays', position: 2 },
  ],
  items: [
    {
      id: 'i1', type: 'video', trackId: 't1', startMs: 0, endMs: 60000,
      data: { src: 'source.mp4', startFrom: 0, volume: 1, playbackRate: 1 },
      transform: { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 },
    },
    {
      id: 'i2', type: 'audio', trackId: 't2', startMs: 0, endMs: 60000,
      data: { src: 'source.mp4', volume: 1, playbackRate: 1 },
      // No transform for audio
    },
    {
      id: 'i3', type: 'text', trackId: 't3', startMs: 5000, endMs: 10000,
      data: { text: 'Hello World', fontFamily: 'Inter', fontSize: 48, fontWeight: 600, color: '#FFF' },
      transform: { x: '10%', y: '10%', width: '80%', height: '20%', rotation: 0, opacity: 1 },
      keyframes: [
        { timeMs: 0, props: { opacity: 0 }, easing: 'ease-in' },
        { timeMs: 500, props: { opacity: 1 }, easing: 'ease-out' },
      ],
      filters: { blur: 0 },
    },
  ],
  assets: { 'source.mp4': 'https://example.com/presigned' },
};

const result = validateManifestV2(validV2);
console.assert(result.version === 2, 'Version should be 2');
console.assert(result.items.length === 3, 'Should have 3 items');
console.assert(result.assets['source.mp4'] === 'https://example.com/presigned', 'Assets map preserved');
console.log('  PASS\n');

// --- Test 2: v1 → v2 migration ---
console.log('Test 2: v1 → v2 migration');
const v1 = validateManifest({
  version: 1,
  fps: 30,
  durationMs: 30000,
  canvas: { width: 1080, height: 1920 },
  tracks: [
    { id: 't1', type: 'video', name: 'Video', position: 0 },
    { id: 't2', type: 'audio', name: 'Audio', position: 1 },
    { id: 't3', type: 'visual', name: 'Visuals', position: 2 },
    { id: 't4', type: 'caption', name: 'Captions', position: 3 },
  ],
  items: [
    { id: 'v1', type: 'video', trackId: 't1', startMs: 0, endMs: 30000,
      data: { src: 'source.mp4', crop: { x: 50, y: 50, scale: 1 }, volume: 1, playbackRate: 1 } },
    { id: 'a1', type: 'audio', trackId: 't2', startMs: 0, endMs: 30000,
      data: { src: 'source.mp4', volume: 0.8, enhancedSrc: null } },
    { id: 's1', type: 'visual', trackId: 't3', startMs: 5000, endMs: 15000,
      data: { sceneFile: 'scenes/Scene1.tsx', displayMode: 'overlay', overlayZone: 'lower-third', frameOffset: 0 } },
    { id: 'c1', type: 'caption', trackId: 't4', startMs: 0, endMs: 30000,
      data: { words: [{ text: 'Hello', startMs: 0, endMs: 500 }] } },
  ],
  layout: { mode: 'stacked', split: { position: 'visuals-first', ratio: 50, gap: 0 },
    pip: { position: 'bottom-right', size: 25, shape: 'circle', borderRadius: 9999,
      borderWidth: 2, borderColor: '#FFF', shadowEnabled: true, shadowColor: '#000',
      shadowBlur: 10, opacity: 1, rotation: 0, offsetX: 0, offsetY: 0,
      crop: { cropX: 50, cropY: 50, zoom: 1 } } },
  videoSettings: { cropX: 50, cropY: 50, scale: 1, sourceWidth: 1920, sourceHeight: 1080 },
});

const v2 = migrateManifestV1toV2(v1);
console.assert(v2.version === 2, 'Migrated version should be 2');
console.assert(v2.tracks.find(t => t.id === 't3')?.type === 'overlay', 'Visual track → overlay');
console.assert(v2.items.find(i => i.id === 's1')?.type === 'scene', 'Visual item → scene');
console.assert(v2.items.find(i => i.id === 'a1')?.transform === undefined, 'Audio has no transform');
console.assert(v2.items.find(i => i.id === 's1')?.transform?.y === '70%', 'Lower-third → y: 70%');
console.log('  PASS\n');

// --- Test 3: audio item has no transform ---
console.log('Test 3: audio item has no transform');
const audioItem = v2.items.find(i => i.type === 'audio');
console.assert(!audioItem?.transform, 'Audio item should have no transform');
console.log('  PASS\n');

// --- Test 4: discriminated union narrows correctly ---
console.log('Test 4: discriminated union type narrowing');
const videoItem = v2.items.find(i => i.type === 'video');
if (videoItem && videoItem.type === 'video') {
  console.assert(typeof videoItem.data.src === 'string', 'VideoItemData.src is string');
  console.assert(typeof videoItem.data.startFrom === 'number', 'VideoItemData.startFrom is number');
}
console.log('  PASS\n');

console.log('All tests passed!');
```

- [ ] **Step 2: Run the test**

Run: `cd packages/shared && pnpm tsx ../../scripts/temp/test-manifest-v2.ts`
Expected: "All tests passed!"

- [ ] **Step 3: Commit**

```bash
git add scripts/temp/test-manifest-v2.ts
git commit -m "test: add manifest v2 schema and migration tests"
```

---

### Task 4: Update dbToManifest for v2

**Files:**
- Modify: `packages/shared/src/manifest-convert.ts`

Update `dbToManifest()` to produce v2 manifests directly. The v1 format is no longer generated — we produce v2 from DB and migrate any stored v1 manifests.

- [ ] **Step 1: Update dbToManifest to produce v2**

Modify `packages/shared/src/manifest-convert.ts`:

1. Change imports to include v2 types
2. Update `dbToManifest()` to return `ManifestV2` with transforms, no layout
3. Update `manifestToDb()` to accept `ManifestV2`

Key changes:
- Remove `layout` construction from `dbToManifest` — v2 has no global layout
- Add `transform` to video items based on stacked/pip settings from DB
- Map `visual` → `scene`, `broll` → `video` in item conversion
- Add `assets: {}` (empty — sandbox fills this in)
- Remove `enhancedSrc` from audio items
- Add `startFrom: 0` to video items
- Change videoSettings to only have `sourceWidth`/`sourceHeight`
- Update `manifestToDb()` to convert v2 items back to DB format (scene → visual, etc.)

The full implementation should follow the migration logic from Task 2 but applied directly to DB data rather than converting an intermediate v1 object.

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/shared && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/manifest-convert.ts
git commit -m "feat: update dbToManifest to produce v2 manifests"
```

---

## Chunk 2: Generic PlayerComposition Renderer

### Task 5: TransformWrapper Component

**Files:**
- Create: `packages/sandbox/template/src/composition/TransformWrapper.tsx`

This component applies position, size, rotation, opacity, keyframe interpolation, and CSS filters to any child item.

- [ ] **Step 1: Create TransformWrapper**

Create `packages/sandbox/template/src/composition/TransformWrapper.tsx`:

```tsx
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

interface Transform {
  x: number | string;
  y: number | string;
  width: number | string;
  height: number | string;
  rotation: number;
  opacity: number;
}

interface Keyframe {
  timeMs: number;
  props: Partial<Transform>;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
}

interface Filters {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  hue?: number;
  grayscale?: number;
  sepia?: number;
}

interface TransformWrapperProps {
  transform: Transform;
  keyframes?: Keyframe[];
  filters?: Filters;
  fps: number;
  children: React.ReactNode;
}

const EASING_MAP: Record<string, (t: number) => number> = {
  'linear': (t) => t,
  'ease-in': Easing.in(Easing.ease),
  'ease-out': Easing.out(Easing.ease),
  'ease-in-out': Easing.inOut(Easing.ease),
  'spring': Easing.out(Easing.ease), // Remotion spring() needs different API; approximate here
};

function resolveValue(
  prop: keyof Transform,
  base: Transform,
  keyframes: Keyframe[],
  currentTimeMs: number,
): number | string {
  const baseVal = base[prop];

  // Find keyframes that affect this property
  const relevantKfs = keyframes
    .filter(kf => kf.props[prop] !== undefined)
    .sort((a, b) => a.timeMs - b.timeMs);

  if (relevantKfs.length === 0) return baseVal;

  // Before first keyframe — use base
  if (currentTimeMs <= relevantKfs[0].timeMs) {
    return interpolateValue(baseVal, relevantKfs[0].props[prop]!,
      relevantKfs[0].timeMs === 0 ? 1 : currentTimeMs / relevantKfs[0].timeMs,
      relevantKfs[0].easing || 'linear');
  }

  // After last keyframe — use last value
  if (currentTimeMs >= relevantKfs[relevantKfs.length - 1].timeMs) {
    return relevantKfs[relevantKfs.length - 1].props[prop]!;
  }

  // Between keyframes
  for (let i = 0; i < relevantKfs.length - 1; i++) {
    const from = relevantKfs[i];
    const to = relevantKfs[i + 1];
    if (currentTimeMs >= from.timeMs && currentTimeMs <= to.timeMs) {
      const progress = (currentTimeMs - from.timeMs) / (to.timeMs - from.timeMs);
      return interpolateValue(from.props[prop]!, to.props[prop]!, progress, to.easing || 'linear');
    }
  }

  return baseVal;
}

function interpolateValue(
  from: number | string,
  to: number | string,
  progress: number,
  easing: string,
): number | string {
  // Can only interpolate between two numbers
  if (typeof from === 'number' && typeof to === 'number') {
    const easingFn = EASING_MAP[easing] || EASING_MAP['linear'];
    const easedProgress = easingFn(Math.max(0, Math.min(1, progress)));
    return from + (to - from) * easedProgress;
  }
  // For string values (percentages), snap at midpoint
  return progress >= 0.5 ? to : from;
}

function buildFilterString(filters: Filters): string {
  const parts: string[] = [];
  if (filters.brightness !== undefined && filters.brightness !== 1) parts.push(`brightness(${filters.brightness})`);
  if (filters.contrast !== undefined && filters.contrast !== 1) parts.push(`contrast(${filters.contrast})`);
  if (filters.saturation !== undefined && filters.saturation !== 1) parts.push(`saturate(${filters.saturation})`);
  if (filters.blur !== undefined && filters.blur > 0) parts.push(`blur(${filters.blur}px)`);
  if (filters.hue !== undefined && filters.hue !== 0) parts.push(`hue-rotate(${filters.hue}deg)`);
  if (filters.grayscale !== undefined && filters.grayscale > 0) parts.push(`grayscale(${filters.grayscale})`);
  if (filters.sepia !== undefined && filters.sepia > 0) parts.push(`sepia(${filters.sepia})`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

function toCss(val: number | string): string {
  if (typeof val === 'string') return val;
  return `${val}px`;
}

export const TransformWrapper: React.FC<TransformWrapperProps> = ({
  transform,
  keyframes = [],
  filters,
  fps,
  children,
}) => {
  const frame = useCurrentFrame();
  const currentTimeMs = (frame / fps) * 1000;

  const x = resolveValue('x', transform, keyframes, currentTimeMs);
  const y = resolveValue('y', transform, keyframes, currentTimeMs);
  const width = resolveValue('width', transform, keyframes, currentTimeMs);
  const height = resolveValue('height', transform, keyframes, currentTimeMs);
  const rotation = resolveValue('rotation', transform, keyframes, currentTimeMs) as number;
  const opacity = resolveValue('opacity', transform, keyframes, currentTimeMs) as number;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: toCss(x),
    top: toCss(y),
    width: toCss(width),
    height: toCss(height),
    transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
    opacity,
    overflow: 'hidden',
  };

  if (filters) {
    const filterStr = buildFilterString(filters);
    if (filterStr !== 'none') style.filter = filterStr;
  }

  return <div style={style}>{children}</div>;
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/sandbox && pnpm tsc --noEmit` (or check that the template tsx is valid)

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/src/composition/TransformWrapper.tsx
git commit -m "feat: add TransformWrapper component for keyframe animation + filters"
```

---

### Task 6: Item Renderer Components

**Files:**
- Create: `packages/sandbox/template/src/items/VideoItem.tsx`
- Create: `packages/sandbox/template/src/items/AudioItem.tsx`
- Create: `packages/sandbox/template/src/items/TextItem.tsx`
- Create: `packages/sandbox/template/src/items/ImageItem.tsx`
- Create: `packages/sandbox/template/src/items/SceneItem.tsx`
- Create: `packages/sandbox/template/src/items/ShapeItem.tsx`
- Create: `packages/sandbox/template/src/items/CaptionItem.tsx`
- Create: `packages/sandbox/template/src/items/index.tsx`

Each renderer is a small React component that renders one item type.

- [ ] **Step 1: Create the items directory and all renderers**

`VideoItem.tsx`:
```tsx
import React from 'react';
import { Video, OffthreadVideo, staticFile } from 'remotion';

interface VideoItemProps {
  data: {
    src: string;
    startFrom: number;
    volume: number;
    playbackRate: number;
    fadeInMs?: number;
    fadeOutMs?: number;
    crop?: { x: number; y: number; scale: number };
  };
  assets: Record<string, string>;
  fps: number;
  durationInFrames: number;
}

export const VideoItem: React.FC<VideoItemProps> = ({ data, assets, fps }) => {
  const src = assets[data.src] || staticFile(data.src);
  const startFromFrame = Math.round((data.startFrom / 1000) * fps);
  const crop = data.crop;

  const videoStyle: React.CSSProperties = crop ? {
    position: 'absolute',
    left: `${50 - crop.x}%`,
    top: `${50 - crop.y}%`,
    width: `${100 * crop.scale}%`,
    height: `${100 * crop.scale}%`,
    objectFit: 'cover',
  } : {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <Video
        src={src}
        startFrom={startFromFrame}
        volume={data.volume}
        playbackRate={data.playbackRate}
        style={videoStyle}
      />
    </div>
  );
};
```

`AudioItem.tsx`:
```tsx
import React from 'react';
import { Audio, staticFile } from 'remotion';

interface AudioItemProps {
  data: {
    src: string;
    volume: number;
    playbackRate: number;
  };
  assets: Record<string, string>;
  fps: number;
}

export const AudioItem: React.FC<AudioItemProps> = ({ data, assets }) => {
  const src = assets[data.src] || staticFile(data.src);
  return <Audio src={src} volume={data.volume} playbackRate={data.playbackRate} />;
};
```

`TextItem.tsx`:
```tsx
import React from 'react';

interface TextItemProps {
  data: {
    text: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    backgroundColor?: string;
    borderRadius?: number;
    padding?: number;
    textAlign?: 'left' | 'center' | 'right';
    lineHeight?: number;
    letterSpacing?: number;
    textTransform?: 'none' | 'uppercase' | 'lowercase';
  };
}

export const TextItem: React.FC<TextItemProps> = ({ data }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: data.textAlign === 'left' ? 'flex-start' : data.textAlign === 'right' ? 'flex-end' : 'center',
        fontFamily: data.fontFamily,
        fontSize: data.fontSize,
        fontWeight: data.fontWeight,
        color: data.color,
        backgroundColor: data.backgroundColor,
        borderRadius: data.borderRadius,
        padding: data.padding,
        textAlign: data.textAlign || 'center',
        lineHeight: data.lineHeight,
        letterSpacing: data.letterSpacing,
        textTransform: data.textTransform,
      }}
    >
      {data.text}
    </div>
  );
};
```

`ImageItem.tsx`:
```tsx
import React from 'react';
import { Img, staticFile } from 'remotion';

interface ImageItemProps {
  data: { src: string };
  assets: Record<string, string>;
}

export const ImageItem: React.FC<ImageItemProps> = ({ data, assets }) => {
  const src = assets[data.src] || staticFile(data.src);
  return <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
};
```

`SceneItem.tsx`:
```tsx
import React from 'react';

interface SceneItemProps {
  data: { sceneFile: string };
  width: number;
  height: number;
  durationInFrames: number;
  fps: number;
  sceneRegistry: Record<string, React.ComponentType<any>>;
}

export const SceneItem: React.FC<SceneItemProps> = ({
  data,
  width,
  height,
  durationInFrames,
  fps,
  sceneRegistry,
}) => {
  const SceneComponent = sceneRegistry[data.sceneFile];

  if (!SceneComponent) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 14 }}>
        Scene not found: {data.sceneFile}
      </div>
    );
  }

  // Wrap in error boundary-like try/catch via React.createElement
  return <SceneComponent width={width} height={height} durationInFrames={durationInFrames} fps={fps} />;
};
```

`ShapeItem.tsx`:
```tsx
import React from 'react';

interface ShapeItemProps {
  data: {
    shape: 'rectangle' | 'circle' | 'line';
    fill: string;
    stroke?: string;
    strokeWidth?: number;
    borderRadius?: number;
  };
}

export const ShapeItem: React.FC<ShapeItemProps> = ({ data }) => {
  if (data.shape === 'circle') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: data.fill,
          border: data.stroke ? `${data.strokeWidth || 1}px solid ${data.stroke}` : undefined,
        }}
      />
    );
  }

  if (data.shape === 'line') {
    return (
      <div
        style={{
          width: '100%',
          height: data.strokeWidth || 2,
          backgroundColor: data.stroke || data.fill,
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
    );
  }

  // rectangle
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: data.fill,
        borderRadius: data.borderRadius,
        border: data.stroke ? `${data.strokeWidth || 1}px solid ${data.stroke}` : undefined,
      }}
    />
  );
};
```

`CaptionItem.tsx`:
```tsx
import React from 'react';
import { useCurrentFrame } from 'remotion';

interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
  classification?: 'power' | 'medium' | 'filler';
  styleOverrides?: Record<string, unknown>;
}

interface CaptionItemProps {
  data: { words: CaptionWord[] };
  captionStyle: Record<string, any>;
  fps: number;
  itemStartMs: number;
}

export const CaptionItem: React.FC<CaptionItemProps> = ({
  data,
  captionStyle,
  fps,
  itemStartMs,
}) => {
  const frame = useCurrentFrame();
  // Caption word timestamps are absolute — convert frame to absolute time
  const currentTimeMs = itemStartMs + (frame / fps) * 1000;

  // Find active words based on current time
  const activeWords = data.words.filter(
    w => currentTimeMs >= w.startMs && currentTimeMs <= w.endMs,
  );

  if (activeWords.length === 0) return null;

  const text = activeWords.map(w => w.text).join(' ');

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: captionStyle?.position?.anchor === 'top' ? 'flex-start' :
                    captionStyle?.position?.anchor === 'center' ? 'center' : 'flex-end',
        justifyContent: 'center',
        padding: '5%',
      }}
    >
      <span
        style={{
          fontFamily: captionStyle?.fontFamily || 'Inter',
          fontSize: captionStyle?.fontSize || 56,
          fontWeight: captionStyle?.fontWeight || 800,
          color: captionStyle?.activeColor || captionStyle?.color || '#FFD700',
          textAlign: captionStyle?.position?.textAlign || 'center',
          backgroundColor: captionStyle?.activeBackgroundColor || 'transparent',
          padding: '4px 8px',
          borderRadius: captionStyle?.backgroundRadius || 4,
        }}
      >
        {text}
      </span>
    </div>
  );
};
```

`index.tsx` (barrel export):
```tsx
export { VideoItem } from './VideoItem';
export { AudioItem } from './AudioItem';
export { TextItem } from './TextItem';
export { ImageItem } from './ImageItem';
export { SceneItem } from './SceneItem';
export { ShapeItem } from './ShapeItem';
export { CaptionItem } from './CaptionItem';
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/template/src/items/
git commit -m "feat: add item renderer components (video, audio, text, image, scene, shape, caption)"
```

---

### Task 7: Generic PlayerComposition

**Files:**
- Create: `packages/sandbox/template/src/PlayerComposition.tsx` (replaces the old stub)
- Modify: `packages/sandbox/src/workspace-init.ts` (remove inline PlayerComposition generation)

The composition reads manifest from `inputProps`, iterates tracks (sorted by position = z-order), renders items in Sequences with TransformWrapper.

- [ ] **Step 1: Create the generic PlayerComposition**

Create `packages/sandbox/template/src/PlayerComposition.tsx`:

```tsx
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TransformWrapper } from './composition/TransformWrapper';
import { VideoItem, AudioItem, TextItem, ImageItem, SceneItem, ShapeItem, CaptionItem } from './items';
// Scene registry — auto-generated by esbuild watcher before each build.
// File is guaranteed to exist (workspace-init creates empty stub, generator updates before each build).
import { sceneRegistry } from './scene-registry';

interface ManifestItem {
  id: string;
  type: string;
  trackId: string;
  startMs: number;
  endMs: number;
  data: any;
  transform?: any;
  keyframes?: any[];
  filters?: any;
}

interface ManifestTrack {
  id: string;
  type: string;
  name: string;
  position: number;
}

interface Manifest {
  version: number;
  fps: number;
  durationMs: number;
  canvas: { width: number; height: number };
  tracks: ManifestTrack[];
  items: ManifestItem[];
  assets: Record<string, string>;
  captionStyle?: any;
}

interface PlayerCompositionProps {
  manifest: Manifest;
}

export const PlayerComposition: React.FC<PlayerCompositionProps> = ({ manifest }) => {
  const { fps, canvas, tracks, items, assets, captionStyle } = manifest;
  const sortedTracks = [...tracks].sort((a, b) => a.position - b.position);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {sortedTracks.map(track => {
        const trackItems = items.filter(item => item.trackId === track.id);
        if (trackItems.length === 0) return null;

        return (
          <AbsoluteFill key={track.id}>
            {trackItems.map(item => {
              const startFrame = Math.round((item.startMs / 1000) * fps);
              const durationInFrames = Math.max(1, Math.round(((item.endMs - item.startMs) / 1000) * fps));

              return (
                <Sequence
                  key={item.id}
                  from={startFrame}
                  durationInFrames={durationInFrames}
                  layout="none"
                >
                  {item.transform ? (
                    <TransformWrapper
                      transform={item.transform}
                      keyframes={item.keyframes}
                      filters={item.filters}
                      fps={fps}
                    >
                      <ItemRenderer
                        item={item}
                        assets={assets}
                        fps={fps}
                        durationInFrames={durationInFrames}
                        canvas={canvas}
                        captionStyle={captionStyle}
                      />
                    </TransformWrapper>
                  ) : (
                    <ItemRenderer
                      item={item}
                      assets={assets}
                      fps={fps}
                      durationInFrames={durationInFrames}
                      canvas={canvas}
                      captionStyle={captionStyle}
                    />
                  )}
                </Sequence>
              );
            })}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

interface ItemRendererProps {
  item: ManifestItem;
  assets: Record<string, string>;
  fps: number;
  durationInFrames: number;
  canvas: { width: number; height: number };
  captionStyle?: any;
}

const ItemRenderer: React.FC<ItemRendererProps> = ({
  item,
  assets,
  fps,
  durationInFrames,
  canvas,
  captionStyle,
}) => {
  switch (item.type) {
    case 'video':
      return <VideoItem data={item.data} assets={assets} fps={fps} durationInFrames={durationInFrames} />;
    case 'audio':
      return <AudioItem data={item.data} assets={assets} fps={fps} />;
    case 'text':
      return <TextItem data={item.data} />;
    case 'image':
      return <ImageItem data={item.data} assets={assets} />;
    case 'scene':
      return (
        <SceneItem
          data={item.data}
          width={canvas.width}
          height={canvas.height}
          durationInFrames={durationInFrames}
          fps={fps}
          sceneRegistry={sceneRegistry}
        />
      );
    case 'shape':
      return <ShapeItem data={item.data} />;
    case 'caption':
      return <CaptionItem data={item.data} captionStyle={captionStyle || {}} fps={fps} itemStartMs={item.startMs} />;
    default:
      return null;
  }
};
```

- [ ] **Step 2: Remove inline PlayerComposition generation from workspace-init.ts**

In `packages/sandbox/src/workspace-init.ts`, remove the `writeFile` block that generates `PlayerComposition.tsx` (lines ~130-146). The template copy (`cp(TEMPLATE, WORKSPACE)`) will now include the generic `PlayerComposition.tsx` from the template.

Also add `mkdir(join(WORKSPACE, 'src', 'scenes'), { recursive: true })` to ensure the scenes directory exists.

- [ ] **Step 3: Verify template compiles**

The template's `PlayerComposition.tsx` imports from `./composition/TransformWrapper` and `./items/` — verify these paths resolve within the template structure.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/template/src/PlayerComposition.tsx packages/sandbox/src/workspace-init.ts
git commit -m "feat: add generic PlayerComposition that renders manifest items with transforms"
```

---

## Chunk 3: Sandbox Runtime (Asset Sync, Scene Registry, Agent Tools)

### Task 8: Scene Registry Generator

**Files:**
- Create: `packages/sandbox/src/scene-registry-generator.ts`
- Modify: `packages/sandbox/src/esbuild-watcher.ts`

Auto-generates `/workspace/src/scene-registry.ts` with static imports for all scene files before each esbuild build.

- [ ] **Step 1: Create the generator**

Create `packages/sandbox/src/scene-registry-generator.ts`:

```typescript
import { readdir, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import pino from 'pino';

const logger = pino({ name: 'scene-registry' });

const SCENES_DIR = '/workspace/src/scenes';
const REGISTRY_FILE = '/workspace/src/scene-registry.ts';

/**
 * Scan /workspace/src/scenes/*.tsx and generate scene-registry.ts
 * with static imports for esbuild to bundle.
 */
export async function generateSceneRegistry(): Promise<void> {
  let sceneFiles: string[] = [];

  try {
    const entries = await readdir(SCENES_DIR);
    sceneFiles = entries.filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
  } catch {
    // No scenes dir yet — generate empty registry
  }

  const imports: string[] = [];
  const registryEntries: string[] = [];

  for (const file of sceneFiles) {
    const name = basename(file, file.endsWith('.tsx') ? '.tsx' : '.ts');
    // Use a safe variable name
    const varName = name.replace(/[^a-zA-Z0-9_]/g, '_');
    imports.push(`import ${varName} from './scenes/${name}';`);
    registryEntries.push(`  'scenes/${file}': ${varName},`);
  }

  const code = `// AUTO-GENERATED by scene-registry-generator — do not edit
import React from 'react';
${imports.join('\n')}

export const sceneRegistry: Record<string, React.ComponentType<any>> = {
${registryEntries.join('\n')}
};
`;

  await writeFile(REGISTRY_FILE, code);
  logger.info({ count: sceneFiles.length }, 'Scene registry generated');
}
```

- [ ] **Step 2: Integrate into esbuild watcher**

Modify `packages/sandbox/src/esbuild-watcher.ts`:

1. Import `generateSceneRegistry`:
   ```typescript
   import { generateSceneRegistry } from './scene-registry-generator.js';
   ```

2. In `doBuild()`, call it before the esbuild build:
   ```typescript
   async function doBuild(): Promise<void> {
     // ... existing entry point check ...
     building = true;
     const start = Date.now();
     try {
       // Generate scene registry before build
       await generateSceneRegistry();

       await build({ /* existing config */ });
       // ... rest unchanged
     }
   }
   ```

3. Update the chokidar watcher `ignored` to skip `scene-registry.ts`:
   ```typescript
   const watcher = watch(SRC_DIR, {
     ignoreInitial: true,
     ignored: [/node_modules/, /scene-registry\.ts$/],
     persistent: true,
     awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
   });
   ```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/scene-registry-generator.ts packages/sandbox/src/esbuild-watcher.ts
git commit -m "feat: auto-generate scene registry before esbuild builds"
```

---

### Task 9: Asset Sync (MinIO Upload + Presigned URLs)

**Files:**
- Create: `packages/sandbox/src/asset-sync.ts`
- Modify: `packages/sandbox/src/esbuild-watcher.ts`

Scans `/workspace/public/`, uploads new files to MinIO, generates presigned URLs, and writes the `assets` map into `manifest.json`.

- [ ] **Step 1: Create asset-sync module**

Create `packages/sandbox/src/asset-sync.ts`:

```typescript
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Client as MinioClient } from 'minio';
import pino from 'pino';

const logger = pino({ name: 'asset-sync' });

const WORKSPACE = '/workspace';
const PUBLIC_DIR = join(WORKSPACE, 'public');
const MANIFEST_PATH = join(WORKSPACE, 'manifest.json');
const PRESIGNED_TTL = 8 * 60 * 60; // 8 hours in seconds

// Track which files have been uploaded to avoid re-uploading
const uploadedFiles = new Set<string>();

let _minioClient: MinioClient | null = null;

function getMinioClient(): MinioClient {
  if (!_minioClient) {
    _minioClient = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || '',
      secretKey: process.env.MINIO_SECRET_KEY || '',
    });
  }
  return _minioClient;
}

/**
 * Sync /workspace/public/ files to MinIO and update manifest.json assets map.
 * Called before each esbuild build.
 */
export async function syncAssets(): Promise<void> {
  const bucket = process.env.MINIO_BUCKET || 'viona';
  const projectPrefix = process.env.SANDBOX_ID || 'unknown';

  let files: string[] = [];
  try {
    files = await readdir(PUBLIC_DIR);
  } catch {
    logger.debug('No public directory yet');
    return;
  }

  if (files.length === 0) return;

  let minio: MinioClient;
  try {
    minio = getMinioClient();
  } catch (err) {
    logger.error({ err }, 'Failed to create MinIO client');
    return;
  }

  const assets: Record<string, string> = {};

  for (const file of files) {
    const objectKey = `${projectPrefix}/${file}`;
    const filePath = join(PUBLIC_DIR, file);

    // Upload if not already uploaded
    if (!uploadedFiles.has(file)) {
      try {
        await minio.fPutObject(bucket, objectKey, filePath);
        uploadedFiles.add(file);
        logger.info({ file }, 'Uploaded to MinIO');
      } catch (err) {
        logger.warn({ err, file }, 'Failed to upload file, skipping');
        continue;
      }
    }

    // Generate presigned URL
    try {
      const url = await minio.presignedGetObject(bucket, objectKey, PRESIGNED_TTL);
      assets[file] = url;
    } catch (err) {
      logger.warn({ err, file }, 'Failed to generate presigned URL');
    }
  }

  // Update manifest.json assets map
  try {
    const manifestRaw = await readFile(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(manifestRaw);
    manifest.assets = assets;
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    logger.info({ assetCount: Object.keys(assets).length }, 'Assets map updated in manifest');
  } catch (err) {
    logger.error({ err }, 'Failed to update manifest assets map');
  }
}
```

- [ ] **Step 2: Integrate into esbuild watcher**

In `packages/sandbox/src/esbuild-watcher.ts`, add asset sync before the build:

```typescript
import { syncAssets } from './asset-sync.js';

// In doBuild():
async function doBuild(): Promise<void> {
  // ... entry point check ...
  building = true;
  try {
    await syncAssets();           // Step 1: sync assets
    await generateSceneRegistry(); // Step 2: generate scene registry
    await build({ /* ... */ });    // Step 3: build
    // ...
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/asset-sync.ts packages/sandbox/src/esbuild-watcher.ts
git commit -m "feat: add asset sync — upload public/ to MinIO, write presigned URLs to manifest"
```

---

### Task 10: Agent Manifest Tools

**Files:**
- Rewrite: `packages/sandbox/src/tools/manifest-ops.ts`

Replace the basic read/update tools with structured tools for filtered reads, track CRUD, item CRUD, and split_video.

- [ ] **Step 1: Rewrite manifest-ops.ts**

Replace `packages/sandbox/src/tools/manifest-ops.ts` with:

```typescript
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { notifyManifestUpdated } from './ws-notify.js';

const MANIFEST_PATH = join('/workspace', 'manifest.json');

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
  await notifyManifestUpdated(); // Notify frontend of manifest change
}

// ---- Read tools ----

export const readManifestTool = {
  name: 'read_manifest',
  description: 'Read manifest. Without filters: returns summary (tracks, item counts, duration). With trackId and/or timeRange: returns matching items.',
  input_schema: {
    type: 'object' as const,
    properties: {
      trackId: { type: 'string', description: 'Filter items by track ID' },
      timeRange: {
        type: 'array',
        items: { type: 'number' },
        description: '[startMs, endMs] — return items overlapping this range',
      },
    },
    required: [],
  },
  async execute(input?: { trackId?: string; timeRange?: [number, number] }): Promise<string> {
    try {
      const manifest = await readManifest();

      if (!input?.trackId && !input?.timeRange) {
        // Summary mode
        const trackSummary = manifest.tracks.map((t: any) => ({
          id: t.id,
          type: t.type,
          name: t.name,
          position: t.position,
          itemCount: manifest.items.filter((i: any) => i.trackId === t.id).length,
        }));
        return JSON.stringify({
          version: manifest.version,
          fps: manifest.fps,
          durationMs: manifest.durationMs,
          canvas: manifest.canvas,
          tracks: trackSummary,
          totalItems: manifest.items.length,
          assetKeys: Object.keys(manifest.assets || {}),
        }, null, 2);
      }

      // Filtered mode
      let items = manifest.items;
      if (input.trackId) {
        items = items.filter((i: any) => i.trackId === input.trackId);
      }
      if (input.timeRange) {
        const [start, end] = input.timeRange;
        items = items.filter((i: any) => i.startMs < end && i.endMs > start);
      }

      return JSON.stringify({ items }, null, 2);
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
};

export const readItemTool = {
  name: 'read_item',
  description: 'Read a single item by ID.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string', description: 'Item ID' },
    },
    required: ['itemId'],
  },
  async execute(input: { itemId: string }): Promise<string> {
    const manifest = await readManifest();
    const item = manifest.items.find((i: any) => i.id === input.itemId);
    if (!item) return `Error: Item ${input.itemId} not found`;
    return JSON.stringify(item, null, 2);
  },
};

// ---- Track tools ----

export const addTrackTool = {
  name: 'add_track',
  description: 'Add a new track.',
  input_schema: {
    type: 'object' as const,
    properties: {
      type: { type: 'string', enum: ['video', 'audio', 'overlay', 'caption'] },
      name: { type: 'string' },
    },
    required: ['type', 'name'],
  },
  async execute(input: { type: string; name: string }): Promise<string> {
    const manifest = await readManifest();
    const maxPos = Math.max(0, ...manifest.tracks.map((t: any) => t.position));
    const track = { id: randomUUID(), type: input.type, name: input.name, position: maxPos + 1 };
    manifest.tracks.push(track);
    await writeManifest(manifest);
    return JSON.stringify(track);
  },
};

export const updateTrackTool = {
  name: 'update_track',
  description: 'Update a track (name, position).',
  input_schema: {
    type: 'object' as const,
    properties: {
      trackId: { type: 'string' },
      changes: { type: 'object', description: '{ name?, position? }' },
    },
    required: ['trackId', 'changes'],
  },
  async execute(input: { trackId: string; changes: any }): Promise<string> {
    const manifest = await readManifest();
    const track = manifest.tracks.find((t: any) => t.id === input.trackId);
    if (!track) return `Error: Track ${input.trackId} not found`;
    if (input.changes.name !== undefined) track.name = input.changes.name;
    if (input.changes.position !== undefined) track.position = input.changes.position;
    await writeManifest(manifest);
    return `Track ${input.trackId} updated`;
  },
};

export const removeTrackTool = {
  name: 'remove_track',
  description: 'Remove a track and all its items.',
  input_schema: {
    type: 'object' as const,
    properties: {
      trackId: { type: 'string' },
    },
    required: ['trackId'],
  },
  async execute(input: { trackId: string }): Promise<string> {
    const manifest = await readManifest();
    const before = manifest.items.length;
    manifest.tracks = manifest.tracks.filter((t: any) => t.id !== input.trackId);
    manifest.items = manifest.items.filter((i: any) => i.trackId !== input.trackId);
    await writeManifest(manifest);
    return `Track removed, ${before - manifest.items.length} items deleted`;
  },
};

// ---- Item tools ----

export const addItemTool = {
  name: 'add_item',
  description: 'Add an item to a track.',
  input_schema: {
    type: 'object' as const,
    properties: {
      trackId: { type: 'string' },
      type: { type: 'string', enum: ['video', 'audio', 'text', 'image', 'scene', 'caption', 'shape'] },
      startMs: { type: 'number' },
      endMs: { type: 'number' },
      data: { type: 'object' },
      transform: { type: 'object', description: 'Optional. { x, y, width, height, rotation, opacity }' },
    },
    required: ['trackId', 'type', 'startMs', 'endMs', 'data'],
  },
  async execute(input: any): Promise<string> {
    const manifest = await readManifest();
    const item: any = {
      id: randomUUID(),
      type: input.type,
      trackId: input.trackId,
      startMs: input.startMs,
      endMs: input.endMs,
      data: input.data,
      keyframes: [],
    };
    if (input.transform) item.transform = input.transform;
    manifest.items.push(item);
    await writeManifest(manifest);
    return JSON.stringify({ id: item.id });
  },
};

export const updateItemTool = {
  name: 'update_item',
  description: 'Partially update an item. Deep-merges nested objects (data, transform, filters).',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string' },
      changes: { type: 'object', description: 'Partial item fields to update' },
    },
    required: ['itemId', 'changes'],
  },
  async execute(input: { itemId: string; changes: any }): Promise<string> {
    const manifest = await readManifest();
    const idx = manifest.items.findIndex((i: any) => i.id === input.itemId);
    if (idx === -1) return `Error: Item ${input.itemId} not found`;

    const item = manifest.items[idx];
    const changes = input.changes;

    // Deep merge for nested objects
    if (changes.data) item.data = { ...item.data, ...changes.data };
    if (changes.transform) item.transform = { ...item.transform, ...changes.transform };
    if (changes.filters) item.filters = { ...item.filters, ...changes.filters };
    if (changes.keyframes) item.keyframes = changes.keyframes; // Replace, don't merge

    // Top-level scalars
    if (changes.startMs !== undefined) item.startMs = changes.startMs;
    if (changes.endMs !== undefined) item.endMs = changes.endMs;
    if (changes.trackId !== undefined) item.trackId = changes.trackId;

    manifest.items[idx] = item;
    await writeManifest(manifest);
    return `Item ${input.itemId} updated`;
  },
};

export const removeItemTool = {
  name: 'remove_item',
  description: 'Remove an item by ID.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string' },
    },
    required: ['itemId'],
  },
  async execute(input: { itemId: string }): Promise<string> {
    const manifest = await readManifest();
    manifest.items = manifest.items.filter((i: any) => i.id !== input.itemId);
    await writeManifest(manifest);
    return `Item ${input.itemId} removed`;
  },
};

export const splitVideoTool = {
  name: 'split_video',
  description: 'Split a video item into two at the given time.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: { type: 'string' },
      atMs: { type: 'number', description: 'Absolute time in ms where to split' },
    },
    required: ['itemId', 'atMs'],
  },
  async execute(input: { itemId: string; atMs: number }): Promise<string> {
    const manifest = await readManifest();
    const idx = manifest.items.findIndex((i: any) => i.id === input.itemId);
    if (idx === -1) return `Error: Item ${input.itemId} not found`;

    const original = manifest.items[idx];
    if (original.type !== 'video') return `Error: Item is not a video (type: ${original.type})`;
    if (input.atMs <= original.startMs || input.atMs >= original.endMs) {
      return `Error: Split time ${input.atMs} outside item range [${original.startMs}, ${original.endMs}]`;
    }

    const splitOffset = input.atMs - original.startMs;
    const newId = randomUUID();

    // Filter and adjust keyframes
    const originalKfs = (original.keyframes || []).filter((kf: any) => kf.timeMs < splitOffset);
    const newKfs = (original.keyframes || [])
      .filter((kf: any) => kf.timeMs >= splitOffset)
      .map((kf: any) => ({ ...kf, timeMs: kf.timeMs - splitOffset }));

    // Create new item (second half)
    const newItem = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      startMs: input.atMs,
      data: {
        ...original.data,
        startFrom: (original.data.startFrom || 0) + splitOffset,
      },
      keyframes: newKfs,
    };

    // Trim original (first half)
    original.endMs = input.atMs;
    original.keyframes = originalKfs;

    manifest.items.splice(idx + 1, 0, newItem);
    await writeManifest(manifest);
    return JSON.stringify({ originalId: original.id, newId });
  },
};

// Export all tools as an array for agent registration
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
];

// Keep backward-compatible default exports
export const updateManifestTool = {
  name: 'updateManifest',
  description: 'Replace the full manifest (legacy — prefer granular tools).',
  input_schema: {
    type: 'object' as const,
    properties: { manifest: { type: 'object' } },
    required: ['manifest'],
  },
  async execute(input: { manifest: object }): Promise<string> {
    await writeManifest(input.manifest);
    const { triggerRebuild } = await import('../esbuild-watcher.js');
    triggerRebuild();
    return 'Manifest updated and rebuild triggered.';
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/tools/manifest-ops.ts
git commit -m "feat: add structured agent tools — filtered reads, track/item CRUD, split_video"
```

---

### Task 11: manifest:updated WebSocket Event

**Files:**
- Create: `packages/sandbox/src/ws-notify.ts`
- Modify: `packages/sandbox/src/agent-server.ts`

When manifest-only edits happen (no scene file changes), notify the API via a callback so the frontend can re-fetch. The notification is in a separate module to avoid circular imports (agent-server imports tools, tools import notification).

- [ ] **Step 1: Create ws-notify module**

Create `packages/sandbox/src/ws-notify.ts`:

```typescript
import pino from 'pino';

const logger = pino({ name: 'ws-notify' });

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

export async function notifyManifestUpdated(): Promise<void> {
  if (!API_CALLBACK_URL || !SANDBOX_ID) return;
  try {
    await fetch(`${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/manifest-updated`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SANDBOX_SECRET}`,
      },
      body: JSON.stringify({}),
    });
  } catch (err) {
    logger.debug({ err }, 'manifest-updated notification failed (best-effort)');
  }
}
```

Note: The manifest tools in Task 10 already import from `./ws-notify.js` and call `notifyManifestUpdated()` inside `writeManifest()`. No additional wiring needed.

- [ ] **Step 2: Update agent-server GET /manifest to use readManifestRaw**

In `packages/sandbox/src/agent-server.ts`, change the GET /manifest handler to use the raw reader (not the agent tool which returns summaries):

```typescript
import { readManifestRaw } from './tools/manifest-ops.js';

// Replace the GET /manifest handler:
app.get('/manifest', async (_req, res) => {
  try {
    const content = await readManifestRaw();
    res.json(JSON.parse(content));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Add the API internal route**

In `packages/api/src/sandbox/routes.ts`, add the internal callback route. Use the existing `emitManifestUpdated()` from `workspace-ws.ts`:

```typescript
import { emitManifestUpdated } from '../workspace/workspace-ws.js';

// POST /internal/sandbox/:id/manifest-updated
fastify.post('/internal/sandbox/:id/manifest-updated', async (request, reply) => {
  const { id } = request.params as { id: string };
  emitManifestUpdated(id, { source: 'ai' });
  return { ok: true };
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/agent-server.ts packages/sandbox/src/tools/manifest-ops.ts packages/api/src/sandbox/routes.ts
git commit -m "feat: add manifest:updated WebSocket event for manifest-only edits"
```

---

## Chunk 4: Frontend + API Integration

### Task 12: Frontend staticFile with Assets Map

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts`

Update the custom `require('remotion')` shim so `staticFile()` checks the manifest's `assets` map first, falling back to the proxy URL.

- [ ] **Step 1: Update createRequire to accept assets map**

Use a module-level mutable ref for the assets map so `staticFile()` always reads the latest presigned URLs (even when the CJS bundle is cached and not re-evaluated):

```typescript
// Module-level ref — updated when manifest changes, read by staticFile at render time
let _currentAssetsMap: Record<string, string> = {};

export function setAssetsMap(map: Record<string, string>) {
  _currentAssetsMap = map;
}

function createRequire(bundleBaseUrl: string, apiUrl: string) {
  const customStaticFile = (relativePath: string) => {
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

    // Check assets map first (presigned S3 URL) — reads from mutable ref
    if (_currentAssetsMap[cleanPath]) {
      return _currentAssetsMap[cleanPath];
    }

    // Fallback to proxy URL
    const projectIdMatch = bundleBaseUrl.match(/\/projects\/([^/]+)\/(workspace|sandbox)\//);
    const publicBase = projectIdMatch
      ? `/api/projects/${projectIdMatch[1]}/${projectIdMatch[2]}/public`
      : `${bundleBaseUrl}/public`;
    return `${apiUrl}${publicBase}/${cleanPath}`;
  };

  // ... rest of createRequire unchanged, just use customStaticFile
}
```

The caller (WorkspacePlayer) calls `setAssetsMap(manifest.assets)` whenever the manifest updates. No need to change the hook signature or cache key — the mutable ref ensures `staticFile()` always resolves to fresh presigned URLs.

- [ ] **Step 3: Remove debug console.log**

Remove the `console.log('[useWorkspaceComposition] Bundle response:', ...)` statement (line ~230).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts
git commit -m "feat: staticFile() resolves through manifest assets map (presigned S3 URLs)"
```

---

### Task 13: Frontend Manifest Fetching + Player Props

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx`
- Modify: `apps/web/src/features/editor-v2/player/Player.tsx`

The Player passes the full manifest as `inputProps` to the Remotion Player, and listens for `manifest:updated` WebSocket events to re-fetch.

- [ ] **Step 1: Update WorkspacePlayer to pass assets map**

In `WorkspacePlayer.tsx`, update assets map whenever manifest changes:

```typescript
import { setAssetsMap } from './useWorkspaceComposition';

// Update assets map ref whenever manifest changes
useEffect(() => {
  const assets = (manifest as any)?.assets;
  if (assets) setAssetsMap(assets);
}, [manifest]);

const { Component, loading, error } = useWorkspaceComposition(bundleUrl, bundleVersion);
```

Update `inputProps` to pass the full manifest:

```typescript
const inputProps = useMemo(
  () => ({ manifest }),
  [manifest],
);
```

Remove `videoUrl` and `audioUrl` from the props interface — they're now in the manifest's `assets` map.

- [ ] **Step 2: Add manifest:updated listener in Player.tsx**

In `Player.tsx`, listen for `manifest:updated` WebSocket events and trigger a manifest re-fetch:

```typescript
// In the WebSocket message handler, add:
if (data.type === 'manifest:updated') {
  // Re-fetch manifest from sandbox/workspace
  refreshManifest();
}
```

The `refreshManifest` function fetches the manifest from the API and updates the store.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/player/WorkspacePlayer.tsx apps/web/src/features/editor-v2/player/Player.tsx
git commit -m "feat: pass manifest as inputProps, listen for manifest:updated events"
```

---

### Task 14: Workspace Init — v2 Manifest + Asset Sync on First Boot

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts`

Update workspace init to generate a v2 manifest and run initial asset sync after downloading video.

- [ ] **Step 1: Update initWorkspace for v2**

In `packages/sandbox/src/workspace-init.ts`:

1. The manifest received from the API is already v2 (since `dbToManifest` now produces v2)
2. After writing manifest, run initial asset sync to populate `assets` map with presigned URLs
3. Create `src/scenes/` directory

```typescript
import { syncAssets } from './asset-sync.js';

export async function initWorkspace(payload: InitPayload): Promise<void> {
  // ... existing directory creation ...
  await mkdir(join(WORKSPACE, 'src', 'scenes'), { recursive: true });

  // Create empty scene-registry.ts stub (PlayerComposition imports it statically)
  await writeFile(join(WORKSPACE, 'src', 'scene-registry.ts'),
    `// AUTO-GENERATED — do not edit\nimport React from 'react';\nexport const sceneRegistry: Record<string, React.ComponentType<any>> = {};\n`);


  // ... existing video download + ffprobe ...

  // Patch manifest with v2 fields
  const manifest = payload.manifest as Record<string, any>;
  if (!manifest.version) manifest.version = 2;
  if (!manifest.assets) manifest.assets = {};

  // ... existing duration patching ...

  // Write manifest
  await writeFile(join(WORKSPACE, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Copy template (includes generic PlayerComposition.tsx)
  await cp(TEMPLATE, WORKSPACE, { recursive: true, force: false });

  // Remove the old inline PlayerComposition generation
  // (Template now provides it)

  // Initial asset sync — generate presigned URLs for downloaded media
  await syncAssets();

  logger.info('Workspace initialized');
}
```

- [ ] **Step 2: Remove the old inline writeFile for PlayerComposition.tsx**

Delete the `writeFile(join(WORKSPACE, 'src', 'PlayerComposition.tsx'), ...)` block (lines ~130-146).

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat: workspace init generates v2 manifest, runs initial asset sync"
```

---

### Task 15: Scene File Write Tool

**Files:**
- Create: `packages/sandbox/src/tools/scene-tools.ts`
- Modify: `packages/sandbox/src/agent-server.ts`

Tools for AI to write and delete scene files, which trigger esbuild rebuilds.

- [ ] **Step 1: Create scene tools**

Create `packages/sandbox/src/tools/scene-tools.ts`:

```typescript
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';

const SCENES_DIR = '/workspace/src/scenes';

export const writeSceneFileTool = {
  name: 'write_scene_file',
  description: 'Write a scene .tsx file. This triggers an esbuild rebuild.',
  input_schema: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string', description: 'Filename (e.g. "LowerThird.tsx")' },
      code: { type: 'string', description: 'Full TSX source code' },
    },
    required: ['filename', 'code'],
  },
  async execute(input: { filename: string; code: string }): Promise<string> {
    await mkdir(SCENES_DIR, { recursive: true });
    const filePath = join(SCENES_DIR, input.filename);
    await writeFile(filePath, input.code);
    // esbuild watcher will pick up the file change and rebuild
    return `Scene file written: ${input.filename}`;
  },
};

export const deleteSceneFileTool = {
  name: 'delete_scene_file',
  description: 'Delete a scene .tsx file.',
  input_schema: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string' },
    },
    required: ['filename'],
  },
  async execute(input: { filename: string }): Promise<string> {
    try {
      await unlink(join(SCENES_DIR, input.filename));
      return `Scene file deleted: ${input.filename}`;
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
};
```

- [ ] **Step 2: Register tools in agent-server**

In `packages/sandbox/src/agent-server.ts`, import and register scene tools alongside manifest tools for future Agent SDK integration.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/tools/scene-tools.ts packages/sandbox/src/agent-server.ts
git commit -m "feat: add scene file write/delete tools for AI agent"
```

---

### Task 16: E2E Integration Test

**Files:**
- Create: `scripts/temp/test-manifest-v2-e2e.ts`

End-to-end test that:
1. Creates a v1 manifest from DB data
2. Migrates it to v2
3. Validates v2 schema
4. Simulates manifest tool operations (add item, split, read filtered)

- [ ] **Step 1: Write the E2E test**

Create `scripts/temp/test-manifest-v2-e2e.ts`:

```typescript
import {
  dbToManifest,
  validateManifestV2,
  migrateManifestV1toV2,
  validateManifest,
} from '@viona/shared';

console.log('=== E2E: Manifest v2 Pipeline ===\n');

// 1. Simulate DB data
const dbInput = {
  project: {
    fps: 30,
    durationMs: 120000,
    sourceWidth: 1920,
    sourceHeight: 1080,
    videoSettings: {
      cropX: 50, cropY: 50, scale: 1,
      canvasWidth: 1080, canvasHeight: 1920,
      layoutSettings: { mode: 'stacked', split: { position: 'visuals-first', ratio: 50, gap: 0 } },
      captionStyle: { displayMode: 'phrase', wordsPerPhrase: 5, fontFamily: 'Inter', fontSize: 56, fontWeight: 800, color: '#FFF', activeColor: '#FFD700', backgroundColor: 'transparent', activeBackgroundColor: 'transparent' },
    },
  },
  tracks: [
    { id: 't1', type: 'video', name: 'Video', position: 0, locked: false, visible: true },
    { id: 't2', type: 'audio', name: 'Audio', position: 1, locked: false, visible: true },
    { id: 't3', type: 'subtitle', name: 'Captions', position: 2, locked: false, visible: true },
  ],
  items: [
    { id: 'v1', trackId: 't1', type: 'video', startMs: 0, endMs: 120000, data: { src: 'source.mp4', volume: 1, playbackRate: 1 } },
    { id: 'a1', trackId: 't2', type: 'audio', startMs: 0, endMs: 120000, data: { src: 'source.mp4', volume: 1, enhancedSrc: null } },
    { id: 'c1', trackId: 't3', type: 'subtitle', startMs: 0, endMs: 120000, data: { words: [{ text: 'Hello', startMs: 100, endMs: 500 }] } },
  ],
};

// 2. Generate v2 manifest from DB
console.log('Step 1: dbToManifest (v2)');
const manifest = dbToManifest(dbInput as any);
console.assert(manifest.version === 2, `Expected version 2, got ${manifest.version}`);
console.assert(!('layout' in manifest), 'v2 should not have layout');
console.assert('assets' in manifest, 'v2 should have assets map');
console.log('  PASS\n');

// 3. Validate v2 schema
console.log('Step 2: validateManifestV2');
const validated = validateManifestV2(manifest);
console.assert(validated.items.length === 3, `Expected 3 items, got ${validated.items.length}`);
console.log('  PASS\n');

// 4. Test v1 migration path (for stored manifests)
console.log('Step 3: v1 → v2 migration');
const v1Raw = {
  version: 1,
  fps: 30,
  durationMs: 60000,
  canvas: { width: 1080, height: 1920 },
  tracks: [{ id: 't1', type: 'video', name: 'V', position: 0 }],
  items: [{ id: 'i1', type: 'video', trackId: 't1', startMs: 0, endMs: 60000, data: { src: 'source.mp4', crop: { x: 50, y: 50, scale: 1 }, volume: 1, playbackRate: 1 } }],
  layout: { mode: 'stacked', split: { position: 'visuals-first', ratio: 50, gap: 0 }, pip: { position: 'bottom-right', size: 25, shape: 'circle', borderRadius: 9999, borderWidth: 2, borderColor: '#FFF', shadowEnabled: true, shadowColor: '#000', shadowBlur: 10, opacity: 1, rotation: 0, offsetX: 0, offsetY: 0, crop: { cropX: 50, cropY: 50, zoom: 1 } } },
  videoSettings: { cropX: 50, cropY: 50, scale: 1, sourceWidth: 1920, sourceHeight: 1080 },
};
const v1 = validateManifest(v1Raw);
const migrated = migrateManifestV1toV2(v1);
console.assert(migrated.version === 2, 'Migrated version should be 2');
const v2Validated = validateManifestV2(migrated);
console.assert(v2Validated.items.length === 1, 'Should have 1 item');
console.log('  PASS\n');

console.log('=== All E2E tests passed! ===');
```

- [ ] **Step 2: Run the test**

Run: `pnpm tsx scripts/temp/test-manifest-v2-e2e.ts`
Expected: "All E2E tests passed!"

- [ ] **Step 3: Commit**

```bash
git add scripts/temp/test-manifest-v2-e2e.ts
git commit -m "test: add E2E manifest v2 pipeline test"
```

---

## Post-Implementation Notes

### Docker Image Rebuild Required
After all tasks are complete, the sandbox Docker image must be rebuilt to include:
- New `PlayerComposition.tsx` template
- New `items/` directory in template
- New `TransformWrapper.tsx` in template
- Scene registry generator
- Asset sync module
- Updated agent tools

Run: `cd packages/sandbox && docker build -t viona-sandbox .`

### Files Not Changed (Deferred)
- **Export pipeline** (`packages/worker/`): The worker's render processor needs updating to use v2 manifests + `PlayerComposition.tsx`. This is a separate task since it requires rebuilding the worker Docker image and testing with actual Remotion renders.
- **manifest-bridge.ts**: The frontend store bridge needs updating to convert v2 manifest to editor store format. This is Phase 2 work (timeline UI).
- **Old composition files**: `packages/sandbox/template/src/composition/FullComposition.tsx`, `PiPVideo.tsx`, `SpeakerVideo.tsx`, etc. can be removed once v2 is stable, but keep them during transition.
