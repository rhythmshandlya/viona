# Manifest-Driven Frontend Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove V1 layout infrastructure from the frontend and build V2 manifest-driven item manipulation.

**Architecture:** Strip all `layoutSettings`/PiP/split state from the Zustand store, delete the PiP and Video drag overlay components, and build a new generic `ItemDragOverlay` that reads/writes manifest item transforms. Add an `update_transform` manifest operation. Rewire text/image items to read position from `item.transform` instead of `item.data.position`.

**Tech Stack:** React, Zustand, Zod, Remotion, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-manifest-driven-frontend-design.md`

---

## Chunk 1: Remove V1 Layout Infrastructure

### Task 1: Remove layout types and constants from types.ts

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts:930-1204`

- [ ] **Step 1: Delete layout type definitions**

Remove these types/constants (lines 930-1204):
- `LayoutMode` type (line 930)
- `normalizeLayoutMode()` function (lines 933-937) — **keep `normalizeDisplayMode()` at lines 940-944**
- `SplitPosition` type (line 947)
- `PiPPosition` type (line 950)
- `PiPSize` type (line 951)
- `PiPShape` type (line 952)
- `PiPCrop` interface (lines 954-958)
- `DEFAULT_PIP_CROP` (lines 960-964)
- `PiPSettings` interface (lines 966-993)
- `SplitSettings` interface (lines 995-1002)
- `LayoutSettings` interface (lines 1004-1011)
- `LayoutPresetId` type (line 1014)
- `LayoutPreset` interface (lines 1016-1021)
- `DEFAULT_PIP_SETTINGS` (lines 1023-1039)
- `DEFAULT_SPLIT_SETTINGS` (lines 1041-1045)
- `DEFAULT_LAYOUT_SETTINGS` (lines 1047-1051)
- `LAYOUT_PRESETS` array (lines 1053-1196)
- `PIP_SIZE_MAP` (lines 1199-1204)

- [ ] **Step 2: Remove layout fields from EditorState**

In `EditorState` interface (around lines 664-667), remove:
```typescript
layoutSettings?: LayoutSettings;
layoutPresetId?: LayoutPresetId;
```

- [ ] **Step 3: Remove layout actions from EditorActions**

In `EditorActions` interface (around lines 798-800), remove:
```typescript
updatePiPSettings: (settings: Partial<PiPSettings>) => void;
updatePiPCrop: (crop: Partial<PiPCrop>) => void;
updateSplitSettings: (settings: Partial<SplitSettings>) => void;
```

- [ ] **Step 4: Verify TypeScript compiles (expect errors in consumers)**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -50`
Expected: Errors in editor-store.ts, manifest-bridge.ts, PiPDragOverlay, VideoDragOverlay, etc. — these will be fixed in subsequent tasks.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/features/editor-v2/store/types.ts
git commit -m "refactor: remove V1 layout types and constants from types.ts"
```

---

### Task 2: Remove layout actions from editor-store.ts

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

- [ ] **Step 1: Remove layout action implementations**

Delete `updatePiPSettings` (lines 2487-2498), `updatePiPCrop` (lines 2500-2510), and `updateSplitSettings` (lines 2512-2523).

- [ ] **Step 2: Remove layout settings loading from videoSettings**

In the reload/init function (~lines 903-915), remove the block:
```typescript
// Reload layout settings in case generation persisted a new layoutMode
const savedVideoSettings = (apiProject as any).videoSettings;
const savedLayoutSettings = savedVideoSettings?.layoutSettings;
if (savedLayoutSettings) {
  state.layoutSettings = {
    ...DEFAULT_LAYOUT_SETTINGS,
    ...savedLayoutSettings,
    mode: normalizeLayoutMode(savedLayoutSettings.mode || 'stacked'),
    pip: { ...DEFAULT_LAYOUT_SETTINGS.pip, ...savedLayoutSettings.pip },
    split: { ...DEFAULT_LAYOUT_SETTINGS.split, ...savedLayoutSettings.split },
  };
}
```

- [ ] **Step 3: Remove layout from loadProject**

Remove these lines (~759-760):
```typescript
state.layoutSettings = bridgeResult.layoutSettings;
state.layoutPresetId = bridgeResult.layoutPresetId as LayoutPresetId;
```

- [ ] **Step 4: Remove layout from applyRemoteManifestUpdate**

