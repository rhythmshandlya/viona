# Unified Timeline Plan 1: Manifest Types + Workspace Template

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the manifest format as TypeScript types with Zod validation, create DB schema migration for workspace support, and build manifest ↔ DB conversion utilities.

**Architecture:** The manifest is a JSON document that describes the entire project timeline (tracks, items, layout, caption style, video settings). It's generated from DB state on workspace spin-up and synced back to DB on teardown. Zod schemas validate all manifest operations. DB gets new columns for workspace lifecycle tracking.

**Tech Stack:** TypeScript, Zod, Drizzle ORM, PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-12-unified-timeline-architecture-design.md`

---

## Chunk 1: Manifest Types + Zod Validation

### Task 1: Define manifest types

**Files:**
- Create: `packages/shared/src/manifest.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create manifest type definitions**

Create `packages/shared/src/manifest.ts` with these types. Reuse existing types from `packages/shared/src/types/index.ts` where they exist (SubtitleStyle, AnimationConfig, CaptionPosition, CaptionEffects, DisplayMode).

```typescript
import { z } from 'zod';
import type { SubtitleStyle, DisplayMode, CaptionPosition, CaptionEffects, AnimationConfig } from './types/index.js';

// ---- Zod schemas ----

export const manifestTrackSchema = z.object({
  id: z.string(),
  type: z.enum(['video', 'audio', 'visual', 'caption', 'broll', 'text', 'image']),
  name: z.string(),
  position: z.number().int(),
});

export const transitionConfigSchema = z.object({
  type: z.enum(['cut', 'crossfade', 'slide-left', 'slide-up', 'zoom', 'morph', 'fade']),
  durationMs: z.number().min(0).max(2000),
});

export const visualItemDataSchema = z.object({
  sceneFile: z.string(),
  displayMode: z.enum(['default', 'fullscreen', 'overlay']),
  frameOffset: z.number().int().min(0).default(0),
  transition: z.object({
    enter: transitionConfigSchema.optional(),
    exit: transitionConfigSchema.optional(),
  }).optional(),
  overlayZone: z.enum(['behind', 'lower-third', 'top', 'frame', 'background', 'none']).optional(),
  speakerBbox: z.object({
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
  }).optional(),
});

export const videoItemDataSchema = z.object({
  src: z.string(),
  crop: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    scale: z.number().min(0.5).max(3),
  }),
  volume: z.number().min(0).max(2).default(1),
  playbackRate: z.number().min(0.25).max(4).default(1),
});

export const audioItemDataSchema = z.object({
  src: z.string(),
  volume: z.number().min(0).max(2).default(1),
  enhancedSrc: z.string().nullable().default(null),
});

export const captionWordSchema = z.object({
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  classification: z.enum(['power', 'medium', 'filler']).optional(),
  styleOverrides: z.record(z.unknown()).optional(),
});

export const captionItemDataSchema = z.object({
  words: z.array(captionWordSchema),
});

export const brollItemDataSchema = z.object({
  sourceType: z.enum(['upload', 'pexels']).default('upload'),
  src: z.string(),
  filename: z.string().optional(),
  photographer: z.string().optional(),
  previewUrl: z.string().optional(),
  volume: z.number().min(0).max(2).default(1),
});

export const textItemDataSchema = z.object({
  text: z.string(),
  style: z.record(z.unknown()).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  size: z.object({ width: z.number(), height: z.number() }).optional(),
});

export const imageItemDataSchema = z.object({
  src: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  opacity: z.number().min(0).max(1).default(1),
});

export const manifestItemSchema = z.object({
  id: z.string(),
  type: z.enum(['video', 'audio', 'visual', 'caption', 'broll', 'text', 'image']),
  trackId: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  data: z.union([
    visualItemDataSchema,
    videoItemDataSchema,
    audioItemDataSchema,
    captionItemDataSchema,
    brollItemDataSchema,
    textItemDataSchema,
    imageItemDataSchema,
  ]),
});

export const manifestPiPSettingsSchema = z.object({
  position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
  size: z.number().min(5).max(50).default(25),
  shape: z.enum(['square', 'circle', 'rounded']).default('circle'),
  borderRadius: z.number().default(9999),
  borderWidth: z.number().default(2),
  borderColor: z.string().default('#FFFFFF'),
  shadowEnabled: z.boolean().default(true),
  shadowColor: z.string().default('#000000'),
  shadowBlur: z.number().default(10),
  opacity: z.number().min(0).max(1).default(1),
  rotation: z.number().default(0),
  crop: z.object({
    cropX: z.number().min(0).max(100).default(50),
    cropY: z.number().min(0).max(100).default(50),
    zoom: z.number().min(0.5).max(3).default(1),
  }).default({}),
});

export const manifestSplitSettingsSchema = z.object({
  position: z.enum(['visuals-first', 'video-first']).default('visuals-first'),
  ratio: z.number().min(0).max(100).default(50),
  gap: z.number().min(0).default(0),
});

export const manifestLayoutSchema = z.object({
  mode: z.enum(['pip', 'stacked']).default('stacked'),
  split: manifestSplitSettingsSchema.default({}),
  pip: manifestPiPSettingsSchema.default({}),
});

// CaptionStyle uses the existing SubtitleStyle interface from types/index.ts
// We define a permissive Zod schema here for validation; the TypeScript type is the authority
export const manifestCaptionStyleSchema = z.object({
  displayMode: z.enum(['word-by-word', 'phrase', 'karaoke', 'dynamic-hierarchy']).default('phrase'),
  wordsPerPhrase: z.number().min(1).max(10).default(5),
  fontFamily: z.string().default('Inter'),
  fontSize: z.number().min(8).max(200).default(56),
  fontWeight: z.number().min(100).max(900).default(800),
  letterSpacing: z.number().optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase']).optional(),
  opacity: z.number().min(0).max(1).optional(),
  lineHeight: z.number().optional(),
  color: z.string().default('#FFFFFF'),
  activeColor: z.string().default('#FFD700'),
  backgroundColor: z.string().default('transparent'),
  activeBackgroundColor: z.string().default('transparent'),
  backgroundPadding: z.object({ x: z.number(), y: z.number() }).optional(),
  backgroundRadius: z.number().optional(),
  stroke: z.object({ width: z.number(), color: z.string() }).nullable().optional(),
  animation: z.object({
    in: z.string(),
    active: z.string(),
    out: z.string(),
    easing: z.string(),
  }).default({ in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' }),
  position: z.object({
    anchor: z.enum(['top', 'center', 'bottom']).default('bottom'),
    offsetX: z.number().default(0),
    offsetY: z.number().default(0),
    textAlign: z.enum(['left', 'center', 'right']).default('center'),
    rotation: z.number().default(0),
  }).default({}),
  effects: z.object({
    shadow: z.object({
      offsetX: z.number(), offsetY: z.number(),
      blur: z.number(), color: z.string(), opacity: z.number(),
    }).nullable().default(null),
    shadowSecondary: z.object({
      offsetX: z.number(), offsetY: z.number(),
      blur: z.number(), color: z.string(), opacity: z.number(),
    }).nullable().default(null),
    glow: z.object({
      enabled: z.boolean(), color: z.string(),
      intensity: z.number(), size: z.number(),
    }).nullable().default(null),
  }).optional(),
  presetId: z.string().nullable().optional(),
}).passthrough(); // passthrough allows future fields without breaking validation

export const manifestVideoSettingsSchema = z.object({
  cropX: z.number().min(0).max(100).default(50),
  cropY: z.number().min(0).max(100).default(50),
  scale: z.number().min(0.5).max(3).default(1),
  sourceWidth: z.number().default(1920),
  sourceHeight: z.number().default(1080),
});

export const manifestSchema = z.object({
  version: z.literal(1),
  fps: z.number().int().min(1).max(120).default(30),
  durationMs: z.number().min(0),
  canvas: z.object({
    width: z.number().int().min(1),
    height: z.number().int().min(1),
  }),
  tracks: z.array(manifestTrackSchema),
  items: z.array(manifestItemSchema),
  layout: manifestLayoutSchema.default({}),
  captionStyle: manifestCaptionStyleSchema.default({}),
  videoSettings: manifestVideoSettingsSchema.default({}),
});

// ---- TypeScript types ----

export type ManifestTrack = z.infer<typeof manifestTrackSchema>;
export type ManifestItem = z.infer<typeof manifestItemSchema>;
export type ManifestLayout = z.infer<typeof manifestLayoutSchema>;
export type ManifestCaptionStyle = z.infer<typeof manifestCaptionStyleSchema>;
export type ManifestVideoSettings = z.infer<typeof manifestVideoSettingsSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export type ManifestVisualItemData = z.infer<typeof visualItemDataSchema>;
export type ManifestVideoItemData = z.infer<typeof videoItemDataSchema>;
export type ManifestAudioItemData = z.infer<typeof audioItemDataSchema>;
export type ManifestCaptionItemData = z.infer<typeof captionItemDataSchema>;
export type ManifestCaptionWord = z.infer<typeof captionWordSchema>;
export type TransitionConfig = z.infer<typeof transitionConfigSchema>;

export type ManifestItemType = ManifestItem['type'];
export type ManifestTrackType = ManifestTrack['type'];
export type SceneTransitionType = TransitionConfig['type'];

// ---- Validation helpers ----

export function validateManifest(data: unknown): Manifest {
  return manifestSchema.parse(data);
}

export function safeValidateManifest(data: unknown) {
  return manifestSchema.safeParse(data);
}
```

