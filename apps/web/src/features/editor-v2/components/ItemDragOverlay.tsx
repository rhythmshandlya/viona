'use client';

import React, { useEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';
import {
  useSingleSelectedItem,
  useEditorStore,
  useCurrentTimeMs,
} from '../store/use-editor-store';
import type { Transform } from '../store/types';
import { resolveTransformAtTime } from '../utils/transform';

// --- Types ---

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type DragMode = 'move' | 'resize' | 'crop-pan';

interface DragState {
  mode: DragMode;
  handle?: HandlePosition;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  scale: number;
  // Crop pan state (video items only)
  startCropX?: number;
  startCropY?: number;
  cropScale?: number;
}

// --- Constants ---

const HANDLE_SIZE = 10;
const HANDLE_HIT_AREA = 24;
const ACCENT = '#a855f7';
const HANDLE_POSITIONS: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  width: '100%',
  height: '100%',
  rotation: 0,
  opacity: 1,
};

// Item types that don't have spatial transforms
const NON_SPATIAL_TYPES = new Set(['audio', 'caption']);

// --- Helpers ---

/** Resolve a transform value (number or "100%") to canvas pixels */
function resolveValue(v: number | string, canvasSize: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.endsWith('%')) {
    return (parseFloat(v) / 100) * canvasSize;
  }
  return parseFloat(v) || 0;
}

function getHandleOffset(handle: HandlePosition, w: number, h: number): { x: number; y: number } {
  const map: Record<HandlePosition, { x: number; y: number }> = {
    nw: { x: 0, y: 0 },
    n:  { x: w / 2, y: 0 },
    ne: { x: w, y: 0 },
    e:  { x: w, y: h / 2 },
    se: { x: w, y: h },
    s:  { x: w / 2, y: h },
    sw: { x: 0, y: h },
    w:  { x: 0, y: h / 2 },
  };
  return map[handle];
}

function getHandleCursor(handle: HandlePosition): string {
  const map: Record<HandlePosition, string> = {
    nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize',
    e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize',
    sw: 'nesw-resize', w: 'ew-resize',
  };
  return map[handle];
}

// --- Component ---

interface ItemDragOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
}

