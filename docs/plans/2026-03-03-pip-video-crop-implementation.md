# PiP Video Crop/Pan/Zoom Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users drag-to-pan and scroll-to-zoom the video inside the PiP bubble, with quick presets (Fit, Face center, Top half).

**Architecture:** Add a `PiPCrop` type to `PiPSettings` with `cropX`/`cropY`/`zoom`. Preview switches from `objectFit: cover` to transform-based rendering (reusing existing `calculateVideoTransform`). Export uses `buildVideoCropFilter` with PiP-specific crop values. Interactive controls via Alt+drag (pan) and scroll (zoom) on the PiP overlay.

**Tech Stack:** React, Zustand (immer), Remotion, FFmpeg filter_complex

---

### Task 1: Add PiPCrop type and defaults to types.ts

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`

**Step 1: Add the PiPCrop interface after PiPShape (line ~830)**

After `export type PiPShape = 'square' | 'circle' | 'rounded';` add:

```typescript
export interface PiPCrop {
  cropX: number;  // 0-100, horizontal pan (50 = center)
  cropY: number;  // 0-100, vertical pan (50 = center)
  zoom: number;   // 1.0 = fill frame (cover), up to 3.0
}

export const DEFAULT_PIP_CROP: PiPCrop = {
  cropX: 50,
  cropY: 50,
  zoom: 1.0,
};
```

**Step 2: Add `crop` field to `PiPSettings` interface (line ~856)**

Add after the `opacity` field:

```typescript
  // Video framing inside the PiP bubble
  crop: PiPCrop;
```

**Step 3: Add `crop` to `DEFAULT_PIP_SETTINGS` (line ~901)**

Add after `opacity: 1,`:

```typescript
  crop: DEFAULT_PIP_CROP,
```

**Step 4: Add `crop: DEFAULT_PIP_CROP` to every PiP preset**

In `LAYOUT_PRESETS`, add `crop: DEFAULT_PIP_CROP` to each preset's `pip` object:
- `pip-tutorial` (line ~969)
- `pip-podcast` (line ~994)
- `pip-minimal` (line ~1019)
- `pip-gaming` (line ~1044)

Each gets `crop: DEFAULT_PIP_CROP,` after their `opacity` line.

**Step 5: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`
Expected: Errors about missing `crop` property in places that construct PiPSettings inline (if any). Fix them.

**Step 6: Commit**

```
feat: add PiPCrop type and defaults to PiPSettings
```

---

### Task 2: Add store action for PiP crop updates

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`
- Modify: `apps/web/src/features/editor-v2/store/use-editor-store.ts`

**Step 1: Add `updatePiPCrop` action in editor-store.ts**

After the `updatePiPSettings` action (line ~2154), add:

```typescript
    updatePiPCrop: (crop: Partial<PiPCrop>) => {
      set((state) => {
        state.layoutSettings.pip.crop = {
          ...state.layoutSettings.pip.crop,
          ...crop,
        };
        state.layoutPresetId = 'custom';
      });
      debouncedSave(() => get().saveProject());
    },
```

Also add the import of `PiPCrop` to the imports from `./types` if not already present (it's likely auto-resolved since `PiPSettings` references it).

**Step 2: Add to the EditorStore interface**

Find the `EditorStore` interface/type (or the `initialState` shape). Add `updatePiPCrop` to the actions. If the store type is inferred from `create`, this step may be automatic.

**Step 3: Export in useLayoutActions hook**

In `apps/web/src/features/editor-v2/store/use-editor-store.ts`, add `updatePiPCrop` to the `useLayoutActions` selector (line ~270):

```typescript
export function useLayoutActions() {
  return useEditorStore(
    useShallow((state) => ({
      updateLayoutSettings: state.updateLayoutSettings,
      updatePiPSettings: state.updatePiPSettings,
      updatePiPCrop: state.updatePiPCrop,
      updateSplitSettings: state.updateSplitSettings,
      setLayoutPreset: state.setLayoutPreset,
      setLayoutMode: state.setLayoutMode,
    }))
  );
}
```

**Step 4: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`
Expected: PASS (no errors)

