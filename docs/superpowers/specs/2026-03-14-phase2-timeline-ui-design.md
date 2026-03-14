# Phase 2: Timeline UI, Properties Panel, and Persistence — Design Spec

## Goal

Make the editor fully functional with the v2 manifest: users can visually edit items via the timeline and properties panel, all changes persist to DB in real-time, and a full NLE-style keyframe editor gives fine-grained control over transforms, filters, and animations.

## Scope

1. **manifest-bridge v2** — store ↔ v2 manifest conversion
2. **Timeline UI v2** — existing canvas timeline works with v2 manifests, shows transform/keyframe indicators
3. **Properties panel** — transform, filters, data tabs with per-property keyframe toggle
4. **Keyframe editor** — mini timeline, property lanes, curve editor, keyframe list
5. **Real-time DB persistence** — every manifest write syncs sandbox → DB
6. **Store action wiring** — all mutating store actions dispatch ops to sandbox

**Out of scope:** Export pipeline, collaborative editing, undo/redo syncing across clients.

---

## Architecture

### Data Flow (Single Source of Truth)

```
User edits timeline/properties
  → Store action (optimistic local update)
  → Dispatch manifest op to sandbox API
  → Sandbox writeManifest() + notifyManifestUpdated()
  → API callback: fetch manifest from sandbox, sync to DB
  → WebSocket: manifest:updated → frontend
  → Player re-renders with updated manifest
```

The **sandbox manifest.json** is the source of truth during an active session. The **DB** is durable storage. The **store** is a local cache for fast UI.

- **Writes:** store → sandbox → DB (always through sandbox)
- **Reads:** DB → sandbox (on init) → store (on load)
- **On sandbox resume:** if DB is newer than volume backup, API regenerates manifest from DB via `dbToManifest()` and sends to sandbox via `/init`

### Why Optimistic Updates

The store updates locally first (optimistic) then dispatches to sandbox. This keeps the UI responsive — the user sees their drag/trim/split immediately without waiting for a round-trip. If the sandbox write fails, the next `manifest:updated` event from the sandbox will reconcile the store.

---

## Section 1: manifest-bridge v2

### Store Type Changes

Update `TimelineItemType` in `store/types.ts` to include v2 item types:

```typescript
// Current: 'video' | 'audio' | 'caption' | 'text' | 'image' | 'visual' | 'broll'
// Updated: add 'scene' and 'shape', keep 'visual' and 'broll' for backward compat
export type TimelineItemType = 'video' | 'audio' | 'caption' | 'text' | 'image' | 'visual' | 'broll' | 'scene' | 'shape';
```

The `scene` type is the v2 equivalent of `visual` (AI-generated Remotion compositions). `shape` is new (rectangles, circles, lines). Both `visual` and `scene` can coexist — `visual` from v1 manifests, `scene` from v2 manifests.

Add to `TimelineItem` in `store/types.ts`:

```typescript
interface TimelineItem {
  // ... existing fields ...
  transform?: Transform;
  keyframes?: Keyframe[];
  filters?: Filters;
}

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
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring' | `cubic-bezier(${string})`;
}

interface Filters {
  brightness?: number;  // 0–2, default 1 (maps to CSS filter 0%–200%)
  contrast?: number;    // 0–2, default 1
  saturation?: number;  // 0–2, default 1
  blur?: number;        // 0–50, default 0 (pixels)
  hue?: number;         // -180–180, default 0 (degrees)
  grayscale?: number;   // 0–1, default 0
  sepia?: number;       // 0–1, default 0
}
```

Add `ShapeItemData` type for `shape` items (field name `shape` matches v2 Zod schema `shapeItemDataV2Schema`):

```typescript
interface ShapeItemData {
  shape: 'rectangle' | 'circle' | 'line';  // NOT 'shapeType' — matches manifest-v2.ts
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
}
```

### manifestToStore() Updates

Detect manifest version (check for `version: 2` field or presence of per-item `transform` fields). For v2 manifests:

- Map v2 track types directly (`video|audio|overlay|caption`). The store `Track['type']` union needs to accept `overlay` as a valid type (add it alongside existing types).
- Read per-item `transform`, `keyframes`, `filters` into the new store fields.
- Map v2 item types directly — `scene` maps to store's `scene` type (not `visual`), `shape` maps to `shape`. The v2 tools accept `scene` directly.
- **layoutSettings**: v2 manifests don't have a global `layout` field. When converting v2, return default `layoutSettings` (stacked mode with defaults). The `ManifestToStoreResult` keeps `layoutSettings` for backward compat with v1 manifests but the properties panel ignores it for v2 — per-item transforms replace global layout.
- **videoSettings**: v2 manifests don't use global `videoSettings` (crop/scale). Return defaults (`cropX: 50, cropY: 50, scale: 1`) and use `canvas.width/height` for dimensions. Per-item crop is in `item.data.crop` for video items.
- **ManifestToStoreContext**: Update to make `videoUrl` optional for v2 (v2 uses `assets` map for source URLs). Add `assets?: Record<string, string>` field. For v2, store `assets` map in the editor store state for player access.
- Store `assets` map in a new `assets` field on the store state (alongside existing fields).
- Caption word timestamps: v2 stores absolute timestamps. Convert to relative (relative to item.startMs) for the store, matching existing store convention.

### storeToManifest() (New)

Reverse conversion for persistence. Called when syncing store → sandbox:

- Convert store items back to v2 manifest format.
- Write `transform`, `keyframes`, `filters` from store items.
- Convert store track types back to v2 (`overlay` stays `overlay`, `visual` → `overlay`).
- Convert caption word timestamps from relative back to absolute.
- Build `assets` map from store state.

### Sandbox API for Granular Ops

The sandbox's `PATCH /manifest` endpoint currently replaces the entire manifest via `updateManifestTool`. The sandbox also has granular tools (`addTrack`, `updateItem`, `removeItem`, etc.) but they're only accessible via the agent MCP interface, not HTTP.

**Solution:** Add a new `POST /ops` endpoint to the sandbox agent-server that accepts an operation name + input and routes to the correct granular tool:

```typescript
// In agent-server.ts
app.post('/ops', async (req, res) => {
  const { tool, input } = req.body;
  const toolMap: Record<string, any> = {
    addTrack: addTrackTool,
    updateTrack: updateTrackTool,
    removeTrack: removeTrackTool,
    addItem: addItemTool,
    updateItem: updateItemTool,
    removeItem: removeItemTool,
    splitVideo: splitVideoTool,
  };
  const t = toolMap[tool];
  if (!t) return res.status(400).json({ error: `Unknown tool: ${tool}` });
  const resultStr = await t.execute(input);
  // Tools return strings — parse to detect errors vs structured results
  try {
    const parsed = JSON.parse(resultStr);
    res.json({ ok: true, result: parsed });
  } catch {
    // Non-JSON result = error message (e.g., "Item not found: ...")
    res.status(400).json({ ok: false, error: resultStr });
  }
});
```

**Note:** All manifest tools return strings (JSON-stringified objects on success, error message strings on failure). They don't throw — errors are returned as plain text like `"Item not found: item-abc"`. The `/ops` endpoint parses the result to detect success vs failure and uses appropriate HTTP status codes so `dispatchToSandbox()` can rely on response status.

This reuses the existing tool implementations with their mutex, deep-merge, and `notifyManifestUpdated()` calls.

### Manifest Op Mapping

Map store actions to sandbox ops via `POST /ops`:

| Store Action | Sandbox Tool | Notes |
|---|---|---|
| `moveItem` | `updateItem` | startMs, endMs, trackId |
| `resizeItem` | `updateItem` | startMs, endMs |
| `updateItem` | `updateItem` | any field |
| `updateItemData` | `updateItem` | data deep-merge |
| `addItem` | `addItem` | full item |
| `deleteItems` | `removeItem` | per item |
| `addTrack` | `addTrack` | type, name |
| `deleteTrack` | `removeTrack` | trackId |
| `updateTrack` | `updateTrack` | name, position |
| `reorderTracks` | `updateTrack` | position per track |
| `splitItem` | `splitVideo` (video only) or `removeItem` + 2× `addItem` (other types) | itemId, atMs |
| `nudgeItems` | `updateItem` | startMs, endMs per item |
| `trimItems` | `updateItem` | startMs or endMs |
| `pasteItems` | `addItem` | per item |
| `duplicateItems` | `addItem` | per item |
| `updateTransform` | `updateItem` | transform deep-merge |
| `updateFilters` | `updateItem` | filters deep-merge |
| `updateKeyframes` | `updateItem` | keyframes replace |