export function ItemDragOverlay({ containerRef, canvasWidth, canvasHeight }: ItemDragOverlayProps) {
  const selectedItem = useSingleSelectedItem();
  const updateTransform = useEditorStore((s) => s.updateTransform);
  const updateItemData = useEditorStore((s) => s.updateItemData);
  const currentTimeMs = useCurrentTimeMs();

  const dragRef = useRef<DragState | null>(null);
  const [offset, setOffset] = useState<{ dx: number; dy: number; dw: number; dh: number }>({ dx: 0, dy: 0, dw: 0, dh: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Don't render for non-spatial items
  if (!selectedItem || NON_SPATIAL_TYPES.has(selectedItem.type)) {
    return null;
  }

  const isVideo = selectedItem.type === 'video';
  const itemType = selectedItem.type;

  // Resolve keyframed transform at current time (fixes stacked mode selection outline)
  const baseTransform = selectedItem.transform ?? DEFAULT_TRANSFORM;
  const relativeTimeMs = currentTimeMs - selectedItem.startMs;
  const transform = resolveTransformAtTime(baseTransform, selectedItem.keyframes, relativeTimeMs);

  const itemX = resolveValue(transform.x, canvasWidth);
  const itemY = resolveValue(transform.y, canvasHeight);
  const itemW = resolveValue(transform.width, canvasWidth);
  const itemH = resolveValue(transform.height, canvasHeight);

  // For video items, offset is always 0 (crop pan doesn't move the selection rect)
  const displayX = itemX + (isVideo ? 0 : offset.dx);
  const displayY = itemY + (isVideo ? 0 : offset.dy);
  const displayW = Math.max(10, itemW + (isVideo ? 0 : offset.dw));
  const displayH = Math.max(10, itemH + (isVideo ? 0 : offset.dh));

  const getScale = (): number => {
    const container = containerRef.current;
    if (!container) return 1;
    return parseFloat(getComputedStyle(container).zoom || '1');
  };

  const handleMouseDown = (e: React.MouseEvent, mode: DragMode, handle?: HandlePosition) => {
    e.preventDefault();
    e.stopPropagation();

    // For video items, always use crop-pan mode instead of move
    const effectiveMode = isVideo && mode === 'move' ? 'crop-pan' : mode;
    const cropData = (selectedItem.data as any)?.crop;
    // Auto-zoom to 1.15 minimum so both axes have overflow for panning
    const cropScale = Math.max(cropData?.scale ?? 1, 1.15);

    dragRef.current = {
      mode: effectiveMode,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: itemX,
      startY: itemY,
      startW: itemW,
      startH: itemH,
      scale: getScale(),
      startCropX: cropData?.x ?? 50,
      startCropY: cropData?.y ?? 50,
      cropScale,
    };
    setIsDragging(true);
    setOffset({ dx: 0, dy: 0, dw: 0, dh: 0 });
  };

  return (
    <ItemDragOverlayInner
      containerRef={containerRef}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      selectedItemId={selectedItem.id}
      isVideo={isVideo}
      itemType={itemType}
      displayX={displayX}
      displayY={displayY}
      displayW={displayW}
      displayH={displayH}
      isDragging={isDragging}
      dragRef={dragRef}
      setOffset={setOffset}
      setIsDragging={setIsDragging}
      handleMouseDown={handleMouseDown}
      updateTransform={updateTransform}
      updateItemData={updateItemData}
    />
  );
}

// Inner component to attach window listeners
interface ItemDragOverlayInnerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  selectedItemId: string;
  isVideo: boolean;
  itemType: string;
  displayX: number;
  displayY: number;
  displayW: number;
  displayH: number;
  isDragging: boolean;
  dragRef: React.MutableRefObject<DragState | null>;
  setOffset: React.Dispatch<React.SetStateAction<{ dx: number; dy: number; dw: number; dh: number }>>;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  handleMouseDown: (e: React.MouseEvent, mode: DragMode, handle?: HandlePosition) => void;
  updateTransform: (itemId: string, updates: Record<string, number | string>) => void;
  updateItemData: (id: string, dataUpdates: Record<string, unknown>) => void;
}

function ItemDragOverlayInner({
  containerRef,
  canvasWidth,
  canvasHeight,
  selectedItemId,
  isVideo,
  itemType,
  displayX,
  displayY,
  displayW,
  displayH,
  isDragging,
  dragRef,
  setOffset,
  setIsDragging,
  handleMouseDown,
  updateTransform,
  updateItemData,
}: ItemDragOverlayInnerProps) {
  // Ref to hold pending updates (applied after render, not inside setOffset)
  const pendingUpdate = useRef<Record<string, number> | null>(null);
  const pendingCrop = useRef<{ x: number; y: number; scale: number } | null>(null);
  // Direct DOM refs for crop-pan live preview (bypasses React/manifest entirely)
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const lastCropRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });

  // Apply pending updates after render
  useEffect(() => {
    if (pendingUpdate.current) {
      updateTransform(selectedItemId, pendingUpdate.current);
      pendingUpdate.current = null;
    }
    if (pendingCrop.current) {
      updateItemData(selectedItemId, { crop: pendingCrop.current });
      pendingCrop.current = null;
    }
  });

  // Window-level mousemove/mouseup during drag
  useEffect(() => {
    if (!isDragging) return;

    // For crop-pan: grab the <video> DOM element for direct manipulation
    if (dragRef.current?.mode === 'crop-pan' && containerRef.current) {
      const videoEl = containerRef.current.querySelector('video');
      videoElRef.current = videoEl ?? null;
    }

    const CROP_SENSITIVITY = 80;

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const scale = drag.scale;
      const dx = (e.clientX - drag.startMouseX) / scale;
      const dy = (e.clientY - drag.startMouseY) / scale;

      if (drag.mode === 'crop-pan') {
        // Compute live crop position
        const newCropX = Math.max(0, Math.min(100, (drag.startCropX ?? 50) - (dx / drag.startW) * CROP_SENSITIVITY));
        const newCropY = Math.max(0, Math.min(100, (drag.startCropY ?? 50) - (dy / drag.startH) * CROP_SENSITIVITY));
        lastCropRef.current = { x: newCropX, y: newCropY };
        // Direct DOM manipulation — zero React overhead, no manifest sync
        if (videoElRef.current) {
          videoElRef.current.style.objectPosition = `${newCropX}% ${newCropY}%`;
          videoElRef.current.style.transform = `scale(${drag.cropScale ?? 1.15})`;
        }
      } else if (drag.mode === 'move') {
        setOffset({ dx, dy, dw: 0, dh: 0 });
      } else if (drag.mode === 'resize' && drag.handle) {
        let ddx = 0, ddy = 0, ddw = 0, ddh = 0;
        const h = drag.handle;

        // Horizontal
        if (h.includes('e')) { ddw = dx; }
        if (h.includes('w')) { ddx = dx; ddw = -dx; }
        // Vertical
        if (h.includes('s')) { ddh = dy; }
        if (h.includes('n')) { ddy = dy; ddh = -dy; }

        setOffset({ dx: ddx, dy: ddy, dw: ddw, dh: ddh });
      }
    };

    const handleMouseUp = () => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.mode === 'crop-pan') {
        const finalCrop = lastCropRef.current;
        const newCropX = Math.round(finalCrop.x);
        const newCropY = Math.round(finalCrop.y);
        // Clean up DOM ref (React will take over on next render from store update)
        videoElRef.current = null;
        // Defer crop update to after render via ref — use the effective scale (includes auto-zoom)
        pendingCrop.current = { x: newCropX, y: newCropY, scale: drag.cropScale ?? 1.15 };
        lastCropRef.current = { x: 50, y: 50 };
        dragRef.current = null;
        setIsDragging(false);
        return;
      }

      // Read current offset from the ref-backed state
      setOffset((currentOffset) => {
        const finalX = drag.startX + currentOffset.dx;
        const finalY = drag.startY + currentOffset.dy;
        const finalW = Math.max(10, drag.startW + currentOffset.dw);
        const finalH = Math.max(10, drag.startH + currentOffset.dh);

        const updates: Record<string, number> = {};
        if (Math.round(finalX) !== Math.round(drag.startX)) updates.x = Math.round(finalX);
        if (Math.round(finalY) !== Math.round(drag.startY)) updates.y = Math.round(finalY);
        if (Math.round(finalW) !== Math.round(drag.startW)) updates.width = Math.round(finalW);
        if (Math.round(finalH) !== Math.round(drag.startH)) updates.height = Math.round(finalH);

        if (Object.keys(updates).length > 0) {
          // Defer store update to after render via ref
          pendingUpdate.current = updates;
        }

        return { dx: 0, dy: 0, dw: 0, dh: 0 };
      });

      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, containerRef, dragRef, setOffset, setIsDragging, updateTransform, updateItemData, selectedItemId, canvasWidth, canvasHeight]);

  return (
    <div
      className="absolute inset-0 z-20"
      style={{ pointerEvents: isDragging ? 'auto' : 'none' }}
    >
      {/* Selection border + move/pan area */}
      <div
        style={{
          position: 'absolute',
          left: displayX,
          top: displayY,
          width: displayW,
          height: displayH,
          border: isDragging ? `2px solid ${ACCENT}` : `1px solid ${ACCENT}`,
          boxShadow: isDragging ? '0 0 12px rgba(168, 85, 247, 0.4)' : 'none',
          cursor: isVideo ? 'grab' : 'move',
          pointerEvents: 'auto',
          boxSizing: 'border-box',
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      />

      {/* Dimension label during resize */}
      {isDragging && dragRef.current?.mode === 'resize' && (
        <div style={{
          position: 'absolute',
          left: displayX + displayW / 2,
          top: displayY - 24,
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: ACCENT,
          fontSize: 11,
          padding: '2px 6px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          {Math.round(displayW)} × {Math.round(displayH)}
        </div>
      )}

      {/* Crop pan indicator */}
      {isDragging && dragRef.current?.mode === 'crop-pan' && (
        <div style={{
          position: 'absolute',
          left: displayX + displayW / 2,
          top: displayY - 24,
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: ACCENT,
          fontSize: 11,
          padding: '2px 6px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          Pan Video
        </div>
      )}

      {/* Person item badge */}
      {itemType === 'person' && (
        <div style={{
          position: 'absolute',
          left: displayX + displayW / 2,
          top: displayY - 24,
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-xs text-emerald-300">
            <User size={12} />
            Speaker Layer
          </div>
        </div>
      )}

      {/* 8 resize handles (hidden for video items — video fills its keyframed bounds) */}
      {!isVideo && HANDLE_POSITIONS.map((handle) => {
        const pos = getHandleOffset(handle, displayW, displayH);
        return (
          <div
            key={handle}
            style={{
              position: 'absolute',
              left: displayX + pos.x - HANDLE_HIT_AREA / 2,
              top: displayY + pos.y - HANDLE_HIT_AREA / 2,
              width: HANDLE_HIT_AREA,
              height: HANDLE_HIT_AREA,
              cursor: getHandleCursor(handle),
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
            onMouseDown={(e) => handleMouseDown(e, 'resize', handle)}
          >
            <div
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                backgroundColor: ACCENT,
                border: '1.5px solid #ffffff',
                borderRadius: 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
