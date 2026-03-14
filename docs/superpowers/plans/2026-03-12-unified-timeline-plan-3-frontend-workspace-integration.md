# Frontend Workspace Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the frontend editor to the workspace API so the store loads from manifest, edits dispatch as manifest operations, bundles load from the workspace endpoint, and WebSocket events drive real-time updates.

**Architecture:** The existing `Composition.tsx` rendering logic stays intact for now (CompositionCore extraction is a later plan — Plan 4+). This plan changes the *data source* — from DB-API round-trips to workspace manifest — and the *bundle source* — from S3 CJS bundles to workspace bundle endpoint. The store gains workspace lifecycle awareness (status, lock, bundle URL) and replaces its debounced `saveProject()` with per-edit manifest operations. Interactive overlays (ElementPicker, InspectOverlay, SafeZoneOverlay) are deferred to a later plan.

**Tech Stack:** Next.js (React 18), Zustand + immer, Remotion Player, WebSocket, `@viona/shared` manifest types

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Modify | `apps/web/src/lib/api.ts` | Add workspace API methods (lifecycle, manifest ops, lock, bundle) |
| Modify | `apps/web/src/lib/ws.ts` | Add workspace WS event types |
| Create | `apps/web/src/features/editor-v2/hooks/use-workspace-ws.ts` | Hook for workspace WS events (bundle:ready, manifest:updated, lock) |
| Modify | `apps/web/src/features/editor-v2/store/types.ts` | Add workspace state fields to EditorState/EditorActions |
| Create | `apps/web/src/features/editor-v2/store/manifest-bridge.ts` | Convert between manifest format and store format (both directions) |
| Modify | `apps/web/src/features/editor-v2/store/editor-store.ts` | Refactor loadProject → workspace spin-up, edits → manifest ops |
| Modify | `apps/web/src/features/editor-v2/player/DynamicVisualLoader.tsx` | Load bundles from workspace endpoint instead of S3 CJS |
| Modify | `apps/web/src/features/editor-v2/Editor.tsx` | Wire workspace WS hook, lock indicator, workspace teardown on unmount |
| Create | `scripts/temp/test-manifest-bridge.ts` | Tests for manifest ↔ store conversion |

---

## Chunk 1: API Client + WebSocket Types

### Task 1: Workspace API Client Methods

Add workspace methods to the existing API client. These call the REST endpoints implemented in Plan 2.

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Read the existing API client**

Read `apps/web/src/lib/api.ts` to understand the existing pattern (fetch wrapper, auth headers, error handling). All new methods follow the same pattern.

- [ ] **Step 2: Add workspace lifecycle methods**

Add these methods to the api object/class in `apps/web/src/lib/api.ts`:

```typescript
// ---- Workspace API ----

/** Spin up workspace — returns manifest + initial bundle URL.
 * Note: backend returns `cachedBundleUrl` for new spin-ups and `bundleUrl` when already active.
 */
async spinUpWorkspace(projectId: string): Promise<{
  manifest: import('@viona/shared').Manifest;
  workspaceStatus: string;
  cachedBundleUrl?: string | null;
  bundleUrl?: string | null;
}> {
  const res = await this.fetch(`/api/projects/${projectId}/workspace`, {
    method: 'POST',
  });
  return res.json();
}

/** Tear down workspace — syncs manifest to DB then cleans up */
async tearDownWorkspace(projectId: string): Promise<void> {
  await this.fetch(`/api/projects/${projectId}/workspace`, {
    method: 'DELETE',
  });
}

/** Read current manifest from active workspace */
async readManifest(projectId: string): Promise<import('@viona/shared').Manifest> {
  const res = await this.fetch(`/api/projects/${projectId}/workspace/manifest`);
  return res.json();
}

/** Apply a single manifest operation — returns updated manifest */
async applyManifestOp(
  projectId: string,
  op: import('@viona/shared').ManifestOp,
): Promise<import('@viona/shared').Manifest> {
  const res = await this.fetch(`/api/projects/${projectId}/workspace/manifest`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(op),
  });
  return res.json();
}
```

- [ ] **Step 3: Add lock management methods**

```typescript
/** Acquire edit lock */
async acquireWorkspaceLock(projectId: string, holder: 'user' | 'ai' = 'user'): Promise<{
  acquired: boolean;
  holder: string;
}> {
  const res = await this.fetch(`/api/projects/${projectId}/workspace/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ holder }),
  });
  return res.json();
}

/** Release edit lock */
async releaseWorkspaceLock(projectId: string, holder: 'user' | 'ai' = 'user'): Promise<void> {
  await this.fetch(`/api/projects/${projectId}/workspace/lock`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ holder }),
  });
}

