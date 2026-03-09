# PiP Video Crop/Pan/Zoom Design

## Problem

When the PiP bubble is small (or any size), the video inside uses `objectFit: 'cover'` with center-crop — the user has no control over which part of their video is visible inside the bubble. If their face is off-center, it gets cut off.

## Solution

Add crop/pan/zoom controls for the video **inside** the PiP bubble, separate from the existing fullscreen video crop settings.

## Data Model

Add a `PiPCrop` interface and embed it in `PiPSettings`:

```typescript
export interface PiPCrop {
  cropX: number;  // 0-100, horizontal pan (50 = center)
  cropY: number;  // 0-100, vertical pan (50 = center)
  zoom: number;   // 1.0 = fill frame (cover), 1.5 = 150% zoom in
}

// Default
const DEFAULT_PIP_CROP: PiPCrop = { cropX: 50, cropY: 50, zoom: 1.0 };
```

Added to `PiPSettings`:
```typescript
export interface PiPSettings {
  // ... existing fields ...
  crop: PiPCrop;
}
```

## Presets

Three quick presets in the control panel:
- **Fit** — `{ cropX: 50, cropY: 50, zoom: 1.0 }` — default center-cover
- **Face center** — `{ cropX: 50, cropY: 30, zoom: 1.3 }` — zooms in on upper-center (where faces typically are)
- **Top half** — `{ cropX: 50, cropY: 25, zoom: 1.0 }` — pans to show the top portion

## Interactive Controls

### Drag-to-pan (on the PiP bubble in preview)
- When PiP is selected, dragging inside the bubble pans the video content (adjusts `cropX`/`cropY`)
- Uses a new `DragMode = 'crop-pan'` in `PiPDragOverlay`
- Activated by: double-click on PiP bubble enters "crop mode", or holding Alt/Option while dragging
- Visual indicator: crosshair cursor + subtle "crop mode" badge

### Scroll-to-zoom (on the PiP bubble)
- Scroll wheel over the PiP bubble adjusts `zoom` (1.0 - 3.0 range, 0.1 step)
- Only active when PiP is selected

### Slider controls in PiPControlPanel
- "Video Framing" section below existing "Style" section
- Horizontal pan slider (cropX: 0-100)
- Vertical pan slider (cropY: 0-100)
- Zoom slider (1.0 - 3.0)
- Preset buttons row (Fit / Face center / Top half)
- Reset button

## Rendering Changes

### Preview (Composition.tsx)

Replace `objectFit: 'cover'` for PiP mode with transform-based rendering using `calculateVideoTransform()`:

```typescript
// When in PiP mode, use crop settings instead of simple cover
if (mode === 'pip' && pip.crop) {
  const transform = calculateVideoTransform(
    sourceWidth, sourceHeight,
    pipContainerWidth, pipContainerHeight,
    pip.crop.cropX, pip.crop.cropY, pip.crop.zoom
  );
  // Apply transform to video element
}
```

The `VideoSequences` component already supports both `useSimpleRender` (cover) and transform-based rendering. We change PiP from simple to transform-based, passing the PiP crop values.

### Export (render.ts)

The FFmpeg PiP filter chain already calls `buildVideoCropFilter()` when `videoCrop` exists. We construct a `VideoCropSettings` from the PiP crop values:

```typescript
const pipVideoCrop: VideoCropSettings = {
  sourceWidth, sourceHeight,
  cropX: pip.crop.cropX,
  cropY: pip.crop.cropY,
  scale: pip.crop.zoom,
};
const pipCropFilter = buildVideoCropFilter(pipVideoCrop, pipWidth, pipHeight);
```

This replaces the current fallback of using the global `videoCrop` or a default center-cover scale.

## Files Changed

| File | Change |
|------|--------|
| `store/types.ts` | Add `PiPCrop` interface, add `crop` to `PiPSettings`, update defaults & presets |
| `store/editor-store.ts` | Add `updatePiPCrop()` action, include crop in preset application |
| `player/Composition.tsx` | Use transform-based rendering for PiP video instead of `objectFit: cover` |
| `components/PiPDragOverlay.tsx` | Add `crop-pan` drag mode, scroll-to-zoom handler |
| `panels/PiPControlPanel.tsx` | Add "Video Framing" section with sliders and presets |
| `worker/render.ts` | Use `pip.crop` values for PiP FFmpeg crop filter |

## Edge Cases

- **Zoom < 1.0**: Clamped to 1.0 minimum (video must always fill the bubble, no letterboxing)
- **Pan at edges**: `cropX`/`cropY` clamped so video never shows blank space (same logic as existing `calculateVideoTransform`)
- **Preset layouts**: Each layout preset (`pip-tutorial`, `pip-podcast`, etc.) gets a sensible default crop (all use `{ cropX: 50, cropY: 50, zoom: 1.0 }`)
- **Migration**: Existing projects without `crop` field default to `DEFAULT_PIP_CROP`