- [ ] **Step 2: Add `dynamic-hierarchy` to `SubtitleDisplayMode`**

In `packages/shared/src/types/index.ts`, update the `SubtitleDisplayMode` type to include `'dynamic-hierarchy'`:

```typescript
export type SubtitleDisplayMode = 'word-by-word' | 'phrase' | 'karaoke' | 'dynamic-hierarchy';
```

This aligns the existing type with the manifest's `captionStyle.displayMode` enum.

- [ ] **Step 3: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './manifest.js';
```

- [ ] **Step 4: Run TypeScript compiler to verify types**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/manifest.ts packages/shared/src/index.ts packages/shared/src/types/index.ts
git commit -m "feat(shared): add manifest types and Zod validation schemas"
```

---

### Task 2: Write manifest validation tests

**Files:**
- Create: `scripts/temp/test-manifest-validation.ts`

- [ ] **Step 1: Write validation tests**

```typescript
import { manifestSchema, validateManifest, safeValidateManifest } from '@viona/shared';

// Minimal valid manifest
const minimal: unknown = {
  version: 1,
  fps: 30,
  durationMs: 10000,
  canvas: { width: 1080, height: 1920 },
  tracks: [],
  items: [],
};

// Full manifest with all item types
const full: unknown = {
  version: 1,
  fps: 30,
  durationMs: 30000,
  canvas: { width: 1080, height: 1920 },
  tracks: [
    { id: 't1', type: 'video', name: 'Speaker', position: 0 },
    { id: 't2', type: 'visual', name: 'Visuals', position: 1 },
    { id: 't3', type: 'caption', name: 'Captions', position: 2 },
    { id: 't4', type: 'audio', name: 'Audio', position: 3 },
  ],
  items: [
    {
      id: 'i1', type: 'video', trackId: 't1', startMs: 0, endMs: 30000,
      data: { src: 'source.mp4', crop: { x: 50, y: 50, scale: 1.0 }, volume: 1, playbackRate: 1 },
    },
    {
      id: 'i2', type: 'visual', trackId: 't2', startMs: 0, endMs: 8000,
      data: {
        sceneFile: 'scenes/Scene1.tsx', displayMode: 'default', frameOffset: 0,
        transition: { enter: { type: 'fade', durationMs: 200 }, exit: { type: 'crossfade', durationMs: 300 } },
      },
    },
    {
      id: 'i3', type: 'caption', trackId: 't3', startMs: 0, endMs: 3500,
      data: {
        words: [
          { text: 'Revenue', startMs: 0, endMs: 400, classification: 'power' },
          { text: 'grew', startMs: 400, endMs: 700 },
        ],
      },
    },
    {
      id: 'i4', type: 'audio', trackId: 't4', startMs: 0, endMs: 30000,
      data: { src: 'source.mp4', volume: 1.0, enhancedSrc: null },
    },
  ],
  layout: {
    mode: 'stacked',
    split: { position: 'visuals-first', ratio: 50, gap: 0 },
    pip: { position: 'bottom-right', size: 25, shape: 'circle' },
  },
  captionStyle: {
    displayMode: 'word-by-word',
    fontFamily: 'Inter',
    fontSize: 64,
    color: '#FFFFFF',
    activeColor: '#FFD700',
    animation: { in: 'elastic-pop', active: 'none', out: 'fade', easing: 'ease-out' },
  },
  videoSettings: { cropX: 50, cropY: 50, scale: 1.0, sourceWidth: 1920, sourceHeight: 1080 },
};

// Test 1: Minimal manifest validates
console.log('Test 1: Minimal manifest...');
const result1 = safeValidateManifest(minimal);
console.assert(result1.success, 'Minimal manifest should validate');
console.log('  PASS');

// Test 2: Full manifest validates
console.log('Test 2: Full manifest...');
const result2 = safeValidateManifest(full);
if (!result2.success) {
  console.error('  FAIL:', JSON.stringify(result2.error.issues, null, 2));
} else {
  console.log('  PASS');
}

// Test 3: Invalid version rejects
console.log('Test 3: Invalid version...');
const result3 = safeValidateManifest({ ...minimal, version: 2 });
console.assert(!result3.success, 'Version 2 should be rejected');
console.log('  PASS');

// Test 4: Missing required fields reject
console.log('Test 4: Missing canvas...');
const { canvas, ...noCanvas } = minimal as any;
const result4 = safeValidateManifest(noCanvas);
console.assert(!result4.success, 'Missing canvas should be rejected');
console.log('  PASS');

// Test 5: Invalid displayMode rejects
console.log('Test 5: Invalid displayMode...');
const badItem = {
  ...minimal,
  items: [{
    id: 'x', type: 'visual', trackId: 't1', startMs: 0, endMs: 1000,
    data: { sceneFile: 'scenes/Scene1.tsx', displayMode: 'stacked', frameOffset: 0 },
  }],
};
const result5 = safeValidateManifest(badItem);
console.assert(!result5.success, 'displayMode "stacked" should be rejected');
console.log('  PASS');

// Test 6: Defaults are applied
console.log('Test 6: Defaults applied...');
const parsed = validateManifest(minimal);
console.assert(parsed.layout.mode === 'stacked', 'Default layout mode should be stacked');
console.assert(parsed.layout.split.ratio === 50, 'Default split ratio should be 50');
console.assert(parsed.captionStyle.fontSize === 56, 'Default font size should be 56');
console.log('  PASS');

// Test 7: Transition duration clamped
console.log('Test 7: Transition duration bounds...');
const badTransition = safeValidateManifest({
  ...minimal,
  items: [{
    id: 'x', type: 'visual', trackId: 't1', startMs: 0, endMs: 1000,
    data: {
      sceneFile: 'scenes/Scene1.tsx', displayMode: 'default', frameOffset: 0,
      transition: { enter: { type: 'crossfade', durationMs: 5000 } },
    },
  }],
});
console.assert(!badTransition.success, 'Transition > 2000ms should be rejected');
console.log('  PASS');

console.log('\nAll tests passed!');
```

