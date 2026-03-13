'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore, useEditorActions } from '../store/use-editor-store';
import { DEFAULT_LAYOUT_SETTINGS } from '../store/types';
import type { PiPSettings, PiPPosition, PiPCrop } from '../store/types';
import { PIP_SIZE_MAP, DEFAULT_PIP_CROP } from '../store/types';

// --- Types ---

interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

type HandlePosition = 'nw' | 'ne' | 'se' | 'sw';
type DragMode = 'move' | 'resize' | 'border-radius' | 'rotate' | 'crop-pan';

interface DragState {
  mode: DragMode;
  handle?: HandlePosition;
  startX: number;
  startY: number;
  startBox: BoundingBox;
  startPiP: PiPSettings;
  startAngle?: number; // for rotation mode
  startCrop?: PiPCrop;
}

// --- Constants ---

const HANDLE_SIZE = 8;
const HANDLE_HIT_AREA = 22;
const MIN_CUSTOM_SIZE = 10;
const MAX_CUSTOM_SIZE = 50;
const MIN_BORDER_RADIUS = 0;
const MAX_BORDER_RADIUS = 50;
const BORDER_RADIUS_HANDLE_SIZE = 7;
const BORDER_RADIUS_HANDLE_HIT_AREA = 18;
const ROTATE_HANDLE_DISTANCE = 28; // px above the PiP top edge
const ROTATE_HANDLE_SIZE = 9;
const ROTATE_HANDLE_HIT_AREA = 22;

// --- Helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function detectCorner(
  centerX: number,
  centerY: number,
  canvasWidth: number,
  canvasHeight: number,
): PiPPosition {
  const isTop = centerY < canvasHeight / 2;
  const isLeft = centerX < canvasWidth / 2;
  if (isTop && isLeft) return 'top-left';
  if (isTop && !isLeft) return 'top-right';
  if (!isTop && isLeft) return 'bottom-left';
  return 'bottom-right';
}

function calculateOffsets(
  box: BoundingBox,
  position: PiPPosition,
  canvasWidth: number,
  canvasHeight: number,
): { offsetX: number; offsetY: number } {
  let offsetX: number;
  let offsetY: number;

  switch (position) {
    case 'top-left':
      offsetX = box.left;
      offsetY = box.top;
      break;
    case 'top-right':
      offsetX = canvasWidth - (box.left + box.width);
      offsetY = box.top;
      break;
    case 'bottom-left':
      offsetX = box.left;
      offsetY = canvasHeight - (box.top + box.height);
      break;
    case 'bottom-right':
    default:
      offsetX = canvasWidth - (box.left + box.width);
      offsetY = canvasHeight - (box.top + box.height);
      break;
  }

  return {
    offsetX: Math.max(0, Math.round(offsetX)),
    offsetY: Math.max(0, Math.round(offsetY)),
  };
}

function getResizeCursor(handle: HandlePosition): string {
  if (handle === 'nw' || handle === 'se') return 'nwse-resize';
  return 'nesw-resize';
}

const CORNER_HANDLES: HandlePosition[] = ['nw', 'ne', 'se', 'sw'];

function getHandleOffset(handle: HandlePosition, box: BoundingBox): { x: number; y: number } {
  const map: Record<HandlePosition, { x: number; y: number }> = {
    nw: { x: 0, y: 0 },
    ne: { x: box.width, y: 0 },
    se: { x: box.width, y: box.height },
    sw: { x: 0, y: box.height },
  };
  return map[handle];
}

/** Get angle in degrees from box center to a point (in container-local coords) */
function getAngleFromCenter(box: BoundingBox, x: number, y: number): number {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
}

// --- Component ---

interface PiPDragOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
}

