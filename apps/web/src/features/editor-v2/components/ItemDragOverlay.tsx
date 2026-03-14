'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useSingleSelectedItem,
  useEditorStore,
} from '../store/use-editor-store';
import type { Transform } from '../store/types';

// --- Types ---

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type DragMode = 'move' | 'resize';

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
  const store = useEditorStore();

  const dragRef = useRef<DragState | null>(null);
  const [offset, setOffset] = useState<{ dx: number; dy: number; dw: number; dh: number }>({ dx: 0, dy: 0, dw: 0, dh: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Don't render for non-spatial items
  if (!selectedItem || NON_SPATIAL_TYPES.has(selectedItem.type)) {
    return null;
  }

  const transform = selectedItem.transform ?? DEFAULT_TRANSFORM;
  const itemX = resolveValue(transform.x, canvasWidth);
  const itemY = resolveValue(transform.y, canvasHeight);
  const itemW = resolveValue(transform.width, canvasWidth);
  const itemH = resolveValue(transform.height, canvasHeight);

  // Final displayed rect (with optimistic drag offset)
  const displayX = itemX + offset.dx;
  const displayY = itemY + offset.dy;
  const displayW = Math.max(10, itemW + offset.dw);
  const displayH = Math.max(10, itemH + offset.dh);

  const getScale = (): number => {
    const container = containerRef.current;
    if (!container) return 1;
    return parseFloat(getComputedStyle(container).zoom || '1');
  };

  const handleMouseDown = (e: React.MouseEvent, mode: DragMode, handle?: HandlePosition) => {
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      mode,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: itemX,
      startY: itemY,
      startW: itemW,
      startH: itemH,
      scale: getScale(),
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
      displayX={displayX}
      displayY={displayY}
      displayW={displayW}
      displayH={displayH}
      isDragging={isDragging}
      dragRef={dragRef}
      setOffset={setOffset}
      setIsDragging={setIsDragging}
      handleMouseDown={handleMouseDown}
    />
  );
}

// Inner component to attach window listeners
interface ItemDragOverlayInnerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  selectedItemId: string;
  displayX: number;
  displayY: number;
  displayW: number;
  displayH: number;
  isDragging: boolean;
  dragRef: React.MutableRefObject<DragState | null>;
  setOffset: React.Dispatch<React.SetStateAction<{ dx: number; dy: number; dw: number; dh: number }>>;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  handleMouseDown: (e: React.MouseEvent, mode: DragMode, handle?: HandlePosition) => void;
}

function ItemDragOverlayInner({
  containerRef,
  canvasWidth,
  canvasHeight,
  selectedItemId,
  displayX,
  displayY,
  displayW,
  displayH,
  isDragging,
  dragRef,
  setOffset,
  setIsDragging,
  handleMouseDown,
}: ItemDragOverlayInnerProps) {
  const updateTransform = useEditorStore((s) => s.updateTransform);

  // Window-level mousemove/mouseup during drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const scale = drag.scale;
      const dx = (e.clientX - drag.startMouseX) / scale;
      const dy = (e.clientY - drag.startMouseY) / scale;

      if (drag.mode === 'move') {
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
          updateTransform(selectedItemId, updates);
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
  }, [isDragging, dragRef, setOffset, setIsDragging, updateTransform, selectedItemId, canvasWidth, canvasHeight]);

  return (
    <div
      className="absolute inset-0 z-20"
      style={{ pointerEvents: isDragging ? 'auto' : 'none' }}
    >
      {/* Selection border + move area */}
      <div
        style={{
          position: 'absolute',
          left: displayX,
          top: displayY,
          width: displayW,
          height: displayH,
          border: isDragging ? `2px solid ${ACCENT}` : `1px solid ${ACCENT}`,
          boxShadow: isDragging ? '0 0 12px rgba(168, 85, 247, 0.4)' : 'none',
          cursor: 'move',
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

      {/* 8 resize handles */}
      {HANDLE_POSITIONS.map((handle) => {
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