- [ ] **Step 2: Run tests**

Run: `cd packages/shared && npx tsx ../../scripts/temp/test-manifest-validation.ts`
Expected: All 7 tests pass

- [ ] **Step 3: Commit**

```bash
git add scripts/temp/test-manifest-validation.ts
git commit -m "test: add manifest validation tests"
```

---

## Chunk 2: Manifest Operations

### Task 3: Manifest operation types and apply function

**Files:**
- Create: `packages/shared/src/manifest-ops.ts`
- Modify: `packages/shared/src/index.ts`

The PATCH endpoint receives operations (not raw manifest rewrites). This module defines the operations and an `applyManifestOp` function.

- [ ] **Step 1: Define manifest operations**

```typescript
import { z } from 'zod';
import type { Manifest, ManifestItem, ManifestLayout, ManifestCaptionStyle } from './manifest.js';

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
    dataUpdates: z.record(z.unknown()),
  }),
  z.object({
    op: z.literal('delete_item'),
    itemId: z.string(),
  }),
  z.object({
    op: z.literal('set_layout'),
    layout: z.record(z.unknown()),
  }),
  z.object({
    op: z.literal('set_display_mode'),
    itemId: z.string(),
    displayMode: z.enum(['default', 'fullscreen', 'overlay']),
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
    op: z.literal('update_caption_style'),
    updates: z.record(z.unknown()),
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
    updates: z.record(z.unknown()),
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

    case 'set_layout': {
      m.layout = { ...m.layout, ...op.layout } as any;
      break;
    }

    case 'set_display_mode': {
      const item = m.items.find(i => i.id === op.itemId);
      if (!item) throw new Error(`Item not found: ${op.itemId}`);
      if (item.type !== 'visual') throw new Error(`Item ${op.itemId} is not a visual`);
      (item.data as any).displayMode = op.displayMode;
      break;
    }

    case 'set_transition': {
      const item = m.items.find(i => i.id === op.itemId);
      if (!item) throw new Error(`Item not found: ${op.itemId}`);
      if (item.type !== 'visual') throw new Error(`Item ${op.itemId} is not a visual`);
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

    case 'update_caption_style': {
      m.captionStyle = { ...m.captionStyle, ...op.updates } as any;
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
      const newId = `${item.id}-${Date.now().toString(36)}`;
      const secondHalf: ManifestItem = structuredClone(item);
      secondHalf.id = newId;
      secondHalf.startMs = op.atMs;

      // If visual, set frameOffset on second half
      if (item.type === 'visual') {
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
  }

  // Recompute duration
  m.durationMs = m.items.length > 0
    ? Math.max(...m.items.map(i => i.endMs))
    : 0;

  return m;
}
```