**Step 5: Commit**

```
feat: add updatePiPCrop store action
```

---

### Task 3: Switch PiP preview from objectFit:cover to transform-based rendering

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Composition.tsx`

This is the critical rendering change. Currently PiP mode sets `videoUseSimpleRender = true` which uses `objectFit: 'cover'`. We need to switch it to use `calculateVideoTransform()` with the PiP crop values.

**Step 1: Pass pip crop to the video transform calculation**

In `DynamicLayoutComposition` (around line 1113-1138), modify the PiP rendering path. Currently:

```typescript
  } else {
    videoUseSimpleRender = !isGap && displayMode === 'default';
  }
```

Change to:

```typescript
  } else if (mode === 'pip' && displayMode === 'default' && !isGap) {
    // PiP mode: use transform-based rendering with PiP-specific crop settings
    videoUseSimpleRender = false;
    const pipCrop = pip.crop || { cropX: 50, cropY: 50, zoom: 1.0 };
    // Get PiP container dimensions for transform calculation
    const pipSizePercent = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size];
    const containerW = Math.round(compWidth * (pipSizePercent / 100));
    const containerH = containerW; // PiP is square aspect ratio
    const firstVideoData = videoItems.length > 0 ? videoItems[0].data as VideoItemData : null;
    if (firstVideoData && firstVideoData.width > 0 && firstVideoData.height > 0) {
      videoTransform = calculateVideoTransform(
        firstVideoData.width,
        firstVideoData.height,
        containerW,
        containerH,
        pipCrop.cropX,
        pipCrop.cropY,
        pipCrop.zoom,
      );
    }
  } else {
    videoUseSimpleRender = !isGap && displayMode === 'default';
  }
```

Note: `PIP_SIZE_MAP` must be imported at the top of `Composition.tsx`. Check if it's already imported; if not, add it to the existing import from `../store/types`.

**Step 2: Ensure VideoItemData has width/height**

Check that `VideoItemData` type includes `width` and `height` fields (these are the source video dimensions). They should already be there since they're used in the stacked layout path. If not, this data comes from `sourceDimensions` on the project — we may need to pass it through.

If `VideoItemData` doesn't have width/height, use the `sourceDimensions` prop instead:

```typescript
    if (sourceDimensions && sourceDimensions.width > 0 && sourceDimensions.height > 0) {
      videoTransform = calculateVideoTransform(
        sourceDimensions.width,
        sourceDimensions.height,
        containerW,
        containerH,
        pipCrop.cropX,
        pipCrop.cropY,
        pipCrop.zoom,
      );
    }
```

`sourceDimensions` would need to be passed into `DynamicLayoutComposition` as a prop. Check the existing props — `DynamicLayoutProps` may already have it or you may need to add it.

**Step 3: Verify it works**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`
Expected: PASS

Test manually: Open the editor, switch to PiP mode. The video inside the bubble should look identical to before (since default crop is centered at 1.0x zoom).

**Step 4: Commit**

```
feat: use transform-based rendering for PiP video crop
```

---

### Task 4: Add crop-pan and scroll-to-zoom to PiPDragOverlay

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/PiPDragOverlay.tsx`

**Step 1: Import `PiPCrop`, `DEFAULT_PIP_CROP`, `PIP_SIZE_MAP` from types**

Update the import at line 5:

```typescript
import type { PiPSettings, PiPPosition, PiPCrop } from '../store/types';
import { PIP_SIZE_MAP, DEFAULT_PIP_CROP } from '../store/types';
```

**Step 2: Add `updatePiPCrop` to the destructured actions**

```typescript
const { updatePiPSettings, updatePiPCrop } = useLayoutActions();
```

Update import of `useLayoutActions` if needed.

**Step 3: Add `'crop-pan'` to the DragMode type (line 18)**

```typescript
type DragMode = 'move' | 'resize' | 'border-radius' | 'rotate' | 'crop-pan';
```

**Step 4: Add `startCrop` to `DragState` interface (line 20)**

```typescript
interface DragState {
  mode: DragMode;
  handle?: HandlePosition;
  startX: number;
  startY: number;
  startBox: BoundingBox;
  startPiP: PiPSettings;
  startAngle?: number;
  startCrop?: PiPCrop; // for crop-pan mode
}
```

**Step 5: Handle crop-pan in handlePointerDown**

In `handlePointerDown` (line ~204), add `startCrop` when mode is `'crop-pan'`:

```typescript
      if (mode === 'crop-pan') {
        state.startCrop = { ...(pip.crop || DEFAULT_PIP_CROP) };
      }
