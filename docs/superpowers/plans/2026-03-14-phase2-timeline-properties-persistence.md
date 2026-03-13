# Phase 2: Timeline UI, Properties Panel, and Persistence — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor fully functional with v2 manifests — visual editing via timeline and properties panel, all changes persisting to DB in real-time via sandbox.

**Architecture:** Store types gain `transform`, `keyframes`, `filters` fields. A new `POST /ops` sandbox endpoint exposes granular manifest tools over HTTP. Store actions dispatch ops through an API proxy to the sandbox. Sandbox notifies the API on every manifest write; the API debounces and syncs to DB. The timeline canvas routes by item type (not track type) for v2, and a new properties panel + keyframe editor lives in the right panel.

**Tech Stack:** TypeScript, React, Zustand (immer), Fastify, Express (sandbox), Zod, Remotion, Canvas API

**Spec:** `docs/superpowers/specs/2026-03-14-phase2-timeline-ui-design.md`

---

## File Structure

### New Files

```
packages/sandbox/src/ops-endpoint.ts         — POST /ops route handler (routes tool name → tool.execute)
packages/api/src/sandbox/sync.ts              — syncManifestToDb() with debounce
packages/api/src/sandbox/proxy.ts             — add proxyOps() alongside existing proxyManifestOp()
apps/web/src/features/editor-v2/
  store/manifest-dispatch.ts                  — dispatchToSandbox() helper
  components/properties/
    PropertiesPanel.tsx                        — container with tabs
    TransformTab.tsx                           — position, size, rotation, opacity controls
    FiltersTab.tsx                             — filter sliders
    DataTab.tsx                                — type-specific property editors
    NumberInput.tsx                            — drag-to-adjust numeric input component
    KeyframeToggle.tsx                         — diamond toggle per property row
  components/keyframe-editor/
    KeyframeEditor.tsx                         — main container
    MiniTimeline.tsx                           — horizontal bar with diamonds + playhead
    PropertyLane.tsx                           — per-property keyframe lane
    CurveEditor.tsx                            — bezier curve visualization + presets
    KeyframeList.tsx                           — tabular keyframe list
```

### Modified Files

```
packages/shared/src/manifest-v2.ts            — extend easing schema for cubic-bezier
apps/web/src/features/editor-v2/
  store/types.ts                               — add Transform, Keyframe, Filters, ShapeItemData, scene/shape types
  store/editor-store.ts                        — wire all 22+ actions to sandbox dispatch
  store/manifest-bridge.ts                     — v2 manifestToStore + new storeToManifest
  components/RightPanel.tsx                    — add Properties tab
  timeline/canvas/CanvasRenderer.ts            — route by item type
  timeline/canvas/renderers/BaseRenderer.ts    — transform/keyframe/filter indicators
  timeline/context-menu/ContextMenu.tsx        — add v2 menu items
packages/sandbox/src/agent-server.ts           — mount /ops endpoint
packages/api/src/sandbox/routes.ts             — add /ops proxy route, update manifest-updated handler
packages/sandbox/template/src/composition/TransformWrapper.tsx — cubic-bezier easing
```

---

## Chunk 1: Foundation (Store Types + Manifest Bridge + Backend Plumbing)

### Task 1: Add v2 types to editor store

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`

- [ ] **Step 1: Add Transform, Keyframe, Filters, ShapeItemData interfaces**

In `apps/web/src/features/editor-v2/store/types.ts`, after the existing `TimelineItemType` (line 10):

```typescript
// After line 10 (TimelineItemType)
export type TimelineItemType = 'video' | 'audio' | 'caption' | 'text' | 'image' | 'visual' | 'broll' | 'scene' | 'shape';

// New v2 types — add after TimelineItem interface (after line 25)
export interface Transform {
  x: number | string;
  y: number | string;
  width: number | string;
  height: number | string;
  rotation: number;
  opacity: number;
}

export interface Keyframe {
  timeMs: number;
  props: Partial<Transform>;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring' | `cubic-bezier(${string})`;
}

export interface Filters {
  brightness?: number;   // 0–2, default 1
  contrast?: number;     // 0–2, default 1
  saturation?: number;   // 0–2, default 1
  blur?: number;         // 0–50px, default 0
  hue?: number;          // -180–180°, default 0
  grayscale?: number;    // 0–1, default 0
  sepia?: number;        // 0–1, default 0
}

export interface ShapeItemData {
  shape: 'rectangle' | 'circle' | 'line';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
}
```

- [ ] **Step 2: Add optional v2 fields to TimelineItem**

In the `TimelineItem` interface (line 12), add after `data`:

```typescript
export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  trackId: string;
  startMs: number;
  endMs: number;
  trim?: {
    startMs: number;
    endMs: number;
  };
  data: VideoItemData | AudioItemData | CaptionItemData | TextItemData | ImageItemData | VisualItemData | BrollItemData | ShapeItemData;
  // v2 fields
  transform?: Transform;
  keyframes?: Keyframe[];
  filters?: Filters;
}
```

- [ ] **Step 3: Add `overlay` and `shape` to TrackType**

Update `TrackType` (line 447) — `overlay` already exists, but verify:

```typescript
export type TrackType = 'video' | 'audio' | 'caption' | 'text' | 'overlay' | 'visual';
```

No change needed — `overlay` is already there.

- [ ] **Step 4: Add `assets` field to editor store state**

In `editor-store.ts`, in the state interface (around line 218), add:

```typescript
assets: Record<string, string>;  // asset key → presigned URL
```

Initialize as `{}` in the default state.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | head -30`
Expected: No new errors (existing errors may exist)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat(editor): add v2 types — Transform, Keyframe, Filters, ShapeItemData, scene/shape"
```

---

### Task 2: Extend easing schema for cubic-bezier

**Files:**
- Modify: `packages/shared/src/manifest-v2.ts`
- Modify: `packages/sandbox/template/src/composition/TransformWrapper.tsx`

- [ ] **Step 1: Update easing schema in manifest-v2.ts**

Find the `keyframeSchema` (around line 15). Change the easing field from strict enum to union:

```typescript
// Before
easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']).default('linear'),

// After
easing: z.union([
  z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']),
  z.string().regex(/^cubic-bezier\(\s*[\d.]+\s*,\s*[\d.-]+\s*,\s*[\d.]+\s*,\s*[\d.-]+\s*\)$/),
]).default('linear'),
```

- [ ] **Step 2: Add cubic-bezier parsing to TransformWrapper.tsx**

In `packages/sandbox/template/src/composition/TransformWrapper.tsx`, update the `getEasingFn` function (line 38):

```typescript
function getEasingFn(easing?: string): ((t: number) => number) | undefined {
  if (!easing) return undefined;
  // Custom cubic-bezier
  if (easing.startsWith('cubic-bezier(')) {
    const match = easing.match(/cubic-bezier\(([\d.]+),\s*([\d.-]+),\s*([\d.]+),\s*([\d.-]+)\)/);
    if (match) {
      const [, x1, y1, x2, y2] = match.map(Number);
      return Easing.bezier(x1, y1, x2, y2);
    }
  }
  switch (easing) {
    case 'linear':
      return Easing.linear;
    case 'ease-in':
      return Easing.in(Easing.ease);
    case 'ease-out':
      return Easing.out(Easing.ease);
    case 'ease-in-out':
      return Easing.inOut(Easing.ease);
    case 'spring':
      return Easing.out(Easing.ease);
    default:
      return undefined;
  }
}
```

Also update the `Keyframe` interface `easing` field at line 16 to accept string:

```typescript
easing?: string;  // was: 'linear' | 'ease-in' | ...
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/manifest-v2.ts packages/sandbox/template/src/composition/TransformWrapper.tsx
git commit -m "feat(shared): extend easing schema to support cubic-bezier curves"
```

---

### Task 3: Update manifest-bridge for v2

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts`

- [ ] **Step 1: Add v2 manifest detection + v2 type imports**

At the top of `manifest-bridge.ts`, add imports for v2 types:

```typescript
import type {
  Transform,
  Keyframe,
  Filters,
  ShapeItemData as StoreShapeItemData,
} from './types';
```

- [ ] **Step 2: Update ManifestToStoreContext for v2**

Make `videoUrl` optional, add `assets`:

```typescript
export interface ManifestToStoreContext {
  videoUrl?: string;  // optional for v2 (resolved from assets)
  bundleUrl: string;
  compositionId: string;
  visualMeta?: Record<string, { bundleUrl?: string; compositionId?: string }>;
  assets?: Record<string, string>;  // v2 asset key → presigned URL
}
```

- [ ] **Step 3: Update manifestToStore() to detect and handle v2**

Add version detection at the start of `manifestToStore()`:

```typescript
export function manifestToStore(
  manifest: any,  // Accept any — could be v1 or v2
  context: ManifestToStoreContext,
): ManifestToStoreResult {
  const isV2 = manifest.version === 2 || manifest.items?.some((i: any) => i.transform);

  const tracks = manifest.tracks.map<Track>((t: any) => ({
    id: t.id,
    type: isV2
      ? (t.type === 'overlay' ? 'overlay' : t.type as Track['type'])
      : (t.type === 'broll' ? 'overlay' : t.type as Track['type']),
    name: t.name,
    position: t.position,
    locked: false,
    visible: true,
    height: 48,
    collapsed: false,
  }));

  // ... rest of conversion with v2-aware item conversion
```