Remove (~line 2749):
```typescript
s.layoutSettings = bridgeResult.layoutSettings;
```

- [ ] **Step 5: Simplify setVisualDisplayMode / changeDisplayModeWithAI**

In `changeDisplayModeWithAI` (~lines 2584-2656):
- Remove reads of `state.layoutSettings?.mode`, `state.layoutSettings?.split?.ratio`, `state.layoutSettings?.split?.gap`
- Replace layout-dependent dimension computation with full canvas dimensions:
```typescript
const canvasW = state.project?.videoSettings?.canvasWidth || 1080;
const canvasH = state.project?.videoSettings?.canvasHeight || 1920;
// Always use full canvas for V2 — items have explicit transforms
const newDims = { w: canvasW, h: canvasH };
```
- Remove layout-specific labels ("Standard (PiP)", "Standard (stacked)"). Use just "Standard" or the display mode name.

- [ ] **Step 6: Remove layout from saveProject**

In `saveProject` (~line 964), remove `layoutSettings` and `layoutPresetId` from the destructured state. Remove any code that writes these to `videoSettings.layoutSettings`.

- [ ] **Step 7: Clean up imports**

Remove imports of `DEFAULT_LAYOUT_SETTINGS`, `normalizeLayoutMode`, `PiPSettings`, `PiPCrop`, `SplitSettings`, `LayoutSettings`, `LayoutPresetId` from the import block at the top of the file.

- [ ] **Step 8: Commit**
```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "refactor: remove V1 layout actions and state from editor store"
```

---

### Task 3: Clean up manifest-bridge.ts

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts`

- [ ] **Step 1: Remove convertManifestLayout function**

Delete `convertManifestLayout` (~lines 809-841).

- [ ] **Step 2: Remove layoutSettings from manifestToStore return**

In `manifestToStore` (~lines 100-168), remove:
- The `const layoutSettings = isV2 ? DEFAULT_LAYOUT_SETTINGS : convertManifestLayout(manifest.layout);` block (~line 155)
- `layoutSettings` and `layoutPresetId` from the return object

- [ ] **Step 3: Remove manifest.layout output from storeToManifest**

In `storeToManifest` (~lines 267-292), delete the entire block:
```typescript
if (state.layoutSettings) {
  manifest.layout = {
    mode: state.layoutSettings.mode,
    pip: { ... },
    split: { ... },
  };
}
```

- [ ] **Step 4: Remove set_layout from StoreManifestOp**

In the `StoreManifestOp` union type (~lines 79-90), remove the `'set_layout'` variant:
```typescript
| { op: 'set_layout'; layout: Record<string, unknown> }
```

- [ ] **Step 5: Clean up imports**

Remove `DEFAULT_LAYOUT_SETTINGS` import and any layout-related type imports (`LayoutSettings`, `LayoutPresetId`, etc.).

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/features/editor-v2/store/manifest-bridge.ts
git commit -m "refactor: remove layout conversion and set_layout op from manifest bridge"
```

---

### Task 4: Delete layout UI components

**Files:**
- Delete: `apps/web/src/features/editor-v2/components/PiPDragOverlay.tsx`
- Delete: `apps/web/src/features/editor-v2/components/VideoDragOverlay.tsx`
- Delete: `apps/web/src/features/editor-v2/panels/PiPControlPanel.tsx`
- Modify: `apps/web/src/features/editor-v2/panels/index.ts`
- Modify: `apps/web/src/features/editor-v2/scene/Scene.tsx`
- Modify: `apps/web/src/features/editor-v2/components/RightPanel.tsx`

- [ ] **Step 1: Delete PiPDragOverlay.tsx**
```bash
rm apps/web/src/features/editor-v2/components/PiPDragOverlay.tsx
```

- [ ] **Step 2: Delete VideoDragOverlay.tsx**
```bash
rm apps/web/src/features/editor-v2/components/VideoDragOverlay.tsx
```

- [ ] **Step 3: Delete PiPControlPanel.tsx**
```bash
rm apps/web/src/features/editor-v2/panels/PiPControlPanel.tsx
```

- [ ] **Step 4: Remove PiPControlPanel from panels/index.ts**

In `apps/web/src/features/editor-v2/panels/index.ts` (line 6), remove:
```typescript
export { PiPControlPanel } from './PiPControlPanel';
```

- [ ] **Step 5: Remove overlays from Scene.tsx**

