'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useEditorStore,
  useShowCaptions,
  useCaptionItems,
  useSelectedIds,
  useCaptionActions,
} from '../store/use-editor-store';
import type { CaptionStyle, CaptionPosition } from '../store/types';
import { anchorToFreeCoords } from '../store/types';

// --- Types ---

interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type DragMode = 'move' | 'resize-font' | 'resize-width' | 'rotate';

interface DragState {
  mode: DragMode;
  handle?: HandlePosition;
  startX: number;
  startY: number;
  startBox: BoundingBox;
  startFontSize: number;
  startWidth: number;
  startPosition: CaptionPosition;
}

interface SnapState {
  snappedVertical: number | null;   // x guide line (vertical line on canvas)
  snappedHorizontal: number | null; // y guide line (horizontal line on canvas)
}

// --- Constants ---

const HANDLE_SIZE = 10;
const HANDLE_HIT_AREA = 24;
const ROTATION_HANDLE_DISTANCE = 30;
const ROTATION_HANDLE_SIZE = 12;
const MIN_FONT_SIZE = 16;
const MIN_WIDTH = 20;
const MAX_WIDTH = 100;

const SNAP_THRESHOLD_PX = 8; // pixels on screen for snap detection
const ROTATION_SNAP_THRESHOLD = 3;

// Snap guide positions (percentage of canvas)
const SNAP_GUIDES = [0, 25, 33.33, 50, 66.67, 75, 100];

const ACCENT_COLOR = '#6366f1'; // Indigo-500
const ACCENT_COLOR_ALPHA = 'rgba(99, 102, 241, 0.7)';

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

// Determine drag mode based on handle position
function getDragModeForHandle(handle: HandlePosition): DragMode {
  // E/W handles = width resize
  if (handle === 'e' || handle === 'w') return 'resize-width';
  // N/S and corner handles = font size resize
  return 'resize-font';
}