- [ ] **Step 4: Add v2-aware item conversion**

Update `convertManifestItem()` to handle v2 fields:

```typescript
function convertManifestItem(
  item: any,
  context: ManifestToStoreContext,
  captionStyle: CaptionStyle,
  isV2: boolean,
): TimelineItem {
  const resolvedSrc = (key: string) => {
    if (!key) return context.videoUrl ?? '';
    return context.assets?.[key] ?? key;
  };

  const base: any = {
    id: item.id,
    type: item.type as TimelineItem['type'],
    trackId: item.trackId,
    startMs: item.startMs,
    endMs: item.endMs,
  };

  // Attach v2 fields if present
  if (item.transform) base.transform = item.transform;
  if (item.keyframes?.length) base.keyframes = item.keyframes;
  if (item.filters) base.filters = item.filters;

  switch (item.type) {
    case 'video': {
      const d = item.data as any;
      base.data = {
        src: isV2 ? resolvedSrc(d.src) : context.videoUrl!,
        width: 1920,
        height: 1080,
        volume: d.volume ?? 1,
        playbackRate: d.playbackRate ?? 1,
      };
      return base;
    }

    case 'scene': {
      // v2 scene items — similar to visual but simpler
      const d = item.data as any;
      base.data = {
        visualId: item.id,
        compositionId: context.compositionId,
        bundleUrl: context.bundleUrl,
        videoUrl: context.videoUrl ?? '',
        type: 'visual',
        description: '',
        width: 1920,
        height: 1080,
        fps: 30,
        sourceSceneId: undefined,
        displayMode: 'default',
        sceneFile: d.sceneFile,
      };
      return base;
    }

    case 'shape': {
      const d = item.data as any;
      base.data = {
        shape: d.shape ?? 'rectangle',
        fill: d.fill,
        stroke: d.stroke,
        strokeWidth: d.strokeWidth,
        borderRadius: d.borderRadius,
      } as StoreShapeItemData;
      return base;
    }

    // ... keep existing cases for audio, caption, visual, broll, text, image
    // (pass resolvedSrc for v2 audio/broll src fields)
  }
}
```

- [ ] **Step 5: Handle v2 layoutSettings and videoSettings defaults**

In `manifestToStore()`, after track/item conversion:

```typescript
  const videoSettings: VideoSettings = isV2
    ? {
        canvasWidth: manifest.canvas.width,
        canvasHeight: manifest.canvas.height,
        cropX: 50, cropY: 50, scale: 1,  // defaults — v2 uses per-item crop
      }
    : {
        canvasWidth: manifest.canvas.width,
        canvasHeight: manifest.canvas.height,
        cropX: manifest.videoSettings.cropX,
        cropY: manifest.videoSettings.cropY,
        scale: manifest.videoSettings.scale,
      };

  const layoutSettings = isV2
    ? {
        mode: 'stacked' as const,
        pip: DEFAULT_PIP_SETTINGS,
        split: DEFAULT_SPLIT_SETTINGS,
      }
    : convertManifestLayout(manifest.layout);
```

- [ ] **Step 6: Add storeToManifest() function**

New export at the bottom of the file:

```typescript
export function storeToManifest(
  tracks: Track[],
  items: Record<string, TimelineItem>,
  itemIds: string[],
  duration: number,
  fps: number,
  canvas: { width: number; height: number },
  assets: Record<string, string>,
  captionStyle: CaptionStyle,
): any {
  return {
    version: 2,
    fps,
    durationMs: duration,
    canvas,
    tracks: tracks.map((t) => ({
      id: t.id,
      type: t.type === 'visual' ? 'overlay' : t.type,
      name: t.name,
      position: t.position,
    })),
    items: itemIds.map((id) => {
      const item = items[id];
      const out: any = {
        id: item.id,
        type: item.type === 'visual' ? 'scene' : item.type === 'broll' ? 'video' : item.type,
        trackId: item.trackId,
        startMs: item.startMs,
        endMs: item.endMs,
        data: convertStoreItemData(item),
      };
      if (item.transform) out.transform = item.transform;
      if (item.keyframes?.length) out.keyframes = item.keyframes;
      if (item.filters) out.filters = item.filters;
      return out;
    }),
    assets,
    captionStyle: convertStoreCaptionStyle(captionStyle),
  };
}

function convertStoreItemData(item: TimelineItem): any {
  switch (item.type) {
    case 'video': {
      const d = item.data as VideoItemData;
      return { src: d.src, volume: d.volume, playbackRate: d.playbackRate };
    }
    case 'audio': {
      const d = item.data as AudioItemData;
      return { src: d.src, volume: d.volume };
    }
    case 'caption': {
      const d = item.data as CaptionItemData;
      return {
        words: d.words.map((w) => ({
          text: w.text,
          startMs: w.startMs + item.startMs,  // relative → absolute
          endMs: w.endMs + item.startMs,
        })),
      };
    }
    case 'text': {
      const d = item.data as TextItemData;
      return { text: d.text, style: d.style };
    }
    case 'image': {
      const d = item.data as ImageItemData;
      return { src: d.src };
    }
    case 'visual':
    case 'scene': {
      const d = item.data as VisualItemData;
      return { sceneFile: d.sourceSceneId ? `scenes/Scene${d.sourceSceneId}.tsx` : (d as any).sceneFile ?? '' };
    }
    case 'shape': {
      return item.data;
    }
    case 'broll': {
      const d = item.data as BrollItemData;
      return { src: d.src, volume: d.volume, sourceType: d.sourceType };
    }
    default:
      return item.data;
  }
}

function convertStoreCaptionStyle(style: CaptionStyle): any {
  // Reuse existing structure — minimal conversion
  return {
    displayMode: style.displayMode,
    wordsPerPhrase: style.wordsPerPhrase,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    color: style.color,
    activeColor: style.activeColor,
    backgroundColor: style.backgroundColor,
    activeBackgroundColor: style.activeBackgroundColor,
    animation: style.animation,
    position: style.position,
  };
}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | head -30`

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/editor-v2/store/manifest-bridge.ts
git commit -m "feat(editor): v2 manifest bridge — manifestToStore v2 detection + storeToManifest"
```

---

### Task 4: Add POST /ops endpoint to sandbox agent-server

**Files:**
- Create: `packages/sandbox/src/ops-endpoint.ts`
- Modify: `packages/sandbox/src/agent-server.ts`

- [ ] **Step 1: Create ops-endpoint.ts**

Create `packages/sandbox/src/ops-endpoint.ts`:

```typescript
import type { Express, Request, Response } from 'express';
import {
  addTrackTool,
  updateTrackTool,
  removeTrackTool,
  addItemTool,
  updateItemTool,
  removeItemTool,
  splitVideoTool,
} from './tools/manifest-ops.js';

const toolMap: Record<string, { execute: (input: any) => Promise<string> }> = {
  addTrack: addTrackTool,
  updateTrack: updateTrackTool,
  removeTrack: removeTrackTool,
  addItem: addItemTool,
  updateItem: updateItemTool,
  removeItem: removeItemTool,
  splitVideo: splitVideoTool,
};

export function mountOpsEndpoint(app: Express): void {
  app.post('/ops', async (req: Request, res: Response) => {
    const { tool, input } = req.body;

    if (!tool || typeof tool !== 'string') {
      res.status(400).json({ ok: false, error: 'tool is required' });
      return;
    }

    const t = toolMap[tool];
    if (!t) {
      res.status(400).json({ ok: false, error: `Unknown tool: ${tool}` });
      return;
    }

    const resultStr = await t.execute(input ?? {});

    // Tools return strings — JSON on success, plain text on error
    try {
      const parsed = JSON.parse(resultStr);
      res.json({ ok: true, result: parsed });
    } catch {
      res.status(400).json({ ok: false, error: resultStr });
    }
  });
}
```

- [ ] **Step 2: Mount in agent-server.ts**

In `packages/sandbox/src/agent-server.ts`, import and mount after `app.use(authMiddleware)` (after line 75):

```typescript
import { mountOpsEndpoint } from './ops-endpoint.js';

// After app.use(authMiddleware) and before other routes:
mountOpsEndpoint(app);
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/ops-endpoint.ts packages/sandbox/src/agent-server.ts
git commit -m "feat(sandbox): add POST /ops endpoint for granular manifest operations"
```

---

### Task 5: Add API proxy for /ops endpoint

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts`
- Modify: `packages/api/src/sandbox/routes.ts`

- [ ] **Step 1: Add proxyOps() to proxy.ts**

In `packages/api/src/sandbox/proxy.ts`, add after `proxyManifestOp()`:

```typescript
/**
 * Forward a granular manifest operation to the sandbox.
 */
export async function proxyOps(
  agentUrl: string,
  secret: string,
  body: { tool: string; input: object },
): Promise<{ status: number; data: any }> {
  const url = `${agentUrl}/ops`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  return { status: res.status, data: await res.json() };
}
```

- [ ] **Step 2: Add /ops route to routes.ts**

In `packages/api/src/sandbox/routes.ts`, add after the PATCH /manifest route (after line 272):