```

Add this after the rotation block (line ~231).

**Step 6: Handle crop-pan in handlePointerMove**

In `handlePointerMove` (line ~240), add a new `else if` block after the rotate handler:

```typescript
      } else if (mode === 'crop-pan' && startCrop) {
        // Pan sensitivity: map pixel drag to 0-100 crop range
        // Larger PiP = more pixels per unit of crop change
        const pipSizePercent = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size];
        const pipPixelSize = canvasWidth * (pipSizePercent / 100);
        const sensitivity = 100 / (pipPixelSize * (startCrop.zoom || 1));

        const newCropX = clamp(startCrop.cropX - dx * sensitivity, 0, 100);
        const newCropY = clamp(startCrop.cropY - dy * sensitivity, 0, 100);
        updatePiPCrop({ cropX: newCropX, cropY: newCropY });
      }
```

Add `startCrop` to the destructured `dragRef.current` at line ~245:
```typescript
const { mode, handle, startX, startY, startBox, startPiP, startAngle, startCrop } = dragRef.current;
```

**Step 7: Add scroll-to-zoom handler**

Add a `handleWheel` callback after `handlePointerUp`:

```typescript
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!isSelected) return;
      e.preventDefault();
      e.stopPropagation();
      const currentCrop = pip.crop || DEFAULT_PIP_CROP;
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = clamp(currentCrop.zoom + delta, 1.0, 3.0);
      updatePiPCrop({ zoom: Math.round(newZoom * 10) / 10 });
    },
    [isSelected, pip.crop, updatePiPCrop]
  );
```

**Step 8: Wire up crop-pan to the PiP bounding box**

Modify the PiP bounding box div's `onPointerDown` (line ~388) to use Alt+click for crop-pan:

```typescript
        onPointerDown={(e) => {
          handlePiPClick(e);
          if (e.altKey) {
            handlePointerDown(e, 'crop-pan');
          } else {
            handlePointerDown(e, 'move');
          }
        }}
```

**Step 9: Wire up scroll handler on the bounding box**

Add `onWheel` to the bounding box div:

```typescript
        onWheel={handleWheel}