In `apps/web/src/features/editor-v2/scene/Scene.tsx`:
- Remove imports (lines 14, 16):
```typescript
import { VideoDragOverlay } from '../components/VideoDragOverlay';
import { PiPDragOverlay } from '../components/PiPDragOverlay';
```
- Remove usage in render (~lines 171-178, 190-194):
```typescript
<VideoDragOverlay
  containerRef={playerContainerRef}
  canvasWidth={videoWidth}
  canvasHeight={videoHeight}
/>
```
and
```typescript
<PiPDragOverlay
  containerRef={playerContainerRef}
  canvasWidth={videoWidth}
  canvasHeight={videoHeight}
/>
```

Keep `CaptionDragOverlay` — it's independent of layout.

- [ ] **Step 6: Remove Layout tab from RightPanel.tsx**

In `apps/web/src/features/editor-v2/components/RightPanel.tsx`:
- Remove import (line 10): `PiPControlPanel` from `'../panels'`
- Remove "Layout" tab button (~lines 74-78)
- Remove `{activeTab === 'layout' && <PiPControlPanel />}` (~line 102)
- Remove `'layout'` from the `RightPanelTab` type (line 16)

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "refactor: delete PiPDragOverlay, VideoDragOverlay, PiPControlPanel and remove from Scene/RightPanel"
```

---

### Task 5: Clean up StyleSelectionModal.tsx

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx`

- [ ] **Step 1: Remove layout mode selector**

- Remove `calculateVisualsDimensions` function (~lines 84-98)
- Remove `layoutMode` state (~line 117)
- Remove `splitRatio` state (~line 118)
- Remove layout mode button UI (PiP/Stacked buttons, ~lines 324-377)
- Remove split ratio slider (~line 381)

- [ ] **Step 2: Always use full canvas dimensions**

Replace the dimension computation (~line 120):
```typescript
const dimensions = calculateVisualsDimensions(canvasWidth, canvasHeight, layoutMode, splitRatio);
```
with:
```typescript
const dimensions = { width: canvasWidth, height: canvasHeight };
```

- [ ] **Step 3: Remove layoutMode from onSelect callback**

In the `onSelect` call (~lines 123-128), remove `layoutMode` and just pass `dimensions`:
```typescript
onSelect({
  stylePreset: selectedStyle,
  dimensions,
  styleGuide: styleGuide.trim() || undefined,
});
```

Update the `onSelect` prop type accordingly.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx
git commit -m "refactor: remove layout mode selector from StyleSelectionModal, always use full canvas"
```

---

### Task 6: Fix remaining TypeScript errors and verify build

**Files:**
- Modify: any files with remaining TS errors

- [ ] **Step 1: Run TypeScript check**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -80`

Fix any remaining errors. Common ones:
- References to `layoutSettings` in use-editor-store selector hooks
- References to removed types in component props
- `VisualsLayoutMode` import from `@viona/shared` (may still be used by generation flow — leave shared package types alone, just remove frontend usage)

- [ ] **Step 2: Search for remaining layout references**

Run: `grep -rn "layoutSettings\|layoutPresetId\|PiPSettings\|SplitSettings\|PiPControlPanel\|PiPDragOverlay\|VideoDragOverlay\|updatePiPSettings\|updatePiPCrop\|updateSplitSettings" apps/web/src/features/editor-v2/ --include="*.ts" --include="*.tsx"`

Fix any remaining references.

- [ ] **Step 3: Verify dev server starts**

Run: `cd apps/web && npm run dev`
Expected: No build errors.

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "fix: resolve remaining TypeScript errors after V1 layout removal"
```

---

## Chunk 2: Build V2 Item Manipulation

### Task 7: Add update_transform manifest operation

**Files:**
- Modify: `packages/shared/src/manifest-ops.ts`
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts`

- [ ] **Step 1: Add update_transform to manifestOpSchema**

In `packages/shared/src/manifest-ops.ts`, add a new variant to the `manifestOpSchema` discriminated union (~after line 63):

```typescript
z.object({
  op: z.literal('update_transform'),
  itemId: z.string(),
  transform: z.record(z.string(), z.union([z.number(), z.string()])),
}),
```

- [ ] **Step 2: Add handler in applyManifestOp**

In the `applyManifestOp` function switch statement, add a new case:

```typescript
case 'update_transform': {
  const item = m.items.find((i: any) => i.id === op.itemId);
  if (item) {
    item.transform = { ...(item.transform || {}), ...op.transform };
  }
  break;
}
```