```typescript
  // POST /projects/:id/sandbox/ops — Granular manifest operations
  fastify.post('/projects/:id/sandbox/ops', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };
    touchActivity(projectId);

    const session = await getActiveSession(projectId);
    if (!session) return reply.status(404).send({ error: 'No active sandbox' });

    const agentUrl = (session.metadata as any)?.agentUrl;
    if (!agentUrl) return reply.status(500).send({ error: 'Agent URL not found in session' });

    const result = await proxyOps(agentUrl, session.sandboxSecret, request.body as any);
    return reply.status(result.status).send(result.data);
  });
```

Import `proxyOps` from `'./proxy.js'` at the top.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/sandbox/proxy.ts packages/api/src/sandbox/routes.ts
git commit -m "feat(api): add /ops proxy route for granular sandbox manifest operations"
```

---

### Task 6: Create manifest-dispatch.ts

**Files:**
- Create: `apps/web/src/features/editor-v2/store/manifest-dispatch.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add sandboxOps API method**

In `apps/web/src/lib/api.ts`, add alongside `applyManifestOp`:

```typescript
  /** Send a granular manifest op to the sandbox */
  async sandboxOps(projectId: string, tool: string, input: object): Promise<any> {
    return this.request(`/api/projects/${projectId}/sandbox/ops`, {
      method: 'POST',
      body: JSON.stringify({ tool, input }),
    });
  }
```

- [ ] **Step 2: Create manifest-dispatch.ts**

Create `apps/web/src/features/editor-v2/store/manifest-dispatch.ts`:

```typescript
import { api } from '@/lib/api';

export interface SandboxOp {
  tool: 'addTrack' | 'updateTrack' | 'removeTrack' | 'addItem' | 'updateItem' | 'removeItem' | 'splitVideo';
  input: Record<string, unknown>;
}

/**
 * Dispatch one or more granular manifest operations to the sandbox.
 * Fire-and-forget — errors are logged but not thrown.
 * For batch ops, sends sequentially (sandbox mutex handles serialization).
 */
export async function dispatchToSandbox(
  projectId: string,
  ops: SandboxOp[],
): Promise<void> {
  for (const op of ops) {
    try {
      const result = await api.sandboxOps(projectId, op.tool, op.input);
      if (!result.ok) {
        console.error(`Sandbox op failed: ${op.tool}`, result.error);
      }
    } catch (err) {
      console.error(`Sandbox dispatch error: ${op.tool}`, err);
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/manifest-dispatch.ts apps/web/src/lib/api.ts
git commit -m "feat(editor): add manifest-dispatch.ts — dispatchToSandbox helper for granular ops"
```

---

### Task 7: Wire store actions to sandbox dispatch

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

This is the largest task — wiring 22+ actions. The pattern is consistent: after the optimistic `set()` call, fire-and-forget `dispatchToSandbox()`.

- [ ] **Step 1: Import dispatchToSandbox**

At the top of `editor-store.ts`:

```typescript
import { dispatchToSandbox, type SandboxOp } from './manifest-dispatch';
```

- [ ] **Step 2: Create dispatch helper inside the store**

Add a helper near the top of the store creation (after `dispatchManifestOp`, around line 82):

```typescript
const dispatchOps = (ops: SandboxOp[]) => {
  const state = useEditorStore.getState();
  if (state.workspaceStatus !== 'active' || !state.project) return;
  dispatchToSandbox(state.project.id, ops);
};
```

- [ ] **Step 3: Wire moveItem (line ~1366)**

After the existing `set()` and `pushHistory()` calls, add:

```typescript
dispatchOps([{
  tool: 'updateItem',
  input: { itemId: id, trackId, startMs, endMs: startMs + duration },
}]);
```

Where `duration = item.endMs - item.startMs` (calculated before the set).

- [ ] **Step 4: Wire resizeItem (line ~1381)**

After `set()`:

```typescript
dispatchOps([{
  tool: 'updateItem',
  input: { itemId: id, startMs, endMs },
}]);
```

- [ ] **Step 5: Wire updateItem (line ~1238)**

After `set()`:

```typescript
const sandboxUpdates: Record<string, unknown> = {};
if (updates.startMs !== undefined) sandboxUpdates.startMs = updates.startMs;
if (updates.endMs !== undefined) sandboxUpdates.endMs = updates.endMs;
if (updates.trackId !== undefined) sandboxUpdates.trackId = updates.trackId;
if (Object.keys(sandboxUpdates).length > 0) {
  dispatchOps([{ tool: 'updateItem', input: { itemId: id, ...sandboxUpdates } }]);
}
```

- [ ] **Step 6: Wire updateItemData (line ~1249)**

After `set()`:

```typescript
dispatchOps([{
  tool: 'updateItem',
  input: { itemId: id, data: dataUpdates },
}]);
```

- [ ] **Step 7: Wire addItem (line ~1214)**

After `set()`, using the generated ID:

```typescript
const item = get().items[newId];
if (item) {
  dispatchOps([{
    tool: 'addItem',
    input: {
      type: item.type,
      trackId: item.trackId,
      startMs: item.startMs,
      endMs: item.endMs,
      data: item.data,
      ...(item.transform ? { transform: item.transform } : {}),
      ...(item.keyframes?.length ? { keyframes: item.keyframes } : {}),
      ...(item.filters ? { filters: item.filters } : {}),
    },
  }]);
}
```

**Note:** The sandbox generates its own ID, but both IDs will reconcile on the next `manifest:updated` event. This is acceptable for optimistic updates.

- [ ] **Step 8: Wire deleteItems (line ~1260)**

After `set()`:

```typescript
dispatchOps(ids.map((id) => ({ tool: 'removeItem' as const, input: { itemId: id } })));
```

- [ ] **Step 9: Wire addTrack (line ~1629)**

After `set()`:

```typescript
dispatchOps([{
  tool: 'addTrack',
  input: { type: track.type, name: track.name },
}]);
```

- [ ] **Step 10: Wire updateTrack (line ~1652)**

After `set()`:

```typescript
dispatchOps([{
  tool: 'updateTrack',
  input: { trackId: id, ...updates },
}]);
```

- [ ] **Step 11: Wire deleteTrack (line ~1663)**

After `set()`:

```typescript
dispatchOps([{ tool: 'removeTrack', input: { trackId: id } }]);
```

- [ ] **Step 12: Wire reorderTracks (line ~1701)**

After `set()`:

```typescript
dispatchOps(trackIds.map((id, i) => ({
  tool: 'updateTrack' as const,
  input: { trackId: id, position: i },
})));
```

- [ ] **Step 13: Wire nudgeItems (line ~2131)**

After `set()`:

```typescript
dispatchOps(ids.map((id) => {
  const item = get().items[id];
  return item ? { tool: 'updateItem' as const, input: { itemId: id, startMs: item.startMs, endMs: item.endMs } } : null;
}).filter(Boolean) as SandboxOp[]);
```

- [ ] **Step 14: Wire trimItems (line ~2152)**

After `set()`:

```typescript
dispatchOps(ids.map((id) => {
  const item = get().items[id];
  return item ? { tool: 'updateItem' as const, input: { itemId: id, startMs: item.startMs, endMs: item.endMs } } : null;
}).filter(Boolean) as SandboxOp[]);
```

- [ ] **Step 15: Wire pasteItems (line ~2074)**

After the loop that creates cloned items, dispatch an `addItem` per item. Similar to Step 7.

- [ ] **Step 16: Wire duplicateItems (line ~2100)**

After the loop that creates cloned items, dispatch an `addItem` per item. Similar to Step 7.

- [ ] **Step 17: Wire splitItem (line ~1829)**

After `set()`:

```typescript
const item = get().items[itemId];
if (item?.type === 'video') {
  dispatchOps([{ tool: 'splitVideo', input: { itemId, atMs } }]);
} else {
  // Non-video: remove original + add two halves
  dispatchOps([
    { tool: 'removeItem', input: { itemId } },
    { tool: 'addItem', input: { /* left half */ } },
    { tool: 'addItem', input: { /* right half */ } },
  ]);
}
```

- [ ] **Step 18: Wire caption mutations**

For `updateSelectedCaptionStyles` (line ~1139), `updateWordStyleOverrides` (line ~1155), `splitCaption` (line ~2175), `mergeCaptions` (line ~2240), `updateCaptionText` (line ~2297):

Each follows the same pattern — after `set()`, dispatch `updateItem` or `removeItem`+`addItem` ops as appropriate. Use `convertStoreItemData` logic for caption data conversion (relative → absolute timestamps).

- [ ] **Step 19: Add new v2 actions: updateTransform, updateFilters, updateKeyframes, addKeyframeAtTime, deleteKeyframe, updateKeyframeEasing**