- [ ] **Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './manifest-ops.js';
```

- [ ] **Step 3: Run TypeScript compiler**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/manifest-ops.ts packages/shared/src/index.ts
git commit -m "feat(shared): add manifest operations and apply function"
```

---

### Task 4: Write manifest operations tests

**Files:**
- Create: `scripts/temp/test-manifest-ops.ts`

- [ ] **Step 1: Write operation tests**

```typescript
import { applyManifestOp, validateManifest, type Manifest } from '@viona/shared';

function makeTestManifest(): Manifest {
  return validateManifest({
    version: 1, fps: 30, durationMs: 15000,
    canvas: { width: 1080, height: 1920 },
    tracks: [
      { id: 't1', type: 'video', name: 'Speaker', position: 0 },
      { id: 't2', type: 'visual', name: 'Visuals', position: 1 },
    ],
    items: [
      {
        id: 'v1', type: 'visual', trackId: 't2', startMs: 0, endMs: 8000,
        data: { sceneFile: 'scenes/Scene1.tsx', displayMode: 'default', frameOffset: 0 },
      },
      {
        id: 'v2', type: 'visual', trackId: 't2', startMs: 8000, endMs: 15000,
        data: { sceneFile: 'scenes/Scene2.tsx', displayMode: 'default', frameOffset: 0 },
      },
    ],
  });
}

// Test 1: move_item
console.log('Test 1: move_item...');
const m1 = applyManifestOp(makeTestManifest(), {
  op: 'move_item', itemId: 'v2', startMs: 9000, endMs: 16000,
});
console.assert(m1.items[1].startMs === 9000, 'startMs should be 9000');
console.assert(m1.items[1].endMs === 16000, 'endMs should be 16000');
console.assert(m1.durationMs === 16000, 'durationMs should update to 16000');
console.log('  PASS');

// Test 2: set_display_mode
console.log('Test 2: set_display_mode...');
const m2 = applyManifestOp(makeTestManifest(), {
  op: 'set_display_mode', itemId: 'v1', displayMode: 'overlay',
});
console.assert((m2.items[0].data as any).displayMode === 'overlay');
console.log('  PASS');

// Test 3: split_item
console.log('Test 3: split_item...');
const m3 = applyManifestOp(makeTestManifest(), {
  op: 'split_item', itemId: 'v1', atMs: 4000,
});
console.assert(m3.items.length === 3, 'Should have 3 items after split');
console.assert(m3.items[0].endMs === 4000, 'First half ends at 4000');
console.assert(m3.items[1].startMs === 4000, 'Second half starts at 4000');
console.assert(m3.items[1].endMs === 8000, 'Second half ends at 8000');
const secondData = m3.items[1].data as any;
console.assert(secondData.frameOffset === 120, 'frameOffset should be 120 (4000ms * 30fps / 1000)');
console.assert(secondData.sceneFile === 'scenes/Scene1.tsx', 'Same scene file');
console.log('  PASS');

// Test 4: delete_item
console.log('Test 4: delete_item...');
const m4 = applyManifestOp(makeTestManifest(), {
  op: 'delete_item', itemId: 'v1',
});
console.assert(m4.items.length === 1, 'Should have 1 item after delete');
console.assert(m4.items[0].id === 'v2', 'Remaining item should be v2');
console.log('  PASS');

// Test 5: set_layout
console.log('Test 5: set_layout...');
const m5 = applyManifestOp(makeTestManifest(), {
  op: 'set_layout', layout: { mode: 'pip' },
});
console.assert(m5.layout.mode === 'pip', 'Layout mode should be pip');
console.assert(m5.layout.split.ratio === 50, 'Split ratio should be preserved');
console.log('  PASS');

// Test 6: update_caption_style
console.log('Test 6: update_caption_style...');
const m6 = applyManifestOp(makeTestManifest(), {
  op: 'update_caption_style', updates: { fontSize: 72, color: '#FF0000' },
});
console.assert(m6.captionStyle.fontSize === 72);
console.assert(m6.captionStyle.color === '#FF0000');
console.log('  PASS');

// Test 7: set_transition
console.log('Test 7: set_transition...');
const m7 = applyManifestOp(makeTestManifest(), {
  op: 'set_transition', itemId: 'v1',
  exit: { type: 'crossfade', durationMs: 300 },
});
console.assert((m7.items[0].data as any).transition.exit.type === 'crossfade');
console.assert((m7.items[0].data as any).transition.exit.durationMs === 300);
console.log('  PASS');

// Test 8: immutability — original not mutated
console.log('Test 8: immutability...');
const original = makeTestManifest();
const modified = applyManifestOp(original, { op: 'move_item', itemId: 'v1', startMs: 1000, endMs: 5000 });
console.assert(original.items[0].startMs === 0, 'Original should not be mutated');
console.assert(modified.items[0].startMs === 1000, 'Modified should have new value');
console.log('  PASS');

// Test 9: error on invalid item
console.log('Test 9: error on invalid item...');
try {
  applyManifestOp(makeTestManifest(), { op: 'delete_item', itemId: 'nonexistent' });
  console.assert(false, 'Should have thrown');
} catch (e: any) {
  console.assert(e.message.includes('not found'), 'Should throw "not found"');
  console.log('  PASS');
}

console.log('\nAll tests passed!');
```

