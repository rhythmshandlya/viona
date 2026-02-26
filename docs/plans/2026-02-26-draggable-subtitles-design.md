# Draggable Subtitles in Preview

## Summary

Add Canva-like direct manipulation of subtitles in the video preview: drag to reposition, corner handles to resize (changes fontSize), rotation handle to rotate. Changes affect both preview and export.

## Architecture

A new `CaptionDragOverlay` component sits as a sibling to `<Player />` inside the `playerContainerRef` div in `Scene.tsx`. The inner container renders at native resolution (1080x1920) with CSS `zoom` for scaling, so the overlay operates in the same coordinate space.

```
Scene.tsx
└── playerContainerRef (1080x1920, zoom: scale)
    ├── <Player />              ← Remotion renders captions
    ├── <CaptionDragOverlay />  ← Transparent overlay with handles
    ├── <SafeZoneOverlay />
    └── <SocialPreviewOverlay />
```

## Interaction Model

### Move (drag)
- Drag anywhere inside the bounding box to reposition
- Updates `position.offsetX` and `position.offsetY` in `CaptionStyle`
- Pointer delta converted to percentage of canvas dimensions (1080x1920)

### Resize (scale font size)
- 8 handles: 4 corners + 4 edge midpoints
- Dragging a handle recalculates `fontSize` proportionally
- E.g. if box width increases 20%, fontSize increases 20%
- Minimum fontSize clamped to 16

### Rotate
- Circle handle above top-center, connected by a thin line
- Calculates angle from box center to pointer position
- Updates `position.rotation`

### Apply scope
- Respects existing "apply to all" toggle
- When on: all captions move/resize/rotate together
- When off: only selected captions affected
- Uses existing `customizeStyle()` flow

## Bounding Box Detection

Add a `data-caption-overlay` attribute to the caption wrapper div in `Composition.tsx`. The overlay queries this element via `getBoundingClientRect()` relative to the player container to get the actual rendered bounding box.

## Data Flow

```
User drags handle
  → pointer event on CaptionDragOverlay
  → calculate new offsetX/offsetY (or fontSize, or rotation)
  → call customizeStyle({ position: { ...pos, offsetX, offsetY } })
  → store updates CaptionStyle on all/selected captions
  → Composition re-renders caption at new position
  → overlay re-reads position from store, stays in sync
```

## Visual Style

- Bounding box: 1px dashed line, semi-transparent accent color
- Resize handles: 8px white squares with accent border
- Rotation handle: 10px circle above top-center, thin connecting line
- Cursors: `move` on box, directional resize on corners/edges, `grab` on rotation handle

## Files to Change

| File | Change |
|------|--------|
| `player/Composition.tsx` | Add `data-caption-overlay` attribute to caption wrapper div |
| `scene/Scene.tsx` | Add `<CaptionDragOverlay />` as sibling to `<Player />` |
| New: `components/CaptionDragOverlay.tsx` | The overlay component (~300 lines) |

## Edge Cases

- No captions visible: overlay hidden
- Caption between words (empty): use last known bounding box
- Drag out of bounds: clamp offsetX to -50/+50, offsetY to -50/+50
- Very small text after resize: clamp fontSize minimum to 16
- CSS zoom scaling: overlay is inside the zoomed container, so coordinates match naturally

## Export Parity

No export changes needed. The existing `CaptionPosition` (offsetX, offsetY, rotation) and `fontSize` values are already consumed by both the Remotion preview and the export pipeline (render.ts). Updating these values in the store is sufficient.
