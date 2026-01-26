/**
 * Timeline Canvas Component
 * Wraps the canvas element and handles rendering/interactions
 */

'use client';

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { CanvasRenderer, RenderState } from './canvas/CanvasRenderer';
import { HitTester } from './canvas/HitTester';
import { getDragManager, DragPreview } from './interactions/DragManager';
import {
  useTracks,
  useItems,
  useItemIds,
  useSelectedIds,
  useCurrentTimeMs,
  useDuration,
  useViewport,
  useSelectionBox,
  useDragState,
  useEditorActions,
} from '../store/use-editor-store';
import { DragState, SnapTarget } from '../store/types';

interface TimelineCanvasProps {
  className?: string;
}

export function TimelineCanvas({ className }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const hitTesterRef = useRef<HitTester>(new HitTester());
  const dragManagerRef = useRef(getDragManager());
  const containerRef = useRef<HTMLDivElement>(null);

  // Local state for drag previews and snap lines
  const [dragPreviews, setDragPreviews] = useState<DragPreview[]>([]);
  const [snapLines, setSnapLines] = useState<{ position: number; type: SnapTarget['type'] }[]>([]);

  // State
  const tracks = useTracks();
  const items = useItems();
  const itemIds = useItemIds();
  const selectedIds = useSelectedIds();
  const currentTimeMs = useCurrentTimeMs();
  const duration = useDuration();
  const viewport = useViewport();
  const selectionBox = useSelectionBox();
  const dragState = useDragState();

  // Actions
  const {
    select,
    clearSelection,
    setSelectionBox,
    setCurrentTime,
    startDrag,
    updateDrag,
    endDrag,
    moveItem,
    resizeItem,
  } = useEditorActions();

  // Build render state
  const renderState: RenderState = useMemo(
    () => ({
      tracks,
      items,
      itemIds,
      selectedIds,
      currentTimeMs,
      duration,
      viewport,
      selectionBox,
      dragState,
      dragPreviews,
      snapLines,
    }),
    [tracks, items, itemIds, selectedIds, currentTimeMs, duration, viewport, selectionBox, dragState, dragPreviews, snapLines]
  );

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    rendererRef.current = new CanvasRenderer(canvasRef.current);

    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (rendererRef.current) {
        rendererRef.current.resize();
        rendererRef.current.render(renderState);
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial render
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [renderState]);

  // Render on state change
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.requestRender(renderState);
    }
  }, [renderState]);

  // Get canvas-relative coordinates
  const getCanvasCoords = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // Handle pointer down
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e);
      const hitTester = hitTesterRef.current;
      const dragManager = dragManagerRef.current;

      const hit = hitTester.hitTest(x, y, {
        tracks,
        items,
        itemIds,
        viewport,
        currentTimeMs,
      });

      const dragType = hitTester.getDragTypeFromHit(hit);

      // Handle selection
      if (hit.type === 'item' && hit.itemId) {
        if (e.shiftKey) {
          select([hit.itemId], 'toggle');
        } else if (!selectedIds.includes(hit.itemId)) {
          select([hit.itemId], 'replace');
        }
      } else if (hit.type === 'empty' || hit.type === 'track') {
        if (!e.shiftKey) {
          clearSelection();
        }
      }

      // Start drag
      if (dragType) {
        const item = hit.itemId ? items[hit.itemId] : undefined;

        const newDragState: DragState = {
          type: dragType,
          itemId: hit.itemId,
          trackId: hit.trackId || item?.trackId,
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
          originalStartMs: item?.startMs,
          originalEndMs: item?.endMs,
          originalTrackId: item?.trackId,
        };

        startDrag(newDragState);

        // Start drag manager operation for move/resize
        if (dragType === 'move' || dragType === 'resize-left' || dragType === 'resize-right') {
          const operation = dragManager.startDrag(newDragState, {
            tracks,
            items,
            itemIds,
            selectedIds: hit.itemId && selectedIds.includes(hit.itemId) ? selectedIds : [hit.itemId!],
            viewport,
            currentTimeMs,
          });
          setDragPreviews(operation.previews);
        }

        // Capture pointer for drag
        canvasRef.current?.setPointerCapture(e.pointerId);
      }
    },
    [
      getCanvasCoords,
      tracks,
      items,
      itemIds,
      viewport,
      currentTimeMs,
      selectedIds,
      select,
      clearSelection,
      startDrag,
    ]
  );

  // Handle pointer move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e);
      const hitTester = hitTesterRef.current;
      const dragManager = dragManagerRef.current;

      // Update cursor based on what's under the pointer
      if (!dragState) {
        const hit = hitTester.hitTest(x, y, {
          tracks,
          items,
          itemIds,
          viewport,
          currentTimeMs,
        });
        const cursor = hitTester.getCursorForHit(hit);
        if (canvasRef.current) {
          canvasRef.current.style.cursor = cursor;
        }
        return;
      }

      // Update drag state
      updateDrag(x, y);

      // Handle drag actions
      switch (dragState.type) {
        case 'scrub': {
          const timeMs = hitTester.xToTime(x, viewport);
          setCurrentTime(Math.max(0, Math.min(timeMs, duration)));
          break;
        }

        case 'select-box': {
          setSelectionBox({
            startX: dragState.startX,
            startY: dragState.startY,
            endX: x,
            endY: y,
          });

          // Update selection based on box
          const idsInBox = hitTester.getItemsInBox(
            {
              startX: dragState.startX,
              startY: dragState.startY,
              endX: x,
              endY: y,
            },
            { tracks, items, itemIds, viewport, currentTimeMs }
          );
          select(idsInBox, 'replace');
          break;
        }

        case 'move':
        case 'resize-left':
        case 'resize-right': {
          // Update drag manager with new position
          const updatedDragState: DragState = {
            ...dragState,
            currentX: x,
            currentY: y,
          };

          const operation = dragManager.updateDrag(updatedDragState, {
            tracks,
            items,
            itemIds,
            selectedIds,
            viewport,
            currentTimeMs,
          });

          if (operation) {
            setDragPreviews(operation.previews);

            // Update snap lines
            if (operation.snapResult.snapped && operation.snapResult.target) {
              setSnapLines([{
                position: operation.snapResult.target.position,
                type: operation.snapResult.target.type,
              }]);
            } else {
              setSnapLines([]);
            }
          }
          break;
        }
      }
    },
    [
      getCanvasCoords,
      dragState,
      tracks,
      items,
      itemIds,
      viewport,
      currentTimeMs,
      selectedIds,
      duration,
      updateDrag,
      setCurrentTime,
      setSelectionBox,
      select,
    ]
  );

  // Handle pointer up
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragState) return;

      const dragManager = dragManagerRef.current;

      switch (dragState.type) {
        case 'move':
        case 'resize-left':
        case 'resize-right': {
          // Get final operation from drag manager
          const operation = dragManager.endDrag();

          if (operation && operation.previews.length > 0) {
            // Apply the changes from previews
            for (const preview of operation.previews) {
              if (!preview.isValid) continue;

              if (operation.type === 'move') {
                moveItem(preview.itemId, preview.previewTrackId, Math.round(preview.previewStartMs));
              } else {
                resizeItem(preview.itemId, Math.round(preview.previewStartMs), Math.round(preview.previewEndMs));
              }
            }
          }

          // Clear previews and snap lines
          setDragPreviews([]);
          setSnapLines([]);
          break;
        }

        case 'select-box': {
          setSelectionBox(null);
          break;
        }
      }

      endDrag();
      canvasRef.current?.releasePointerCapture(e.pointerId);
    },
    [
      dragState,
      moveItem,
      resizeItem,
      setSelectionBox,
      endDrag,
    ]
  );

  // Handle pointer leave (cancel drag)
  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Only handle if we're not capturing the pointer
      if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
        return;
      }

      // Cancel any active drag
      if (dragState) {
        dragManagerRef.current.cancelDrag();
        setDragPreviews([]);
        setSnapLines([]);
        setSelectionBox(null);
        endDrag();
      }
    },
    [dragState, setSelectionBox, endDrag]
  );

  // Handle double click for seeking
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x } = getCanvasCoords(e as unknown as React.PointerEvent);
      const hitTester = hitTesterRef.current;
      const timeMs = hitTester.xToTime(x, viewport);
      setCurrentTime(Math.max(0, Math.min(timeMs, duration)));
    },
    [getCanvasCoords, viewport, duration, setCurrentTime]
  );

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className || ''}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
}