/** Extend lock TTL (heartbeat) */
async heartbeatWorkspaceLock(projectId: string, holder: 'user' | 'ai' = 'user'): Promise<void> {
  await this.fetch(`/api/projects/${projectId}/workspace/lock/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ holder }),
  });
}

/** Get lock status */
async getWorkspaceLockStatus(projectId: string): Promise<{
  locked: boolean;
  info: { holder: string; acquiredAt: string } | null;
}> {
  const res = await this.fetch(`/api/projects/${projectId}/workspace/lock`);
  return res.json();
}
```

- [ ] **Step 4: Add workspace bundle URL helper**

```typescript
/** Get the base URL for workspace bundle assets */
getWorkspaceBundleUrl(projectId: string): string {
  return `${this.baseUrl}/api/projects/${projectId}/workspace/bundle`;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add workspace API client methods (lifecycle, manifest, lock, bundle)"
```

---

### Task 2: WebSocket Workspace Event Types

Extend the WebSocket client to handle workspace events. The backend (Plan 2) already publishes these events via Redis pub/sub → WS handler.

**Files:**
- Modify: `apps/web/src/lib/ws.ts`

- [ ] **Step 1: Add workspace event types to WSMessageType**

In `apps/web/src/lib/ws.ts`, extend the `WSMessageType` union:

```typescript
export type WSMessageType =
  | 'connected'
  | 'job:progress'
  | 'job:complete'
  | 'job:error'
  | 'job:logs'
  | 'project:updated'
  // Workspace events (Plan 3)
  | 'workspace:ready'
  | 'manifest:updated'
  | 'bundle:ready'
  | 'bundle:error'
  | 'workspace:lock_acquired'
  | 'workspace:lock_released'
  | 'workspace:teardown';
```

- [ ] **Step 2: Add workspace event payload types**

Add these interfaces after the existing payload types:

```typescript
// ---- Workspace event payloads ----

export interface WorkspaceReadyPayload {
  projectId: string;
  bundleUrl: string;
}

export interface ManifestUpdatedPayload {
  projectId: string;
  source: 'user' | 'ai';
  ops?: unknown[]; // ManifestOp array — frontend uses this to skip own echoes
}

export interface BundleReadyPayload {
  projectId: string;
  bundleUrl?: string;
  hash?: string;
}

export interface BundleErrorPayload {
  projectId: string;
  error: string;
}

export interface WorkspaceLockPayload {
  projectId: string;
  holder: 'user' | 'ai';
}

export interface WorkspaceTeardownPayload {
  projectId: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/ws.ts
git commit -m "feat(web): add workspace WebSocket event types and payloads"
```

---

### Task 3: Workspace WebSocket Hook

Create a dedicated hook for workspace-level WebSocket events. This is separate from `use-job-websocket.ts` because workspace events don't require job subscriptions — they route by `projectId` matching.

**Files:**
- Create: `apps/web/src/features/editor-v2/hooks/use-workspace-ws.ts`

- [ ] **Step 1: Create the hook**

```typescript
/**
 * Hook for workspace-level WebSocket events.
 * These events are routed by projectId (not job subscription).
 * Uses the singleton wsClient from @/lib/ws.
 */
import { useEffect, useRef } from 'react';
import {
  wsClient,
  WSMessage,
  WorkspaceReadyPayload,
  ManifestUpdatedPayload,
  BundleReadyPayload,
  BundleErrorPayload,
  WorkspaceLockPayload,
  WorkspaceTeardownPayload,
} from '@/lib/ws';

interface WorkspaceWSHandlers {
  onWorkspaceReady?: (data: WorkspaceReadyPayload) => void;
  onManifestUpdated?: (data: ManifestUpdatedPayload) => void;
  onBundleReady?: (data: BundleReadyPayload) => void;
  onBundleError?: (data: BundleErrorPayload) => void;
  onLockAcquired?: (data: WorkspaceLockPayload) => void;
  onLockReleased?: (data: WorkspaceLockPayload) => void;
  onWorkspaceTeardown?: (data: WorkspaceTeardownPayload) => void;
}

export function useWorkspaceWS(
  projectId: string | null,
  handlers: WorkspaceWSHandlers,
) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!projectId) return;

    const removeHandler = wsClient.addHandler((message: WSMessage) => {
      const h = handlersRef.current;
      switch (message.type) {
        case 'workspace:ready':
          h.onWorkspaceReady?.(message.payload as WorkspaceReadyPayload);
          break;
        case 'manifest:updated':
          h.onManifestUpdated?.(message.payload as ManifestUpdatedPayload);
          break;
        case 'bundle:ready':
          h.onBundleReady?.(message.payload as BundleReadyPayload);
          break;
        case 'bundle:error':
          h.onBundleError?.(message.payload as BundleErrorPayload);
          break;
        case 'workspace:lock_acquired':
          h.onLockAcquired?.(message.payload as WorkspaceLockPayload);
          break;
        case 'workspace:lock_released':
          h.onLockReleased?.(message.payload as WorkspaceLockPayload);
          break;
        case 'workspace:teardown':
          h.onWorkspaceTeardown?.(message.payload as WorkspaceTeardownPayload);
          break;
      }
    });

    return removeHandler;
  }, [projectId]);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/hooks/use-workspace-ws.ts
git commit -m "feat(web): add useWorkspaceWS hook for workspace events"
```

---

## Chunk 2: Manifest ↔ Store Bridge

### Task 4: Store Type Extensions

Add workspace-related fields to the store types. These track workspace lifecycle, lock state, and bundle status.

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`

- [ ] **Step 1: Add workspace state fields to EditorState**

Add these fields to the `EditorState` interface (after the existing `isDirty` field):

```typescript
  // Workspace state (Plan 3)
  workspaceStatus: 'inactive' | 'initializing' | 'active' | 'tearing_down';
  workspaceBundleUrl: string | null;
  workspaceBundleVersion: number; // Incremented on each bundle:ready to trigger reload
  workspaceLockHolder: 'user' | 'ai' | null;
  workspaceBundleError: string | null;
```

- [ ] **Step 2: Add workspace actions to EditorActions**

Add these to the `EditorActions` interface:

```typescript
  // Workspace actions (Plan 3)
  setWorkspaceStatus: (status: EditorState['workspaceStatus']) => void;
  setWorkspaceBundleUrl: (url: string | null) => void;
  incrementBundleVersion: () => void;
  setWorkspaceLockHolder: (holder: 'user' | 'ai' | null) => void;
  setWorkspaceBundleError: (error: string | null) => void;
  applyRemoteManifestUpdate: (manifest: import('@viona/shared').Manifest) => void;
```

- [ ] **Step 3: Add default workspace values**

Add defaults wherever `EditorState` initial values are defined (this will be used in the store initialization):

```typescript
// Default workspace state
workspaceStatus: 'inactive' as const,
workspaceBundleUrl: null,
workspaceBundleVersion: 0,
workspaceLockHolder: null,
workspaceBundleError: null,
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "feat(web): add workspace state fields to editor store types"
```

---

### Task 5: Manifest ↔ Store Bridge Module

Create a bridge module that converts between `@viona/shared` manifest format and the editor store format. This is needed because the manifest uses a different shape (flat items with `type: 'caption'`, `data.words`) vs. the store (items with `type: 'caption'`, `data: CaptionItemData` with style, etc.).

**Key differences to handle:**
- Manifest uses `caption` type, store already uses `caption` (same, no mapping needed)
- Manifest caption data has only `words[]`; store caption data has `words[] + style + styleOverrides + aiWordOverrides`
- Caption style in manifest is global (`captionStyle`); in store it's per-caption-item (`data.style`)
- Manifest visual data has `sceneFile: "scenes/Scene1.tsx"` + `displayMode` + `frameOffset`; store visual data has `bundleUrl` + `compositionId` + `sourceSceneId` etc.
- Manifest video data has `crop: {x, y, scale}` + `volume` + `playbackRate`; store has same fields at top level of VideoItemData
- Manifest layout is `layout: { mode, pip, split }`; store has `layoutSettings: LayoutSettings`

**Files:**
- Create: `apps/web/src/features/editor-v2/store/manifest-bridge.ts`

- [ ] **Step 1: Create the bridge with manifestToStore conversion**

```typescript
/**
 * Manifest ↔ Store Bridge
 *
 * Converts between @viona/shared Manifest format (workspace source of truth)
 * and the Zustand editor store format.
 */
import type { Manifest, ManifestTrack, ManifestItem } from '@viona/shared';
import type {
  Track, TimelineItem, CaptionItemData, VisualItemData, VideoItemData,
  AudioItemData, BrollItemData, TextItemData, ImageItemData,
  CaptionStyle, LayoutSettings, VideoSettings, VisualDisplayMode,
} from './types';
import {
  DEFAULT_CAPTION_STYLE, DEFAULT_LAYOUT_SETTINGS,
  DEFAULT_VIDEO_SETTINGS, normalizeLayoutMode, normalizeDisplayMode,
} from './types';

interface ManifestToStoreResult {
  tracks: Track[];
  items: Record<string, TimelineItem>;
  itemIds: string[];
  duration: number;
  fps: number;
  videoSettings: VideoSettings;
  layoutSettings: LayoutSettings;
  layoutPresetId: string;
}

/**
 * Convert a workspace manifest into editor store state.
 * The manifest is the source of truth; this produces the Zustand-compatible shape.
 */
export function manifestToStore(
  manifest: Manifest,
  context: {
    /** Presigned video URL for playback */
    videoUrl: string;
    /** Bundle URL for visual items */
    bundleUrl: string | null;
    /** compositionId for grouping visual items */
    compositionId: string;
    /** Visual metadata from the project (width, height, fps, etc.) */
    visualMeta?: { width: number; height: number; fps: number };
  },
): ManifestToStoreResult {
  const tracks: Track[] = manifest.tracks.map((mt: ManifestTrack) => ({
    id: mt.id,
    type: mt.type as Track['type'],
    name: mt.name,
    position: mt.position,
    locked: false,
    visible: true,
    height: 48, // DEFAULT_TRACK_HEIGHT
    collapsed: false,
  }));

  const items: Record<string, TimelineItem> = {};
  const itemIds: string[] = [];

  // Global caption style from manifest (applied to all caption items)
  const globalCaptionStyle: CaptionStyle = {
    ...DEFAULT_CAPTION_STYLE,
    ...(manifest.captionStyle ? convertManifestCaptionStyle(manifest.captionStyle) : {}),
  };

  for (const mi of manifest.items) {
    const item = convertManifestItem(mi, {
      globalCaptionStyle,
      videoUrl: context.videoUrl,
      bundleUrl: context.bundleUrl,
      compositionId: context.compositionId,
      visualMeta: context.visualMeta,
    });
    if (item) {
      items[item.id] = item;
      itemIds.push(item.id);
    }
  }

  // Video settings from manifest
  // Canvas dimensions are at manifest.canvas (NOT videoSettings)
  // Crop/scale are at manifest.videoSettings
  const videoSettings: VideoSettings = {
    canvasWidth: manifest.canvas?.width ?? DEFAULT_VIDEO_SETTINGS.canvasWidth,
    canvasHeight: manifest.canvas?.height ?? DEFAULT_VIDEO_SETTINGS.canvasHeight,
    cropX: manifest.videoSettings?.cropX ?? DEFAULT_VIDEO_SETTINGS.cropX,
    cropY: manifest.videoSettings?.cropY ?? DEFAULT_VIDEO_SETTINGS.cropY,
    scale: manifest.videoSettings?.scale ?? DEFAULT_VIDEO_SETTINGS.scale,
  };

  // Layout from manifest
  const layoutSettings: LayoutSettings = manifest.layout
    ? convertManifestLayout(manifest.layout)
    : { ...DEFAULT_LAYOUT_SETTINGS };

  return {
    tracks,
    items,
    itemIds,
    duration: manifest.durationMs,
    fps: manifest.fps ?? 30, // fps is a top-level manifest field
    videoSettings,
    layoutSettings,
    layoutPresetId: 'custom', // Workspace always uses custom
  };
}

// ---- Internal converters ----

function convertManifestItem(
  mi: ManifestItem,
  ctx: {
    globalCaptionStyle: CaptionStyle;
    videoUrl: string;
    bundleUrl: string | null;
    compositionId: string;
    visualMeta?: { width: number; height: number; fps: number };
  },
): TimelineItem | null {
  const base = {
    id: mi.id,
    trackId: mi.trackId,
    startMs: mi.startMs,
    endMs: mi.endMs,
  };

  switch (mi.type) {
    case 'video':
      return {
        ...base,
        type: 'video',
        data: {
          src: ctx.videoUrl,
          width: 1920, // Source dimensions — overridden by project
          height: 1080,
          volume: mi.data?.volume ?? 1,
          playbackRate: mi.data?.playbackRate ?? 1,
        } as VideoItemData,
      };

    case 'audio':
      return {
        ...base,
        type: 'audio',
        data: {
          src: mi.data?.src ?? '',
          originalSrc: mi.data?.src ?? '',
          enhancedSrc: mi.data?.enhancedSrc ?? undefined,
          isEnhanced: !!mi.data?.enhancedSrc,
          sourceVideoItemId: '', // Resolved from track relationships
          volume: mi.data?.volume ?? 1,
        } as AudioItemData,
      };

    case 'caption':
      return {
        ...base,
        type: 'caption',
        data: {
          text: (mi.data?.words ?? []).map((w: any) => w.text).join(' '),
          words: (mi.data?.words ?? []).map((w: any) => ({
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs,
            styleOverrides: w.styleOverrides,
          })),
          style: { ...ctx.globalCaptionStyle },
        } as CaptionItemData,
      };

    case 'visual':
      return {
        ...base,
        type: 'visual',
        data: {
          visualId: '', // Not in manifest — derived from project context
          compositionId: ctx.compositionId,
          bundleUrl: ctx.bundleUrl ?? '',
          type: 'process',
          description: '',
          width: ctx.visualMeta?.width ?? 1080,
          height: ctx.visualMeta?.height ?? 1920,
          fps: ctx.visualMeta?.fps ?? 30,
          sourceSceneId: extractSceneId(mi.data?.sceneFile),
          displayMode: normalizeDisplayMode(mi.data?.displayMode) as VisualDisplayMode,
          overlayZone: mi.data?.overlayZone,
          speakerBbox: mi.data?.speakerBbox,
          transition: mi.data?.transition
            ? {
                enter: mi.data.transition.enter
                  ? { type: mi.data.transition.enter.type, durationMs: mi.data.transition.enter.durationMs }
                  : undefined,
                exit: mi.data.transition.exit
                  ? { type: mi.data.transition.exit.type, durationMs: mi.data.transition.exit.durationMs }
                  : undefined,
              }
            : undefined,
        } as VisualItemData,
      };

    case 'broll':
      return {
        ...base,
        type: 'broll',
        data: {
          sourceType: mi.data?.sourceType ?? 'upload',
          src: mi.data?.src ?? '',
          filename: mi.data?.filename,
          photographer: mi.data?.photographer,
          volume: mi.data?.volume ?? 1,
        } as BrollItemData,
      };

    case 'text':
      return {
        ...base,
        type: 'text',
        data: {
          text: mi.data?.text ?? '',
          style: mi.data?.style,
          position: mi.data?.position,
          size: mi.data?.size,
        } as TextItemData,
      };

    case 'image':
      return {
        ...base,
        type: 'image',
        data: {
          src: mi.data?.src ?? '',
          width: mi.data?.width ?? 0,
          height: mi.data?.height ?? 0,
          position: mi.data?.position,
          opacity: 1,
        } as ImageItemData,
      };

    default:
      return null;
  }
}

/** Extract scene number from "scenes/Scene3.tsx" → 3 */
export function extractSceneId(sceneFile?: string): number | undefined {
  if (!sceneFile) return undefined;
  const match = sceneFile.match(/Scene(\d+)\.tsx$/);
  return match ? parseInt(match[1], 10) : undefined;
}

/** Convert manifest captionStyle to store CaptionStyle shape */
function convertManifestCaptionStyle(cs: NonNullable<Manifest['captionStyle']>): Partial<CaptionStyle> {
  const result: Partial<CaptionStyle> = {};
  if (cs.displayMode) result.displayMode = cs.displayMode as CaptionStyle['displayMode'];
  if (cs.fontFamily) result.fontFamily = cs.fontFamily;
  if (cs.fontSize) result.fontSize = cs.fontSize;
  if (cs.fontWeight) result.fontWeight = cs.fontWeight;
  if (cs.color) result.color = cs.color;
  if (cs.activeColor) result.activeColor = cs.activeColor;
  if (cs.backgroundColor) result.backgroundColor = cs.backgroundColor;
  if (cs.position) result.position = cs.position as any;
  if (cs.animation) result.animation = cs.animation as any;
  if (cs.effects) result.effects = cs.effects as any;
  if (cs.stroke) result.stroke = cs.stroke as any;
  if (cs.opacity !== undefined) result.opacity = cs.opacity;
  if (cs.letterSpacing !== undefined) result.letterSpacing = cs.letterSpacing;
  if (cs.textTransform) result.textTransform = cs.textTransform as any;
  if (cs.lineHeight !== undefined) result.lineHeight = cs.lineHeight;
  if (cs.wordsPerPhrase !== undefined) result.wordsPerPhrase = cs.wordsPerPhrase;
  return result;
}

/** Convert manifest layout to store LayoutSettings */
function convertManifestLayout(layout: NonNullable<Manifest['layout']>): LayoutSettings {
  return {
    mode: normalizeLayoutMode(layout.mode ?? 'stacked'),
    pip: {
      ...DEFAULT_LAYOUT_SETTINGS.pip,
      ...(layout.pip ?? {}),
    } as LayoutSettings['pip'],
    split: {
      ...DEFAULT_LAYOUT_SETTINGS.split,
      ...(layout.split ?? {}),
    } as LayoutSettings['split'],
  };
}

// ---- Store → Manifest operation helpers ----

/**
 * Build a ManifestOp from a store-level edit.
 * These are used to dispatch PATCH requests to the workspace.
 *
 * IMPORTANT: The discriminant field is `op` (NOT `type`) — must match
 * the ManifestOp schema in @viona/shared/manifest-ops.ts exactly,
 * or the server-side Zod validation will reject the payload.
 */
export type StoreManifestOp =
  | { op: 'update_item'; itemId: string; updates: { startMs?: number; endMs?: number; trackId?: string } }
  | { op: 'update_item_data'; itemId: string; dataUpdates: Record<string, unknown> }
  | { op: 'delete_item'; itemId: string }
  | { op: 'set_layout'; layout: Record<string, unknown> }
  | { op: 'set_display_mode'; itemId: string; displayMode: 'default' | 'fullscreen' | 'overlay' }
  | { op: 'set_transition'; itemId: string; enter?: { type: string; durationMs: number }; exit?: { type: string; durationMs: number } }
  | { op: 'move_item'; itemId: string; startMs: number; endMs: number }
  | { op: 'update_caption_style'; updates: Record<string, unknown> }
  | { op: 'split_item'; itemId: string; atMs: number }
  | { op: 'reorder_tracks'; trackIds: string[] }
  | { op: 'update_video_settings'; updates: Record<string, unknown> };
```

- [ ] **Step 2: Write bridge tests**

Create `scripts/temp/test-manifest-bridge.ts`:

```typescript
import { manifestToStore, extractSceneId } from '../apps/web/src/features/editor-v2/store/manifest-bridge';

// Test 1: extractSceneId
const s1 = extractSceneId('scenes/Scene3.tsx');
console.assert(s1 === 3, `Expected 3, got ${s1}`);

const s2 = extractSceneId('scenes/Scene12.tsx');
console.assert(s2 === 12, `Expected 12, got ${s2}`);

const s3 = extractSceneId(undefined);
console.assert(s3 === undefined, `Expected undefined, got ${s3}`);

// Test 2: manifestToStore with minimal manifest
const minimal = {
  version: 1,
  projectId: 'test-proj',
  durationMs: 10000,
  tracks: [
    { id: 't1', type: 'video', name: 'Video', position: 0 },
    { id: 't2', type: 'caption', name: 'Captions', position: 1 },
  ],
  items: [
    { id: 'i1', trackId: 't1', type: 'video', startMs: 0, endMs: 10000, data: { src: 'test.mp4', crop: { x: 50, y: 50, scale: 1 }, volume: 1, playbackRate: 1 } },
    { id: 'i2', trackId: 't2', type: 'caption', startMs: 0, endMs: 3000, data: { words: [{ text: 'Hello', startMs: 0, endMs: 1500 }, { text: 'World', startMs: 1500, endMs: 3000 }] } },
  ],
};

const result = manifestToStore(minimal as any, {
  videoUrl: '/api/projects/test-proj/video',
  bundleUrl: null,
  compositionId: 'comp-1',
});

console.assert(result.tracks.length === 2, `Expected 2 tracks, got ${result.tracks.length}`);
console.assert(Object.keys(result.items).length === 2, `Expected 2 items`);
console.assert(result.items['i2'].type === 'caption', `Expected caption type`);
const captionData = result.items['i2'].data as any;
console.assert(captionData.words.length === 2, `Expected 2 words`);
console.assert(captionData.text === 'Hello World', `Expected joined text`);
console.assert(result.duration === 10000, `Expected duration 10000`);

// Test 3: Visual item conversion
const withVisual = {
  ...minimal,
  tracks: [...minimal.tracks, { id: 't3', type: 'visual', name: 'Visuals', position: 2 }],
  items: [
    ...minimal.items,
    { id: 'i3', trackId: 't3', type: 'visual', startMs: 0, endMs: 5000, data: { sceneFile: 'scenes/Scene1.tsx', displayMode: 'overlay', frameOffset: 0 } },
  ],
};

const vResult = manifestToStore(withVisual as any, {
  videoUrl: '/api/projects/test-proj/video',
  bundleUrl: '/api/projects/test-proj/workspace/bundle',
  compositionId: 'comp-1',
  visualMeta: { width: 1080, height: 1920, fps: 30 },
});

const visualItem = vResult.items['i3'];
console.assert(visualItem.type === 'visual', `Expected visual type`);
const vd = visualItem.data as any;
console.assert(vd.sourceSceneId === 1, `Expected sceneId 1, got ${vd.sourceSceneId}`);
console.assert(vd.displayMode === 'overlay', `Expected overlay, got ${vd.displayMode}`);

// Test 4: Layout conversion
const withLayout = {
  ...minimal,
  layout: { mode: 'pip', pip: { position: 'top-left', size: 'large' }, split: {} },
};
const lResult = manifestToStore(withLayout as any, {
  videoUrl: '/video', bundleUrl: null, compositionId: 'c1',
});
console.assert(lResult.layoutSettings.mode === 'pip', `Expected pip mode`);

console.log('All manifest-bridge tests passed!');
```

- [ ] **Step 3: Run tests**

Run: `npx tsx scripts/temp/test-manifest-bridge.ts`
Expected: "All manifest-bridge tests passed!"

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/store/manifest-bridge.ts scripts/temp/test-manifest-bridge.ts
git commit -m "feat(web): add manifest-to-store bridge with conversion functions"
```

---

## Chunk 3: Store Refactor

### Task 6: Refactor loadProject to Use Workspace

Modify `loadProject` in `editor-store.ts` to spin up a workspace and populate from the returned manifest instead of the existing DB-based API response. The existing `convertApiProject()` function is kept as a fallback for projects that don't support workspaces yet.

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

- [ ] **Step 1: Read the current loadProject implementation**

Read `editor-store.ts` and find the `loadProject` action (around line 645-730 based on exploration). Note how it calls `api.getProject()`, runs `convertApiProject()`, and populates the store.

- [ ] **Step 2: Add workspace state initialization**

In the initial state object (where `isLoading`, `isDirty`, etc. are initialized), add the workspace defaults:

```typescript
workspaceStatus: 'inactive' as const,
workspaceBundleUrl: null,
workspaceBundleVersion: 0,
workspaceLockHolder: null,
workspaceBundleError: null,
```

- [ ] **Step 3: Add workspace action implementations**

Add these actions alongside the existing actions:

```typescript
setWorkspaceStatus: (status) => set({ workspaceStatus: status }),
setWorkspaceBundleUrl: (url) => set({ workspaceBundleUrl: url }),
incrementBundleVersion: () => set((s) => ({ workspaceBundleVersion: s.workspaceBundleVersion + 1 })),
setWorkspaceLockHolder: (holder) => set({ workspaceLockHolder: holder }),
setWorkspaceBundleError: (error) => set({ workspaceBundleError: error }),
```

- [ ] **Step 4: Add applyRemoteManifestUpdate action**

This is called when a `manifest:updated` WS event arrives from an AI edit. It re-reads the manifest and updates the store:

```typescript
applyRemoteManifestUpdate: async (manifest) => {
  const state = get();
  if (!state.project) return;

  // Preserve existing visual metadata from current store items
  const existingVideoItem = state.itemIds
    .map(id => state.items[id])
    .find(item => item?.type === 'video');
  const existingVisualItem = state.itemIds
    .map(id => state.items[id])
    .find(item => item?.type === 'visual');
  const existingVisualData = existingVisualItem?.data as VisualItemData | undefined;

  const bridgeResult = manifestToStore(manifest, {
    videoUrl: (existingVideoItem?.data as VideoItemData)?.src ?? '',
    bundleUrl: state.workspaceBundleUrl,
    compositionId: existingVisualData?.compositionId ?? '',
    visualMeta: existingVisualData
      ? { width: existingVisualData.width, height: existingVisualData.height, fps: existingVisualData.fps }
      : undefined,
  });

  set({
    tracks: bridgeResult.tracks,
    items: bridgeResult.items,
    itemIds: bridgeResult.itemIds,
    duration: bridgeResult.duration,
    layoutSettings: bridgeResult.layoutSettings,
  });
},
```

- [ ] **Step 5: Modify loadProject to try workspace first**

Wrap the existing loadProject logic so that after fetching the project, it attempts to spin up a workspace. If successful, populate from manifest. If the workspace API isn't available or fails, fall back to the existing `convertApiProject()` path.

The key change inside `loadProject`:

```typescript
// After fetching apiProject (existing code)...
try {
  // Try workspace-based loading
  const wsResult = await api.spinUpWorkspace(projectId);
  const bundleBaseUrl = api.getWorkspaceBundleUrl(projectId);
  // Backend returns `cachedBundleUrl` for new spin-ups, `bundleUrl` when already active
  const initialBundleUrl = wsResult.cachedBundleUrl ?? wsResult.bundleUrl ?? bundleBaseUrl;

  // Convert manifest to store format
  const bridgeResult = manifestToStore(wsResult.manifest, {
    videoUrl: videoUrl, // from existing presigned URL logic
    bundleUrl: initialBundleUrl,
    compositionId: apiProject.compositionId ?? '',
    visualMeta: apiProject.visualMeta,
  });

  set({
    ...bridgeResult, // tracks, items, itemIds, duration, fps, videoSettings, layoutSettings
    workspaceStatus: wsResult.workspaceStatus as any,
    workspaceBundleUrl: bundleBaseUrl,
    workspaceBundleVersion: 0,
    workspaceBundleError: null,
    workspaceLockHolder: null,
    // Keep existing state
    project: project,
    isLoading: false,
    isDirty: false,
    error: null,
    selectedIds: [],
    history: [],
    historyIndex: -1,
  });
} catch (wsError) {
  // Workspace not available — fall back to existing DB-based loading
  console.warn('Workspace spin-up failed, falling back to DB loading:', wsError);
  // ... existing convertApiProject logic ...
}
```

**Important:** Do NOT delete the existing `convertApiProject` function. Keep it as the fallback path. The workspace path is additive.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat(web): refactor loadProject to use workspace manifest with DB fallback"
```

---

### Task 7: Refactor Edit Flow to Dispatch Manifest Operations

Modify key store actions to dispatch manifest operations to the workspace API after updating local state. The existing `saveProject()` debounced approach is kept as fallback (for non-workspace mode), but workspace-mode edits go through `PATCH /workspace/manifest` immediately.

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

- [ ] **Step 1: Create a helper to dispatch manifest ops**

Add a helper function inside the store (or at module level) that sends a manifest op if the workspace is active:

```typescript
/** Dispatch a manifest operation to the workspace if active, otherwise mark dirty for legacy save */
const dispatchManifestOp = async (op: StoreManifestOp): Promise<void> => {
  const state = get();
  if (state.workspaceStatus !== 'active' || !state.project) {
    // Not in workspace mode — fall back to legacy debounced save
    set({ isDirty: true });
    debouncedSave();
    return;
  }

  try {
    await api.applyManifestOp(state.project.id, op);
    // Success — WS will confirm via manifest:updated
  } catch (err) {
    console.error('Failed to apply manifest op:', err);
    // Mark dirty so legacy save picks it up as recovery
    set({ isDirty: true });
  }
};
```

- [ ] **Step 2: Wire manifest ops to key store actions**

Add `dispatchManifestOp()` calls to the following existing actions. The local store update (via immer `set()`) happens first for instant feedback, then the manifest op is dispatched async:

**`moveItem` / `resizeItem`:**
After the local update, dispatch:
```typescript
dispatchManifestOp({ op: 'move_item', itemId: id, startMs, endMs: item.endMs });
```

**`updateVisualDisplayMode`:**
After the local update:
```typescript
dispatchManifestOp({ op: 'set_display_mode', itemId, displayMode });
```

**`updateVisualTransition`:**
After the local update:
```typescript
dispatchManifestOp({ op: 'set_transition', itemId, enter: transition?.enter, exit: transition?.exit });
```

**`updateLayoutSettings` / `setLayoutMode` / `setLayoutPreset`:**
After the local update:
```typescript
dispatchManifestOp({ op: 'set_layout', layout: { mode, pip, split } });
```

**`updateAllCaptionStyles` / `updateSelectedCaptionStyles`:**
After the local update:
```typescript
dispatchManifestOp({ op: 'update_caption_style', updates: { ...styleUpdates } });
```

**`splitItem`:**
After the local update:
```typescript
dispatchManifestOp({ op: 'split_item', itemId, atMs });
```

**`deleteItems`:**
For each deleted item:
```typescript
dispatchManifestOp({ op: 'delete_item', itemId: id });
```

**`updateVideoSettings`:**
After the local update:
```typescript
dispatchManifestOp({ op: 'update_video_settings', updates: { ...settingsUpdates } });
```

**`reorderTracks`:**
After the local update:
```typescript
dispatchManifestOp({ op: 'reorder_tracks', trackIds });
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat(web): dispatch manifest ops from store actions when workspace active"
```

---

## Chunk 4: Bundle Loading + Editor Wiring

### Task 8: Modify DynamicVisualLoader for Workspace Bundles

Update `DynamicVisualLoader` to support loading from the workspace bundle endpoint. When a workspace is active, bundles come from `/api/projects/{id}/workspace/bundle/` instead of the old S3 CJS path. The existing CJS eval approach is kept as fallback.

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/DynamicVisualLoader.tsx`

- [ ] **Step 1: Read current DynamicVisualLoader**

Read `DynamicVisualLoader.tsx` fully. Understand the module loading, caching, and rendering logic.

- [ ] **Step 2: Add workspace bundle version prop**

Add a `workspaceBundleVersion` prop to the component that forces reload when incremented:

```typescript
interface DynamicVisualLoaderProps {
  bundleUrl: string;
  compositionId: string;
  inputProps?: Record<string, unknown>;
  workspaceBundleVersion?: number; // Incremented on bundle:ready to force reload
}
```

- [ ] **Step 3: Include version in cache key**

Modify the module cache key to include `workspaceBundleVersion`:

```typescript
const cacheKey = `${compositionUrl}:${compositionId}:${urlVersion}:${workspaceBundleVersion ?? 0}`;
```

And add `workspaceBundleVersion` to the effect dependency array so the component re-fetches when a new bundle is ready.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/player/DynamicVisualLoader.tsx
git commit -m "feat(web): add workspace bundle version prop to DynamicVisualLoader for cache busting"
```

---

### Task 9: Wire Workspace WS Events in Editor

Connect the `useWorkspaceWS` hook in the Editor component to update the store when workspace events arrive.

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`

- [ ] **Step 1: Read current Editor.tsx**

Read `Editor.tsx` to understand the component structure, hooks used, and existing WS integration.

- [ ] **Step 2: Add useWorkspaceWS hook**

Import and wire the workspace WS hook:

```typescript
import { useWorkspaceWS } from './hooks/use-workspace-ws';
import api from '@/lib/api';

// Inside the Editor component, after existing hooks:
const projectId = useProjectId();
const store = useEditorStore();

useWorkspaceWS(projectId, {
  onWorkspaceReady: (data) => {
    const s = store.getState();
    s.setWorkspaceStatus('active');
    if (data.bundleUrl) {
      s.setWorkspaceBundleUrl(data.bundleUrl);
    }
  },
  onManifestUpdated: async (data) => {
    // Only re-read if the update came from AI (not our own echo)
    if (data.source === 'ai' && projectId) {
      try {
        const manifest = await api.readManifest(projectId);
        store.getState().applyRemoteManifestUpdate(manifest);
      } catch (err) {
        console.error('Failed to apply remote manifest update:', err);
      }
    }
  },
  onBundleReady: (data) => {
    const s = store.getState();
    s.setWorkspaceBundleError(null);
    s.incrementBundleVersion();
    if (data.bundleUrl) {
      s.setWorkspaceBundleUrl(data.bundleUrl);
    }
  },
  onBundleError: (data) => {
    store.getState().setWorkspaceBundleError(data.error);
  },
  onLockAcquired: (data) => {
    store.getState().setWorkspaceLockHolder(data.holder);
  },
  onLockReleased: () => {
    store.getState().setWorkspaceLockHolder(null);
  },
  onWorkspaceTeardown: () => {
    const s = store.getState();
    s.setWorkspaceStatus('inactive');
    s.setWorkspaceBundleUrl(null);
    s.setWorkspaceLockHolder(null);
  },
});
```

- [ ] **Step 3: Add AI lock indicator to the UI**

Add a visual indicator when the AI holds the lock. Place it near the player or header:

```tsx
{store.workspaceLockHolder === 'ai' && (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-300 text-sm">
    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
    AI is editing...
  </div>
)}
```

- [ ] **Step 4: Add bundle error indicator**

Show a banner when the bundler fails:

```tsx
{store.workspaceBundleError && (
  <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
    Bundle error: {store.workspaceBundleError}
  </div>
)}
```

- [ ] **Step 5: Pass workspaceBundleVersion to visual items**

In the Composition where `DynamicVisualLoader` is rendered, pass the `workspaceBundleVersion` from the store so bundle reloads are triggered by `bundle:ready` events:

Find where `<DynamicVisualLoader>` is used in `Composition.tsx` and add:

```tsx
<DynamicVisualLoader
  bundleUrl={group.bundleUrl}
  compositionId={group.compositionId}
  inputProps={inputProps}
  workspaceBundleVersion={workspaceBundleVersion}
/>
```

The `workspaceBundleVersion` value is passed down from the Editor through the Player to the Composition. Add it to the composition's input props or pass through the Remotion `inputProps`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx apps/web/src/features/editor-v2/player/Composition.tsx
git commit -m "feat(web): wire workspace WS events, lock indicator, and bundle version to editor"
```

---

### Task 10: Workspace Teardown on Unmount

When the user navigates away from the editor, tear down the workspace to release resources. This also prevents stale workspaces from accumulating (the idle timeout handles this server-side, but explicit teardown is more responsive).

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`

- [ ] **Step 1: Add cleanup effect**

Add a cleanup effect in Editor.tsx that tears down the workspace on unmount:

```typescript
// Workspace cleanup on unmount
useEffect(() => {
  return () => {
    const state = store.getState();
    if (state.project && state.workspaceStatus === 'active') {
      // Fire-and-forget — we're unmounting so we can't await
      api.tearDownWorkspace(state.project.id).catch((err) => {
        console.warn('Failed to tear down workspace on unmount:', err);
      });
    }
  };
}, []); // Empty deps — runs only on unmount
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "feat(web): tear down workspace on editor unmount"
```

---

### Task 11: Add Workspace Store Selectors

Add React hooks for the new workspace state fields so components can subscribe to them efficiently.

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/use-editor-store.ts`

- [ ] **Step 1: Read existing selectors**

Read `use-editor-store.ts` to see the pattern for existing selectors (they use `useShallow`, `useDeepSelector`, etc.).

- [ ] **Step 2: Add workspace selectors**

```typescript
/** Workspace lifecycle status */
export function useWorkspaceStatus() {
  return useEditorStore((s) => s.workspaceStatus);
}

/** Whether workspace is active (ready for manifest ops) */
export function useIsWorkspaceActive() {
  return useEditorStore((s) => s.workspaceStatus === 'active');
}

/** Current workspace bundle URL */
export function useWorkspaceBundleUrl() {
  return useEditorStore((s) => s.workspaceBundleUrl);
}

/** Bundle version — changes trigger visual reload */
export function useWorkspaceBundleVersion() {
  return useEditorStore((s) => s.workspaceBundleVersion);
}

/** Who holds the workspace lock (null if unlocked) */
export function useWorkspaceLockHolder() {
  return useEditorStore((s) => s.workspaceLockHolder);
}

/** Bundle error message (null if no error) */
export function useWorkspaceBundleError() {
  return useEditorStore((s) => s.workspaceBundleError);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/use-editor-store.ts
git commit -m "feat(web): add workspace state selectors to use-editor-store"
```

---

## Chunk 5: Integration Testing

### Task 12: Integration Smoke Test

Create a manual integration test script that verifies the workspace flow works end-to-end when the backend services are running.

**Files:**
- Create: `scripts/temp/test-workspace-frontend-integration.ts`

- [ ] **Step 1: Write the test**

```typescript
/**
 * Workspace Frontend Integration Smoke Test
 *
 * Prerequisites: API server running on localhost:4000 with Redis + DB
 * Run: npx tsx scripts/temp/test-workspace-frontend-integration.ts
 */

const API_URL = 'http://localhost:4000';

// These test the API methods that the frontend will call.
// Replace with a valid projectId and auth token for your dev environment.
const PROJECT_ID = process.env.TEST_PROJECT_ID || 'test';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

async function fetchApi(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log('=== Workspace Frontend Integration Test ===\n');

  if (!AUTH_TOKEN) {
    console.log('Skipping (no TEST_AUTH_TOKEN set). Set TEST_PROJECT_ID and TEST_AUTH_TOKEN to run.');
    console.log('This test requires a running API server with valid auth.');
    return;
  }

  // 1. Spin up workspace
  console.log('1. Spinning up workspace...');
  const ws = await fetchApi(`/api/projects/${PROJECT_ID}/workspace`, { method: 'POST' });
  console.log(`   Status: ${ws.workspaceStatus}`);
  console.log(`   Manifest tracks: ${ws.manifest?.tracks?.length ?? 'N/A'}`);
  console.log(`   Manifest items: ${ws.manifest?.items?.length ?? 'N/A'}`);

  // 2. Read manifest
  console.log('\n2. Reading manifest...');
  const manifest = await fetchApi(`/api/projects/${PROJECT_ID}/workspace/manifest`);
  console.log(`   Version: ${manifest.version}`);
  console.log(`   Duration: ${manifest.durationMs}ms`);

  // 3. Check lock status
  console.log('\n3. Checking lock status...');
  const lock = await fetchApi(`/api/projects/${PROJECT_ID}/workspace/lock`);
  console.log(`   Locked: ${lock.locked}`);

  // 4. Tear down
  console.log('\n4. Tearing down workspace...');
  const td = await fetchApi(`/api/projects/${PROJECT_ID}/workspace`, { method: 'DELETE' });
  console.log(`   Status: ${td.status}`);

  console.log('\n=== All checks passed ===');
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/temp/test-workspace-frontend-integration.ts
git commit -m "test: add workspace frontend integration smoke test"
```