- [ ] **Step 2: Run tests**

Run: `cd packages/shared && npx tsx ../../scripts/temp/test-manifest-ops.ts`
Expected: All 9 tests pass

- [ ] **Step 3: Commit**

```bash
git add scripts/temp/test-manifest-ops.ts
git commit -m "test: add manifest operations tests"
```

---

## Chunk 3: DB Schema Migration + Manifest Conversion

### Task 5: DB schema migration

**Files:**
- Modify: `packages/api/src/db/schema.ts`
- Create: `packages/api/drizzle/0021_add_workspace_fields.sql`

> **Note:** This migration only ADDS columns. Existing `bundle_url` and `timestamps` columns on `visuals` are NOT removed — they stay until the workspace system is fully operational (Plan 3+). Removing them now would break the existing pipeline.

- [ ] **Step 1: Add workspace fields to schema.ts**

Add these columns to the `projects` table in `packages/api/src/db/schema.ts`:

```typescript
// Add to projects table definition:
workspaceStatus: varchar('workspace_status', { length: 50 }).default('inactive').notNull(),
workspaceLastActivity: timestamp('workspace_last_activity'),
activeBundleUrl: varchar('active_bundle_url', { length: 1024 }),
```

Add `sourceSceneIds` to the `visuals` table:

```typescript
// Add to visuals table definition:
sourceSceneIds: jsonb('source_scene_ids').$type<number[]>(),
```

