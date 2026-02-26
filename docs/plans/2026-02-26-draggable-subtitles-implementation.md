# Draggable Subtitles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Canva-like drag, resize, and rotate handles to subtitles in the video preview.

**Architecture:** A `CaptionDragOverlay` component renders as a transparent overlay above the Remotion Player inside Scene.tsx's `playerContainerRef`. It queries the actual caption DOM element (via a `data-caption-overlay` attribute) for bounding box, then renders interactive handles. Pointer interactions update `CaptionStyle` position/fontSize/rotation in the Zustand store, which re-renders both preview and export.

**Tech Stack:** React, Zustand, pointer events (no external dependencies)

---

### Task 1: Add data attribute to caption wrapper in Composition.tsx

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/Composition.tsx`

**Step 1: Add `data-caption-overlay` to all caption wrapper divs**

There are 4 return points in `CaptionRenderer` that render `<div style={positionStyles}>`. Each needs a `data-caption-overlay` attribute so the overlay can find the element.

At line 1298 (word-by-word mode), change:
```tsx
<div style={positionStyles}>
```
to:
```tsx
<div style={positionStyles} data-caption-overlay>
```

At line 1336 (karaoke mode), change:
```tsx
<div style={positionStyles}>
```
to:
```tsx
<div style={positionStyles} data-caption-overlay>
```

At line 1478 (dynamic hierarchy mode), the div uses a spread of positionStyles — add the attribute:
```tsx
<div style={{
  ...positionStyles,
  // ... existing overrides
}} data-caption-overlay>
```

At line 1517 (standard phrase mode), change:
```tsx
<div style={positionStyles}>
```
to:
```tsx
<div style={positionStyles} data-caption-overlay>
```

**Step 2: Verify no regressions**

Run the dev server and confirm subtitles still render normally in preview.

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/player/Composition.tsx
git commit -m "feat: add data-caption-overlay attribute for drag overlay detection"
```

---

### Task 2: Create CaptionDragOverlay component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx`

**Step 1: Create the component file**

This is the core component. It:
1. Finds the caption DOM element via `[data-caption-overlay]`
2. Calculates bounding box relative to its container
3. Renders a bounding box outline + 8 resize handles + 1 rotation handle
4. Handles pointer events for drag (move), resize, and rotate
5. Updates the store via the same path as StylePanel (`updateAllCaptionStyles` / `updateSelectedCaptionStyles`)

```tsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useShowCaptions,
  useCaptionItems,
  useSelectedIds,
  useApplyStyleToAll,
  useEditorActions,
} from '../store/use-editor-store';
import type { CaptionItemData, CaptionStyle, CaptionPosition } from '../store/types';

// --- Types ---

interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type DragMode = 'move' | 'resize' | 'rotate';

interface DragState {
  mode: DragMode;
  handle?: HandlePosition;
  startX: number;
  startY: number;
  startBox: BoundingBox;
  startFontSize: number;
  startPosition: CaptionPosition;
}

// --- Constants ---

const HANDLE_SIZE = 8;
const ROTATION_HANDLE_DISTANCE = 30;
const ROTATION_HANDLE_SIZE = 10;
const MIN_FONT_SIZE = 16;
const MAX_OFFSET = 50;

const HANDLE_CURSORS: Record<HandlePosition, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

const HANDLE_POSITIONS: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

// --- Helpers ---

function getHandleOffset(handle: HandlePosition, box: BoundingBox): { x: number; y: number } {
  const halfW = box.width / 2;
  const halfH = box.height / 2;
  const map: Record<HandlePosition, { x: number; y: number }> = {
    nw: { x: 0, y: 0 },
    n:  { x: halfW, y: 0 },
    ne: { x: box.width, y: 0 },
    e:  { x: box.width, y: halfH },
    se: { x: box.width, y: box.height },
    s:  { x: halfW, y: box.height },
    sw: { x: 0, y: box.height },
    w:  { x: 0, y: halfH },
  };
  return map[handle];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolvePosition(position: CaptionPosition | string): CaptionPosition {
  if (typeof position === 'object' && 'anchor' in position) return position;
  return {
    anchor: (typeof position === 'string' ? position : 'bottom') as 'top' | 'center' | 'bottom',
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    textAlign: 'center',
  };
}

// --- Component ---

interface CaptionDragOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
}

export function CaptionDragOverlay({ containerRef, canvasWidth, canvasHeight }: CaptionDragOverlayProps) {
  const showCaptions = useShowCaptions();
  const captionItems = useCaptionItems();
  const selectedIds = useSelectedIds();
  const applyToAll = useApplyStyleToAll();
  const { updateAllCaptionStyles, updateSelectedCaptionStyles } = useEditorActions();

  const [box, setBox] = useState<BoundingBox | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef<number>(0);
  const lastBoxRef = useRef<BoundingBox | null>(null);

  // Get the current caption style (from first selected caption or first caption)
  const getCaptionStyle = useCallback((): CaptionStyle | null => {
    if (!captionItems.length) return null;
    if (selectedIds.length > 0) {
      const selected = captionItems.find((item) => selectedIds.includes(item.id));
      if (selected) return (selected.data as CaptionItemData).style;
    }
    return (captionItems[0].data as CaptionItemData).style;
  }, [captionItems, selectedIds]);

  // Update style respecting "apply to all" toggle
  const updateStyle = useCallback(
    (updates: Partial<CaptionStyle>) => {
      if (applyToAll || selectedIds.length === 0) {
        updateAllCaptionStyles(updates);
      } else {
        updateSelectedCaptionStyles(selectedIds, updates);
      }
    },
    [applyToAll, selectedIds, updateAllCaptionStyles, updateSelectedCaptionStyles]
  );

  // Measure the caption element's bounding box
  const measureBox = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const captionEl = container.querySelector('[data-caption-overlay]') as HTMLElement | null;
    if (!captionEl) {
      // Keep last known box briefly so it doesn't flash during word transitions
      if (!lastBoxRef.current) setBox(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const captionRect = captionEl.getBoundingClientRect();

    // Account for CSS zoom on the container
    const zoom = parseFloat(getComputedStyle(container).zoom || '1');

    const newBox: BoundingBox = {
      left: (captionRect.left - containerRect.left) / zoom,
      top: (captionRect.top - containerRect.top) / zoom,
      width: captionRect.width / zoom,
      height: captionRect.height / zoom,
    };

    // Only update if changed meaningfully (avoid thrashing)
    const prev = lastBoxRef.current;
    if (
      !prev ||
      Math.abs(prev.left - newBox.left) > 1 ||
      Math.abs(prev.top - newBox.top) > 1 ||
      Math.abs(prev.width - newBox.width) > 1 ||
      Math.abs(prev.height - newBox.height) > 1
    ) {
      lastBoxRef.current = newBox;
      setBox(newBox);
    }
  }, [containerRef]);

  // Poll for bounding box changes (caption content changes with playback)
  useEffect(() => {
    if (!showCaptions || captionItems.length === 0) {
      setBox(null);
      lastBoxRef.current = null;
      return;
    }

    const tick = () => {
      measureBox();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [showCaptions, captionItems.length, measureBox]);

  // --- Pointer Handlers ---

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode, handle?: HandlePosition) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const style = getCaptionStyle();
      if (!style || !box) return;

      dragRef.current = {
        mode,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startBox: { ...box },
        startFontSize: style.fontSize,
        startPosition: resolvePosition(style.position),
      };
    },
    [getCaptionStyle, box]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();

      const { mode, handle, startX, startY, startBox, startFontSize, startPosition } = dragRef.current;

      // Get zoom factor from container
      const container = containerRef.current;
      const zoom = container ? parseFloat(getComputedStyle(container).zoom || '1') : 1;

      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;

      if (mode === 'move') {
        // Convert pixel delta to percentage of canvas
        const deltaOffsetX = (dx / canvasWidth) * 100;
        const deltaOffsetY = (dy / canvasHeight) * 100;

        // For bottom anchor, Y is inverted (bottom offset decreases when moving down)
        const yMultiplier = startPosition.anchor === 'bottom' ? -1 : 1;

        const newOffsetX = clamp(startPosition.offsetX + deltaOffsetX, -MAX_OFFSET, MAX_OFFSET);
        const newOffsetY = clamp(startPosition.offsetY + deltaOffsetY * yMultiplier, -MAX_OFFSET, MAX_OFFSET);

        updateStyle({
          position: {
            ...startPosition,
            offsetX: Math.round(newOffsetX * 10) / 10,
            offsetY: Math.round(newOffsetY * 10) / 10,
          },
        });
      } else if (mode === 'resize' && handle) {
        // Calculate scale factor from handle drag
        let scaleX = 1;
        let scaleY = 1;

        if (handle.includes('e')) scaleX = (startBox.width + dx) / startBox.width;
        if (handle.includes('w')) scaleX = (startBox.width - dx) / startBox.width;
        if (handle.includes('s')) scaleY = (startBox.height + dy) / startBox.height;
        if (handle.includes('n')) scaleY = (startBox.height - dy) / startBox.height;

        // Use the dominant axis for uniform scaling
        const scale = handle.length === 2
          ? (Math.abs(dx) > Math.abs(dy) ? scaleX : scaleY)  // Corner: use dominant axis
          : (handle === 'e' || handle === 'w' ? scaleX : scaleY); // Edge: use that axis

        const newFontSize = Math.round(clamp(startFontSize * scale, MIN_FONT_SIZE, 200));
        updateStyle({ fontSize: newFontSize });
      } else if (mode === 'rotate') {
        // Calculate angle from box center to current pointer position
        const centerX = startBox.left + startBox.width / 2;
        const centerY = startBox.top + startBox.height / 2;

        const currentX = centerX + dx;
        const currentY = centerY + dy;

        // Angle in degrees, 0 = straight up
        const angle = Math.atan2(currentX - centerX, -(currentY - centerY)) * (180 / Math.PI);
        const snappedAngle = Math.round(angle);
        const clampedAngle = clamp(snappedAngle, -180, 180);

        updateStyle({
          position: {
            ...startPosition,
            rotation: clampedAngle,
          },
        });
      }
    },
    [containerRef, canvasWidth, canvasHeight, updateStyle]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  }, []);

  // --- Render ---

  if (!box || !showCaptions || captionItems.length === 0) return null;

  const isDragging = dragRef.current !== null;

  return (
    <div
      className="absolute inset-0 z-20"
      style={{ pointerEvents: isDragging ? 'auto' : 'none' }}
      onPointerMove={isDragging ? handlePointerMove : undefined}
      onPointerUp={isDragging ? handlePointerUp : undefined}
    >
      {/* Bounding box + move area */}
      <div
        style={{
          position: 'absolute',
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          border: isHovered || isDragging ? '1px dashed rgba(139, 92, 246, 0.7)' : '1px dashed transparent',
          cursor: 'move',
          pointerEvents: 'auto',
          transition: isDragging ? 'none' : 'border-color 0.15s',
        }}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => !isDragging && setIsHovered(false)}
        onPointerDown={(e) => handlePointerDown(e, 'move')}
      />

      {/* Resize handles — only show when hovered or dragging */}
      {(isHovered || isDragging) &&
        HANDLE_POSITIONS.map((handle) => {
          const offset = getHandleOffset(handle, box);
          return (
            <div
              key={handle}
              style={{
                position: 'absolute',
                left: box.left + offset.x - HANDLE_SIZE / 2,
                top: box.top + offset.y - HANDLE_SIZE / 2,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                backgroundColor: '#ffffff',
                border: '1.5px solid #8b5cf6',
                borderRadius: 1,
                cursor: HANDLE_CURSORS[handle],
                pointerEvents: 'auto',
                zIndex: 1,
              }}
              onPointerDown={(e) => handlePointerDown(e, 'resize', handle)}
            />
          );
        })}

      {/* Rotation handle — circle above top-center */}
      {(isHovered || isDragging) && (
        <>
          {/* Connecting line */}
          <div
            style={{
              position: 'absolute',
              left: box.left + box.width / 2,
              top: box.top - ROTATION_HANDLE_DISTANCE,
              width: 1,
              height: ROTATION_HANDLE_DISTANCE,
              backgroundColor: 'rgba(139, 92, 246, 0.5)',
              pointerEvents: 'none',
            }}
          />
          {/* Rotation circle */}
          <div
            style={{
              position: 'absolute',
              left: box.left + box.width / 2 - ROTATION_HANDLE_SIZE / 2,
              top: box.top - ROTATION_HANDLE_DISTANCE - ROTATION_HANDLE_SIZE / 2,
              width: ROTATION_HANDLE_SIZE,
              height: ROTATION_HANDLE_SIZE,
              backgroundColor: '#ffffff',
              border: '1.5px solid #8b5cf6',
              borderRadius: '50%',
              cursor: 'grab',
              pointerEvents: 'auto',
              zIndex: 1,
            }}
            onPointerDown={(e) => handlePointerDown(e, 'rotate')}
          />
        </>
      )}
    </div>
  );
}
```

