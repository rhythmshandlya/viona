# Pure NLE Manifest System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the manifest system a true NLE — transforms are stored explicitly in DB items and read back as-is, not computed from layout modes.

**Architecture:** Three-phase fix: (1) Data layer — `dbToManifest()` reads stored `_transform`/`_keyframes`/`_filters` from DB item data instead of computing from layout settings; `manifestToDb()` stops inferring layout mode from transforms. (2) Codegen — generated `PlayerComposition.tsx` renders manifest items with per-item transforms (like the sandbox template) instead of delegating to `FullComposition` with layout modes. (3) Cleanup — remove layout compute functions and deprecated layout settings inference.

**Tech Stack:** TypeScript, Zod (manifest-v2 schema), Remotion, React

---

## Context for Implementers

### The Problem

`dbToManifest()` in `packages/shared/src/manifest-convert.ts` computes transforms from `videoSettings.layoutSettings.mode` (stacked/pip/fullscreen) instead of reading stored transforms from item data. This causes:

1. **Round-trip data loss**: User edits transforms in sandbox → `syncManifestToDb()` correctly stores them as `_transform` in item data → on next load, `dbToManifest()` ignores stored `_transform` and recomputes from layout mode → edits lost.
2. **Stale layout defaults**: The codegen (`workspace-codegen.ts`) reads `manifest.layout` which doesn't exist in V2 manifests → always defaults to `stacked` with `50/50` split.
3. **Bandaid code**: `effectiveLayoutMode` forces fullscreen when no visual items exist to avoid half-black screen — unnecessary if transforms are explicit.

### How It Should Work (Industry Standard)

```
DB item.data._transform → manifest item.transform → renderer applies transform
                                                   ↗
DB item.data._keyframes → manifest item.keyframes → renderer interpolates keyframes
```

No layout mode computation. Transforms are explicit. The manifest is the source of truth.

### Two Rendering Paths

1. **Sandbox container** (`packages/sandbox/template/src/PlayerComposition.tsx`): Already NLE — iterates tracks/items, applies `TransformWrapper` per item. Only needs data layer fix.
2. **API workspace codegen** (`packages/api/src/workspace/workspace-codegen.ts`): Generates `PlayerComposition.tsx` that wraps `FullComposition` with layout modes. Needs to be rewritten to use per-item transforms.

### Key Files

| File | Role |
|------|------|
| `packages/shared/src/manifest-convert.ts` | DB↔manifest conversion (main target) |
| `packages/shared/src/manifest-v2.ts` | V2 manifest Zod schema |
| `packages/api/src/sandbox/sync.ts` | Sandbox→DB sync (stores `_transform` in item data) |
| `packages/api/src/workspace/workspace-codegen.ts` | Generates PlayerComposition.tsx for workspace |
| `packages/api/src/workspace/workspace-service.ts` | Workspace lifecycle (calls dbToManifest/syncManifestToDb) |
| `apps/web/src/features/editor-v2/store/manifest-bridge.ts` | Browser: manifest↔editor store conversion |

---

## Chunk 1: Data Layer — dbToManifest Reads Stored Transforms

### Task 1: Make `dbToManifest()` read stored transforms from item data

**Files:**
- Modify: `packages/shared/src/manifest-convert.ts:187-492`
- Test: `scripts/temp/test-manifest-roundtrip.ts`

The core fix: when building manifest items, check if the DB item has `data._transform` (sandbox sync path) or `data.transform` (manifestToDb path) first. Only fall back to layout-computed defaults when no stored transform exists AND `layoutSettings` is present (backward compat for existing projects).

**Key insight — two storage paths with different key names:**
- `packages/api/src/sandbox/sync.ts` stores as `_transform` (underscore prefix, lines 49-54)
- `packages/shared/src/manifest-convert.ts` `manifestToDb()` stores as `transform` (no underscore, line 538)
- Solution: `dbToManifest()` reads both keys: `data._transform || data.transform`
- Task 2 will unify to `_transform` everywhere

- [ ] **Step 1: Write a round-trip test**

Create `scripts/temp/test-manifest-roundtrip.ts`:

```typescript
import { dbToManifest, manifestToDb } from '../../packages/shared/src/manifest-convert.js';
import type { DbToManifestInput } from '../../packages/shared/src/manifest-convert.js';

// Test 1: Stored transforms survive round-trip
function testStoredTransformRoundTrip() {
  const input: DbToManifestInput = {
    project: {
      fps: 30,
      durationMs: 10000,
      sourceWidth: 1920,
      sourceHeight: 1080,
      videoSettings: {
        canvasWidth: 1080,
        canvasHeight: 1920,
        layoutSettings: { mode: 'stacked', split: { ratio: 50, position: 'visuals-first', gap: 0 } },
      },
    },
    tracks: [
      { id: 'track-1', type: 'video', name: 'Video', position: 0, locked: false, visible: true },
    ],
    items: [
      {
        id: 'item-1',
        trackId: 'track-1',
        type: 'video',
        startMs: 0,
        endMs: 10000,
        data: {
          src: 'source.mp4',
          volume: 1,
          // Stored transform from previous sandbox edit — user moved/resized video
          _transform: { x: 10, y: 20, width: '80%', height: '60%', rotation: 5, opacity: 0.9 },
          _keyframes: [{ timeMs: 500, props: { opacity: 0.5 }, easing: 'linear' }],
          _filters: { brightness: 1.2 },
        },
      },
    ],
  };

  const manifest = dbToManifest(input);
  const videoItem = manifest.items.find(i => i.type === 'video')!;

  // Transform should come from stored _transform, NOT computed from stacked layout
  console.assert(videoItem.transform?.x === 10, `Expected x=10, got ${videoItem.transform?.x}`);
  console.assert(videoItem.transform?.y === 20, `Expected y=20, got ${videoItem.transform?.y}`);
  console.assert(videoItem.transform?.width === '80%', `Expected width=80%, got ${videoItem.transform?.width}`);
  console.assert(videoItem.transform?.height === '60%', `Expected height=60%, got ${videoItem.transform?.height}`);
  console.assert(videoItem.transform?.rotation === 5, `Expected rotation=5, got ${videoItem.transform?.rotation}`);
  console.assert(videoItem.transform?.opacity === 0.9, `Expected opacity=0.9, got ${videoItem.transform?.opacity}`);

  // Keyframes should be preserved
  console.assert(videoItem.keyframes?.length === 1, `Expected 1 keyframe, got ${videoItem.keyframes?.length}`);

  // Filters should be preserved
  console.assert((videoItem as any).filters?.brightness === 1.2, `Expected brightness=1.2`);

  console.log('✅ Test 1 passed: Stored transforms survive round-trip');
}

// Test 2: Default transforms when no stored transform exists (backward compat)
function testDefaultTransformFallback() {
  const input: DbToManifestInput = {
    project: {
      fps: 30,
      durationMs: 10000,
      sourceWidth: 1920,
      sourceHeight: 1080,
      videoSettings: { canvasWidth: 1080, canvasHeight: 1920 },
    },
    tracks: [
      { id: 'track-1', type: 'video', name: 'Video', position: 0, locked: false, visible: true },
    ],
    items: [
      {
        id: 'item-1',
        trackId: 'track-1',
        type: 'video',
        startMs: 0,
        endMs: 10000,
        data: { src: 'source.mp4', volume: 1 },
        // No _transform — should get fullscreen default
      },
    ],
  };

  const manifest = dbToManifest(input);
  const videoItem = manifest.items.find(i => i.type === 'video')!;

  // Should get fullscreen defaults (no stored transform → fullscreen)
  console.assert(videoItem.transform?.x === 0, `Expected x=0, got ${videoItem.transform?.x}`);
  console.assert(videoItem.transform?.y === 0, `Expected y=0, got ${videoItem.transform?.y}`);
  console.assert(videoItem.transform?.width === '100%', `Expected width=100%, got ${videoItem.transform?.width}`);
  console.assert(videoItem.transform?.height === '100%', `Expected height=100%, got ${videoItem.transform?.height}`);
  console.assert(videoItem.transform?.opacity === 1, `Expected opacity=1, got ${videoItem.transform?.opacity}`);

  console.log('✅ Test 2 passed: Default fullscreen transform when no stored transform');
}

// Test 3: Scene item with stored transform
function testSceneStoredTransform() {
  const input: DbToManifestInput = {
    project: {
      fps: 30,
      durationMs: 10000,
      sourceWidth: 1920,
      sourceHeight: 1080,
      videoSettings: {
        canvasWidth: 1080,
        canvasHeight: 1920,
        layoutSettings: { mode: 'stacked', split: { ratio: 50, position: 'visuals-first', gap: 0 } },
      },
    },
    tracks: [
      { id: 'track-1', type: 'video', name: 'Video', position: 0, locked: false, visible: true },
      { id: 'track-2', type: 'visual', name: 'Visuals', position: 1, locked: false, visible: true },
    ],
    items: [
      {
        id: 'item-1', trackId: 'track-1', type: 'video',
        startMs: 0, endMs: 10000,
        data: { src: 'source.mp4', volume: 1 },
      },
      {
        id: 'item-2', trackId: 'track-2', type: 'visual',
        startMs: 0, endMs: 5000,
        data: {
          sceneFile: 'scenes/Scene1.tsx',
          displayMode: 'default',
          // User edited this scene's transform in sandbox
          _transform: { x: 0, y: '50%', width: '100%', height: '50%', rotation: 0, opacity: 1 },
        },
      },
    ],
  };

  const manifest = dbToManifest(input);
  const sceneItem = manifest.items.find(i => i.type === 'scene')!;

  // Should use stored transform, not compute from stacked layout
  console.assert(sceneItem.transform?.y === '50%', `Expected y=50%, got ${sceneItem.transform?.y}`);
  console.assert(sceneItem.transform?.height === '50%', `Expected height=50%, got ${sceneItem.transform?.height}`);

  console.log('✅ Test 3 passed: Scene item uses stored transform');
}

// Test 4: manifestToDb preserves transforms without layout inference
function testManifestToDbNoLayoutInference() {
  const input: DbToManifestInput = {
    project: {
      fps: 30,
      durationMs: 10000,
      sourceWidth: 1920,
      sourceHeight: 1080,
      videoSettings: { canvasWidth: 1080, canvasHeight: 1920 },
    },
    tracks: [
      { id: 'track-1', type: 'video', name: 'Video', position: 0, locked: false, visible: true },
    ],
    items: [
      {
        id: 'item-1', trackId: 'track-1', type: 'video',
        startMs: 0, endMs: 10000,
        data: {
          src: 'source.mp4', volume: 1,
          _transform: { x: 0, y: 0, width: '100%', height: '60%', rotation: 0, opacity: 1 },
        },
      },
    ],
  };

  const manifest = dbToManifest(input);
  const dbResult = manifestToDb(manifest);

  // layoutSettings should NOT be inferred from transforms — should be empty or absent
  const ls = dbResult.videoSettings.layoutSettings as any;
  const hasMode = ls && ls.mode;
  console.assert(!hasMode, `Expected no inferred layout mode, got ${JSON.stringify(ls)}`);

  // Transform should be preserved in item data (using _transform key)
  const itemData = dbResult.items[0]!.data as any;
  console.assert(itemData._transform !== undefined, 'Transform should be stored as _transform in item data');

  console.log('✅ Test 4 passed: manifestToDb stores transforms, no layout inference');
}

// Run all tests
testStoredTransformRoundTrip();
testDefaultTransformFallback();
testSceneStoredTransform();
testManifestToDbNoLayoutInference();

console.log('\n🎉 All tests passed!');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx tsx ../../scripts/temp/test-manifest-roundtrip.ts`
Expected: Tests 1, 3, 4 should fail (stored transforms ignored, layout inferred)