- [ ] **Step 2: Create migration SQL**

Create `packages/api/drizzle/0021_add_workspace_fields.sql`:

```sql
ALTER TABLE projects
ADD COLUMN workspace_status VARCHAR(50) NOT NULL DEFAULT 'inactive',
ADD COLUMN workspace_last_activity TIMESTAMP,
ADD COLUMN active_bundle_url VARCHAR(1024);

ALTER TABLE visuals
ADD COLUMN source_scene_ids JSONB;
```

- [ ] **Step 3: Run migration**

Run: `cd packages/api && npx tsx src/scripts/migrate.ts`
Expected: Migration applies successfully

- [ ] **Step 4: Verify with TypeScript compiler**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/db/schema.ts packages/api/drizzle/0021_add_workspace_fields.sql
git commit -m "feat(api): add workspace fields to DB schema"
```

---

### Task 6: Manifest ↔ DB conversion utilities

**Files:**
- Create: `packages/shared/src/manifest-convert.ts`
- Modify: `packages/shared/src/index.ts`

These functions convert between the DB representation (tracks/timelineItems/videoSettings) and the manifest format. Used on workspace spin-up (DB → manifest) and teardown (manifest → DB).

- [ ] **Step 1: Create conversion module**

```typescript
import type { Manifest, ManifestTrack, ManifestItem, ManifestLayout, ManifestCaptionStyle, ManifestVideoSettings } from './manifest.js';
import { manifestSchema } from './manifest.js';

/**
 * Data structures matching what the DB returns.
 * These mirror the Drizzle schema shapes without importing Drizzle.
 */
export interface DbTrack {
  id: string;
  type: string;
  name: string;
  position: number;
  locked: boolean;
  visible: boolean;
}

export interface DbTimelineItem {
  id: string;
  trackId: string;
  type: string;
  startMs: number;
  endMs: number;
  data: Record<string, unknown>;
}

export interface DbProject {
  fps: number;
  durationMs: number;
  sourceWidth: number;
  sourceHeight: number;
  videoSettings: Record<string, unknown> | null;
}

export interface DbToManifestInput {
  project: DbProject;
  tracks: DbTrack[];
  items: DbTimelineItem[];
  canvasWidth?: number;
  canvasHeight?: number;
}

/**
 * Generate a manifest from DB state. Used on workspace spin-up.
 */
export function dbToManifest(input: DbToManifestInput): Manifest {
  const { project, tracks, items } = input;

  const videoSettings = (project.videoSettings || {}) as Record<string, unknown>;
  const layoutSettings = (videoSettings.layoutSettings || {}) as Record<string, unknown>;

  const manifestTracks: ManifestTrack[] = tracks.map(t => ({
    id: t.id,
    type: t.type as ManifestTrack['type'],
    name: t.name,
    position: t.position,
  }));

  const manifestItems: ManifestItem[] = items.map(item => {
    const data = item.data || {};

    // DB uses 'subtitle' but manifest uses 'caption' — map between them
    const itemType = item.type === 'subtitle' ? 'caption' : item.type;

    // Map existing DB item data to manifest format
    if (itemType === 'visual') {
      return {
        id: item.id,
        type: 'visual' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        data: {
          sceneFile: `scenes/Scene${(data as any).sourceSceneId || 1}.tsx`,
          displayMode: ((data as any).displayMode || 'default') as 'default' | 'fullscreen' | 'overlay',
          frameOffset: 0,
          transition: (data as any).transition,
          overlayZone: (data as any).overlayZone,
          speakerBbox: (data as any).speakerBbox,
        },
      };
    }

    if (itemType === 'video') {
      return {
        id: item.id,
        type: 'video' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        data: {
          src: (data as any).src || 'source.mp4',
          crop: {
            x: (videoSettings.cropX as number) ?? 50,
            y: (videoSettings.cropY as number) ?? 50,
            scale: (videoSettings.scale as number) ?? 1,
          },
          volume: (data as any).volume ?? 1,
          playbackRate: (data as any).playbackRate ?? 1,
        },
      };
    }

    if (itemType === 'audio') {
      return {
        id: item.id,
        type: 'audio' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        data: {
          src: (data as any).src || 'source.mp4',
          volume: (data as any).volume ?? 1,
          enhancedSrc: (data as any).enhancedSrc || null,
        },
      };
    }

    if (itemType === 'caption') {
      return {
        id: item.id,
        type: 'caption' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        data: {
          words: ((data as any).words || []).map((w: any) => ({
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs,
            classification: w.classification,
            styleOverrides: w.styleOverrides,
          })),
        },
      };
    }

    // For broll, text, image — pass data through as-is
    return {
      id: item.id,
      type: itemType as ManifestItem['type'],
      trackId: item.trackId,
      startMs: item.startMs,
      endMs: item.endMs,
      data: data as any,
    };
  });

  const raw = {
    version: 1 as const,
    fps: project.fps || 30,
    durationMs: project.durationMs || 0,
    canvas: {
      width: input.canvasWidth || (videoSettings.canvasWidth as number) || 1080,
      height: input.canvasHeight || (videoSettings.canvasHeight as number) || 1920,
    },
    tracks: manifestTracks,
    items: manifestItems,
    layout: {
      mode: (layoutSettings.mode as string) || 'stacked',
      split: (layoutSettings.split as any) || { position: 'visuals-first', ratio: 50, gap: 0 },
      pip: (layoutSettings.pip as any) || { position: 'bottom-right', size: 25, shape: 'circle' },
    },
    captionStyle: (videoSettings.captionStyle as any) || {},
    videoSettings: {
      cropX: (videoSettings.cropX as number) ?? 50,
      cropY: (videoSettings.cropY as number) ?? 50,
      scale: (videoSettings.scale as number) ?? 1,
      sourceWidth: project.sourceWidth || 1920,
      sourceHeight: project.sourceHeight || 1080,
    },
  };

  return manifestSchema.parse(raw);
}