// Find nearest snap guide for a given percentage value
function findSnap(value: number, canvasSizePx: number, guides: number[] = SNAP_GUIDES): number | null {
  const thresholdPercent = (SNAP_THRESHOLD_PX / canvasSizePx) * 100;
  for (const guide of guides) {
    if (Math.abs(value - guide) <= thresholdPercent) {
      return guide;
    }
  }
  return null;
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
  const { updateCaptionPreset } = useCaptionActions();
  const select = useEditorStore((s) => s.select);

  const [box, setBox] = useState<BoundingBox | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [snapState, setSnapState] = useState<SnapState>({ snappedVertical: null, snappedHorizontal: null });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  // During move drag: overlay handles/border track this box (computed from drag delta, not DOM)
  const [dragRenderBox, setDragRenderBox] = useState<BoundingBox | null>(null);
  // Captions being moved, with their starting free-mode (x%, y%) positions. Multiple
  // entries when the user has ≥2 caption items selected — the drag delta is applied
  // to each one's own starting position so relative offsets are preserved.
  const dragTargetsRef = useRef<Array<{ id: string; startX: number; startY: number }> | null>(null);
  // Final (possibly snapped) delta in canvas percentage, committed on pointer up.
  const lastMoveDeltaRef = useRef<{ dx: number; dy: number } | null>(null);
  // Fallback preset position when there are no target captions (e.g. playhead between phrases).
  const lastPresetPositionRef = useRef<CaptionPosition | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef<number>(0);
  const lastBoxRef = useRef<BoundingBox | null>(null);

  // Get the current caption style from the store's captionPreset
  const captionPreset = useEditorStore((s) => s.captionPreset);
  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);
  const updateCaptionItemPosition = useEditorStore((s) => s.updateCaptionItemPosition);
  const getCaptionStyle = useCallback((): CaptionStyle | null => {
    if (!captionItems.length) return null;
    return captionPreset;
  }, [captionItems, captionPreset]);

  /** Find the caption item visible at the current playhead time */
  const getVisibleCaptionId = useCallback((): string | null => {
    const t = useEditorStore.getState().currentTimeMs;
    for (const item of captionItems) {
      if (t >= item.startMs && t < item.endMs) return item.id;
    }
    return null;
  }, [captionItems]);

  // Global style updates (fontSize, rotation, width — shared by all captions)
  const updateStyle = useCallback(
    (updates: Partial<CaptionStyle>) => {
      updateCaptionPreset(updates);
    },
    [updateCaptionPreset]
  );

  // Measure the caption element's bounding box
  const measureBox = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const captionEl = container.querySelector('[data-caption-overlay]') as HTMLElement | null;
    if (!captionEl) {
      if (!lastBoxRef.current) setBox(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const captionRect = captionEl.getBoundingClientRect();

    const zoom = parseFloat(getComputedStyle(container).zoom || '1');

    const newBox: BoundingBox = {
      left: (captionRect.left - containerRect.left) / zoom,
      top: (captionRect.top - containerRect.top) / zoom,
      width: captionRect.width / zoom,
      height: captionRect.height / zoom,
    };

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

  // Poll for bounding box changes
  useEffect(() => {
    if (!showCaptions || captionItems.length === 0) {
      setBox(null);
      lastBoxRef.current = null;
      setIsSelected(false);
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

      const pos = resolvePosition(style.position);

      dragRef.current = {
        mode,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startBox: { ...box },
        startFontSize: style.fontSize,
        startWidth: pos.width ?? 90,
        startPosition: pos,
      };

      // Build the target list for this drag. Captions in the current selection
      // take priority; otherwise fall back to the phrase visible at the playhead.
      // Each target carries its own starting free-mode (x, y) so the delta is
      // applied relative to where that caption actually is (its per-item override
      // if present, else the preset's resolved free-mode coords).
      if (mode === 'move') {
        const state = useEditorStore.getState();
        const selectedCaptionIds = selectedIds.filter((id) => state.items[id]?.type === 'caption');
        const targetIds = selectedCaptionIds.length > 0
          ? selectedCaptionIds
          : (getVisibleCaptionId() ? [getVisibleCaptionId()!] : []);

        const presetFree = pos.mode === 'free'
          ? { x: pos.x ?? 50, y: pos.y ?? 85 }
          : anchorToFreeCoords(pos);

        dragTargetsRef.current = targetIds.map((id) => {
          const override = (state.items[id]?.data as { positionOverride?: { x: number; y: number } })?.positionOverride;
          return {
            id,
            startX: override?.x ?? presetFree.x,
            startY: override?.y ?? presetFree.y,
          };
        });
        lastMoveDeltaRef.current = null;
        lastPresetPositionRef.current = null;
      }

      setIsDragging(true);
      setSnapState({ snappedVertical: null, snappedHorizontal: null });
    },
    [getCaptionStyle, box, selectedIds, getVisibleCaptionId]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();

      const { mode, handle, startX, startY, startBox, startFontSize, startWidth, startPosition } = dragRef.current;

      const container = containerRef.current;
      const zoom = container ? parseFloat(getComputedStyle(container).zoom || '1') : 1;

      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;

      if (mode === 'move') {
        // Primary target = the first caption being dragged; used for snap guides
        // and the live position readout. When there are no targets (playhead
        // between phrases, nothing selected) we fall back to moving the preset.
        const targets = dragTargetsRef.current;
        const primary = targets && targets.length > 0 ? targets[0] : null;

        // Derive baseX/baseY for snapping
        let baseX: number;
        let baseY: number;
        if (primary) {
          baseX = primary.startX;
          baseY = primary.startY;
        } else {
          const isAnchorMode = startPosition.mode !== 'free';
          if (isAnchorMode) {
            const freeCoords = anchorToFreeCoords(startPosition);
            baseX = freeCoords.x;
            baseY = freeCoords.y;
          } else {
            baseX = startPosition.x ?? 50;
            baseY = startPosition.y ?? 85;
          }
        }

        const deltaX = (dx / canvasWidth) * 100;
        const deltaY = (dy / canvasHeight) * 100;

        let newX = clamp(baseX + deltaX, 0, 100);
        let newY = clamp(baseY + deltaY, 0, 100);

        // Snap to guides (based on the primary caption's center)
        const captionW = startPosition.width ?? 90;
        const leftEdge = newX - captionW / 2;
        const rightEdge = newX + captionW / 2;

        let snappedV = findSnap(newX, canvasWidth);
        if (snappedV == null) {
          const leftSnap = findSnap(leftEdge, canvasWidth);
          if (leftSnap != null) {
            newX = leftSnap + captionW / 2;
            snappedV = leftSnap;
          }
        }
        if (snappedV == null) {
          const rightSnap = findSnap(rightEdge, canvasWidth);
          if (rightSnap != null) {
            newX = rightSnap - captionW / 2;
            snappedV = rightSnap;
          }
        }
        if (snappedV != null) {
          if (snappedV === findSnap(newX, canvasWidth)) {
            newX = snappedV;
          }
        }

        const snappedH = findSnap(newY, canvasHeight);
        if (snappedH != null) {
          newY = snappedH;
        }

        setSnapState({ snappedVertical: snappedV, snappedHorizontal: snappedH });
        setDragPosition({ x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 });

        setDragRenderBox({
          left: startBox.left + dx,
          top: startBox.top + dy,
          width: startBox.width,
          height: startBox.height,
        });

        // Translate every rendered caption overlay together so a multi-select
        // drag looks like a group move. Only the phrase visible at the playhead
        // actually mounts, so this is typically a single element anyway.
        const container2 = containerRef.current;
        if (container2) {
          container2.querySelectorAll<HTMLElement>('[data-caption-overlay]').forEach((el) => {
            el.style.translate = `${dx}px ${dy}px`;
          });
        }

        if (primary) {
          // Commit delta in canvas-percent space — pointer-up applies it to
          // each target's own starting position (preserves relative offsets).
          lastMoveDeltaRef.current = {
            dx: newX - primary.startX,
            dy: newY - primary.startY,
          };
        } else {
          // No targets — remember the absolute new preset position for commit.
          lastPresetPositionRef.current = {
            ...startPosition,
            mode: 'free',
            x: Math.round(newX * 10) / 10,
            y: Math.round(newY * 10) / 10,
          };
        }
      } else if (mode === 'resize-width' && handle) {
        // E/W handles change caption width
        const deltaPercent = (dx / canvasWidth) * 100;
        let newWidth: number;

        if (handle === 'e') {
          // Dragging right edge: width increases with positive dx
          newWidth = startWidth + deltaPercent * 2; // *2 because centered
        } else {
          // Dragging left edge: width increases with negative dx
          newWidth = startWidth - deltaPercent * 2;
        }

        newWidth = Math.round(clamp(newWidth, MIN_WIDTH, MAX_WIDTH));

        updateStyle({
          position: {
            ...startPosition,
            width: newWidth,
          },
        });
      } else if (mode === 'resize-font' && handle) {
        let scaleX = 1;
        let scaleY = 1;

        if (handle.includes('e')) scaleX = (startBox.width + dx) / startBox.width;
        if (handle.includes('w')) scaleX = (startBox.width - dx) / startBox.width;
        if (handle.includes('s')) scaleY = (startBox.height + dy) / startBox.height;
        if (handle.includes('n')) scaleY = (startBox.height - dy) / startBox.height;

        // Corner handles: uniform scale; N/S edge handles: use vertical axis
        const scale = handle.length === 2
          ? (Math.abs(dx) > Math.abs(dy) ? scaleX : scaleY)
          : scaleY;

        const newFontSize = Math.round(clamp(startFontSize * scale, MIN_FONT_SIZE, 200));
        updateStyle({ fontSize: newFontSize });
      } else if (mode === 'rotate') {
        const centerX = startBox.left + startBox.width / 2;
        const centerY = startBox.top + startBox.height / 2;
        const currentX = centerX + dx;
        const currentY = centerY + dy;
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

      const targets = dragTargetsRef.current;
      const delta = lastMoveDeltaRef.current;

      // Clear the DOM translate FIRST, in the same paint as the store commit.
      // If we delay, React/Remotion re-renders the caption at its new position
      // while the translate is still applied → the caption visibly overshoots
      // by the drag delta for however long we wait. A synchronous clear means
      // at most one frame of the caption being shown at its pre-drag spot
      // before React repaints at the new position.
      const container = containerRef.current;
      if (container) {
        container.querySelectorAll<HTMLElement>('[data-caption-overlay]').forEach((el) => {
          el.style.translate = '';
        });
      }

      if (targets && targets.length > 0 && delta) {
        // "Select all then drag" = global move. Update the preset position and
        // wipe every per-item override so the whole caption set shares one
        // anchor, matching what the user typically expects.
        const isAllSelectedDrag =
          captionItems.length > 0 && targets.length === captionItems.length;

        if (isAllSelectedDrag) {
          const preset = useEditorStore.getState().captionPreset;
          const presetPos = resolvePosition(preset.position ?? 'bottom');
          const presetFree = presetPos.mode === 'free'
            ? { x: presetPos.x ?? 50, y: presetPos.y ?? 85 }
            : anchorToFreeCoords(presetPos);
          const newX = clamp(presetFree.x + delta.dx, 0, 100);
          const newY = clamp(presetFree.y + delta.dy, 0, 100);
          updateCaptionPreset({
            position: {
              ...presetPos,
              mode: 'free',
              x: Math.round(newX * 10) / 10,
              y: Math.round(newY * 10) / 10,
            },
          });
          for (const t of targets) {
            updateCaptionItemPosition(t.id, null);
          }
        } else {
          for (const t of targets) {
            const newX = clamp(t.startX + delta.dx, 0, 100);
            const newY = clamp(t.startY + delta.dy, 0, 100);
            updateCaptionItemPosition(t.id, {
              x: Math.round(newX * 10) / 10,
              y: Math.round(newY * 10) / 10,
            });
          }
        }
      } else if (lastPresetPositionRef.current) {
        // No per-item targets — treat the drag as a preset-level position edit.
        updateStyle({ position: lastPresetPositionRef.current });
      }

      dragTargetsRef.current = null;
      lastMoveDeltaRef.current = null;
      lastPresetPositionRef.current = null;

      dragRef.current = null;
      setIsDragging(false);
      setDragRenderBox(null);
      setSnapState({ snappedVertical: null, snappedHorizontal: null });
      setDragPosition(null);
    }
  }, [containerRef, updateStyle, updateCaptionItemPosition, updateCaptionPreset, captionItems.length]);

  // Sync local isSelected with store — clear when caption deselected externally
  const hasCaptionSelected = selectedIds.length > 0 && captionItems.some((item) => selectedIds.includes(item.id));
  useEffect(() => {
    if (!hasCaptionSelected) {
      setIsSelected(false);
    }
  }, [hasCaptionSelected]);

  // --- Render ---

  if (!box || !showCaptions || captionItems.length === 0) return null;

  // During move drag, use the drag-computed box for instant visual feedback;
  // otherwise use the DOM-measured box.
  const renderBox = dragRenderBox ?? box;

  const currentStyle = getCaptionStyle();
  const currentPosition = resolvePosition(currentStyle?.position ?? 'bottom');
  const currentRotation = currentPosition.rotation;

  // Show box + handles when a caption is selected, hovered, or being dragged
  const isActive = isHovered || isSelected || isDragging || hasCaptionSelected;

  return (
    <div
      className="absolute inset-0 z-20"
      // Opt out of the global "click empty preview area deselects" handler —
      // otherwise pointer-down inside the caption overlay (bounding box, handles,
      // rotation knob) would wipe a multi-caption selection before the drag
      // handler reads it, and only the single visible caption would end up moving.
      data-keep-selection
      style={{ pointerEvents: isSelected || isDragging ? 'auto' : 'none' }}
      onPointerDown={(e) => {
        // Click on background (not a child) to deselect
        if (e.target === e.currentTarget && !isDragging) {
          setIsSelected(false);
          select([], 'replace');
        }
      }}
      onPointerMove={isDragging ? handlePointerMove : undefined}
      onPointerUp={isDragging ? handlePointerUp : undefined}
    >
      {/* Snap guide lines */}
      {isDragging && snapState.snappedVertical != null && (
        <div
          style={{
            position: 'absolute',
            left: `${snapState.snappedVertical}%`,
            top: 0,
            bottom: 0,
            width: 0,
            borderLeft: `1px dashed ${ACCENT_COLOR}`,
            opacity: 0.6,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      {isDragging && snapState.snappedHorizontal != null && (
        <div
          style={{
            position: 'absolute',
            top: `${snapState.snappedHorizontal}%`,
            left: 0,
            right: 0,
            height: 0,
            borderTop: `1px dashed ${ACCENT_COLOR}`,
            opacity: 0.6,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* Expanded hover zone — covers bounding box + handle hit areas + rotation handle.
          This prevents handles from disappearing when the cursor moves from the box to a handle. */}
      <div
        style={{
          position: 'absolute',
          left: renderBox.left - HANDLE_HIT_AREA / 2,
          top: renderBox.top - ROTATION_HANDLE_DISTANCE - ROTATION_HANDLE_SIZE,
          width: renderBox.width + HANDLE_HIT_AREA,
          height: renderBox.height + HANDLE_HIT_AREA / 2 + ROTATION_HANDLE_DISTANCE + ROTATION_HANDLE_SIZE,
          pointerEvents: 'auto',
          cursor: 'default',
        }}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => !isDragging && setIsHovered(false)}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Bounding box + move area */}
      <div
        style={{
          position: 'absolute',
          left: renderBox.left,
          top: renderBox.top,
          width: renderBox.width,
          height: renderBox.height,
          border: isActive ? `1.5px solid ${ACCENT_COLOR_ALPHA}` : '1.5px solid transparent',
          cursor: 'move',
          pointerEvents: 'auto',
          transition: isDragging ? 'none' : 'border-color 0.15s',
        }}
        onPointerDown={(e) => {
          setIsSelected(true);
          // Keep an existing multi-caption selection intact so the user can drag
          // a group. Otherwise pick the caption visible at the playhead — that
          // matches what the user is clicking on visually.
          const selectedCaptionIds = selectedIds.filter((id) => captionItems.some((c) => c.id === id));
          if (selectedCaptionIds.length === 0 && captionItems.length > 0) {
            const visibleId = getVisibleCaptionId();
            select([visibleId ?? captionItems[0].id], 'replace');
          }
          handlePointerDown(e, 'move');
        }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Position readout tooltip during drag */}
      {isDragging && dragPosition && dragRef.current?.mode === 'move' && (
        <div
          style={{
            position: 'absolute',
            left: renderBox.left + renderBox.width / 2,
            top: renderBox.top - 28,
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            fontSize: 10,
            fontFamily: 'monospace',
            padding: '2px 6px',
            borderRadius: 4,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          x: {dragPosition.x}% y: {dragPosition.y}%
        </div>
      )}

      {/* Resize handles */}
      {isActive &&
        HANDLE_POSITIONS.map((handle) => {
          const offset = getHandleOffset(handle, renderBox);
          const dragMode = getDragModeForHandle(handle);
          const isWidthHandle = dragMode === 'resize-width';
          const isCorner = handle.length === 2;

          // Width handles (E/W): taller rectangles, Font handles: squares
          const handleW = isWidthHandle ? 6 : HANDLE_SIZE;
          const handleH = isWidthHandle ? 16 : HANDLE_SIZE;

          return (
            <div
              key={handle}
              style={{
                position: 'absolute',
                left: renderBox.left + offset.x - HANDLE_HIT_AREA / 2,
                top: renderBox.top + offset.y - HANDLE_HIT_AREA / 2,
                width: HANDLE_HIT_AREA,
                height: HANDLE_HIT_AREA,
                cursor: isWidthHandle ? 'ew-resize' : getRotatedCursor(handle, currentRotation),
                pointerEvents: 'auto',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPointerDown={(e) => handlePointerDown(e, dragMode, handle)}
            >
              <div
                style={{
                  width: handleW,
                  height: handleH,
                  backgroundColor: '#ffffff',
                  border: `1.5px solid ${ACCENT_COLOR}`,
                  borderRadius: isCorner ? 2 : (isWidthHandle ? 2 : 1),
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              />
            </div>
          );
        })}

      {/* Rotation handle */}
      {isActive && (
        <>
          <div
            style={{
              position: 'absolute',
              left: renderBox.left + renderBox.width / 2,
              top: renderBox.top - ROTATION_HANDLE_DISTANCE,
              width: 1,
              height: ROTATION_HANDLE_DISTANCE,
              backgroundColor: ACCENT_COLOR_ALPHA,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: renderBox.left + renderBox.width / 2 - ROTATION_HANDLE_SIZE / 2,
              top: renderBox.top - ROTATION_HANDLE_DISTANCE - ROTATION_HANDLE_SIZE / 2,
              width: ROTATION_HANDLE_SIZE,
              height: ROTATION_HANDLE_SIZE,
              backgroundColor: '#ffffff',
              border: `1.5px solid ${ACCENT_COLOR}`,
              borderRadius: '50%',
              cursor: 'grab',
              pointerEvents: 'auto',
              zIndex: 1,
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
            onPointerDown={(e) => handlePointerDown(e, 'rotate')}
          />
        </>
      )}
    </div>
  );
}