```typescript
updateTransform: (itemId: string, transform: Partial<Transform>) => {
  set(produce((draft) => {
    const item = draft.items[itemId];
    if (!item) return;
    item.transform = { ...(item.transform ?? { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 }), ...transform };
  }));
  pushHistory();
  dispatchOps([{ tool: 'updateItem', input: { itemId, transform } }]);
},

updateFilters: (itemId: string, filters: Partial<Filters>) => {
  set(produce((draft) => {
    const item = draft.items[itemId];
    if (!item) return;
    item.filters = { ...(item.filters ?? {}), ...filters };
  }));
  pushHistory();
  dispatchOps([{ tool: 'updateItem', input: { itemId, filters } }]);
},

updateKeyframes: (itemId: string, keyframes: Keyframe[]) => {
  set(produce((draft) => {
    const item = draft.items[itemId];
    if (!item) return;
    item.keyframes = keyframes;
  }));
  pushHistory();
  dispatchOps([{ tool: 'updateItem', input: { itemId, keyframes } }]);
},

addKeyframeAtTime: (itemId: string, timeMs: number, props: Partial<Transform>, easing?: string) => {
  set(produce((draft) => {
    const item = draft.items[itemId];
    if (!item) return;
    const kf: Keyframe = { timeMs, props, easing: easing ?? 'linear' };
    item.keyframes = [...(item.keyframes ?? []), kf].sort((a, b) => a.timeMs - b.timeMs);
  }));
  pushHistory();
  const item = get().items[itemId];
  if (item) dispatchOps([{ tool: 'updateItem', input: { itemId, keyframes: item.keyframes } }]);
},

deleteKeyframe: (itemId: string, index: number) => {
  set(produce((draft) => {
    const item = draft.items[itemId];
    if (!item?.keyframes) return;
    item.keyframes.splice(index, 1);
  }));
  pushHistory();
  const item = get().items[itemId];
  if (item) dispatchOps([{ tool: 'updateItem', input: { itemId, keyframes: item.keyframes ?? [] } }]);
},

updateKeyframeEasing: (itemId: string, index: number, easing: string) => {
  set(produce((draft) => {
    const item = draft.items[itemId];
    if (!item?.keyframes?.[index]) return;
    item.keyframes[index].easing = easing;
  }));
  pushHistory();
  const item = get().items[itemId];
  if (item) dispatchOps([{ tool: 'updateItem', input: { itemId, keyframes: item.keyframes } }]);
},
```

- [ ] **Step 20: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | head -30`

- [ ] **Step 21: Commit**

```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat(editor): wire all 22+ store actions to sandbox dispatch via POST /ops"
```

---

### Task 8: Add DB persistence — syncManifestToDb

**Files:**
- Create: `packages/api/src/sandbox/sync.ts`
- Modify: `packages/api/src/sandbox/routes.ts`

- [ ] **Step 1: Create sync.ts**

Create `packages/api/src/sandbox/sync.ts`:

```typescript
import { db, tracks as tracksTable, timelineItems, projects } from '../db/index.js';
import { eq, notInArray } from 'drizzle-orm';
import { logger } from '../logger.js';

/**
 * Sync a v2 manifest to the database.
 * Upserts tracks and items, removes orphans, updates project metadata.
 * Runs in a single transaction.
 */
export async function syncManifestToDb(
  projectId: string,
  manifest: any,
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Upsert tracks
    const manifestTrackIds = (manifest.tracks ?? []).map((t: any) => t.id);
    for (const track of manifest.tracks ?? []) {
      await tx
        .insert(tracksTable)
        .values({
          id: track.id,
          projectId,
          type: track.type,
          name: track.name,
          position: track.position,
        })
        .onConflictDoUpdate({
          target: tracksTable.id,
          set: { type: track.type, name: track.name, position: track.position },
        });
    }
    // Remove tracks not in manifest
    if (manifestTrackIds.length > 0) {
      await tx.delete(tracksTable)
        .where(eq(tracksTable.projectId, projectId))
        .where(notInArray(tracksTable.id, manifestTrackIds));
    }

    // 2. Upsert items
    const manifestItemIds = (manifest.items ?? []).map((i: any) => i.id);
    for (const item of manifest.items ?? []) {
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
          projectId,
          trackId: item.trackId,
          type: item.type,
          startMs: item.startMs,
          endMs: item.endMs,
          data,
        })
        .onConflictDoUpdate({
          target: timelineItems.id,
          set: {
            trackId: item.trackId,
            type: item.type,
            startMs: item.startMs,
            endMs: item.endMs,
            data,
          },
        });
    }
    // Remove items not in manifest
    if (manifestItemIds.length > 0) {
      await tx.delete(timelineItems)
        .where(eq(timelineItems.projectId, projectId))
        .where(notInArray(timelineItems.id, manifestItemIds));
    }

    // 3. Update project metadata
    await tx
      .update(projects)
      .set({
        durationMs: manifest.durationMs,
        fps: manifest.fps,
      })
      .where(eq(projects.id, projectId));
  });
}
```

**Note:** The exact Drizzle column names and table schemas may vary. The implementer should check `packages/api/src/db/schema.ts` for exact column names and adjust. The `.onConflictDoUpdate()` pattern is the Drizzle upsert idiom.

- [ ] **Step 2: Add debounced sync to manifest-updated handler**

In `packages/api/src/sandbox/routes.ts`, update the `POST /internal/sandbox/:id/manifest-updated` handler:

```typescript
import { syncManifestToDb } from './sync.js';
import { proxyOps, proxyManifestOp } from './proxy.js';

// Debounce map: projectId → timer
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SYNC_DEBOUNCE_MS = 2000;

function debouncedSync(projectId: string, agentUrl: string, secret: string): void {
  const existing = syncTimers.get(projectId);
  if (existing) clearTimeout(existing);

  syncTimers.set(projectId, setTimeout(async () => {
    syncTimers.delete(projectId);
    try {
      const result = await proxyManifestOp(agentUrl, secret, 'GET');
      if (result.status === 200) {
        await syncManifestToDb(projectId, result.data);
        logger.debug({ projectId }, 'Manifest synced to DB');
      }
    } catch (err) {
      logger.error({ err, projectId }, 'Failed to sync manifest to DB');
    }
  }, SYNC_DEBOUNCE_MS));
}
```

Then update the handler to call `debouncedSync`:

```typescript
  fastify.post('/internal/sandbox/:id/manifest-updated', async (request, reply) => {
    const projectId = await validateInternalCallback(request, reply);
    if (!projectId) return;

    // Get session for agent URL
    const session = await getActiveSession(projectId);
    if (session) {
      const agentUrl = (session.metadata as any)?.agentUrl;
      if (agentUrl) {
        debouncedSync(projectId, agentUrl, session.sandboxSecret);
      }
    }

    await emitManifestUpdated(projectId, { source: 'ai' });
    return { ok: true };
  });
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/sandbox/sync.ts packages/api/src/sandbox/routes.ts
git commit -m "feat(api): add debounced syncManifestToDb — manifest changes persist to DB"
```

---

## Chunk 2: Timeline UI + Properties Panel + Keyframe Editor

### Task 9: Timeline canvas — route by item type

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/CanvasRenderer.ts`

- [ ] **Step 1: Update renderer selection to use item.type**

In `CanvasRenderer.ts`, find where the renderer is selected based on track type. Change to select based on `item.type`:

```typescript
function getRendererForItem(item: TimelineItem): ItemRenderer {
  switch (item.type) {
    case 'video':
      return videoRenderer;
    case 'audio':
      return audioRenderer;
    case 'caption':
      return captionRenderer;
    case 'visual':
    case 'scene':
      return visualRenderer;
    case 'text':
      return textRenderer;
    case 'image':
      return imageRenderer;  // create if needed, or reuse visual
    case 'broll':
      return brollRenderer;
    case 'shape':
      return shapeRenderer;  // create minimal renderer
    default:
      return defaultRenderer;
  }
}
```

The implementer should read the existing `CanvasRenderer.ts` to understand the current pattern and match it. This step is about changing the routing logic, not creating new renderers.

- [ ] **Step 2: Update CanvasRendererOptions.itemColors type + defaults**

The existing `CanvasRendererOptions.itemColors` type (around line 46 of `CanvasRenderer.ts`) only has `video|audio|caption|text|image|visual|broll`. Add `scene` and `shape` to this type interface AND to the default color values wherever they're defined:

```typescript
// In the itemColors type/defaults, add:
scene: '#6366f1',   // same as visual
shape: '#ec4899',
```

Also check `BaseRenderer.ts` for any `ITEM_COLORS` map and add the same entries there. Follow the existing pattern — don't introduce a new standalone constant.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/
git commit -m "feat(timeline): route canvas renderers by item type for v2 compatibility"
```

---

### Task 10: Add v2 visual indicators to timeline items

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/canvas/renderers/` (BaseRenderer or shared render function)

- [ ] **Step 1: Add transform badge**

In the base rendering function (shared across all renderers), after drawing the item rectangle, check for non-default transform:

```typescript
// Draw transform badge (top-left) if transform differs from defaults
if (item.transform) {
  const t = item.transform;
  const hasCustomTransform = t.x !== 0 || t.y !== 0 ||
    t.width !== '100%' || t.height !== '100%' ||
    t.rotation !== 0 || t.opacity !== 1;
  if (hasCustomTransform) {
    // Draw small move-arrows icon at top-left
    ctx.fillStyle = '#60a5fa';
    ctx.font = '10px sans-serif';
    ctx.fillText('⊞', x + 4, y + 12);
  }
}
```

- [ ] **Step 2: Add filter badge**