/**
 * Extract DB-compatible data from a manifest. Used on workspace teardown/checkpoint.
 */
export function manifestToDb(manifest: Manifest): {
  tracks: Omit<DbTrack, 'locked' | 'visible'>[];
  items: DbTimelineItem[];
  videoSettings: Record<string, unknown>;
} {
  const tracks = manifest.tracks.map(t => ({
    id: t.id,
    type: t.type,
    name: t.name,
    position: t.position,
  }));

  const items: DbTimelineItem[] = manifest.items.map(item => {
    const data: Record<string, unknown> = { ...(item.data as any) };

    // Manifest uses 'caption' but DB uses 'subtitle' — map back
    const dbType = item.type === 'caption' ? 'subtitle' : item.type;

    // Convert visual sceneFile back to sourceSceneId
    if (item.type === 'visual') {
      const match = (data.sceneFile as string)?.match(/Scene(\d+)\.tsx$/);
      if (match) {
        data.sourceSceneId = parseInt(match[1], 10);
      }
      delete data.sceneFile;
      // Preserve frameOffset — needed for split scenes to know where in the scene to start
    }

    return {
      id: item.id,
      trackId: item.trackId,
      type: dbType,
      startMs: item.startMs,
      endMs: item.endMs,
      data,
    };
  });

  const videoSettings: Record<string, unknown> = {
    canvasWidth: manifest.canvas.width,
    canvasHeight: manifest.canvas.height,
    cropX: manifest.videoSettings.cropX,
    cropY: manifest.videoSettings.cropY,
    scale: manifest.videoSettings.scale,
    layoutSettings: manifest.layout,
    captionStyle: manifest.captionStyle,
  };

  return { tracks, items, videoSettings };
}
```

- [ ] **Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './manifest-convert.js';
```

- [ ] **Step 3: Run TypeScript compiler**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/manifest-convert.ts packages/shared/src/index.ts
git commit -m "feat(shared): add manifest <-> DB conversion utilities"
```

---

### Task 7: Write conversion tests

**Files:**
- Create: `scripts/temp/test-manifest-convert.ts`

- [ ] **Step 1: Write round-trip conversion tests**

```typescript
import { dbToManifest, manifestToDb, validateManifest, type DbToManifestInput } from '@viona/shared';