```

**Step 10: Change cursor when Alt is held**

Update the cursor on the bounding box. Add state to track Alt key:

```typescript
  const [altHeld, setAltHeld] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.altKey) setAltHeld(true); };
    const up = (e: KeyboardEvent) => { if (!e.altKey) setAltHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
```

Then use `cursor: altHeld ? 'crosshair' : 'move'` on the bounding box div.

**Step 11: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`
Expected: PASS

**Step 12: Commit**

```
feat: add drag-to-pan and scroll-to-zoom for PiP video framing
```

---

### Task 5: Add Video Framing section to PiPControlPanel

**Files:**
- Modify: `apps/web/src/features/editor-v2/panels/PiPControlPanel.tsx`

**Step 1: Import new types and add crop preset data**

Add to imports from `../store/types`:
```typescript
import {
  LAYOUT_PRESETS,
  PiPPosition,
  PiPShape,
  LayoutMode,
  DEFAULT_PIP_CROP,
} from '../store/types';
```

Add `Focus`, `Maximize`, `ArrowUpFromLine` to lucide imports (or use `Crosshair`, `Expand`, `CropIcon`):
```typescript
import { ..., Crosshair, Expand, CropIcon } from 'lucide-react';
```

Add preset data after `splitRatios`:

```typescript
  const cropPresets = [
    { label: 'Fit', icon: <Expand className="w-3 h-3" />, crop: { cropX: 50, cropY: 50, zoom: 1.0 } },
    { label: 'Face', icon: <Crosshair className="w-3 h-3" />, crop: { cropX: 50, cropY: 30, zoom: 1.3 } },
    { label: 'Top', icon: <CropIcon className="w-3 h-3" />, crop: { cropX: 50, cropY: 25, zoom: 1.0 } },
  ];
```

**Step 2: Get updatePiPCrop from actions**

Update the destructured actions:
```typescript
const { updatePiPSettings, updatePiPCrop, updateSplitSettings, setLayoutPreset, setLayoutMode } = useLayoutActions();
```

Get current crop:
```typescript
const crop = pip.crop || DEFAULT_PIP_CROP;
```

**Step 3: Add Video Framing section after the Style section**

After the closing `</div>` of the Style section (line ~357) and before the closing `</div>` of the PiP mode block, add:

```tsx
          {/* Video Framing */}
          <div className="border-t border-[var(--editor-border-subtle)]" />

          <div className="space-y-3">
            <SectionLabel>Video Framing</SectionLabel>

            {/* Quick Presets */}
            <div className="grid grid-cols-3 gap-1.5">
              {cropPresets.map((preset) => (
                <ToggleButton
                  key={preset.label}
                  active={
                    crop.cropX === preset.crop.cropX &&
                    crop.cropY === preset.crop.cropY &&
                    crop.zoom === preset.crop.zoom
                  }
                  onClick={() => updatePiPCrop(preset.crop)}
                  className="h-8"
                >
                  {preset.icon}
                  <span>{preset.label}</span>
                </ToggleButton>
              ))}
            </div>

            {/* Horizontal Pan */}
            <div className="space-y-1.5">
              <FieldLabel value={Math.round(crop.cropX)}>Horizontal Pan</FieldLabel>
              <Slider
                value={[crop.cropX]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => updatePiPCrop({ cropX: v })}
              />
            </div>

            {/* Vertical Pan */}
            <div className="space-y-1.5">
              <FieldLabel value={Math.round(crop.cropY)}>Vertical Pan</FieldLabel>
              <Slider
                value={[crop.cropY]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => updatePiPCrop({ cropY: v })}
              />
            </div>

            {/* Zoom */}
            <div className="space-y-1.5">
              <FieldLabel value={`${crop.zoom.toFixed(1)}x`}>Zoom</FieldLabel>
              <Slider
                value={[crop.zoom]}
                min={1.0}
                max={3.0}
                step={0.1}
                onValueChange={([v]) => updatePiPCrop({ zoom: v })}
              />
            </div>

            <p className="text-[10px] text-[var(--editor-text-muted)]">
              Alt+drag on PiP to pan. Scroll to zoom.
            </p>
          </div>
```

**Step 4: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`
Expected: PASS

**Step 5: Commit**

```
feat: add Video Framing controls to PiP panel
```

---

### Task 6: Update FFmpeg export to use PiP crop values

**Files:**
- Modify: `packages/worker/src/processors/render.ts`

**Step 1: Import DEFAULT_PIP_CROP**

Add to existing imports from `@viona/shared` or from the types file. Since `PiPSettings` is already used in `render.ts`, check how it's imported. The `PIP_SIZE_MAP` and types are likely imported from `@viona/shared` or directly. Add `DEFAULT_PIP_CROP` to that import.

If types come from a local reference, add:
```typescript
const DEFAULT_PIP_CROP = { cropX: 50, cropY: 50, zoom: 1.0 };
```

**Step 2: Use pip.crop for the PiP crop filter (line ~2399-2402)**

Replace:
```typescript
    // Build PiP-specific crop filter: use user's crop/pan/scale for the PiP bubble
    const pipCropFilter = videoCrop
      ? buildVideoCropFilter(videoCrop, pipWidth, pipHeight)
      : `scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=increase,crop=${pipWidth}:${pipHeight},setsar=1`;
```

With:
```typescript
    // Build PiP-specific crop filter using PiP's own crop settings
    const pipCrop = pip.crop || DEFAULT_PIP_CROP;
    const pipHasCrop = pipCrop.cropX !== 50 || pipCrop.cropY !== 50 || pipCrop.zoom !== 1.0;

    let pipCropFilter: string;
    if (pipHasCrop && videoCrop) {
      // Use PiP-specific crop values with the source video dimensions
      const pipVideoCrop: VideoCropSettings = {
        sourceWidth: videoCrop.sourceWidth,
        sourceHeight: videoCrop.sourceHeight,
        cropX: pipCrop.cropX,
        cropY: pipCrop.cropY,
        scale: pipCrop.zoom,
      };
      pipCropFilter = buildVideoCropFilter(pipVideoCrop, pipWidth, pipHeight);
    } else if (pipHasCrop) {
      // No global videoCrop but PiP has custom crop — use default source dimensions
      const pipVideoCrop: VideoCropSettings = {
        sourceWidth: project?.sourceWidth || 1920,
        sourceHeight: project?.sourceHeight || 1080,
        cropX: pipCrop.cropX,
        cropY: pipCrop.cropY,
        scale: pipCrop.zoom,
      };
      pipCropFilter = buildVideoCropFilter(pipVideoCrop, pipWidth, pipHeight);
    } else if (videoCrop) {
      // No PiP-specific crop, fall back to global video crop
      pipCropFilter = buildVideoCropFilter(videoCrop, pipWidth, pipHeight);
    } else {
      // Default center cover
      pipCropFilter = `scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=increase,crop=${pipWidth}:${pipHeight},setsar=1`;
    }
```

Note: Check if `project` (or source dimensions) are available in scope. They're passed into the render function via `options`. If not directly available, use `videoCrop.sourceWidth`/`videoCrop.sourceHeight` when `videoCrop` exists, or add source dimensions to `RenderWithPiPLayoutOptions`.

**Step 3: Verify typecheck**

Run: `cd packages/worker && npx tsc --noEmit 2>&1 | head -30`
Expected: PASS

**Step 4: Commit**

```
feat: export PiP video with user crop/pan/zoom settings
```

---

### Task 7: Update hint text and verify end-to-end

**Files:**
- Modify: `apps/web/src/features/editor-v2/panels/PiPControlPanel.tsx` (hint text, line ~364)

**Step 1: Update the PiP hint text**

Change:
```
'Talking head overlays the AI visuals. Customize position, size, and style.'
```
To:
```
'Drag PiP to reposition. Alt+drag to pan video inside. Scroll to zoom.'
```

**Step 2: Full typecheck**

Run: `cd /Users/sarthakpant/project/clippify && pnpm run typecheck 2>&1 | tail -20` (or equivalent)
Expected: PASS across all packages

**Step 3: Manual test checklist**

1. Open editor with PiP mode
2. Verify default rendering looks identical to before (center-cropped cover)
3. Open PiP panel > Video Framing section visible
4. Drag Horizontal Pan slider — video shifts left/right inside bubble
5. Drag Vertical Pan slider — video shifts up/down inside bubble
6. Drag Zoom slider — video zooms in inside bubble
7. Click "Face" preset — video zooms to upper-center
8. Click "Fit" preset — resets to default
9. Alt+drag on PiP bubble — video pans inside (cursor shows crosshair)
10. Scroll over PiP bubble — zoom changes
11. Regular drag (no Alt) still moves PiP position as before
12. Resize handles still work
13. Rotation handle still works

**Step 4: Commit**

```
feat: complete PiP video framing with drag-pan, scroll-zoom, and presets
```