- [ ] **Step 3: Add update_transform to StoreManifestOp**

In `apps/web/src/features/editor-v2/store/manifest-bridge.ts`, add to the `StoreManifestOp` union:

```typescript
| { op: 'update_transform'; itemId: string; transform: Record<string, number | string> }
```

- [ ] **Step 4: Write test**

Create `scripts/temp/test-update-transform-op.ts`:

```typescript
import { applyManifestOp } from '../../packages/shared/src/manifest-ops.js';

// Test: update_transform merges into existing transform
const manifest: any = {
  version: 2,
  items: [{
    id: 'item1',
    type: 'video',
    trackId: 't1',
    startMs: 0,
    endMs: 5000,
    transform: { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 },
    data: { src: 'test.mp4' },
  }],
  tracks: [{ id: 't1', type: 'video', name: 'Video', position: 0 }],
};

applyManifestOp(manifest, { op: 'update_transform', itemId: 'item1', transform: { x: 100, y: 200 } });
const item = manifest.items[0];

console.assert(item.transform.x === 100, 'x should be 100');
console.assert(item.transform.y === 200, 'y should be 200');
console.assert(item.transform.width === '100%', 'width should be preserved');
console.assert(item.transform.rotation === 0, 'rotation should be preserved');

console.log('All update_transform tests passed');
```

- [ ] **Step 5: Run test**

Run: `npx tsx scripts/temp/test-update-transform-op.ts`
Expected: "All update_transform tests passed"

- [ ] **Step 6: Commit**
```bash
git add packages/shared/src/manifest-ops.ts apps/web/src/features/editor-v2/store/manifest-bridge.ts scripts/temp/test-update-transform-op.ts
git commit -m "feat: add update_transform manifest operation"
```

---

### Task 8: Fix text/image items to read from item.transform

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts`

- [ ] **Step 1: Update text item conversion in manifestToStore**

In `manifestToStore`, find where text items build their store representation (~lines 209-221). Currently text items read position from `item.data.position` and size from `item.data.size`. Change to read from `item.transform`:

The V2 manifest already puts transforms in `item.transform`. The store's text items should read spatial data from there, not from `data.position`/`data.size`.

In the text item branch of `convertManifestItemV2` or equivalent: ensure `item.transform` is the source for x/y/width/height, not `item.data.position`.

- [ ] **Step 2: Update image item conversion similarly**

Image items (~lines 223-235) also read from `item.data.position`, `item.data.width`, `item.data.height`. Change to read from `item.transform`.

- [ ] **Step 3: Update storeToManifest for text/image**

In `storeToManifest`, text and image items currently write position back to `data.position`/`data.size`. Remove this duplication — only write to `item.transform`.

- [ ] **Step 4: Run test from Task 7 to ensure no regression**

Run: `npx tsx scripts/temp/test-update-transform-op.ts`
Expected: Still passes.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/features/editor-v2/store/manifest-bridge.ts
git commit -m "refactor: text/image items read position from item.transform, not data.position"
```

---

### Task 9: Build ItemDragOverlay component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx`
- Modify: `apps/web/src/features/editor-v2/scene/Scene.tsx`

- [ ] **Step 1: Create ItemDragOverlay.tsx**

```tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '../store/use-editor-store';

interface ItemDragOverlayProps {
  containerRef: React.RefObject<HTMLDivElement>;
  canvasWidth: number;
  canvasHeight: number;
}

type HandleType = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'rotate';

interface DragState {
  handleType: HandleType;
  startMouseX: number;
  startMouseY: number;
  startTransform: { x: number; y: number; width: number; height: number; rotation: number; opacity: number };
}

function resolveToPixels(val: number | string, canvasSize: number): number {
  if (typeof val === 'number') return val;
  const s = String(val);
  if (s.endsWith('%')) return (parseFloat(s) / 100) * canvasSize;
  return parseFloat(s) || 0;
}

export function ItemDragOverlay({ containerRef, canvasWidth, canvasHeight }: ItemDragOverlayProps) {
  const selectedItemId = useEditorStore((s) => s.selectedItemId);
  const selectedItem = useEditorStore((s) => selectedItemId ? s.items[selectedItemId] : null);
  const applyManifestOp = useEditorStore((s) => s.applyManifestOp);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0, dw: 0, dh: 0 });
  const dragRef = useRef<DragState | null>(null);

  // Get the item's transform (from manifest)
  const transform = selectedItem?.transform;
  if (!selectedItem || !transform || selectedItem.type === 'audio' || selectedItem.type === 'caption') {
    return null;
  }

  // Resolve transform to canvas pixels
  const itemX = resolveToPixels(transform.x, canvasWidth);
  const itemY = resolveToPixels(transform.y, canvasHeight);
  const itemW = resolveToPixels(transform.width, canvasWidth);
  const itemH = resolveToPixels(transform.height, canvasHeight);

  // Get container's display rect to compute scale from canvas coords to screen pixels
  const getScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { scaleX: 1, scaleY: 1 };
    const rect = container.getBoundingClientRect();
    return {
      scaleX: rect.width / canvasWidth,
      scaleY: rect.height / canvasHeight,
    };
  }, [containerRef, canvasWidth, canvasHeight]);

  // Apply drag offset for optimistic visual feedback
  const displayX = itemX + dragOffset.dx;
  const displayY = itemY + dragOffset.dy;
  const displayW = itemW + dragOffset.dw;
  const displayH = itemH + dragOffset.dh;

  const handleMouseDown = useCallback((e: React.MouseEvent, handleType: HandleType) => {
    e.preventDefault();
    e.stopPropagation();
    const state: DragState = {
      handleType,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTransform: { x: itemX, y: itemY, width: itemW, height: itemH, rotation: transform.rotation, opacity: transform.opacity },
    };
    dragRef.current = state;
    setDragState(state);
  }, [itemX, itemY, itemW, itemH, transform]);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragRef.current;
      if (!ds) return;
      const { scaleX, scaleY } = getScale();
      const dx = (e.clientX - ds.startMouseX) / scaleX;
      const dy = (e.clientY - ds.startMouseY) / scaleY;

      switch (ds.handleType) {
        case 'move':
          setDragOffset({ dx, dy, dw: 0, dh: 0 });
          break;
        case 'se':
          setDragOffset({ dx: 0, dy: 0, dw: dx, dh: dy });
          break;
        case 'sw':
          setDragOffset({ dx: dx, dy: 0, dw: -dx, dh: dy });
          break;
        case 'ne':
          setDragOffset({ dx: 0, dy: dy, dw: dx, dh: -dy });
          break;
        case 'nw':
          setDragOffset({ dx: dx, dy: dy, dw: -dx, dh: -dy });
          break;
        case 'n':
          setDragOffset({ dx: 0, dy: dy, dw: 0, dh: -dy });
          break;
        case 's':
          setDragOffset({ dx: 0, dy: 0, dw: 0, dh: dy });
          break;
        case 'e':
          setDragOffset({ dx: 0, dy: 0, dw: dx, dh: 0 });
          break;
        case 'w':
          setDragOffset({ dx: dx, dy: 0, dw: -dx, dh: 0 });
          break;
      }
    };

    const handleMouseUp = () => {
      const ds = dragRef.current;
      if (!ds) return;

      // Compute final transform in canvas pixels
      const finalX = ds.startTransform.x + dragOffset.dx;
      const finalY = ds.startTransform.y + dragOffset.dy;
      const finalW = Math.max(10, ds.startTransform.width + dragOffset.dw);
      const finalH = Math.max(10, ds.startTransform.height + dragOffset.dh);

      // Dispatch manifest op
      applyManifestOp({
        op: 'update_transform',
        itemId: selectedItemId!,
        transform: {
          x: Math.round(finalX),
          y: Math.round(finalY),
          width: Math.round(finalW),
          height: Math.round(finalH),
        },
      });

      dragRef.current = null;
      setDragState(null);
      setDragOffset({ dx: 0, dy: 0, dw: 0, dh: 0 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, dragOffset, getScale, applyManifestOp, selectedItemId]);

  const { scaleX, scaleY } = getScale();

  // Position overlay in screen coordinates
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    left: displayX * scaleX,
    top: displayY * scaleY,
    width: displayW * scaleX,
    height: displayH * scaleY,
    pointerEvents: 'none',
    zIndex: 50,
  };

  const handleSize = 8;
  const handleStyle = (cursor: string): React.CSSProperties => ({
    position: 'absolute',
    width: handleSize,
    height: handleSize,
    backgroundColor: '#a855f7',
    border: '1px solid white',
    borderRadius: 2,
    cursor,
    pointerEvents: 'auto',
  });

  return (
    <div style={overlayStyle}>
      {/* Move handle — full area */}
      <div
        style={{ position: 'absolute', inset: 0, cursor: 'move', pointerEvents: 'auto', border: '1px solid #a855f7' }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      />

      {/* Corner handles */}
      <div style={{ ...handleStyle('nw-resize'), top: -handleSize / 2, left: -handleSize / 2 }} onMouseDown={(e) => handleMouseDown(e, 'nw')} />
      <div style={{ ...handleStyle('ne-resize'), top: -handleSize / 2, right: -handleSize / 2 }} onMouseDown={(e) => handleMouseDown(e, 'ne')} />
      <div style={{ ...handleStyle('sw-resize'), bottom: -handleSize / 2, left: -handleSize / 2 }} onMouseDown={(e) => handleMouseDown(e, 'sw')} />
      <div style={{ ...handleStyle('se-resize'), bottom: -handleSize / 2, right: -handleSize / 2 }} onMouseDown={(e) => handleMouseDown(e, 'se')} />

      {/* Edge handles */}
      <div style={{ ...handleStyle('n-resize'), top: -handleSize / 2, left: '50%', marginLeft: -handleSize / 2 }} onMouseDown={(e) => handleMouseDown(e, 'n')} />
      <div style={{ ...handleStyle('s-resize'), bottom: -handleSize / 2, left: '50%', marginLeft: -handleSize / 2 }} onMouseDown={(e) => handleMouseDown(e, 'se')} />
      <div style={{ ...handleStyle('e-resize'), right: -handleSize / 2, top: '50%', marginTop: -handleSize / 2 }} onMouseDown={(e) => handleMouseDown(e, 'e')} />
      <div style={{ ...handleStyle('w-resize'), left: -handleSize / 2, top: '50%', marginTop: -handleSize / 2 }} onMouseDown={(e) => handleMouseDown(e, 'w')} />
    </div>
  );
}
```