```typescript
// Draw filter badge (top-right) if any filter is non-default
if (item.filters) {
  const f = item.filters;
  const hasFilters = (f.brightness !== undefined && f.brightness !== 1) ||
    (f.contrast !== undefined && f.contrast !== 1) ||
    (f.saturation !== undefined && f.saturation !== 1) ||
    (f.blur !== undefined && f.blur !== 0) ||
    (f.hue !== undefined && f.hue !== 0) ||
    (f.grayscale !== undefined && f.grayscale !== 0) ||
    (f.sepia !== undefined && f.sepia !== 0);
  if (hasFilters) {
    ctx.beginPath();
    ctx.arc(x + width - 8, y + 8, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();
  }
}
```

- [ ] **Step 3: Add keyframe diamonds on selected items**

```typescript
// Draw keyframe diamonds at bottom of item when selected
if (isSelected && item.keyframes?.length) {
  const laneY = y + height - 6;
  for (const kf of item.keyframes) {
    const kfX = x + ((kf.timeMs / (item.endMs - item.startMs)) * width);
    // Draw diamond
    ctx.save();
    ctx.translate(kfX, laneY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/canvas/
git commit -m "feat(timeline): add transform/filter/keyframe visual indicators on items"
```

---

### Task 11: Context menu v2 additions

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx`

- [ ] **Step 1: Add v2 menu items**

In the context menu component, add items after existing ones:

```typescript
// After existing menu items, add:
{ label: 'Edit Properties', action: () => {
  // Focus the properties panel for the selected item
  // This will be wired to open the right panel's Properties tab
  onEditProperties?.(selectedItemId);
}},
{ label: 'Add Keyframe at Playhead', action: () => {
  const item = store.items[selectedItemId];
  if (!item) return;
  const relativeTime = store.currentTimeMs - item.startMs;
  store.addKeyframeAtTime(selectedItemId, relativeTime, item.transform ?? { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 });
}},
{ type: 'separator' },
{ label: 'Clear All Keyframes', action: () => {
  store.updateKeyframes(selectedItemId, []);
}},
{ label: 'Reset Transform', action: () => {
  store.updateTransform(selectedItemId, { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 });
}},
{ label: 'Reset Filters', action: () => {
  store.updateFilters(selectedItemId, { brightness: 1, contrast: 1, saturation: 1, blur: 0, hue: 0, grayscale: 0, sepia: 0 });
}},
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/context-menu/
git commit -m "feat(timeline): add v2 context menu items — keyframes, transform, filters"
```

---

### Task 12: NumberInput component

> **Style note for Tasks 12-20:** The existing editor uses CSS variables (`var(--editor-bg-surface)`, `var(--editor-text-primary)`, `var(--editor-border-subtle)`, etc.) for theming. Check `RightPanel.tsx` and `ContextMenu.tsx` for the established pattern. All new components should use these CSS variables instead of hardcoded Tailwind dark classes like `bg-slate-800`. The code below uses Tailwind for readability — the implementer MUST replace with CSS variable equivalents to match the existing theme system.

**Files:**
- Create: `apps/web/src/features/editor-v2/components/properties/NumberInput.tsx`

- [ ] **Step 1: Create NumberInput component**

```typescript
'use client';

