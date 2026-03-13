'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useVideoSettings,
  useSourceDimensions,
  useEditorStore,
} from '../store/use-editor-store';
import {
  DEFAULT_LAYOUT_SETTINGS,
  PIP_SIZE_MAP,
} from '../store/types';
import type {
  VisualItemData,
  PiPSettings,
  SplitSettings,
} from '../store/types';

// --- Types ---

interface DragState {
  startX: number;
  startY: number;
  startCropX: number;
  startCropY: number;
}

// --- Helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute the on-screen region (relative to the canvas) where the video is visible.
 * Returns {left, top, width, height} in canvas-pixel coordinates.
 */
function computeVideoRegion(
  canvasWidth: number,
  canvasHeight: number,
  activeDisplayMode: string | null,
  layoutMode: 'pip' | 'stacked',
  pip: PiPSettings,
  split: SplitSettings,
): { left: number; top: number; width: number; height: number } | null {
  if (activeDisplayMode === 'fullscreen') {
    // Video is hidden in fullscreen mode
    return null;
  }

  if (!activeDisplayMode || activeDisplayMode === 'overlay') {
    // Gap or overlay: video fills full canvas
    return { left: 0, top: 0, width: canvasWidth, height: canvasHeight };
  }

  // displayMode === 'default'
  if (layoutMode === 'stacked') {
    // Stacked: video occupies the non-visual portion
    const videoPercent = (100 - split.ratio) / 100;
    const gap = split.gap;
    const isVisualsFirst = split.position === 'visuals-first';
    const height = canvasHeight * videoPercent - gap / 2;
    const top = isVisualsFirst ? canvasHeight - height : 0;
    return { left: 0, top, width: canvasWidth, height };
  }

  // PiP mode: video is in the pip bubble
  const sizePercent = (pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size]) / 100;
  const pipW = canvasWidth * sizePercent;
  const pipH = pipW; // 1:1 aspect ratio

  let left = 0;
  let top = 0;
  switch (pip.position) {
    case 'top-left':
      left = pip.offsetX;
      top = pip.offsetY;
      break;
    case 'top-right':
      left = canvasWidth - pipW - pip.offsetX;
      top = pip.offsetY;
      break;
    case 'bottom-left':
      left = pip.offsetX;
      top = canvasHeight - pipH - pip.offsetY;
      break;
    case 'bottom-right':
    default:
      left = canvasWidth - pipW - pip.offsetX;
      top = canvasHeight - pipH - pip.offsetY;
      break;
  }

  return { left, top, width: pipW, height: pipH };
}

/**
 * Convert a pixel-space drag delta into cropX/cropY deltas.
 * Uses the same overflow math as calculateCoverTransform so 1:1 panning.
 */
function dragPixelsToCropDelta(
  dxPx: number,
  dyPx: number,
  sourceWidth: number,
  sourceHeight: number,
  containerWidth: number,
  containerHeight: number,
  currentScale: number,
): { dCropX: number; dCropY: number } {
  const baseScale = Math.max(containerWidth / sourceWidth, containerHeight / sourceHeight) * currentScale;
  const overflowX = sourceWidth * baseScale - containerWidth;
  const overflowY = sourceHeight * baseScale - containerHeight;

  // Drag right (positive dx) moves the image right, so cropX decreases
  const dCropX = overflowX > 0 ? (-dxPx / overflowX) * 100 : 0;
  const dCropY = overflowY > 0 ? (-dyPx / overflowY) * 100 : 0;

  return { dCropX, dCropY };
}

// --- Component ---

interface VideoDragOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
}

