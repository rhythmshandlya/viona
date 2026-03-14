# Manifest-Driven Frontend Design Spec

## Principle

The frontend is a pure view of the manifest. It renders exactly what the manifest says and provides UI to update the manifest. No independent frontend layout state.

## Problem

The editor frontend maintains a parallel layout system (`layoutSettings`, `layoutMode`, `pip`, `split`, `layoutPresetId`) in the Zustand store that operates independently of the manifest. This violates the manifest-as-source-of-truth principle established by the V2 NLE architecture.

### Violations Found

| File | Type | Issue |
|---|---|---|
| `store/types.ts:664-668, 1004-1196` | STATE | `layoutSettings`, `LayoutSettings`, `PiPSettings`, `SplitSettings`, `LAYOUT_PRESETS` in EditorState |
| `store/editor-store.ts:2487-2523` | STATE | `updatePiPSettings()`, `updatePiPCrop()`, `updateSplitSettings()` actions |
| `store/editor-store.ts:2585-2655` | COMPUTE | `setVisualDisplayMode` reads `layoutSettings.mode/.split` for dimension computation |
| `components/PiPDragOverlay.tsx` | UI+COMPUTE | 578-line component reading/writing `layoutSettings`, not manifest |
| `components/VideoDragOverlay.tsx` | COMPUTE | `computeVideoRegion()` computes layout from `layoutSettings` |
| `components/StyleSelectionModal.tsx` | UI+COMPUTE | PiP/stacked layout mode selector, `calculateVisualsDimensions`, sends `layoutMode` to generation pipeline |
| `scene/Scene.tsx` | RENDER | Renders PiP/Video drag overlays from `layoutSettings.mode` |
| `components/RightPanel.tsx` | UI | "Layout" tab renders `PiPControlPanel` |
| `store/manifest-bridge.ts` | STATE | Reads/writes `layoutSettings` to/from manifest, `convertManifestLayout()`, `manifest.layout` output (lines 267-292) |
| `panels/index.ts` | EXPORT | Re-exports `PiPControlPanel` |

## Solution

### Phase 1: Remove V1 Layout Infrastructure (Frontend)

Delete all V1 layout state and UI:

**Types and constants (`store/types.ts`):**
- `LayoutMode` type
- `normalizeLayoutMode()` function (keep `normalizeDisplayMode()` — it's independent)
- `PiPCrop`, `PiPSettings`, `PiPSize`, `PIP_SIZE_MAP` types/constants
- `SplitPosition`, `SplitSettings` types
- `LayoutSettings` interface
- `DEFAULT_PIP_CROP`, `DEFAULT_PIP_SETTINGS`, `DEFAULT_SPLIT_SETTINGS`, `DEFAULT_LAYOUT_SETTINGS` constants
- `LayoutPresetId`, `LayoutPreset`, `LAYOUT_PRESETS` types/constants
- `layoutSettings` and `layoutPresetId` fields from `EditorState`

**Store actions (`store/editor-store.ts`):**
- `updatePiPSettings()` action
- `updatePiPCrop()` action
- `updateSplitSettings()` action
- Layout settings loading from `videoSettings.layoutSettings` in reload/init (~line 906)
- `setVisualDisplayMode` (~line 2570): remove layout-dependent dimension computation and layout-specific labels ("Standard (PiP)", "Standard (stacked)"). Simplify to always use full canvas dimensions since V2 items have explicit transforms.

**Components (delete entirely):**
- `components/PiPDragOverlay.tsx`
- `components/VideoDragOverlay.tsx`
- `components/PiPControlPanel.tsx` (if exists)

**Manifest bridge (`store/manifest-bridge.ts`):**
- Remove `layoutSettings` from `convertManifestToStore` return
- Remove `manifest.layout` output from `storeToManifest` (lines 267-292 — dead code after removal)
- Remove `convertManifestLayout()` function
- Remove `DEFAULT_LAYOUT_SETTINGS` import and usage

**Scene rendering (`scene/Scene.tsx`):**
- Remove PiPDragOverlay and VideoDragOverlay imports and rendering

**Right panel (`components/RightPanel.tsx`):**
- Remove "Layout" tab
- Remove PiPControlPanel import

**Panel exports (`panels/index.ts`):**
- Remove `PiPControlPanel` re-export

**Style selection (`components/StyleSelectionModal.tsx`):**
- Remove PiP/stacked layout mode selector UI
- Remove `calculateVisualsDimensions` layout computation
- Always send full canvas dimensions to the generation pipeline (V2 items specify their own transforms)

### Phase 2: Build V2 Item Manipulation

**New manifest operation — `update_transform`:**

```typescript
{ op: 'update_transform', itemId: string, transform: Partial<TransformV2> }
```

Merges partial transform updates into an item's existing transform. Must be added to:
- `StoreManifestOp` union in `manifest-bridge.ts`
- `manifestOpSchema` in `packages/shared/src/manifest-ops.ts`
- `applyManifestOp` handler in `packages/shared/src/manifest-ops.ts`

For text/image items: `update_transform` updates `item.transform` only. The manifest-bridge must be updated so text/image items read position from `item.transform` (not from `item.data.position`/`item.data.size`), eliminating the dual-storage problem.

**New component: `ItemDragOverlay.tsx`**

A generic item manipulation overlay that:
- Reads the selected item's `transform` from the editor store (which comes from the manifest)
- Renders drag handles on the selected item: move (drag body), resize (8 corner/edge handles), rotate (rotation handle)
- Maps pixel coordinates to canvas coordinates using known canvas dimensions and player display size
- Uses local optimistic state during drag (CSS transform) and commits to manifest on drag-end for 60fps performance
- On drag end, dispatches `update_transform` manifest ops
- Works for any visible item type (video, text, image, scene)

**Coordinate system:** The drag overlay works in canvas pixels (matching manifest transform values). Percentage-based transforms (e.g., `'100%'`) are resolved to pixels during drag, and committed as pixel values. Users can type percentage values in the properties panel.

**Updated RightPanel: "Item Properties" tab**

Replaces the "Layout" tab. Shows the selected item's transform fields as editable inputs:
- x, y (position)
- width, height (size — supports px and %)
- rotation (degrees)
- opacity (0-1)

Changes dispatch `update_transform` ops through the manifest operation system.

### Data Flow

```
User drags item handle
  → ItemDragOverlay computes new transform values (pixel → canvas coords)
  → Local optimistic CSS transform during drag (no manifest ops per frame)
  → On drag-end: dispatches manifest op { op: 'update_transform', itemId, transform }
  → Editor store applies op → updates manifest in store
  → Manifest syncs to workspace backend
  → Player re-renders from updated manifest
```

### Backend/Shared Layout Code — Out of Scope

The following backend/shared/worker layout infrastructure is **not changed** in this spec:
- `packages/shared/src/manifest.ts` — V1 manifest layout schema (backward compat)
- `packages/shared/src/manifest-ops.ts` — `set_layout` op (deprecated, kept as no-op)
- `packages/shared/src/queue-types.ts` — `VisualsLayoutMode` in generation options
- `packages/worker/remotion-template/src/composition/` — PiPVideo, layout types
- `packages/worker/src/processors/generate-visuals/` — layout settings in generation

These are used by the visual generation pipeline and V1 backward compatibility. They will be addressed in a separate cleanup when the generation pipeline is updated for V2.

### What This Does NOT Change

- **Manifest V2 schema** — already correct with per-item transforms
- **`dbToManifest` / `manifestToDb`** — already handles transforms correctly
- **Workspace codegen** — already renders items by transforms (PlayerComposition.tsx, TransformWrapper.tsx)
- **Player rendering path** — WorkspacePlayer → useWorkspaceComposition already renders from manifest
- **Timeline** — track/item management unaffected
- **`normalizeDisplayMode()`** — kept, independent of layout system

### Success Criteria

1. No `layoutSettings`, `layoutMode`, `pip`, `split` in frontend code
2. Player renders purely from manifest item transforms
3. Users can drag/resize/rotate any visible item in the canvas
4. Transform changes flow through manifest operations
5. Item properties panel shows and allows editing of transform values
6. Existing projects with stored `layoutSettings` in DB still work (ignored, items render by their transforms)
7. Text/image items read position from `item.transform`, not `item.data.position`/`item.data.size`