- [ ] **Step 3: Modify `dbToManifest()` to read stored transforms**

In `packages/shared/src/manifest-convert.ts`, modify the item mapping (lines 220-492). For each item type, check for stored `_transform` first:

**VIDEO items** (replace lines 232-272 with):
```typescript
    if (dbType === 'video') {
      const videoEndMs = (item.endMs <= item.startMs && project.durationMs > 0)
        ? project.durationMs
        : item.endMs;

      // Read stored transform — check both key conventions
      // _transform: sandbox sync path (sync.ts)
      // transform: manifestToDb path (manifest-convert.ts)
      const storedTransform = ((data as any)._transform || (data as any).transform) as TransformV2 | undefined;
      const storedKeyframes = ((data as any)._keyframes || (data as any).keyframes) as any[] | undefined;
      const storedFilters = ((data as any)._filters || (data as any).filters) as Record<string, unknown> | undefined;
      const transform: TransformV2 = storedTransform
        ? { ...storedTransform }
        : { ...FULLSCREEN_TRANSFORM };

      // Crop: per-item from data, fallback to global videoSettings
      let crop: { x: number; y: number; scale: number } | undefined;
      const itemCrop = (data as any).crop;
      if (itemCrop) {
        crop = { x: itemCrop.x ?? 50, y: itemCrop.y ?? 50, scale: itemCrop.scale ?? 1 };
      } else {
        const cropX = (videoSettings.cropX as number) ?? 50;
        const cropY = (videoSettings.cropY as number) ?? 50;
        const scale = (videoSettings.scale as number) ?? 1;
        if (cropX !== 50 || cropY !== 50 || scale !== 1) {
          crop = { x: cropX, y: cropY, scale };
        }
      }

      return {
        id: item.id,
        type: 'video' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: videoEndMs,
        transform,
        keyframes: storedKeyframes || [],
        ...(storedFilters ? { filters: storedFilters } : {}),
        data: {
          src: (data as any).src || 'source.mp4',
          startFrom: (data as any).startFrom ?? 0,
          volume: (data as any).volume ?? 1,
          playbackRate: (data as any).playbackRate ?? 1,
          ...(crop ? { crop } : {}),
        },
      };
    }
```

**VISUAL/SCENE items** (replace lines 317-361 with):
```typescript
    if (dbType === 'visual') {
      // Read stored transform — check both key conventions
      const storedTransform = ((data as any)._transform || (data as any).transform) as TransformV2 | undefined;
      const storedKeyframes = ((data as any)._keyframes || (data as any).keyframes) as any[] | undefined;
      const storedFilters = ((data as any)._filters || (data as any).filters) as Record<string, unknown> | undefined;
      const transform: TransformV2 = storedTransform
        ? { ...storedTransform }
        : { ...FULLSCREEN_TRANSFORM };

      return {
        id: item.id,
        type: 'scene' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        transform,
        keyframes: storedKeyframes || [],
        ...(storedFilters ? { filters: storedFilters } : {}),
        data: {
          sceneFile: (data as any).sceneFile || `scenes/Scene${(data as any).sourceSceneId || 1}.tsx`,
        },
      };
    }
```