### Dispatch Helper

Create `store/manifest-dispatch.ts` — a single function that takes a store action description and calls the sandbox API:

```typescript
async function dispatchToSandbox(
  projectId: string,
  ops: SandboxOp[],
): Promise<void>
```

Each `SandboxOp` has `{ tool: string; input: object }`. The dispatch helper calls `POST /api/projects/:id/sandbox/ops` which the API proxies to the sandbox's `POST /ops` endpoint.

For batch operations (e.g., `deleteItems` with multiple IDs, `nudgeItems` with multiple items), send ops sequentially to the sandbox (the mutex in manifest-ops.ts handles serialization).

### Implementation Notes

**splitVideo limitation:** The sandbox `splitVideo` tool only works on `video` type items. For splitting captions, audio, or other types, `dispatchToSandbox()` should decompose into `removeItem` + two `addItem` ops (calculating the split data client-side).

**updateManifestTool gap:** The existing `PATCH /manifest` endpoint (which calls `updateManifestTool`) does NOT call `notifyManifestUpdated()` — it only calls `triggerRebuild()`. This is a pre-existing issue. As a Phase 2 prerequisite, add `notifyManifestUpdated()` to `updateManifestTool.execute()` so that any code path writing to manifest.json triggers the DB sync flow. However, since Phase 2 uses `POST /ops` (which routes to granular tools that already call `notifyManifestUpdated()`), this gap only affects the agent's direct manifest writes.

**v2 asset resolution:** In v2 manifests, `item.data.src` contains an asset key (e.g., `"source.mp4"`) that maps to a presigned URL via the manifest's `assets` map. The `manifestToStore()` function should resolve these: `const resolvedSrc = assets[item.data.src] ?? item.data.src`. If `assets` is unavailable (e.g., sandbox not booted yet), fall back to the raw src value. Store the `assets` map in a new `assets: Record<string, string>` field on the editor store state for the player.

---

## Section 2: Timeline UI v2 Compatibility

### Track Type Mapping

The canvas renderers currently route by track type. V2 has 4 track types (`video|audio|overlay|caption`) but items within `overlay` tracks can be `text`, `image`, `scene`, `shape`. The renderers should route by **item type**, not track type.

Update `CanvasRenderer.ts` to select renderer based on `item.type`:

| Item Type | Renderer | Color |
|---|---|---|
| `video` | `VideoRenderer` | Blue `#3b82f6` |
| `audio` | `AudioRenderer` | Green `#22c55e` |
| `caption` | `CaptionRenderer` | Purple `#a855f7` |
| `text` | New `TextRenderer` | Amber `#f59e0b` |
| `image` | New `ImageRenderer` | Teal `#14b8a6` |
| `scene` | `VisualRenderer` (reuse) | Indigo `#6366f1` |
| `shape` | New `ShapeRenderer` | Pink `#ec4899` |

### Visual Indicators on Items

When rendering items on the canvas, add small indicators:

1. **Transform badge** — small icon (move arrows) at top-left of item when `transform` differs from defaults (not full-frame, not zero rotation, not full opacity).
2. **Keyframe diamonds** — when item is selected, render diamond markers along the bottom edge of the item at each keyframe's `timeMs` position. Color: purple `#a78bfa`.
3. **Filter badge** — small circle at top-right when `filters` has any non-default value. Color: orange `#f97316`.

These are rendered in `BaseRenderer.ts` so all item types get them.

### Keyframe Diamonds on Selected Items

When an item is selected, expand its visual to show a **keyframe lane** at the bottom (4px strip). Each keyframe is a diamond marker. The user can:

- **Click** a diamond → seek to that keyframe's time
- **Drag** a diamond left/right → re-time the keyframe
- **Double-click** empty area → add keyframe at that time
- **Right-click** a diamond → delete keyframe

This is rendered in `BaseRenderer.ts` and interaction is handled in `DragManager.ts` (new `keyframe-drag` drag type).

### Context Menu Updates

Add to the existing `ContextMenu.tsx`:

- "Edit Properties" → opens/focuses the properties panel for the selected item
- "Add Keyframe at Playhead" → adds a keyframe at current playhead time with current transform values
- "Clear All Keyframes" → removes all keyframes from selected items
- "Reset Transform" → resets transform to defaults (full-frame, no rotation, full opacity)
- "Reset Filters" → resets all filters to defaults

---

## Section 3: Properties Panel

### Location

The properties panel lives in the existing right panel (`RightPanel.tsx`). When an item is selected, it shows as a new tab alongside existing tabs. When no item is selected, the tab is hidden.

### Tab Structure

Three tabs within the properties panel:

#### Transform Tab

| Control | Type | Range | Default |
|---|---|---|---|
| X | Numeric input + drag | any px or % | 0 |
| Y | Numeric input + drag | any px or % | 0 |
| Width | Numeric input + drag | any px or % | 100% |
| Height | Numeric input + drag | any px or % | 100% |
| Rotation | Numeric input + drag | -360° to 360° | 0 |
| Opacity | Slider | 0% to 100% | 100% |

Each property row has a **keyframe toggle** (diamond icon). When active (purple), editing the value creates/updates a keyframe at the current playhead time instead of changing the base transform.

Layout: two-column grid for X/Y and W/H, single row for Rotation and Opacity.

#### Filters Tab

