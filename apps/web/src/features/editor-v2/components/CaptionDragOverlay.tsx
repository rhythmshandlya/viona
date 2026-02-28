'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useShowCaptions,
  useCaptionItems,
  useSelectedIds,
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
const MAX_OFFSET = 80;

const SNAP_THRESHOLD = 1; // % offset snap-to-center threshold
const ROTATION_SNAP_THRESHOLD = 3; // degrees snap-to-zero threshold

function getRotatedCursor(handle: HandlePosition, rotationDeg: number): string {
  const baseAngles: Record<HandlePosition, number> = {
    n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315,
  };
  const angle = (baseAngles[handle] + rotationDeg + 360) % 360;
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
      if (angle >= range[0] || angle < range[1]) return cursor;
    } else {
      if (angle >= range[0] && angle < range[1]) return cursor;
    }
  }
  return 'move';
}

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
  const { updateAllCaptionStyles, updateSelectedCaptionStyles } = useEditorActions();

  const [box, setBox] = useState<BoundingBox | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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

  // Update style — matches StylePanel behavior: all when no selection, selected otherwise
  const updateStyle = useCallback(
    (updates: Partial<CaptionStyle>) => {
      if (selectedIds.length === 0) {
        updateAllCaptionStyles(updates);
      } else {
        updateSelectedCaptionStyles(selectedIds, updates);
      }
    },
    [selectedIds, updateAllCaptionStyles, updateSelectedCaptionStyles]
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
      setIsDragging(true);
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

        const newOffsetX = clamp(startPosition.offsetX + deltaOffsetX, -MAX_OFFSET, MAX_OFFSET);
        const newOffsetY = clamp(startPosition.offsetY + deltaOffsetY, -MAX_OFFSET, MAX_OFFSET);

        const finalOffsetX = Math.abs(newOffsetX) <= SNAP_THRESHOLD ? 0 : Math.round(newOffsetX * 10) / 10;
        const finalOffsetY = Math.abs(newOffsetY) <= SNAP_THRESHOLD ? 0 : Math.round(newOffsetY * 10) / 10;

        updateStyle({
          position: {
            ...startPosition,
            offsetX: finalOffsetX,
            offsetY: finalOffsetY,
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
        const finalAngle = Math.abs(clampedAngle) <= ROTATION_SNAP_THRESHOLD ? 0 : clampedAngle;

        updateStyle({
          position: {
            ...startPosition,
            rotation: finalAngle,
          },
        });
      }
    },
    [containerRef, canvasWidth, canvasHeight, updateStyle]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Pointer already released
      }
      dragRef.current = null;
      setIsDragging(false);
    }
  }, []);

  // --- Render ---

  if (!box || !showCaptions || captionItems.length === 0) return null;

  const currentRotation = resolvePosition(getCaptionStyle()?.position ?? 'bottom').rotation;

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
                cursor: getRotatedCursor(handle, currentRotation),
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