**BROLL items** (replace lines 364-382 with):
```typescript
    if (dbType === 'broll') {
      const src = (data as any).src || (data as any).previewUrl || (data as any).filename || '';
      const storedTransform = ((data as any)._transform || (data as any).transform) as TransformV2 | undefined;
      const storedKeyframes = ((data as any)._keyframes || (data as any).keyframes) as any[] | undefined;
      const storedFilters = ((data as any)._filters || (data as any).filters) as Record<string, unknown> | undefined;

      return {
        id: item.id,
        type: 'video' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        transform: storedTransform ? { ...storedTransform } : { ...FULLSCREEN_TRANSFORM },
        keyframes: storedKeyframes || [],
        ...(storedFilters ? { filters: storedFilters } : {}),
        data: {
          src,
          startFrom: 0,
          volume: (data as any).volume ?? 1,
          playbackRate: 1,
        },
      };
    }
```

**TEXT items** (replace lines 425-453 — merge stored transform with position/size):
```typescript
    if (dbType === 'text') {
      const style = (data as any).style ?? {};
      const storedTransform = ((data as any)._transform || (data as any).transform) as TransformV2 | undefined;
      const storedKeyframes = ((data as any)._keyframes || (data as any).keyframes) as any[] | undefined;
      const storedFilters = ((data as any)._filters || (data as any).filters) as Record<string, unknown> | undefined;
      const transform: TransformV2 = storedTransform
        ? { ...storedTransform }
        : {
            x: (data as any).position?.x ?? 0,
            y: (data as any).position?.y ?? 0,
            width: (data as any).size?.width != null ? `${(data as any).size.width}%` : '100%',
            height: (data as any).size?.height != null ? `${(data as any).size.height}%` : '100%',
            rotation: 0,
            opacity: 1,
          };

      return {
        id: item.id,
        type: 'text' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        transform,
        keyframes: storedKeyframes || [],
        ...(storedFilters ? { filters: storedFilters } : {}),
        data: {
          text: (data as any).text || '',
          fontFamily: (style.fontFamily as string) ?? 'Inter',
          fontSize: (style.fontSize as number) ?? 48,
          fontWeight: (style.fontWeight as number) ?? 600,
          color: (style.color as string) ?? '#FFFFFF',
          textAlign: ((style.textAlign as string) ?? 'center') as 'left' | 'center' | 'right',
          textTransform: ((style.textTransform as string) ?? 'none') as 'none' | 'uppercase' | 'lowercase',
        },
      };
    }
```

**IMAGE items** (replace lines 457-478 — merge stored transform with position/size):
```typescript
    if (dbType === 'image') {
      const storedTransform = ((data as any)._transform || (data as any).transform) as TransformV2 | undefined;
      const storedKeyframes = ((data as any)._keyframes || (data as any).keyframes) as any[] | undefined;
      const storedFilters = ((data as any)._filters || (data as any).filters) as Record<string, unknown> | undefined;
      const transform: TransformV2 = storedTransform
        ? { ...storedTransform }
        : {
            x: (data as any).position?.x ?? 0,
            y: (data as any).position?.y ?? 0,
            width: (data as any).width != null ? `${(data as any).width}%` : '100%',
            height: (data as any).height != null ? `${(data as any).height}%` : '100%',
            rotation: 0,
            opacity: (data as any).opacity ?? 1,
          };

      return {
        id: item.id,
        type: 'image' as const,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        transform,
        keyframes: storedKeyframes || [],
        ...(storedFilters ? { filters: storedFilters } : {}),
        data: {
          src: (data as any).src || '',
        },
      };
    }
```

- [ ] **Step 4: Remove layout mode computation from `dbToManifest()`**

Remove these lines/blocks from `dbToManifest()`:
- Lines 191-196: `layoutSettings`, `layoutMode`, `rawPip`, `coerceNumericFields`/`normalizePipSize` calls
- Lines 198-204: `hasVisualContent`, `effectiveLayoutMode` computation
- Lines 206-211: `videoTrackIds`, `secondVideoTrackId` for PiP detection

The function should no longer reference layout modes at all. Keep the manifest track mapping and item iteration structure.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/shared && npx tsx ../../scripts/temp/test-manifest-roundtrip.ts`
Expected: All 4 tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/manifest-convert.ts scripts/temp/test-manifest-roundtrip.ts
git commit -m "feat(manifest): read stored transforms from DB items instead of computing from layout modes"
```

---

### Task 2: Fix `manifestToDb()` — unify storage keys, remove layout inference

**Files:**
- Modify: `packages/shared/src/manifest-convert.ts:518-635`

There are two issues:
1. `manifestToDb()` stores transforms as `data.transform` (no underscore), but sandbox `sync.ts` stores as `data._transform`. Unify to `_transform` prefix everywhere.
2. Layout inference from transforms (lines 586-620) needs to be removed.

- [ ] **Step 1: Unify transform storage keys to `_transform` prefix**