**Step 2: Verify the file compiles**

Check the dev server for TypeScript errors.

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx
git commit -m "feat: add CaptionDragOverlay component with drag, resize, rotate"
```

---

### Task 3: Wire CaptionDragOverlay into Scene.tsx

**Files:**
- Modify: `apps/web/src/features/editor-v2/scene/Scene.tsx`

**Step 1: Import and render CaptionDragOverlay**

Add the import at the top of Scene.tsx (after existing imports around line 12):
```tsx
import { CaptionDragOverlay } from '../components/CaptionDragOverlay';
```

Add the `useProject` hook is already imported. We need the canvas dimensions from it.

Inside the `playerContainerRef` div (after `<Player />` at line 162, before the element selection overlay), add:
```tsx
<CaptionDragOverlay
  containerRef={playerContainerRef}
  canvasWidth={videoWidth}
  canvasHeight={videoHeight}
/>
```

The render tree becomes:
```tsx
<div ref={playerContainerRef} style={{ width: videoWidth, height: videoHeight, zoom: scale }}>
  <Player />
  <CaptionDragOverlay
    containerRef={playerContainerRef}
    canvasWidth={videoWidth}
    canvasHeight={videoHeight}
  />
  {/* Element selection overlay */}
  {/* Social preview overlay */}