import React, { useState, useRef, useCallback } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
  className?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  label,
  className,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const dragStartRef = useRef<{ x: number; value: number } | null>(null);

  const clamp = useCallback(
    (v: number) => {
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      return Math.round(v / step) * step;
    },
    [min, max, step],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (editing) return;
      e.preventDefault();
      dragStartRef.current = { x: e.clientX, value };

      const handleMouseMove = (e: MouseEvent) => {
        if (!dragStartRef.current) return;
        const dx = e.clientX - dragStartRef.current.x;
        let multiplier = step;
        if (e.shiftKey) multiplier = step * 10;
        if (e.altKey) multiplier = step * 0.1;
        const newValue = clamp(dragStartRef.current.value + dx * multiplier);
        onChange(newValue);
      };

      const handleMouseUp = () => {
        dragStartRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [editing, value, step, clamp, onChange],
  );

  const handleDoubleClick = () => {
    setEditing(true);
    setEditValue(String(value));
  };

  const commitEdit = () => {
    setEditing(false);
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    }
  };

  return (
    <div
      className={`flex items-center gap-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 select-none cursor-ew-resize ${className ?? ''}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {label && (
        <span className="text-xs text-slate-500 w-4 shrink-0">{label}</span>
      )}
      {editing ? (
        <input
          className="bg-transparent text-sm text-white w-full outline-none"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
          autoFocus
        />
      ) : (
        <span className="text-sm text-white">
          {Number.isInteger(value) ? value : value.toFixed(1)}
        </span>
      )}
      {unit && (
        <span className="text-xs text-slate-500 ml-auto">{unit}</span>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/properties/NumberInput.tsx
git commit -m "feat(editor): add NumberInput component — drag-to-adjust with Shift/Alt precision"
```

---

### Task 13: KeyframeToggle component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/properties/KeyframeToggle.tsx`

- [ ] **Step 1: Create KeyframeToggle component**

```typescript
'use client';

import React from 'react';

interface KeyframeToggleProps {
  active: boolean;
  hasKeyframes: boolean;
  onClick: () => void;
}

export const KeyframeToggle: React.FC<KeyframeToggleProps> = ({
  active,
  hasKeyframes,
  onClick,
}) => {
  return (
    <button
      className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
        active
          ? 'text-purple-400 bg-purple-900/30'
          : hasKeyframes
            ? 'text-purple-300/50 hover:text-purple-400'
            : 'text-slate-500 hover:text-slate-400'
      }`}
      onClick={onClick}
      title={active ? 'Keyframe mode active' : 'Enable keyframe mode'}
    >
      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
        <rect x="3" y="3" width="6" height="6" transform="rotate(45 6 6)" />
      </svg>
    </button>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/properties/KeyframeToggle.tsx
git commit -m "feat(editor): add KeyframeToggle component — diamond icon with active state"
```

---

### Task 14: TransformTab component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/properties/TransformTab.tsx`

- [ ] **Step 1: Create TransformTab**

```typescript
'use client';

import React, { useState } from 'react';
import { NumberInput } from './NumberInput';
import { KeyframeToggle } from './KeyframeToggle';
import type { TimelineItem, Transform, Keyframe } from '../../store/types';
import { useEditorStore } from '../../store/use-editor-store';

interface TransformTabProps {
  item: TimelineItem;
}

const DEFAULT_TRANSFORM: Transform = {
  x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1,
};

export const TransformTab: React.FC<TransformTabProps> = ({ item }) => {
  const store = useEditorStore.getState();
  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);
  const [keyframeMode, setKeyframeMode] = useState<Record<string, boolean>>({});

  const transform = item.transform ?? DEFAULT_TRANSFORM;

  const updateProp = (prop: keyof Transform, value: number | string) => {
    if (keyframeMode[prop]) {
      // Add/update keyframe at current playhead
      const relTime = currentTimeMs - item.startMs;
      store.addKeyframeAtTime(item.id, relTime, { [prop]: value });
    } else {
      store.updateTransform(item.id, { [prop]: value });
    }
  };

  // Note: x, y, width, height can be string ("100%") or number (px).
  // numVal extracts the numeric part. When user edits via NumberInput, the value
  // becomes a raw number (pixels). To preserve percentage mode, the implementer
  // should add a px/% toggle per property — deferred to a follow-up.
  const numVal = (v: number | string) => typeof v === 'number' ? v : parseFloat(v) || 0;
  const hasKeyframesFor = (prop: string) =>
    item.keyframes?.some((kf) => (kf.props as any)[prop] !== undefined) ?? false;

  return (
    <div className="p-4 space-y-4">
      {/* Position */}
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Position</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <KeyframeToggle
              active={!!keyframeMode.x}
              hasKeyframes={hasKeyframesFor('x')}
              onClick={() => setKeyframeMode((p) => ({ ...p, x: !p.x }))}
            />
            <NumberInput label="X" value={numVal(transform.x)} onChange={(v) => updateProp('x', v)} unit="px" />
          </div>
          <div className="flex items-center gap-1">
            <KeyframeToggle
              active={!!keyframeMode.y}
              hasKeyframes={hasKeyframesFor('y')}
              onClick={() => setKeyframeMode((p) => ({ ...p, y: !p.y }))}
            />
            <NumberInput label="Y" value={numVal(transform.y)} onChange={(v) => updateProp('y', v)} unit="px" />
          </div>
        </div>
      </div>

      {/* Size */}
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Size</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <KeyframeToggle
              active={!!keyframeMode.width}
              hasKeyframes={hasKeyframesFor('width')}
              onClick={() => setKeyframeMode((p) => ({ ...p, width: !p.width }))}
            />
            <NumberInput label="W" value={numVal(transform.width)} onChange={(v) => updateProp('width', v)} unit="px" />
          </div>
          <div className="flex items-center gap-1">
            <KeyframeToggle
              active={!!keyframeMode.height}
              hasKeyframes={hasKeyframesFor('height')}
              onClick={() => setKeyframeMode((p) => ({ ...p, height: !p.height }))}
            />
            <NumberInput label="H" value={numVal(transform.height)} onChange={(v) => updateProp('height', v)} unit="px" />
          </div>
        </div>
      </div>

      {/* Rotation + Opacity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Rotation</div>
          <div className="flex items-center gap-1">
            <KeyframeToggle
              active={!!keyframeMode.rotation}
              hasKeyframes={hasKeyframesFor('rotation')}
              onClick={() => setKeyframeMode((p) => ({ ...p, rotation: !p.rotation }))}
            />
            <NumberInput value={transform.rotation} onChange={(v) => updateProp('rotation', v)} min={-360} max={360} unit="deg" />
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Opacity</div>
          <div className="flex items-center gap-1">
            <KeyframeToggle
              active={!!keyframeMode.opacity}
              hasKeyframes={hasKeyframesFor('opacity')}
              onClick={() => setKeyframeMode((p) => ({ ...p, opacity: !p.opacity }))}
            />
            <NumberInput value={Math.round(transform.opacity * 100)} onChange={(v) => updateProp('opacity', v / 100)} min={0} max={100} unit="%" />
          </div>
        </div>
      </div>

      {/* Keyframe count indicator */}
      {item.keyframes && item.keyframes.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-purple-900/20 border border-purple-800/30 rounded text-sm">
          <span className="text-purple-300">◆</span>
          <span className="text-purple-300">{item.keyframes.length} keyframe{item.keyframes.length > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/properties/TransformTab.tsx
git commit -m "feat(editor): add TransformTab — position, size, rotation, opacity with keyframe toggles"
```

---

### Task 15: FiltersTab component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/properties/FiltersTab.tsx`

- [ ] **Step 1: Create FiltersTab**

```typescript
'use client';

import React from 'react';
import { NumberInput } from './NumberInput';
import type { TimelineItem, Filters } from '../../store/types';
import { useEditorStore } from '../../store/use-editor-store';

interface FiltersTabProps {
  item: TimelineItem;
}

const FILTER_CONFIG = [
  { key: 'brightness' as const, label: 'Brightness', min: 0, max: 200, default: 100, unit: '%', toStore: (v: number) => v / 100, fromStore: (v: number) => v * 100 },
  { key: 'contrast' as const, label: 'Contrast', min: 0, max: 200, default: 100, unit: '%', toStore: (v: number) => v / 100, fromStore: (v: number) => v * 100 },
  { key: 'saturation' as const, label: 'Saturation', min: 0, max: 200, default: 100, unit: '%', toStore: (v: number) => v / 100, fromStore: (v: number) => v * 100 },
  { key: 'blur' as const, label: 'Blur', min: 0, max: 50, default: 0, unit: 'px', toStore: (v: number) => v, fromStore: (v: number) => v },
  { key: 'hue' as const, label: 'Hue Rotate', min: -180, max: 180, default: 0, unit: '°', toStore: (v: number) => v, fromStore: (v: number) => v },
  { key: 'grayscale' as const, label: 'Grayscale', min: 0, max: 100, default: 0, unit: '%', toStore: (v: number) => v / 100, fromStore: (v: number) => v * 100 },
  { key: 'sepia' as const, label: 'Sepia', min: 0, max: 100, default: 0, unit: '%', toStore: (v: number) => v / 100, fromStore: (v: number) => v * 100 },
] as const;

export const FiltersTab: React.FC<FiltersTabProps> = ({ item }) => {
  const store = useEditorStore.getState();
  const filters = item.filters ?? {};

  const hasAnyFilter = FILTER_CONFIG.some(
    (f) => filters[f.key] !== undefined && f.fromStore(filters[f.key]!) !== f.default,
  );

  return (
    <div className="p-4 space-y-3">
      {hasAnyFilter && (
        <button
          className="text-xs text-slate-400 hover:text-white"
          onClick={() => store.updateFilters(item.id, {
            brightness: 1, contrast: 1, saturation: 1,
            blur: 0, hue: 0, grayscale: 0, sepia: 0,
          })}
        >
          Reset All Filters
        </button>
      )}

      {FILTER_CONFIG.map((f) => {
        const storeVal = filters[f.key];
        const displayVal = storeVal !== undefined ? f.fromStore(storeVal) : f.default;
        const isNonDefault = displayVal !== f.default;

        return (
          <div key={f.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">{f.label}</span>
              {isNonDefault && (
                <button
                  className="text-xs text-slate-500 hover:text-slate-300"
                  onClick={() => store.updateFilters(item.id, { [f.key]: f.key === 'blur' || f.key === 'hue' ? 0 : f.key === 'grayscale' || f.key === 'sepia' ? 0 : 1 })}
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={f.min}
                max={f.max}
                value={displayVal}
                onChange={(e) => store.updateFilters(item.id, { [f.key]: f.toStore(Number(e.target.value)) })}
                className="flex-1 h-1 bg-slate-700 rounded appearance-none cursor-pointer"
              />
              <NumberInput
                value={displayVal}
                onChange={(v) => store.updateFilters(item.id, { [f.key]: f.toStore(v) })}
                min={f.min}
                max={f.max}
                step={1}
                unit={f.unit}
                className="w-20"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/properties/FiltersTab.tsx
git commit -m "feat(editor): add FiltersTab — 7 filter sliders with decimal↔percentage conversion"
```

---

### Task 16: DataTab component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/properties/DataTab.tsx`

- [ ] **Step 1: Create DataTab with type-specific sections**

```typescript
'use client';

import React from 'react';
import { NumberInput } from './NumberInput';
import type { TimelineItem, VideoItemData, AudioItemData, TextItemData, ImageItemData, ShapeItemData } from '../../store/types';
import { useEditorStore } from '../../store/use-editor-store';

interface DataTabProps {
  item: TimelineItem;
}

export const DataTab: React.FC<DataTabProps> = ({ item }) => {
  const store = useEditorStore.getState();

  const updateData = (updates: Record<string, unknown>) => {
    store.updateItemData(item.id, updates);
  };

  switch (item.type) {
    case 'video': {
      const d = item.data as VideoItemData;
      return (
        <div className="p-4 space-y-3">
          <div>
            <span className="text-xs text-slate-400">Volume</span>
            <input type="range" min={0} max={200} value={d.volume * 100}
              onChange={(e) => updateData({ volume: Number(e.target.value) / 100 })}
              className="w-full h-1 bg-slate-700 rounded" />
          </div>
          <div>
            <span className="text-xs text-slate-400">Playback Rate</span>
            <NumberInput value={d.playbackRate} onChange={(v) => updateData({ playbackRate: v })}
              min={0.25} max={4} step={0.25} unit="×" />
          </div>
        </div>
      );
    }
    case 'audio': {
      const d = item.data as AudioItemData;
      return (
        <div className="p-4 space-y-3">
          <div>
            <span className="text-xs text-slate-400">Volume</span>
            <input type="range" min={0} max={200} value={d.volume * 100}
              onChange={(e) => updateData({ volume: Number(e.target.value) / 100 })}
              className="w-full h-1 bg-slate-700 rounded" />
          </div>
        </div>
      );
    }
    case 'text': {
      const d = item.data as TextItemData;
      return (
        <div className="p-4 space-y-3">
          <div>
            <span className="text-xs text-slate-400">Text</span>
            <textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white"
              value={d.text} onChange={(e) => updateData({ text: e.target.value })} rows={3} />
          </div>
        </div>
      );
    }
    case 'image': {
      const d = item.data as ImageItemData;
      return (
        <div className="p-4 space-y-3">
          <div>
            <span className="text-xs text-slate-400">Opacity</span>
            <NumberInput value={Math.round(d.opacity * 100)} onChange={(v) => updateData({ opacity: v / 100 })}
              min={0} max={100} unit="%" />
          </div>
        </div>
      );
    }
    case 'shape': {
      const d = item.data as ShapeItemData;
      return (
        <div className="p-4 space-y-3">
          <div>
            <span className="text-xs text-slate-400">Shape</span>
            <select className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-sm text-white"
              value={d.shape} onChange={(e) => updateData({ shape: e.target.value })}>
              <option value="rectangle">Rectangle</option>
              <option value="circle">Circle</option>
              <option value="line">Line</option>
            </select>
          </div>
          <div>
            <span className="text-xs text-slate-400">Fill</span>
            <input type="color" value={d.fill ?? '#FFFFFF'} onChange={(e) => updateData({ fill: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer" />
          </div>
        </div>
      );
    }
    case 'caption':
      return (
        <div className="p-4 text-sm text-slate-400">
          Caption styles are edited in the Caption Style panel.
        </div>
      );
    default:
      return (
        <div className="p-4 text-sm text-slate-400">
          No editable properties for this item type.
        </div>
      );
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/properties/DataTab.tsx
git commit -m "feat(editor): add DataTab — type-specific property editors for all item types"
```

---

### Task 17: PropertiesPanel container

**Files:**
- Create: `apps/web/src/features/editor-v2/components/properties/PropertiesPanel.tsx`
- Modify: `apps/web/src/features/editor-v2/components/RightPanel.tsx`

- [ ] **Step 1: Create PropertiesPanel**

```typescript
'use client';

import React, { useState } from 'react';
import { TransformTab } from './TransformTab';
import { FiltersTab } from './FiltersTab';
import { DataTab } from './DataTab';
import { useSingleSelectedItem } from '../../store/use-editor-store';

type TabId = 'transform' | 'filters' | 'data';

export const PropertiesPanel: React.FC = () => {
  const item = useSingleSelectedItem();
  const [activeTab, setActiveTab] = useState<TabId>('transform');

  if (!item) return null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'transform', label: 'Transform' },
    { id: 'filters', label: 'Filters' },
    { id: 'data', label: 'Data' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-sm font-semibold text-white capitalize">{item.type} Item</span>
        <span className="text-xs text-slate-500 ml-auto">{item.id.slice(0, 9)}</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex-1 py-2 text-xs text-center transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-purple-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'transform' && <TransformTab item={item} />}
        {activeTab === 'filters' && <FiltersTab item={item} />}
        {activeTab === 'data' && <DataTab item={item} />}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Mount in RightPanel.tsx**

In `apps/web/src/features/editor-v2/components/RightPanel.tsx`, add the properties panel as a tab. Import `PropertiesPanel` and `useSingleSelectedItem`. Show the Properties tab when an item is selected:

```typescript
import { PropertiesPanel } from './properties/PropertiesPanel';
import { useSingleSelectedItem } from '../store/use-editor-store';

// Inside the component, add a tab:
const selectedItem = useSingleSelectedItem();

// In the tab list:
{selectedItem && <Tab label="Properties" />}

// In the tab content:
{activeTab === 'properties' && <PropertiesPanel />}
```

The implementer should follow the existing tab pattern in RightPanel.tsx.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/properties/PropertiesPanel.tsx apps/web/src/features/editor-v2/components/RightPanel.tsx
git commit -m "feat(editor): add PropertiesPanel with Transform/Filters/Data tabs in right panel"
```

---

### Task 18: Keyframe Editor — MiniTimeline + PropertyLane

**Files:**
- Create: `apps/web/src/features/editor-v2/components/keyframe-editor/MiniTimeline.tsx`
- Create: `apps/web/src/features/editor-v2/components/keyframe-editor/PropertyLane.tsx`

- [ ] **Step 1: Create MiniTimeline**

```typescript
'use client';

import React, { useRef, useCallback } from 'react';
import type { TimelineItem, Keyframe } from '../../store/types';
import { useEditorStore } from '../../store/use-editor-store';
import { PropertyLane } from './PropertyLane';

interface MiniTimelineProps {
  item: TimelineItem;
  onSelectSegment: (fromIndex: number, toIndex: number, property: string) => void;
}

const PROPERTIES = ['x', 'y', 'width', 'height', 'rotation', 'opacity'] as const;

export const MiniTimeline: React.FC<MiniTimelineProps> = ({ item, onSelectSegment }) => {
  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);
  const containerRef = useRef<HTMLDivElement>(null);
  const duration = item.endMs - item.startMs;
  const relativeTime = currentTimeMs - item.startMs;
  const playheadPercent = duration > 0 ? (relativeTime / duration) * 100 : 0;

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const seekMs = item.startMs + percent * duration;
      useEditorStore.getState().setCurrentTime(Math.round(seekMs));
    },
    [item.startMs, duration],
  );

  // Collect which properties have keyframes
  const animatedProps = PROPERTIES.filter(
    (prop) => item.keyframes?.some((kf) => (kf.props as any)[prop] !== undefined),
  );

  return (
    <div className="space-y-1">
      {/* Time ruler */}
      <div
        ref={containerRef}
        className="relative h-6 bg-slate-800 rounded cursor-pointer"
        onClick={handleTimelineClick}
      >
        {/* Time labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <span
            key={pct}
            className="absolute top-0 text-[10px] text-slate-500"
            style={{ left: `${pct * 100}%` }}
          >
            {((pct * duration) / 1000).toFixed(1)}s
          </span>
        ))}
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
          style={{ left: `${playheadPercent}%` }}
        />
      </div>

      {/* Property lanes */}
      {animatedProps.map((prop) => (
        <PropertyLane
          key={prop}
          property={prop}
          item={item}
          duration={duration}
          onSelectSegment={(from, to) => onSelectSegment(from, to, prop)}
        />
      ))}

      {animatedProps.length === 0 && (
        <div className="text-xs text-slate-500 py-2 text-center">
          No keyframes — use the diamond toggle in Transform to add
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Create PropertyLane**

```typescript
'use client';

import React, { useCallback } from 'react';
import type { TimelineItem, Keyframe } from '../../store/types';
import { useEditorStore } from '../../store/use-editor-store';

interface PropertyLaneProps {
  property: string;
  item: TimelineItem;
  duration: number;
  onSelectSegment: (fromIndex: number, toIndex: number) => void;
}

export const PropertyLane: React.FC<PropertyLaneProps> = ({
  property,
  item,
  duration,
  onSelectSegment,
}) => {
  const store = useEditorStore.getState();
  const keyframes = (item.keyframes ?? [])
    .map((kf, i) => ({ ...kf, index: i }))
    .filter((kf) => (kf.props as any)[property] !== undefined);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const timeMs = Math.round(percent * duration);
      const currentTransform = item.transform ?? { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 };
      store.addKeyframeAtTime(item.id, timeMs, { [property]: (currentTransform as any)[property] });
    },
    [duration, item, property, store],
  );

  const handleDeleteKeyframe = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      store.deleteKeyframe(item.id, index);
    },
    [item.id, store],
  );

  return (
    <div
      className="relative h-6 bg-slate-800/50 rounded flex items-center"
      onDoubleClick={handleDoubleClick}
    >
      <span className="absolute left-1 text-[10px] text-slate-500 uppercase">{property}</span>

      {/* Interpolation lines between keyframes */}
      {keyframes.length >= 2 &&
        keyframes.slice(0, -1).map((kf, i) => {
          const next = keyframes[i + 1];
          const leftPct = duration > 0 ? (kf.timeMs / duration) * 100 : 0;
          const rightPct = duration > 0 ? (next.timeMs / duration) * 100 : 0;
          return (
            <div
              key={`line-${i}`}
              className="absolute h-px bg-purple-500/50 cursor-pointer hover:bg-purple-400"
              style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%`, top: '50%' }}
              onClick={() => onSelectSegment(kf.index, next.index)}
            />
          );
        })}

      {/* Diamond markers */}
      {keyframes.map((kf) => {
        const leftPct = duration > 0 ? (kf.timeMs / duration) * 100 : 0;
        return (
          <div
            key={kf.index}
            className="absolute w-2.5 h-2.5 bg-purple-500 border border-purple-300 rotate-45 cursor-pointer hover:bg-purple-400 z-10"
            style={{ left: `${leftPct}%`, top: '50%', transform: 'translate(-50%, -50%) rotate(45deg)' }}
            onClick={() => store.setCurrentTime(item.startMs + kf.timeMs)}
            onContextMenu={(e) => handleDeleteKeyframe(e, kf.index)}
          />
        );
      })}
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/keyframe-editor/
git commit -m "feat(editor): add MiniTimeline + PropertyLane — keyframe visualization and interaction"
```

---

### Task 19: CurveEditor component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/keyframe-editor/CurveEditor.tsx`

- [ ] **Step 1: Create CurveEditor**

```typescript
'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useEditorStore } from '../../store/use-editor-store';

interface CurveEditorProps {
  itemId: string;
  keyframeIndex: number;
  currentEasing: string;
}

const PRESETS = [
  { label: 'Linear', value: 'linear' },
  { label: 'Ease In', value: 'ease-in' },
  { label: 'Ease Out', value: 'ease-out' },
  { label: 'Ease In Out', value: 'ease-in-out' },
  { label: 'Spring', value: 'spring' },
] as const;

// Bezier control points for preview
const BEZIER_POINTS: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  spring: [0.25, 0.46, 0.45, 0.94],
};

function parseBezier(easing: string): [number, number, number, number] {
  const match = easing.match(/cubic-bezier\(([\d.]+),\s*([\d.-]+),\s*([\d.]+),\s*([\d.-]+)\)/);
  if (match) return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
  return BEZIER_POINTS[easing] ?? BEZIER_POINTS.linear;
}

export const CurveEditor: React.FC<CurveEditorProps> = ({ itemId, keyframeIndex, currentEasing }) => {
  const store = useEditorStore.getState();
  const svgRef = useRef<SVGSVGElement>(null);
  const [points, setPoints] = useState<[number, number, number, number]>(parseBezier(currentEasing));

  // Sync from prop changes
  React.useEffect(() => {
    setPoints(parseBezier(currentEasing));
  }, [currentEasing]);

  const [cp1, cp2, cp3, cp4] = points;

  const setEasing = (easing: string) => {
    store.updateKeyframeEasing(itemId, keyframeIndex, easing);
  };

  // Drag handler for control points
  const handleControlPointDrag = useCallback(
    (cpIndex: 0 | 1, e: React.MouseEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;

      const handleMove = (me: MouseEvent) => {
        const rect = svg.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width));
        const y = Math.max(-0.5, Math.min(1.5, 1 - (me.clientY - rect.top) / rect.height));
        setPoints((prev) => {
          const next = [...prev] as [number, number, number, number];
          next[cpIndex * 2] = Math.round(x * 100) / 100;
          next[cpIndex * 2 + 1] = Math.round(y * 100) / 100;
          return next;
        });
      };

      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        // Commit the custom bezier
        setPoints((final) => {
          const bezierStr = `cubic-bezier(${final[0]}, ${final[1]}, ${final[2]}, ${final[3]})`;
          store.updateKeyframeEasing(itemId, keyframeIndex, bezierStr);
          return final;
        });
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [itemId, keyframeIndex, store],
  );

  // SVG curve path
  const path = `M 0 100 C ${cp1 * 100} ${100 - cp2 * 100}, ${cp3 * 100} ${100 - cp4 * 100}, 100 0`;

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-400 uppercase tracking-wide">Easing Curve</div>

      {/* SVG preview with draggable control points */}
      <div className="relative bg-slate-800 border border-slate-600 rounded p-2" style={{ height: 120 }}>
        <svg ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          {/* Grid */}
          <line x1="0" y1="100" x2="100" y2="100" stroke="#334155" strokeWidth="0.5" />
          <line x1="0" y1="0" x2="0" y2="100" stroke="#334155" strokeWidth="0.5" />
          {/* Curve */}
          <path d={path} stroke="#8b5cf6" strokeWidth="2" fill="none" />
          {/* Control lines */}
          <line x1="0" y1="100" x2={cp1 * 100} y2={100 - cp2 * 100} stroke="#4c1d95" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="100" y1="0" x2={cp3 * 100} y2={100 - cp4 * 100} stroke="#4c1d95" strokeWidth="0.5" strokeDasharray="2,2" />
          {/* Draggable control points */}
          <circle cx={cp1 * 100} cy={100 - cp2 * 100} r="4" fill="#a78bfa" stroke="#1e293b" strokeWidth="1"
            className="cursor-grab" onMouseDown={(e) => handleControlPointDrag(0, e)} />
          <circle cx={cp3 * 100} cy={100 - cp4 * 100} r="4" fill="#a78bfa" stroke="#1e293b" strokeWidth="1"
            className="cursor-grab" onMouseDown={(e) => handleControlPointDrag(1, e)} />
        </svg>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            className={`px-2 py-1 text-xs rounded ${
              currentEasing === preset.value
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            onClick={() => setEasing(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Current value */}
      <div className="text-xs text-slate-500">
        {currentEasing.startsWith('cubic-bezier')
          ? currentEasing
          : `cubic-bezier(${cp1}, ${cp2}, ${cp3}, ${cp4})`}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/keyframe-editor/CurveEditor.tsx
git commit -m "feat(editor): add CurveEditor — bezier curve preview with easing presets"
```

---

### Task 20: KeyframeList + KeyframeEditor container

**Files:**
- Create: `apps/web/src/features/editor-v2/components/keyframe-editor/KeyframeList.tsx`
- Create: `apps/web/src/features/editor-v2/components/keyframe-editor/KeyframeEditor.tsx`

- [ ] **Step 1: Create KeyframeList**

```typescript
'use client';

import React from 'react';
import type { TimelineItem, Keyframe } from '../../store/types';
import { useEditorStore } from '../../store/use-editor-store';

interface KeyframeListProps {
  item: TimelineItem;
  onSelectKeyframe: (index: number) => void;
  selectedIndex: number | null;
}

export const KeyframeList: React.FC<KeyframeListProps> = ({ item, onSelectKeyframe, selectedIndex }) => {
  const store = useEditorStore.getState();
  const keyframes = item.keyframes ?? [];

  return (
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Keyframes</div>
      <div className="bg-slate-800 rounded overflow-hidden">
        {keyframes.length === 0 ? (
          <div className="p-3 text-xs text-slate-500 text-center">No keyframes</div>
        ) : (
          keyframes.map((kf, i) => {
            const props = Object.entries(kf.props).filter(([, v]) => v !== undefined);
            return (
              <div
                key={i}
                className={`flex items-center px-3 py-2 border-b border-slate-900 cursor-pointer hover:bg-slate-700/50 ${
                  selectedIndex === i ? 'bg-purple-900/20' : ''
                }`}
                onClick={() => {
                  onSelectKeyframe(i);
                  store.setCurrentTime(item.startMs + kf.timeMs);
                }}
              >
                <span className="text-purple-300 mr-2">◆</span>
                <span className="text-sm text-white w-14">{(kf.timeMs / 1000).toFixed(1)}s</span>
                <span className="text-sm text-slate-400 flex-1">
                  {props.map(([k, v]) => `${k}: ${typeof v === 'number' ? Math.round(v) : v}`).join(', ')}
                </span>
                <span className="text-xs text-slate-500">{kf.easing}</span>
                <button
                  className="ml-2 text-xs text-slate-500 hover:text-red-400"
                  onClick={(e) => { e.stopPropagation(); store.deleteKeyframe(item.id, i); }}
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>
      <button
        className="mt-2 text-xs text-purple-400 hover:text-purple-300"
        onClick={() => {
          const relTime = useEditorStore.getState().currentTimeMs - item.startMs;
          const transform = item.transform ?? { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 };
          store.addKeyframeAtTime(item.id, Math.max(0, relTime), transform);
        }}
      >
        + Add Keyframe
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Create KeyframeEditor container**

```typescript
'use client';

import React, { useState } from 'react';
import { MiniTimeline } from './MiniTimeline';
import { CurveEditor } from './CurveEditor';
import { KeyframeList } from './KeyframeList';
import { useSingleSelectedItem } from '../../store/use-editor-store';

export const KeyframeEditor: React.FC = () => {
  const item = useSingleSelectedItem();
  const [selectedKfIndex, setSelectedKfIndex] = useState<number | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<{ from: number; to: number; property: string } | null>(null);

  if (!item) return null;

  const hasKeyframes = (item.keyframes?.length ?? 0) > 0;

  const handleSelectSegment = (from: number, to: number, property: string) => {
    setSelectedSegment({ from, to, property });
    setSelectedKfIndex(to);  // select the "to" keyframe for easing editing
  };

  const selectedKf = selectedKfIndex !== null ? item.keyframes?.[selectedKfIndex] : null;

  return (
    <div className="border-t border-slate-700 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">Keyframe Editor</span>
        <span className="text-xs text-slate-500">{item.id.slice(0, 9)}</span>
      </div>

      {hasKeyframes ? (
        <>
          <MiniTimeline item={item} onSelectSegment={handleSelectSegment} />

          {selectedKf && (
            <CurveEditor
              itemId={item.id}
              keyframeIndex={selectedKfIndex!}
              currentEasing={selectedKf.easing}
            />
          )}
        </>
      ) : (
        <div className="text-xs text-slate-500 py-2 text-center">
          No keyframes yet. Use the diamond toggles in Transform or add one below.
        </div>
      )}

      <KeyframeList
        item={item}
        onSelectKeyframe={setSelectedKfIndex}
        selectedIndex={selectedKfIndex}
      />
    </div>
  );
};
```

- [ ] **Step 3: Mount KeyframeEditor below PropertiesPanel in RightPanel.tsx**

In `RightPanel.tsx`, below the PropertiesPanel content:

```typescript
import { KeyframeEditor } from './keyframe-editor/KeyframeEditor';

// In the Properties tab content:
<PropertiesPanel />
<KeyframeEditor />
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/components/keyframe-editor/ apps/web/src/features/editor-v2/components/RightPanel.tsx
git commit -m "feat(editor): add KeyframeEditor — mini timeline, curve editor, keyframe list"
```

---

### Task 21: Integration verification

- [ ] **Step 1: Verify TypeScript compiles for all packages**

Run: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | head -50`
Run: `cd packages/api && npx tsc --noEmit --pretty false 2>&1 | head -50`
Run: `cd packages/sandbox && npx tsc --noEmit --pretty false 2>&1 | head -50`

Fix any compile errors.

- [ ] **Step 2: Verify sandbox builds**

Run: `cd packages/sandbox && npm run build 2>&1 | tail -10`

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve TypeScript errors from Phase 2 integration"
```

---

## Implementation Order Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Store types (Transform, Keyframe, Filters, ShapeItemData) | None |
| 2 | Easing schema extension (cubic-bezier) | None |
| 3 | Manifest bridge v2 (manifestToStore + storeToManifest) | 1 |
| 4 | Sandbox POST /ops endpoint | None |
| 5 | API proxy for /ops | 4 |
| 6 | manifest-dispatch.ts | 5 |
| 7 | Store action wiring | 1, 6 |
| 8 | DB persistence (syncManifestToDb) | 5 |
| 9 | Timeline canvas — route by item type | 1 |
| 10 | Visual indicators on timeline items | 1, 9 |
| 11 | Context menu v2 additions | 7 |
| 12 | NumberInput component | None |
| 13 | KeyframeToggle component | None |
| 14 | TransformTab | 1, 7, 12, 13 |
| 15 | FiltersTab | 1, 7, 12 |
| 16 | DataTab | 7, 12 |
| 17 | PropertiesPanel container | 14, 15, 16 |
| 18 | MiniTimeline + PropertyLane | 1, 7 |
| 19 | CurveEditor | 2, 7 |
| 20 | KeyframeList + KeyframeEditor container | 18, 19 |
| 21 | Integration verification | All |