export function PiPDragOverlay({ containerRef, canvasWidth, canvasHeight }: PiPDragOverlayProps) {
  const layoutSettings = useEditorStore((s) => s.layoutSettings) ?? DEFAULT_LAYOUT_SETTINGS;
  const { updatePiPSettings } = useEditorActions();
  const updatePiPCrop = useEditorStore((s) => s.updatePiPCrop);

  const [box, setBox] = useState<BoundingBox | null>(null);
  const [isSelected, setIsSelected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [altHeld, setAltHeld] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef<number>(0);
  const lastBoxRef = useRef<BoundingBox | null>(null);

  const pip = layoutSettings.pip;
  const isPiPMode = layoutSettings.mode === 'pip';

  // Measure the PiP element's bounding box
  const measureBox = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const pipEl = container.querySelector('[data-pip-overlay]') as HTMLElement | null;
    if (!pipEl) {
      if (!lastBoxRef.current) setBox(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const pipRect = pipEl.getBoundingClientRect();
    const zoom = parseFloat(getComputedStyle(container).zoom || '1');

    const newBox: BoundingBox = {
      left: (pipRect.left - containerRect.left) / zoom,
      top: (pipRect.top - containerRect.top) / zoom,
      width: pipRect.width / zoom,
      height: pipRect.height / zoom,
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
    if (!isPiPMode) {
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
  }, [isPiPMode, measureBox]);

  // Track Alt key for crop-pan mode
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

  // --- Pointer Handlers ---

  const getZoom = useCallback(() => {
    const container = containerRef.current;
    return container ? parseFloat(getComputedStyle(container).zoom || '1') : 1;
  }, [containerRef]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode, handle?: HandlePosition) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      if (!box) return;

      const state: DragState = {
        mode,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startBox: { ...box },
        startPiP: { ...pip },
      };

      // For rotation: record starting angle
      if (mode === 'rotate') {
        const container = containerRef.current;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const zoom = getZoom();
          const localX = (e.clientX - containerRect.left) / zoom;
          const localY = (e.clientY - containerRect.top) / zoom;
          state.startAngle = getAngleFromCenter(box, localX, localY);
        }
      }

      if (mode === 'crop-pan') {
        state.startCrop = { ...(pip.crop || DEFAULT_PIP_CROP) };
      }

      dragRef.current = state;
      setIsDragging(true);
      setIsSelected(true);
    },
    [box, pip, containerRef, getZoom]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();

      const { mode, handle, startX, startY, startBox, startPiP, startAngle } = dragRef.current;
      const zoom = getZoom();
      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;

      if (mode === 'move') {
        const newLeft = clamp(startBox.left + dx, 0, canvasWidth - startBox.width);
        const newTop = clamp(startBox.top + dy, 0, canvasHeight - startBox.height);

        const newBox: BoundingBox = {
          left: newLeft,
          top: newTop,
          width: startBox.width,
          height: startBox.height,
        };

        const centerX = newBox.left + newBox.width / 2;
        const centerY = newBox.top + newBox.height / 2;
        const position = detectCorner(centerX, centerY, canvasWidth, canvasHeight);
        const { offsetX, offsetY } = calculateOffsets(newBox, position, canvasWidth, canvasHeight);

        updatePiPSettings({ position, offsetX, offsetY });
      } else if (mode === 'resize' && handle) {
        let scaleX = 1;
        let scaleY = 1;

        if (handle.includes('e')) scaleX = (startBox.width + dx) / startBox.width;
        if (handle.includes('w')) scaleX = (startBox.width - dx) / startBox.width;
        if (handle.includes('s')) scaleY = (startBox.height + dy) / startBox.height;
        if (handle.includes('n')) scaleY = (startBox.height - dy) / startBox.height;

        const scale = Math.abs(dx) > Math.abs(dy) ? scaleX : scaleY;
        const startSize = startPiP.size === 'custom'
          ? startPiP.customSize
          : PIP_SIZE_MAP[startPiP.size];

        const newSize = clamp(
          Math.round(startSize * scale * 10) / 10,
          MIN_CUSTOM_SIZE,
          MAX_CUSTOM_SIZE,
        );

        updatePiPSettings({ size: 'custom', customSize: newSize });
      } else if (mode === 'border-radius') {
        const delta = (dx + dy) / 2;
        const radiusDelta = delta * 0.5;
        const newRadius = clamp(
          Math.round(startPiP.borderRadius + radiusDelta),
          MIN_BORDER_RADIUS,
          MAX_BORDER_RADIUS,
        );

        updatePiPSettings({ borderRadius: newRadius });
      } else if (mode === 'rotate' && startAngle !== undefined) {
        const container = containerRef.current;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        const localX = (e.clientX - containerRect.left) / zoom;
        const localY = (e.clientY - containerRect.top) / zoom;
        const currentAngle = getAngleFromCenter(startBox, localX, localY);
        const angleDelta = currentAngle - startAngle;
        const newRotation = clamp(
          Math.round((startPiP.rotation || 0) + angleDelta),
          -180,
          180,
        );
        updatePiPSettings({ rotation: newRotation });
      } else if (mode === 'crop-pan' && dragRef.current.startCrop) {
        const startCrop = dragRef.current.startCrop;
        // Pan sensitivity: map pixel drag to 0-100 crop range
        const pipSizePercent = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size];
        const pipPixelSize = canvasWidth * (pipSizePercent / 100);
        const sensitivity = 100 / (pipPixelSize * (startCrop.zoom || 1));

        const newCropX = clamp(startCrop.cropX - dx * sensitivity, 0, 100);
        const newCropY = clamp(startCrop.cropY - dy * sensitivity, 0, 100);
        updatePiPCrop({ cropX: newCropX, cropY: newCropY });
      }
    },
    [containerRef, canvasWidth, canvasHeight, updatePiPSettings, updatePiPCrop, pip, getZoom]
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

  // Click on PiP area to select
  const handlePiPClick = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsSelected(true);
    },
    []
  );

  // Click on background to deselect
  const handleBackgroundClick = useCallback(
    (e: React.PointerEvent) => {
      // Only deselect if clicking the background itself (not a child)
      if (e.target === e.currentTarget && !isDragging) {
        setIsSelected(false);
      }
    },
    [isDragging]
  );

  // --- Render ---

  if (!box || !isPiPMode) return null;

  const showHandles = isSelected || isDragging;
  const showBorderRadiusHandle = showHandles && pip.shape === 'rounded';

  // Rotation handle position: above the center top of the PiP
  const rotateCx = box.left + box.width / 2;
  const rotateCy = box.top - ROTATE_HANDLE_DISTANCE;

  const accentColor = 'rgba(99, 102, 241, 0.9)'; // indigo-500
  const accentSolid = '#6366f1';

  return (
    <div
      className="absolute inset-0 z-20"
      style={{ pointerEvents: isSelected || isDragging ? 'auto' : 'none' }}
      onPointerDown={handleBackgroundClick}
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
          border: showHandles
            ? `1.5px solid ${accentColor}`
            : '1.5px solid transparent',
          borderRadius: pip.shape === 'circle' ? '50%' : pip.shape === 'rounded' ? pip.borderRadius : 0,
          cursor: altHeld ? 'crosshair' : 'move',
          pointerEvents: 'auto',
          transition: isDragging ? 'none' : 'border-color 0.15s',
        }}
        onPointerDown={(e) => {
          handlePiPClick(e);
          if (e.altKey) {
            handlePointerDown(e, 'crop-pan');
          } else {
            handlePointerDown(e, 'move');
          }
        }}
        onWheel={handleWheel}
      />

      {/* Corner resize handles */}
      {showHandles &&
        CORNER_HANDLES.map((handle) => {
          const offset = getHandleOffset(handle, box);
          return (
            <div
              key={handle}
              style={{
                position: 'absolute',
                left: box.left + offset.x - HANDLE_HIT_AREA / 2,
                top: box.top + offset.y - HANDLE_HIT_AREA / 2,
                width: HANDLE_HIT_AREA,
                height: HANDLE_HIT_AREA,
                cursor: getResizeCursor(handle),
                pointerEvents: 'auto',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPointerDown={(e) => handlePointerDown(e, 'resize', handle)}
            >
              <div
                style={{
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  backgroundColor: '#ffffff',
                  border: `1.5px solid ${accentSolid}`,
                  borderRadius: 2,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                }}
              />
            </div>
          );
        })}

      {/* Rotation handle — line + circle above PiP */}
      {showHandles && (
        <>
          {/* Connector line from top-center to rotate handle */}
          <div
            style={{
              position: 'absolute',
              left: rotateCx,
              top: rotateCy + ROTATE_HANDLE_SIZE / 2,
              width: 1,
              height: ROTATE_HANDLE_DISTANCE - ROTATE_HANDLE_SIZE / 2,
              backgroundColor: accentColor,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
          {/* Rotate handle circle */}
          <div
            style={{
              position: 'absolute',
              left: rotateCx - ROTATE_HANDLE_HIT_AREA / 2,
              top: rotateCy - ROTATE_HANDLE_HIT_AREA / 2,
              width: ROTATE_HANDLE_HIT_AREA,
              height: ROTATE_HANDLE_HIT_AREA,
              cursor: 'grab',
              pointerEvents: 'auto',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPointerDown={(e) => handlePointerDown(e, 'rotate')}
          >
            <div
              style={{
                width: ROTATE_HANDLE_SIZE,
                height: ROTATE_HANDLE_SIZE,
                backgroundColor: '#ffffff',
                border: `1.5px solid ${accentSolid}`,
                borderRadius: '50%',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Small rotate icon (SVG arrow arc) */}
              <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
                <path
                  d="M10 2.5A5 5 0 1 0 11 6"
                  stroke={accentSolid}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M10 0.5v3h-3"
                  stroke={accentSolid}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </>
      )}

      {/* Border radius handle */}
      {showBorderRadiusHandle && (
        <div
          style={{
            position: 'absolute',
            left: box.left + box.width - pip.borderRadius - BORDER_RADIUS_HANDLE_HIT_AREA / 2,
            top: box.top + BORDER_RADIUS_HANDLE_HIT_AREA / 2 - BORDER_RADIUS_HANDLE_SIZE / 2,
            width: BORDER_RADIUS_HANDLE_HIT_AREA,
            height: BORDER_RADIUS_HANDLE_HIT_AREA,
            cursor: 'ew-resize',
            pointerEvents: 'auto',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPointerDown={(e) => handlePointerDown(e, 'border-radius')}
        >
          <div
            style={{
              width: BORDER_RADIUS_HANDLE_SIZE,
              height: BORDER_RADIUS_HANDLE_SIZE,
              backgroundColor: '#ffffff',
              border: '1.5px solid #f59e0b',
              borderRadius: '50%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }}
          />
        </div>
      )}
    </div>
  );
}