The UI shows percentages for user-friendliness, but the store and manifest use **decimal values** (matching CSS filter function conventions and `TransformWrapper.tsx`'s `buildFilterString()`):

| Control | UI Range | Store Value Range | Default (store) | CSS Function |
|---|---|---|---|---|
| Brightness | 0–200% | 0–2 | 1 | `brightness(1)` |
| Contrast | 0–200% | 0–2 | 1 | `contrast(1)` |
| Saturation | 0–200% | 0–2 | 1 | `saturate(1)` |
| Blur | 0–50px | 0–50 | 0 | `blur(0px)` |
| Hue | -180° to 180° | -180–180 | 0 | `hue-rotate(0deg)` |
| Grayscale | 0–100% | 0–1 | 0 | `grayscale(0)` |
| Sepia | 0–100% | 0–1 | 0 | `sepia(0)` |

The slider component converts between UI percentage and store decimal (e.g., brightness slider at 150% → store value 1.5). No conversion needed when writing to manifest — store values pass through directly.

Each filter has a reset button (appears when non-default). "Reset All Filters" button at top.

Filters do NOT support keyframes in this phase (the v2 schema supports it, but the UI complexity of keyframing 7 filter properties is deferred).

#### Data Tab

Type-specific properties for the selected item. Replaces scattered property editors:

- **Video:** volume slider, playback rate, crop controls (x, y, scale), startFrom offset
- **Audio:** volume slider, playback rate
- **Text:** text content (textarea), font family dropdown, font size, font weight, color picker, background color, text align, padding, border radius
- **Image:** objectFit dropdown (contain, cover, fill)
- **Scene:** scene file name (read-only), link to open scene in AI chat
- **Shape:** shape type (rectangle, circle, line), fill color, stroke color, stroke width, border radius
- **Caption:** links to existing caption style panel (no duplication)

### Numeric Input Component

A reusable `NumberInput` component used throughout the panel:

- Click to edit as text input
- Drag left/right to adjust value (with configurable step size)
- Hold Shift while dragging for 10x precision
- Hold Alt while dragging for 0.1x precision
- Shows unit suffix (px, %, deg)
- Supports both `number` and `string` values (for percentage inputs like "50%")

---

## Section 4: Keyframe Editor

### Location

Below the properties panel in the right panel, or as an expandable section. Visible when the selected item has keyframes or when the user is in keyframe editing mode.

### Components

#### Mini Timeline

A horizontal bar showing the selected item's time range (startMs to endMs). Features:

- **Time ruler** at top with tick marks
- **Property lanes** — one row per animated property. Each lane shows diamond markers at keyframe positions.
- **Playhead** — vertical red line at current time position
- **Interactions:**
  - Click on timeline → seek to that time
  - Drag diamond → re-time keyframe
  - Double-click empty space in lane → add keyframe
  - Right-click diamond → context menu (delete, edit value)

#### Property Lanes

One lane per transform property that has keyframes. Each lane:

- Label on left (e.g., "X", "Opacity")
- Horizontal track with diamond markers
- Interpolation preview line between diamonds (thin line showing the easing shape)

Properties with no keyframes are collapsed to a single row showing "No keyframes — click + to add".

#### Curve Editor

When a segment between two keyframes is selected (click on the interpolation line):

- Shows a bezier curve visualization (100×100 normalized space)
- **Easing presets** as clickable pills: Linear, Ease In, Ease Out, Ease In Out, Spring
- **Custom bezier** — two draggable control points on the curve for manual easing
- Shows computed control point values (e.g., `cubic-bezier(0.4, 0, 0.2, 1)`)

The curve editor maps to the keyframe's `easing` field. Preset names map directly. Custom bezier stores as a string like `cubic-bezier(0.4,0,0.2,1)` (extend the easing enum).

#### Keyframe List

A table below the curve editor:

| Time | Property | Value | Easing | Actions |
|---|---|---|---|---|
| 0.8s | X | 0px | ease-in-out | Delete |
| 2.4s | X | 120px | linear | Delete |

- Inline editable time, value, and easing fields
- Click row → seek to keyframe time
- Delete button per row
- "Add Keyframe" button at bottom

### Easing Extension

The v2 schema defines easing as `'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring'`. Extend to also accept `cubic-bezier(...)` strings for custom curves.

**Zod schema change** in `packages/shared/src/manifest.ts` — wherever keyframe easing is validated, change from a strict enum to a union:

```typescript
const easingSchema = z.union([
  z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']),
  z.string().regex(/^cubic-bezier\(\s*[\d.]+\s*,\s*[\d.-]+\s*,\s*[\d.]+\s*,\s*[\d.-]+\s*\)$/),
]);
```

**TransformWrapper.tsx update** — add cubic-bezier parsing to `getEasingFn()`:

```typescript
function getEasingFn(easing?: string): ((t: number) => number) | undefined {
  if (!easing) return undefined;
  if (easing.startsWith('cubic-bezier(')) {
    const match = easing.match(/cubic-bezier\(([\d.]+),\s*([\d.-]+),\s*([\d.]+),\s*([\d.-]+)\)/);
    if (match) {
      const [, x1, y1, x2, y2] = match.map(Number);
      return Easing.bezier(x1, y1, x2, y2);
    }
  }
  // ... existing switch cases ...
}
```

Remotion's `Easing.bezier(x1, y1, x2, y2)` returns a function compatible with `interpolate()`'s `easing` option.

---

## Section 5: Real-Time DB Persistence

### Sync Flow

```
Sandbox writeManifest()
  → notifyManifestUpdated() POSTs to API
  → API route: POST /internal/sandbox/:id/manifest-updated
  → API fetches full manifest from sandbox: GET /manifest
  → API calls syncManifestToDb(projectId, manifest)
  → DB tracks/items tables updated
  → WebSocket: manifest:updated → frontend
```

### syncManifestToDb()

New function in `packages/api/src/sandbox/sync.ts`:

```typescript
async function syncManifestToDb(projectId: string, manifest: ManifestV2): Promise<void>
```

Logic:

1. **Tracks** — upsert: match by `track.id`. Insert new tracks, update existing (name, type, position), delete tracks not in manifest.
2. **Items** — upsert: match by `item.id`. Insert new items, update existing (startMs, endMs, trackId, data including transform/keyframes/filters), delete items not in manifest.
3. **Item data column** — store `transform`, `keyframes`, `filters` inside the item's `data` JSONB column alongside type-specific data:
   ```json
   {
     "src": "source.mp4",
     "volume": 1,
     "_transform": { "x": 0, "y": "50%", "width": "100%", "height": "50%" },
     "_keyframes": [{ "timeMs": 800, "props": { "x": 120 }, "easing": "ease-in-out" }],
     "_filters": { "brightness": 1.2 }
   }
   ```
   Use `_` prefix to distinguish manifest metadata from type-specific data.
4. **Project-level fields** — update `project.durationMs`, `project.fps` from manifest.
5. **Transaction** — all DB writes in a single transaction for atomicity.

### manifestToDb() Update

The existing `manifestToDb()` in `packages/shared/src/manifest-convert.ts` needs to be updated to properly round-trip v2 fields. Currently it's lossy for transforms (tries to reconstruct layout from transforms). Instead:

- Store `transform`, `keyframes`, `filters` directly in item data with `_` prefix
- Don't attempt to reconstruct global layout — v2 manifests don't have one
- Store `assets` map as a project-level metadata field (or skip — assets are regenerated on sandbox boot via syncAssets)

### Debouncing

The API receives `manifest-updated` callbacks on every manifest write. For rapid edits (e.g., dragging an item), this could be many writes per second. The sync should be **debounced** at the API level:

- On receiving `manifest-updated`, start a 2-second timer
- If another `manifest-updated` arrives before the timer fires, reset the timer
- When the timer fires, fetch manifest and sync to DB
- This ensures at most one DB sync per 2 seconds of continuous editing

### Error Handling

- If the sandbox is unreachable when trying to fetch manifest, log and skip (next callback will retry)
- If DB sync fails, log the error but don't block the WebSocket notification (frontend should still get the update for preview)
- On sandbox resume, always regenerate manifest from DB (DB is the durable source)

---

## Section 6: Store Action Wiring

### Actions That Need Sandbox Dispatch

These 22 store actions mutate items/tracks but currently don't dispatch to sandbox:

**Track mutations:**
- `addTrack` → `addTrack` sandbox tool
- `updateTrack` → `updateTrack` sandbox tool
- `deleteTrack` → `removeTrack` sandbox tool

**Item mutations:**
- `addItem` → `addItem` sandbox tool
- `updateItem` → `updateItem` sandbox tool
- `updateItemData` → `updateItem` sandbox tool (data deep-merge)
- `nudgeItems` → `updateItem` per item (startMs, endMs)
- `trimItems` → `updateItem` per item (startMs or endMs)
- `pasteItems` → `addItem` per item
- `duplicateItems` → `addItem` per item
- `deleteTimeRange` → `removeItem` + `updateItem` for splits

**Caption mutations:**
- `updateSelectedCaptionStyles` → `updateItem` per caption (data merge)
- `updateWordStyleOverrides` → `updateItem` (data merge)
- `splitCaption` → `removeItem` + `addItem` × 2
- `mergeCaptions` → `removeItem` × 2 + `addItem`
- `updateCaptionText` → `updateItem` (data merge)

**New actions (Phase 2):**
- `updateTransform` → `updateItem` (transform deep-merge)
- `updateFilters` → `updateItem` (filters deep-merge)
- `updateKeyframes` → `updateItem` (keyframes replace)
- `addKeyframeAtTime` → `updateItem` (keyframes append + sort)
- `deleteKeyframe` → `updateItem` (keyframes filter)
- `updateKeyframeEasing` → `updateItem` (keyframes update)

### Actions That Should NOT Dispatch

These actions are UI-only state (selection, viewport, playback) and don't need sandbox sync:

- All selection actions (select, clearSelection, selectRange, etc.)
- Playback actions (play, pause, setCurrentTime)
- Viewport actions (setZoom, setScrollX/Y)
- UI flags (splitMode, showCaptions, safeZonePlatform, etc.)
- Clipboard (copyItems — paste dispatches via addItem)
- Workspace/sandbox status setters

### Actions Needing Special Handling

- `separateAudio` — currently uses a separate API endpoint. In v2, this should: create an audio track via sandbox, move audio data to new item, mute the video item's audio. Requires multiple sandbox ops.
- `splitAllAtPlayhead` — calls splitItem internally per item. Each splitItem already dispatches.
- `applyRemoteManifestUpdate` — this is the RECEIVE path (sandbox → store). Should NOT dispatch back to sandbox (would create infinite loop).

### Implementation Pattern

Each store action follows this pattern:

```typescript
moveItem: (id, trackId, startMs) => {
  // 1. Optimistic local update
  set(produce((draft) => {
    const item = draft.items[id];
    item.trackId = trackId;
    item.startMs = startMs;
    item.endMs = startMs + (item.endMs - item.startMs);
  }));

  // 2. Dispatch to sandbox (fire-and-forget)
  const { projectId } = get();
  dispatchToSandbox(projectId, [{
    tool: 'updateItem',
    input: { itemId: id, trackId, startMs, endMs: startMs + duration },
  }]);
},
```

The dispatch is fire-and-forget. If it fails, the next `manifest:updated` from the sandbox will reconcile the store to the sandbox's state (which may not have the failed edit).

---

## File Structure

### New Files

```
apps/web/src/features/editor-v2/
  store/
    manifest-dispatch.ts          — dispatchToSandbox() helper
  components/
    PropertiesPanel.tsx           — main properties panel container
    properties/
      TransformTab.tsx            — transform controls with keyframe toggles
      FiltersTab.tsx              — filter sliders
      DataTab.tsx                 — type-specific data controls
      NumberInput.tsx             — drag-to-adjust numeric input
      KeyframeToggle.tsx          — diamond toggle per property
    keyframe-editor/
      KeyframeEditor.tsx          — main keyframe editor container
      MiniTimeline.tsx            — horizontal timeline with diamonds
      PropertyLane.tsx            — per-property keyframe lane
      CurveEditor.tsx             — bezier curve visualization + presets
      KeyframeList.tsx            — tabular keyframe list

packages/api/src/sandbox/
  sync.ts                         — syncManifestToDb() function

packages/shared/src/
  manifest-convert.ts             — updated manifestToDb() for v2
```

### Modified Files

```
apps/web/src/features/editor-v2/
  store/types.ts                  — add Transform, Keyframe, Filters to TimelineItem
  store/editor-store.ts           — wire all actions to sandbox dispatch
  store/manifest-bridge.ts        — v2 manifest ↔ store conversion
  components/RightPanel.tsx       — add Properties tab
  timeline/canvas/BaseRenderer.ts — transform/keyframe/filter indicators
  timeline/canvas/CanvasRenderer.ts — route by item type not track type
  timeline/interactions/DragManager.ts — keyframe diamond drag
  timeline/ContextMenu.tsx        — add v2 context menu items

packages/api/src/sandbox/routes.ts — update POST /internal/sandbox/:id/manifest-updated handler: add debounced call to syncManifestToDb() after fetching manifest from sandbox, add proxy route for POST /ops endpoint
packages/sandbox/template/src/composition/TransformWrapper.tsx — custom bezier easing
```

---

## Testing Strategy

Test files go in `scripts/temp/` per project convention.

1. **manifest-bridge round-trip** — create v2 manifest, convert to store, convert back, validate no data loss
2. **sync flow** — simulate manifest-updated callback, verify DB state matches manifest
3. **keyframe operations** — add/remove/re-time keyframes, verify manifest updates
4. **persistence E2E** — edit item via store action, verify sandbox manifest updated, verify DB synced

---

## Implementation Order

1. Store type changes (Transform, Keyframe, Filters on TimelineItem)
2. manifest-bridge v2 (manifestToStore + storeToManifest)
3. manifest-dispatch.ts (dispatchToSandbox helper)
4. Wire store actions to sandbox dispatch
5. DB sync (syncManifestToDb + API route update)
6. Timeline canvas updates (item type routing, indicators)
7. Properties panel (Transform + Filters + Data tabs)
8. Keyframe editor (mini timeline, property lanes, curve editor)
9. Context menu updates
10. TransformWrapper custom bezier easing