In `manifestToDb()`, replace lines 536-545:
```typescript
    // Before:
    if (item.type !== 'audio' && (item as any).transform) {
      data.transform = (item as any).transform;
    }
    if ((item as any).keyframes?.length > 0) {
      data.keyframes = (item as any).keyframes;
    }
    if ((item as any).filters) {
      data.filters = (item as any).filters;
    }

    // After — use underscore prefix to match sandbox sync convention:
    if (item.type !== 'audio' && (item as any).transform) {
      data._transform = (item as any).transform;
    }
    if ((item as any).keyframes?.length > 0) {
      data._keyframes = (item as any).keyframes;
    }
    if ((item as any).filters) {
      data._filters = (item as any).filters;
    }
```

- [ ] **Step 2: Remove layout settings inference logic**

Replace lines 586-620 (the layout inference block) with just:
```typescript
  // No layout inference — transforms are explicit in manifest items
```

Keep the rest of `manifestToDb()` intact (track mapping, item data preservation, videoSettings construction).

The `videoSettings` object (lines 622-632) should still include `canvasWidth`, `canvasHeight`, `sourceWidth`, `sourceHeight`, `captionStyle`, and crop from first video item. Remove the `layoutSettings` field:

```typescript
  const videoSettings: Record<string, unknown> = {
    canvasWidth: manifest.canvas.width,
    canvasHeight: manifest.canvas.height,
    cropX: videoCrop?.x ?? 50,
    cropY: videoCrop?.y ?? 50,
    scale: videoCrop?.scale ?? 1,
    sourceWidth: manifest.videoSettings.sourceWidth,
    sourceHeight: manifest.videoSettings.sourceHeight,
    captionStyle: manifest.captionStyle,
  };
```

- [ ] **Step 3: Run tests**