const dbInput: DbToManifestInput = {
  project: {
    fps: 30,
    durationMs: 30000,
    sourceWidth: 1920,
    sourceHeight: 1080,
    videoSettings: {
      canvasWidth: 1080,
      canvasHeight: 1920,
      cropX: 50,
      cropY: 40,
      scale: 1.2,
      layoutSettings: {
        mode: 'stacked',
        split: { position: 'visuals-first', ratio: 60, gap: 4 },
        pip: { position: 'bottom-right', size: 25, shape: 'circle' },
      },
      captionStyle: {
        displayMode: 'word-by-word',
        fontFamily: 'Montserrat',
        fontSize: 72,
        color: '#FFFFFF',
        activeColor: '#FF0000',
      },
    },
  },
  tracks: [
    { id: 't1', type: 'video', name: 'Speaker', position: 0, locked: false, visible: true },
    { id: 't2', type: 'visual', name: 'Visuals', position: 1, locked: false, visible: true },
    { id: 't3', type: 'caption', name: 'Captions', position: 2, locked: false, visible: true },
  ],
  items: [
    {
      id: 'vid1', trackId: 't1', type: 'video', startMs: 0, endMs: 30000,
      data: { src: 'source.mp4', volume: 1 },
    },
    {
      id: 'vis1', trackId: 't2', type: 'visual', startMs: 0, endMs: 8000,
      data: { sourceSceneId: 1, displayMode: 'default', transition: { enter: { type: 'fade', durationMs: 200 } } },
    },
    {
      id: 'vis2', trackId: 't2', type: 'visual', startMs: 8000, endMs: 15000,
      data: { sourceSceneId: 2, displayMode: 'overlay' },
    },
    {
      id: 'cap1', trackId: 't3', type: 'subtitle', startMs: 0, endMs: 3000, // DB uses 'subtitle', not 'caption'
      data: { words: [{ text: 'Hello', startMs: 0, endMs: 500 }, { text: 'world', startMs: 500, endMs: 1000 }] },
    },
  ],
};

// Test 1: DB → manifest produces valid manifest
console.log('Test 1: DB -> manifest...');
const manifest = dbToManifest(dbInput);
const validation = validateManifest(manifest);
console.assert(validation.version === 1);
console.assert(validation.fps === 30);
console.assert(validation.canvas.width === 1080);
console.assert(validation.tracks.length === 3);
console.assert(validation.items.length === 4);
console.log('  PASS');

// Test 2: Visual items get sceneFile from sourceSceneId
console.log('Test 2: sourceSceneId -> sceneFile...');
const vis1 = manifest.items.find(i => i.id === 'vis1')!;
console.assert((vis1.data as any).sceneFile === 'scenes/Scene1.tsx');
const vis2 = manifest.items.find(i => i.id === 'vis2')!;
console.assert((vis2.data as any).sceneFile === 'scenes/Scene2.tsx');
console.log('  PASS');

// Test 3: Layout settings preserved
console.log('Test 3: Layout settings...');
console.assert(manifest.layout.mode === 'stacked');
console.assert(manifest.layout.split.ratio === 60);
console.assert(manifest.layout.split.gap === 4);
console.log('  PASS');

// Test 4: Video settings preserved
console.log('Test 4: Video settings...');
console.assert(manifest.videoSettings.cropX === 50);
console.assert(manifest.videoSettings.cropY === 40);
console.assert(manifest.videoSettings.scale === 1.2);
console.log('  PASS');

// Test 5: Caption style preserved
console.log('Test 5: Caption style...');
console.assert(manifest.captionStyle.fontFamily === 'Montserrat');
console.assert(manifest.captionStyle.fontSize === 72);
console.log('  PASS');

// Test 6: DB 'subtitle' type maps to manifest 'caption' type
console.log('Test 6: subtitle -> caption mapping...');
const capItem = manifest.items.find(i => i.id === 'cap1')!;
console.assert(capItem.type === 'caption', `Expected 'caption' but got '${capItem.type}'`);
console.assert((capItem.data as any).words.length === 2, 'Should have 2 words');
console.log('  PASS');

// Test 7: manifest → DB round-trip
console.log('Test 7: manifest -> DB...');
const dbOut = manifestToDb(manifest);
console.assert(dbOut.tracks.length === 3);
console.assert(dbOut.items.length === 4);
// Visual items should have sourceSceneId restored
const dbVis1 = dbOut.items.find(i => i.id === 'vis1')!;
console.assert((dbVis1.data as any).sourceSceneId === 1, 'sourceSceneId should be restored from sceneFile');
console.assert((dbVis1.data as any).sceneFile === undefined, 'sceneFile should be removed');
// Caption items should map back to 'subtitle' type
const dbCap1 = dbOut.items.find(i => i.id === 'cap1')!;
console.assert(dbCap1.type === 'subtitle', `Expected DB type 'subtitle' but got '${dbCap1.type}'`);
console.log('  PASS');

// Test 8: videoSettings includes layout and caption style
console.log('Test 8: videoSettings structure...');
console.assert((dbOut.videoSettings.layoutSettings as any).mode === 'stacked');
console.assert((dbOut.videoSettings.captionStyle as any).fontFamily === 'Montserrat');
console.assert(dbOut.videoSettings.cropX === 50);
console.log('  PASS');

console.log('\nAll tests passed!');
```

- [ ] **Step 2: Run tests**

Run: `cd packages/shared && npx tsx ../../scripts/temp/test-manifest-convert.ts`
Expected: All 8 tests pass

- [ ] **Step 3: Commit**

```bash
git add scripts/temp/test-manifest-convert.ts
git commit -m "test: add manifest conversion round-trip tests"
```