- [ ] **Step 2: Add ItemDragOverlay to Scene.tsx**

In `apps/web/src/features/editor-v2/scene/Scene.tsx`, add import and render the overlay where PiPDragOverlay/VideoDragOverlay used to be:

```typescript
import { ItemDragOverlay } from '../components/ItemDragOverlay';
```

In the render, add after CaptionDragOverlay:
```tsx
<ItemDragOverlay
  containerRef={playerContainerRef}
  canvasWidth={videoWidth}
  canvasHeight={videoHeight}
/>
```

- [ ] **Step 3: Ensure applyManifestOp is exposed in the store**

Check that `applyManifestOp` (or equivalent function that dispatches manifest operations to the backend) is available in the store. If it's not directly on the store, find the existing pattern for dispatching manifest ops and use that in ItemDragOverlay.

- [ ] **Step 4: Verify dev server runs and overlay renders**

Run: `cd apps/web && npm run dev`
Open the editor, select a video item. You should see a purple selection border with 8 resize handles.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx apps/web/src/features/editor-v2/scene/Scene.tsx
git commit -m "feat: add generic ItemDragOverlay for V2 manifest-driven item manipulation"
```

---

### Task 10: Add Item Properties tab to RightPanel

**Files:**
- Create: `apps/web/src/features/editor-v2/panels/ItemPropertiesPanel.tsx`
- Modify: `apps/web/src/features/editor-v2/panels/index.ts`
- Modify: `apps/web/src/features/editor-v2/components/RightPanel.tsx`

- [ ] **Step 1: Create ItemPropertiesPanel.tsx**

```tsx
'use client';

import React, { useCallback } from 'react';
import { useEditorStore } from '../store/use-editor-store';

function resolveToPixels(val: number | string, canvasSize: number): number {
  if (typeof val === 'number') return val;
  const s = String(val);
  if (s.endsWith('%')) return (parseFloat(s) / 100) * canvasSize;
  return parseFloat(s) || 0;
}