</div>
```

**Step 2: Test manually**

1. Open the editor with a project that has captions
2. Hover over the caption in the preview — should see dashed bounding box + handles
3. Drag the caption — should move (check StylePanel offset sliders update)
4. Drag a corner handle — font size should change (check StylePanel font size slider)
5. Drag the rotation circle — caption should rotate (check StylePanel rotation slider)
6. Toggle "Apply to all" and verify it affects all vs selected captions

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/scene/Scene.tsx
git commit -m "feat: wire CaptionDragOverlay into Scene for preview subtitle manipulation"
```

---

### Task 4: Polish and edge cases

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx`

**Step 1: Handle rotation-adjusted cursor directions**

When the caption is rotated, the resize cursors should rotate to match. Add cursor rotation logic in the resize handle rendering. Replace the static cursor with a rotated one:

```tsx
function getRotatedCursor(handle: HandlePosition, rotationDeg: number): string {
  // Map handle positions to base angles (clockwise from north)
  const baseAngles: Record<HandlePosition, number> = {
    n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315,
  };
  const angle = (baseAngles[handle] + rotationDeg + 360) % 360;
  // Snap to nearest cursor direction
  const cursorMap = [
    { range: [337.5, 22.5], cursor: 'ns-resize' },
    { range: [22.5, 67.5], cursor: 'nesw-resize' },
    { range: [67.5, 112.5], cursor: 'ew-resize' },
    { range: [112.5, 157.5], cursor: 'nwse-resize' },
    { range: [157.5, 202.5], cursor: 'ns-resize' },
    { range: [202.5, 247.5], cursor: 'nesw-resize' },
    { range: [247.5, 292.5], cursor: 'ew-resize' },
    { range: [292.5, 337.5], cursor: 'nwse-resize' },
  ];
  for (const { range, cursor } of cursorMap) {
    if (range[0] > range[1]) {
      // Wraps around 0
      if (angle >= range[0] || angle < range[1]) return cursor;
    } else {
      if (angle >= range[0] && angle < range[1]) return cursor;
    }
  }
  return 'move';
}
```

Use it in the handle rendering:
```tsx
cursor: getRotatedCursor(handle, getCaptionStyle()?.position?.rotation ?? 0),
```

**Step 2: Add snap-to-zero for rotation**

When rotating near 0 degrees (within ±3°), snap to exactly 0 for easy reset:

In the rotate handler, after calculating `snappedAngle`:
```tsx
const finalAngle = Math.abs(snappedAngle) <= 3 ? 0 : clampedAngle;
```

**Step 3: Add snap-to-center for position**

When dragging near center (offsetX or offsetY within ±1%), snap to 0:
```tsx
const snapThreshold = 1;
const finalOffsetX = Math.abs(newOffsetX) <= snapThreshold ? 0 : Math.round(newOffsetX * 10) / 10;
const finalOffsetY = Math.abs(newOffsetY) <= snapThreshold ? 0 : Math.round(newOffsetY * 10) / 10;
```

**Step 4: Test edge cases**

- Play video and verify overlay follows caption as words change
- Resize to very small — confirm fontSize doesn't go below 16
- Drag to far corner — confirm offsets clamp at ±50
- Rotate and resize — confirm cursor direction adjusts
- With no captions — confirm no overlay rendered
- Toggle show/hide captions — confirm overlay hides too

**Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/components/CaptionDragOverlay.tsx
git commit -m "feat: add rotation-aware cursors, snap-to-center and snap-to-zero"
```