export function VideoDragOverlay({ containerRef, canvasWidth, canvasHeight }: VideoDragOverlayProps) {
  const videoSettings = useVideoSettings();
  const layoutSettings = useEditorStore((s) => s.layoutSettings) ?? DEFAULT_LAYOUT_SETTINGS;
  const sourceDimensions = useSourceDimensions();

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const wheelTargetRef = useRef<HTMLDivElement | null>(null);
  const wheelHistoryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if there are any video items (skip overlay for audio-only projects)
  const hasVideoItems = useEditorStore((state) =>
    state.itemIds.some((id) => state.items[id]?.type === 'video')
  );

  // Find the active visual item's display mode at the current time
  const activeDisplayMode = useEditorStore((state) => {
    const time = state.currentTimeMs;
    for (const id of state.itemIds) {
      const item = state.items[id];
      if (item?.type === 'visual' && time >= item.startMs && time < item.endMs) {
        const dm = (item.data as VisualItemData).displayMode;
        // Normalize legacy 'pip' → 'default'
        if (!dm || (dm as string) === 'pip') return 'default';
        return dm;
      }
    }
    return null; // gap — no active visual
  });

  // Check if there are any visuals at all
  const hasVisuals = useEditorStore((state) =>
    state.itemIds.some((id) => state.items[id]?.type === 'visual')
  );

  // Compute video region
  const region = hasVisuals
    ? computeVideoRegion(
        canvasWidth, canvasHeight,
        activeDisplayMode,
        layoutSettings.mode,
        layoutSettings.pip,
        layoutSettings.split,
      )
    : { left: 0, top: 0, width: canvasWidth, height: canvasHeight };

  // Determine container dimensions for overflow math
  const getContainerDims = useCallback((): { w: number; h: number } => {
    if (!hasVisuals || !activeDisplayMode || activeDisplayMode === 'overlay') {
      return { w: canvasWidth, h: canvasHeight };
    }
    if (activeDisplayMode === 'fullscreen') {
      return { w: canvasWidth, h: canvasHeight };
    }
    // displayMode === 'default'
    if (layoutSettings.mode === 'stacked') {
      const videoPercent = (100 - layoutSettings.split.ratio) / 100;
      return { w: canvasWidth, h: Math.round(canvasHeight * videoPercent) };
    }
    // PiP
    const sizePercent = (layoutSettings.pip.size === 'custom'
      ? layoutSettings.pip.customSize
      : PIP_SIZE_MAP[layoutSettings.pip.size]) / 100;
    const pipW = Math.round(canvasWidth * sizePercent);
    return { w: pipW, h: pipW };
  }, [hasVisuals, activeDisplayMode, layoutSettings, canvasWidth, canvasHeight]);

  // --- Pointer handlers ---

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!videoSettings || !sourceDimensions) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCropX: videoSettings.cropX,
      startCropY: videoSettings.cropY,
    };
    setIsDragging(true);
  }, [videoSettings, sourceDimensions]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !sourceDimensions || !videoSettings) return;
    e.preventDefault();

    const container = containerRef.current;
    const zoom = container ? parseFloat(getComputedStyle(container).zoom || '1') : 1;

    const dx = (e.clientX - dragRef.current.startX) / zoom;
    const dy = (e.clientY - dragRef.current.startY) / zoom;

    const { w, h } = getContainerDims();
    const { dCropX, dCropY } = dragPixelsToCropDelta(
      dx, dy,
      sourceDimensions.width, sourceDimensions.height,
      w, h,
      videoSettings.scale,
    );

    const newCropX = clamp(dragRef.current.startCropX + dCropX, 0, 100);
    const newCropY = clamp(dragRef.current.startCropY + dCropY, 0, 100);

    // Direct store update (no history push) for smooth dragging
    const project = useEditorStore.getState().project;
    if (project) {
      useEditorStore.setState({
        project: {
          ...project,
          videoSettings: {
            ...project.videoSettings,
            cropX: Math.round(newCropX * 10) / 10,
            cropY: Math.round(newCropY * 10) / 10,
          },
        },
      });
    }
  }, [containerRef, sourceDimensions, videoSettings, getContainerDims]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer already released
    }
    dragRef.current = null;
    setIsDragging(false);

    // Push a single history entry for the completed drag gesture
    useEditorStore.getState().pushHistory();
  }, []);

  // Native wheel handler (must be non-passive to allow preventDefault)
  useEffect(() => {
    const el = wheelTargetRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const vs = useEditorStore.getState().project?.videoSettings;
      if (!vs) return;

      const delta = -e.deltaY * 0.001;
      const newScale = clamp(vs.scale + delta, 1.0, 3.0);
      const rounded = Math.round(newScale * 100) / 100;

      if (rounded !== vs.scale) {
        const project = useEditorStore.getState().project;
        if (project) {
          useEditorStore.setState({
            project: {
              ...project,
              videoSettings: { ...project.videoSettings, scale: rounded },
            },
          });
          // Debounce history push so continuous scrolling = one undo entry
          if (wheelHistoryTimer.current) clearTimeout(wheelHistoryTimer.current);
          wheelHistoryTimer.current = setTimeout(() => {
            useEditorStore.getState().pushHistory();
            wheelHistoryTimer.current = null;
          }, 300);
        }
      }
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => {
      el.removeEventListener('wheel', handler);
      if (wheelHistoryTimer.current) {
        clearTimeout(wheelHistoryTimer.current);
        useEditorStore.getState().pushHistory();
      }
    };
  }, []);

  // Double-click to reset
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!videoSettings) return;
    e.preventDefault();
    e.stopPropagation();

    if (videoSettings.cropX !== 50 || videoSettings.cropY !== 50 || videoSettings.scale !== 1.0) {
      const project = useEditorStore.getState().project;
      if (project) {
        useEditorStore.setState({
          project: {
            ...project,
            videoSettings: { ...project.videoSettings, cropX: 50, cropY: 50, scale: 1.0 },
          },
        });
        useEditorStore.getState().pushHistory();
      }
    }
  }, [videoSettings]);

  // --- Render ---

  // Don't render if no video items, no video region, or no valid source
  if (!hasVideoItems || !region || !videoSettings || !sourceDimensions) return null;

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 10, pointerEvents: isDragging ? 'auto' : 'none' }}
      onPointerMove={isDragging ? handlePointerMove : undefined}
      onPointerUp={isDragging ? handlePointerUp : undefined}
    >
      {/* Drag target over the video region */}
      <div
        ref={wheelTargetRef}
        style={{
          position: 'absolute',
          left: region.left,
          top: region.top,
          width: region.width,
          height: region.height,
          cursor: isDragging ? 'grabbing' : 'grab',
          pointerEvents: 'auto',
          outline: isHovered || isDragging
            ? '2px solid rgba(139, 92, 246, 0.5)'
            : '2px solid transparent',
          outlineOffset: -2,
          borderRadius: activeDisplayMode === 'default' && layoutSettings.mode === 'pip'
            ? (layoutSettings.pip.shape === 'circle' ? '50%' : undefined)
            : undefined,
          transition: isDragging ? 'none' : 'outline-color 0.15s',
        }}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => !isDragging && setIsHovered(false)}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
}