Run: `cd packages/shared && npx tsx ../../scripts/temp/test-manifest-roundtrip.ts`
Expected: All 4 tests pass (test 4 specifically validates no layout inference)

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/manifest-convert.ts
git commit -m "refactor(manifest): unify _transform storage keys, remove layout inference from manifestToDb"
```

---

### Task 3: Remove dead layout compute functions

**Files:**
- Modify: `packages/shared/src/manifest-convert.ts:30-162`

- [ ] **Step 1: Remove unused functions**

Delete these functions (they're no longer called after Task 1):
- `normalizePipSize` (lines 35-41)
- `computePipTransformFromDb` (lines 92-124)
- `computeStackedTransformFromDb` (lines 126-162)

Also remove the `coerceNumericFields` function (lines 8-28) if it's no longer used anywhere. Check with grep first.

- [ ] **Step 2: Verify build**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run tests**

Run: `cd packages/shared && npx tsx ../../scripts/temp/test-manifest-roundtrip.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/manifest-convert.ts
git commit -m "refactor(manifest): remove dead layout compute functions"
```

---

## Chunk 2: Codegen — NLE Rendering

### Task 4: Rewrite codegen to generate NLE-style PlayerComposition

**Files:**
- Modify: `packages/api/src/workspace/workspace-codegen.ts:56-340`
- Reference: `packages/sandbox/template/src/PlayerComposition.tsx` (NLE renderer model)
- Reference: `packages/sandbox/template/src/composition/TransformWrapper.tsx` (transform wrapper model)

The current codegen generates a `PlayerComposition.tsx` that:
- Imports `FullComposition` (layout-mode based renderer)
- Reads `manifest.layout` (doesn't exist in V2 → always defaults to stacked)
- Passes `layoutMode`, `splitSettings`, `pipSettings` to FullComposition

Replace with NLE-style rendering that:
- Iterates manifest tracks/items sorted by track position
- Creates `<Sequence>` per item with correct timing
- Wraps each item in a `<TransformWrapper>` using the item's explicit transform
- Dispatches to type-specific renderers (video, audio, scene, text, image, caption, shape)

- [ ] **Step 1: Add TransformWrapper to workspace template files**

The workspace needs a `TransformWrapper.tsx` component. Copy the implementation from `packages/sandbox/template/src/composition/TransformWrapper.tsx` into the workspace template.

In `workspace-codegen.ts`, the `generatePlayerComposition` function should write a `TransformWrapper.tsx` alongside `PlayerComposition.tsx`. Add a new function:

```typescript
export async function generateTransformWrapper(projectId: string): Promise<void> {
  const srcPath = getWorkspaceSrcPath(projectId);
  const code = `// Auto-generated — applies per-item transforms with keyframe interpolation
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

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
  easing?: string;
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

function getEasingFn(easing?: string): ((t: number) => number) | undefined {
  switch (easing) {
    case 'ease-in': return Easing.in(Easing.ease);
    case 'ease-out': return Easing.out(Easing.ease);
    case 'ease-in-out': return Easing.inOut(Easing.ease);
    case 'linear': return undefined;
    default: return undefined;
  }
}

export const TransformWrapper: React.FC<{
  transform: Transform;
  keyframes?: Keyframe[];
  filters?: Filters;
  children: React.ReactNode;
}> = ({ transform, keyframes = [], filters, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  // Resolve numeric value from transform field
  const resolveNum = (val: number | string, fallback: number): number =>
    typeof val === 'number' ? val : parseFloat(val) || fallback;

  // Interpolate a single property across keyframes
  const interpolateProperty = (
    prop: keyof Transform,
    baseValue: number | string,
  ): number | string => {
    if (keyframes.length === 0) return baseValue;

    // V2 schema: keyframes have { timeMs, props: { x?, y?, ... }, easing }
    const relevantKfs = keyframes
      .filter(kf => kf.props && (kf.props as any)[prop] !== undefined)
      .sort((a, b) => a.timeMs - b.timeMs);

    if (relevantKfs.length === 0) return baseValue;

    // Before first keyframe
    if (currentTimeMs <= relevantKfs[0]!.timeMs) {
      const target = (relevantKfs[0]!.props as any)[prop];
      if (typeof baseValue === 'string' || typeof target === 'string') {
        return currentTimeMs < relevantKfs[0]!.timeMs ? baseValue : target;
      }
      const easing = getEasingFn(relevantKfs[0]!.easing);
      return interpolate(
        currentTimeMs, [0, relevantKfs[0]!.timeMs],
        [baseValue as number, target as number],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', ...(easing ? { easing } : {}) },
      );
    }

    // After last keyframe
    if (currentTimeMs >= relevantKfs[relevantKfs.length - 1]!.timeMs) {
      return (relevantKfs[relevantKfs.length - 1]!.props as any)[prop];
    }

    // Between two keyframes
    for (let i = 0; i < relevantKfs.length - 1; i++) {
      const kf = relevantKfs[i]!;
      const nextKf = relevantKfs[i + 1]!;
      if (currentTimeMs >= kf.timeMs && currentTimeMs <= nextKf.timeMs) {
        const from = (kf.props as any)[prop];
        const to = (nextKf.props as any)[prop];
        if (typeof from === 'string' || typeof to === 'string') {
          const progress = (currentTimeMs - kf.timeMs) / (nextKf.timeMs - kf.timeMs);
          return progress < 0.5 ? from : to;
        }
        const easing = getEasingFn(nextKf.easing);
        return interpolate(
          currentTimeMs, [kf.timeMs, nextKf.timeMs], [from, to],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', ...(easing ? { easing } : {}) },
        );
      }
    }

    return baseValue;
  };

  const x = interpolateProperty('x', transform.x);
  const y = interpolateProperty('y', transform.y);
  const width = interpolateProperty('width', transform.width);
  const height = interpolateProperty('height', transform.height);
  const rotation = interpolateProperty('rotation', transform.rotation) as number;
  const opacity = interpolateProperty('opacity', transform.opacity) as number;

  const toCSS = (val: number | string): string =>
    typeof val === 'number' ? \`\${val}px\` : val;

  // Build filter string
  let filterStr = '';
  if (filters) {
    const parts: string[] = [];
    if (filters.brightness != null && filters.brightness !== 1) parts.push(\`brightness(\${filters.brightness})\`);
    if (filters.contrast != null && filters.contrast !== 1) parts.push(\`contrast(\${filters.contrast})\`);
    if (filters.saturation != null && filters.saturation !== 1) parts.push(\`saturate(\${filters.saturation})\`);
    if (filters.blur != null && filters.blur !== 0) parts.push(\`blur(\${filters.blur}px)\`);
    if (filters.hue != null && filters.hue !== 0) parts.push(\`hue-rotate(\${filters.hue}deg)\`);
    if (filters.grayscale != null && filters.grayscale !== 0) parts.push(\`grayscale(\${filters.grayscale})\`);
    if (filters.sepia != null && filters.sepia !== 0) parts.push(\`sepia(\${filters.sepia})\`);
    filterStr = parts.join(' ');
  }

  return (
    <div style={{
      position: 'absolute',
      left: toCSS(x),
      top: toCSS(y),
      width: toCSS(width),
      height: toCSS(height),
      transform: rotation ? \`rotate(\${rotation}deg)\` : undefined,
      opacity,
      overflow: 'hidden',
      ...(filterStr ? { filter: filterStr } : {}),
    }}>
      {children}
    </div>
  );
};
`;
  await writeFile(join(srcPath, 'TransformWrapper.tsx'), code, 'utf-8');
}
```

- [ ] **Step 2: Rewrite `generatePlayerComposition` to emit NLE-style code**

Replace the `renderFullComposition` and `PlayerComposition` component generation in `generatePlayerComposition()`. The new generated code should:

```typescript
// Inside generatePlayerComposition(), replace the `const code = ...` block:

const code = `import React from 'react';
import { useVideoConfig, AbsoluteFill, Sequence, Audio, Video, Img, staticFile } from 'remotion';
import { TransformWrapper } from './TransformWrapper';
${sceneImports}
${aiCompositionImport}
${fontImport}

const SCENE_MAP: Record<string, React.FC<any>> = {
${sceneMapEntries}
};

const HAS_AI_COMPOSITION = ${hasCompositionTsx};

// Error boundary for AI compositions
class CompositionErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// Subtitle rendering
function SubtitleRenderer({ items, captionStyle }: { items: any[]; captionStyle?: any }) {
  // Captions rendered by the player's caption system — placeholder for now
  return null;
}

// Item renderer — dispatches to type-specific components
function ItemRenderer({ item }: { item: any }) {
  switch (item.type) {
    case 'video':
      return (
        <Video
          src={staticFile(item.data?.src || 'source.mp4')}
          volume={item.data?.volume ?? 1}
          playbackRate={item.data?.playbackRate ?? 1}
          startFrom={item.data?.startFrom ?? 0}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      );
    case 'audio':
      return (
        <Audio
          src={staticFile(item.data?.src || '')}
          volume={item.data?.volume ?? 1}
          playbackRate={item.data?.playbackRate ?? 1}
        />
      );
    case 'scene': {
      const SceneComponent = SCENE_MAP[item.data?.sceneFile || ''];
      if (!SceneComponent) return null;
      return <SceneComponent />;
    }
    case 'text':
      return (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: item.data?.fontFamily || 'Inter',
          fontSize: item.data?.fontSize || 48,
          fontWeight: item.data?.fontWeight || 600,
          color: item.data?.color || '#FFFFFF',
          textAlign: item.data?.textAlign || 'center',
          textTransform: item.data?.textTransform || 'none',
        }}>
          {item.data?.text || ''}
        </div>
      );
    case 'image':
      return (
        <Img
          src={staticFile(item.data?.src || '')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      );
    case 'caption':
      return null; // Captions handled separately
    default:
      return null;
  }
}

// Main NLE composition — iterates tracks/items, applies transforms
export const PlayerComposition: React.FC<{
  manifest: any;
  videoUrl?: string;
  audioUrl?: string;
}> = ({ manifest, videoUrl, audioUrl }) => {
  const { fps } = useVideoConfig();

  if (!manifest?.items) return null;

  // Sort tracks by position
  const sortedTracks = [...(manifest.tracks || [])].sort(
    (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
  );
  const trackOrder = new Map(sortedTracks.map((t: any, i: number) => [t.id, i]));

  // Sort items by track order, then by startMs
  const sortedItems = [...manifest.items].sort((a: any, b: any) => {
    const trackDiff = (trackOrder.get(a.trackId) ?? 0) - (trackOrder.get(b.trackId) ?? 0);
    return trackDiff !== 0 ? trackDiff : a.startMs - b.startMs;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {sortedItems.map((item: any) => {
        const startFrame = Math.round((item.startMs / 1000) * fps);
        const endFrame = Math.round((item.endMs / 1000) * fps);
        const durationInFrames = Math.max(1, endFrame - startFrame);

        // Audio items don't need transform wrapper
        if (item.type === 'audio') {
          return (
            <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} layout="none">
              <ItemRenderer item={item} />
            </Sequence>
          );
        }

        // Caption items — skip (handled by caption system)
        if (item.type === 'caption') {
          return null;
        }

        const transform = item.transform || {
          x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1,
        };

        return (
          <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} layout="none">
            <TransformWrapper
              transform={transform}
              keyframes={item.keyframes}
              filters={item.filters}
            >
              <ItemRenderer item={item} />
            </TransformWrapper>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
`;
```

- [ ] **Step 3: Call `generateTransformWrapper` from `spinUpWorkspace`**

In `packages/api/src/workspace/workspace-service.ts`, after the `generatePlayerComposition` call, add:
```typescript
await generateTransformWrapper(projectId);
```

Import the function:
```typescript
import { generatePlayerComposition, generateTransformWrapper, ... } from './workspace-codegen.js';
```

- [ ] **Step 4: Remove FullComposition import from codegen**

In the generated code template, remove:
- `import { FullComposition } from './composition/index';`
- `import { OverlayLayer } from './composition/OverlayLayer';`
- `import type { SceneItem, SubtitleItemData, SubtitleWordData, SubtitleStyle, LayoutSegment } from './composition/types';`

Remove helper functions that are no longer needed:
- `buildLayoutSegments` (lines 171-208)
- `buildSceneItems` (lines 210-242)
- `buildSubtitles` (lines 153-167) — move subtitle rendering to the component if needed
- `renderFullComposition` (lines 281-336)

- [ ] **Step 5: Verify build**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/workspace/workspace-codegen.ts packages/api/src/workspace/workspace-service.ts
git commit -m "feat(codegen): generate NLE-style PlayerComposition with per-item transforms"
```

---

## Chunk 3: Sync and Bridge Cleanup

### Task 5: Verify sandbox sync round-trip

**Files:**
- Read-only verify: `packages/api/src/sandbox/sync.ts`
- Modify if needed: `packages/api/src/workspace/workspace-service.ts`

The sandbox `sync.ts` already stores `_transform`, `_keyframes`, `_filters` in item data (lines 49-54). After Task 1, `dbToManifest()` reads them back. Verify the full cycle works.

- [ ] **Step 1: Add round-trip test for sandbox sync path**

Add to `scripts/temp/test-manifest-roundtrip.ts`:

```typescript
// Test 5: Full cycle — dbToManifest → edit transform → manifestToDb → dbToManifest
function testFullCycle() {
  // Step 1: Initial load (no stored transforms)
  const initialInput: DbToManifestInput = {
    project: {
      fps: 30, durationMs: 10000, sourceWidth: 1920, sourceHeight: 1080,
      videoSettings: { canvasWidth: 1080, canvasHeight: 1920 },
    },
    tracks: [
      { id: 'track-1', type: 'video', name: 'Video', position: 0, locked: false, visible: true },
    ],
    items: [
      { id: 'item-1', trackId: 'track-1', type: 'video', startMs: 0, endMs: 10000,
        data: { src: 'source.mp4', volume: 1 } },
    ],
  };

  const manifest1 = dbToManifest(initialInput);
  const video1 = manifest1.items.find(i => i.type === 'video')!;
  console.assert(video1.transform?.width === '100%', 'Initial: fullscreen width');

  // Step 2: Simulate sandbox edit — user resizes video
  (video1 as any).transform = { x: 0, y: 0, width: '100%', height: '50%', rotation: 0, opacity: 1 };

  // Step 3: Save back to DB format (manifestToDb now stores as _transform)
  const dbResult = manifestToDb(manifest1);
  const savedData = dbResult.items[0]!.data as any;
  console.assert(savedData._transform?.height === '50%', 'DB save: _transform preserved');

  // Step 4: Re-load from DB — transform should survive (dbToManifest reads _transform)
  const reloadInput: DbToManifestInput = {
    project: initialInput.project,
    tracks: initialInput.tracks,
    items: [{
      id: 'item-1', trackId: 'track-1', type: 'video', startMs: 0, endMs: 10000,
      data: savedData, // Already has _transform from manifestToDb
    }],
  };

  const manifest2 = dbToManifest(reloadInput);
  const video2 = manifest2.items.find(i => i.type === 'video')!;
  console.assert(video2.transform?.height === '50%', `Reload: Expected height=50%, got ${video2.transform?.height}`);

  console.log('✅ Test 5 passed: Full DB→manifest→edit→DB→manifest cycle preserves transforms');
}

testFullCycle();
```

- [ ] **Step 2: Run test**

Run: `cd packages/shared && npx tsx ../../scripts/temp/test-manifest-roundtrip.ts`
Expected: All 5 tests pass

- [ ] **Step 3: Verify workspace-service sync path**

In `packages/api/src/workspace/workspace-service.ts`, the `syncManifestToDb` function (line 287) calls `manifestToDb()` then writes to DB. After Task 2, this no longer stores layout settings. Verify the function still works correctly by checking:
- `manifestToDb()` returns tracks, items, videoSettings without layoutSettings
- Items have `data._transform` stored (unified key convention from Task 2)

No code changes needed if sync.ts and workspace-service.ts both use the updated manifestToDb.

- [ ] **Step 4: Commit**

```bash
git add scripts/temp/test-manifest-roundtrip.ts
git commit -m "test: add full-cycle round-trip test for NLE manifest transforms"
```

---

### Task 6: Clean up manifest-bridge.ts

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts`

- [ ] **Step 1: Remove V2 hardcoded stacked layout default**

In `manifestToStore()` (line 155), the V2 path hardcodes `mode: 'stacked'`. Change to default to no layout mode:

```typescript
// Before:
layoutSettings: { mode: 'stacked' } as any,

// After:
layoutSettings: {} as any,
```

This prevents the editor from assuming stacked mode for V2 manifests.

- [ ] **Step 2: Remove `convertManifestLayout` if unused for V2**

Check if `convertManifestLayout` (line 811) is still called for V2 manifests. If it's only used for V1, it can stay as backward compat. If V2 path calls it, remove the call.

- [ ] **Step 3: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/store/manifest-bridge.ts
git commit -m "refactor(bridge): remove hardcoded stacked layout default for V2 manifests"
```

---

### Task 7: Remove debug logging

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts:103`

- [ ] **Step 1: Remove staticFile debug log**

Remove line 103:
```typescript
console.debug('[staticFile shim]', relativePath, '->', resolved);
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts
git commit -m "chore: remove staticFile debug logging"
```

---

## Chunk 4: Integration Verification

### Task 8: End-to-end verification

- [ ] **Step 1: Type-check all packages**

Run: `cd C:\Users\armaa\Documents\cllipify && pnpm run build` (or `pnpm tsc` across packages)
Expected: No type errors across packages

- [ ] **Step 2: Test with existing project**

1. Start the API and web app
2. Open an existing project in the editor
3. Verify video renders fullscreen (not stacked 50/50)
4. Verify transform edits in sandbox persist through page refresh

- [ ] **Step 3: Test new project**

1. Create a new project with video upload
2. Verify manifest has explicit fullscreen transform on video item
3. Verify no layout mode in videoSettings

- [ ] **Step 4: Verify sandbox sync**

1. With a sandbox running, make transform edits
2. Tear down sandbox (or let it idle timeout)
3. Re-open project — verify edits survived DB round-trip