export function ItemPropertiesPanel() {
  const selectedItemId = useEditorStore((s) => s.selectedItemId);
  const selectedItem = useEditorStore((s) => selectedItemId ? s.items[selectedItemId] : null);
  const applyManifestOp = useEditorStore((s) => s.applyManifestOp);
  const canvasWidth = useEditorStore((s) => s.project?.videoSettings?.canvasWidth || 1080);
  const canvasHeight = useEditorStore((s) => s.project?.videoSettings?.canvasHeight || 1920);

  const updateTransform = useCallback((field: string, value: number | string) => {
    if (!selectedItemId) return;
    applyManifestOp({
      op: 'update_transform',
      itemId: selectedItemId,
      transform: { [field]: value },
    });
  }, [selectedItemId, applyManifestOp]);

  if (!selectedItem || !selectedItem.transform) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        Select an item to edit its properties.
      </div>
    );
  }

  if (selectedItem.type === 'audio' || selectedItem.type === 'caption') {
    return (
      <div className="p-4 text-sm text-zinc-500">
        This item type does not have spatial properties.
      </div>
    );
  }

  const t = selectedItem.transform;
  const x = resolveToPixels(t.x, canvasWidth);
  const y = resolveToPixels(t.y, canvasHeight);
  const w = resolveToPixels(t.width, canvasWidth);
  const h = resolveToPixels(t.height, canvasHeight);

  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white';
  const labelClass = 'text-xs text-zinc-400 mb-1';

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-medium text-white">Transform</h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>X</label>
          <input type="number" className={inputClass} value={Math.round(x)}
            onChange={(e) => updateTransform('x', Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass}>Y</label>
          <input type="number" className={inputClass} value={Math.round(y)}
            onChange={(e) => updateTransform('y', Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass}>Width</label>
          <input type="number" className={inputClass} value={Math.round(w)}
            onChange={(e) => updateTransform('width', Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass}>Height</label>
          <input type="number" className={inputClass} value={Math.round(h)}
            onChange={(e) => updateTransform('height', Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass}>Rotation</label>
          <input type="number" className={inputClass} value={t.rotation}
            onChange={(e) => updateTransform('rotation', Number(e.target.value))} />
        </div>
        <div>
          <label className={labelClass}>Opacity</label>
          <input type="number" className={inputClass} value={t.opacity} step={0.1} min={0} max={1}
            onChange={(e) => updateTransform('opacity', Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from panels/index.ts**

Add to `apps/web/src/features/editor-v2/panels/index.ts`:
```typescript
export { ItemPropertiesPanel } from './ItemPropertiesPanel';
```

- [ ] **Step 3: Add Item Properties tab to RightPanel**

In `apps/web/src/features/editor-v2/components/RightPanel.tsx`:
- Import `ItemPropertiesPanel` from `'../panels'`
- Add `'item-properties'` to tab type (should already exist, or rename from removed 'layout')
- Add tab button and content:
```tsx
<TabButton
  label="Properties"
  isActive={activeTab === 'item-properties'}
  onClick={() => onTabChange('item-properties')}
/>
```
and:
```tsx
{activeTab === 'item-properties' && <ItemPropertiesPanel />}
```

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/features/editor-v2/panels/ItemPropertiesPanel.tsx apps/web/src/features/editor-v2/panels/index.ts apps/web/src/features/editor-v2/components/RightPanel.tsx
git commit -m "feat: add Item Properties panel for editing transforms via manifest ops"
```

---

### Task 11: Final verification and cleanup

**Files:**
- Various

- [ ] **Step 1: Run full TypeScript check**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -80`
Expected: No errors.

- [ ] **Step 2: Search for any remaining V1 layout references in frontend**

Run: `grep -rn "layoutSettings\|layoutPresetId\|PiPSettings\|SplitSettings\|PiPControlPanel\|PiPDragOverlay\|VideoDragOverlay\|updatePiPSettings\|updatePiPCrop\|updateSplitSettings\|LayoutPreset\b\|PIP_SIZE_MAP\|DEFAULT_PIP\|DEFAULT_SPLIT\|DEFAULT_LAYOUT" apps/web/src/features/editor-v2/ --include="*.ts" --include="*.tsx"`

Expected: No matches (or only comments/documentation).

- [ ] **Step 3: Verify dev server and basic functionality**

Run: `cd apps/web && npm run dev`
- Open editor with a project
- Verify video renders (from manifest transforms)
- Verify ItemDragOverlay appears when item is selected
- Verify drag-to-move and resize work
- Verify Item Properties panel shows transform values
- Verify editing transform values in panel updates the item

- [ ] **Step 4: Commit any final fixes**
```bash
git add -A
git commit -m "chore: final cleanup after V1 layout removal and V2 item manipulation"
```
