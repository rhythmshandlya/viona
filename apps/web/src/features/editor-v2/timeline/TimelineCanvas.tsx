/**
 * Timeline Canvas Component
 * Wraps the canvas element and handles rendering/interactions
 */

'use client';

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { CanvasRenderer, RenderState } from './canvas/CanvasRenderer';
import { HitTester } from './canvas/HitTester';
import { getDragManager, DragPreview } from './interactions/DragManager';
import { getSplitTool } from './interactions/SplitTool';
import { registerRenderer } from './canvas/renderers/registry';
import { VideoRenderer } from './canvas/renderers/VideoRenderer';
import { AudioRenderer } from './canvas/renderers/AudioRenderer';
import { CaptionRenderer } from './canvas/renderers/CaptionRenderer';
import { BaseRenderer } from './canvas/renderers/BaseRenderer';
import { VisualRenderer } from './canvas/renderers/VisualRenderer';
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
  useSplitMode,
  useEditorActions,
} from '../store/use-editor-store';
import { DragState, SnapTarget } from '../store/types';
import { useContextMenu, ContextMenu } from './context-menu';

interface TimelineCanvasProps {
  className?: string;
}

export function TimelineCanvas({ className }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const hitTesterRef = useRef<HitTester>(new HitTester());
  const dragManagerRef = useRef(getDragManager());
  const splitToolRef = useRef(getSplitTool());
  const containerRef = useRef<HTMLDivElement>(null);

  // Context menu
  const contextMenu = useContextMenu();

  // Local state for drag previews and snap lines
  const [dragPreviews, setDragPreviews] = useState<DragPreview[]>([]);
  const [snapLines, setSnapLines] = useState<{ position: number; type: SnapTarget['type'] }[]>([]);
  const [splitCursorTimeMs, setSplitCursorTimeMs] = useState<number>(0);

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
  const splitMode = useSplitMode();

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
    splitItem,
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
      splitMode,
      splitCursorTimeMs,
    }),
    [tracks, items, itemIds, selectedIds, currentTimeMs, duration, viewport, selectionBox, dragState, dragPreviews, snapLines, splitMode, splitCursorTimeMs]
  );

  // Keep render state in a ref so the ResizeObserver callback always has the latest
  const renderStateRef = useRef<RenderState>(renderState);
  renderStateRef.current = renderState;

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    rendererRef.current = new CanvasRenderer(canvasRef.current);

    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Register item renderers on mount
  useEffect(() => {
    const requestRedraw = () => {
      if (rendererRef.current) {
        rendererRef.current.requestRender(renderStateRef.current);
      }
    };
    registerRenderer('video', new VideoRenderer(requestRedraw));
    registerRenderer('audio', new AudioRenderer(requestRedraw));
    registerRenderer('caption', new CaptionRenderer());
    registerRenderer('text', new BaseRenderer());
    registerRenderer('image', new BaseRenderer());
    registerRenderer('visual', new VisualRenderer());
  }, []);

  // Handle resize via ResizeObserver — detects both window resize AND container size changes
  // (e.g. when user drags the timeline resize handle)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (rendererRef.current) {
        rendererRef.current.resize();
        rendererRef.current.render(renderStateRef.current);
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

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

      // Split mode: find item under cursor and split it
      if (splitMode) {
        const timeMs = hitTester.xToTime(x, viewport);
        const track = hitTester.getTrackAtY(y, {
          tracks,
          items,
          itemIds,
          viewport,
          currentTimeMs,
        });

        if (track) {
          const splitTool = splitToolRef.current;
          const itemId = splitTool.findItemAtPosition(timeMs, track.id, items, itemIds);
          if (itemId) {
            splitItem(itemId, timeMs);
          }
        }
        return; // Don't start drags in split mode
      }

      const hit = hitTester.hitTest(x, y, {
        tracks,
        items,
        itemIds,
        viewport,
        currentTimeMs,
      });

      const dragType = hitTester.getDragTypeFromHit(hit);

      // Handle selection
      const isMultiSelectKey = e.shiftKey || e.ctrlKey || e.metaKey;
      if (hit.type === 'item' && hit.itemId) {
        if (isMultiSelectKey) {
          select([hit.itemId], 'toggle');
        } else if (!selectedIds.includes(hit.itemId)) {
          select([hit.itemId], 'replace');
        }
      } else if (hit.type === 'empty' || hit.type === 'track') {
        if (!isMultiSelectKey) {
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
      splitMode,
      select,
      clearSelection,
      startDrag,
      splitItem,
    ]
  );

  // Handle pointer move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e);
      const hitTester = hitTesterRef.current;
      const dragManager = dragManagerRef.current;

      // Split mode: show crosshair cursor and update split cursor time
      if (splitMode) {
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'crosshair';
        }
        const timeMs = hitTester.xToTime(x, viewport);
        const splitTool = splitToolRef.current;
        splitTool.setCursorTime(timeMs);
        setSplitCursorTimeMs(timeMs);
        return;
      }

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
      splitMode,
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

  // Handle right-click context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hitTester = hitTesterRef.current;

      const hit = hitTester.hitTest(x, y, {
        tracks,
        items,
        itemIds,
        viewport,
        currentTimeMs,
      });

      const timeMs = hitTester.xToTime(x, viewport);

      contextMenu.open(e, {
        type: hit.type === 'playhead' ? 'empty' : hit.type,
        itemId: hit.itemId,
        trackId: hit.trackId,
        timeMs,
      });
    },
    [tracks, items, itemIds, viewport, currentTimeMs, contextMenu]
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
        onContextMenu={handleContextMenu}
      />
      <ContextMenu state={contextMenu.state} onClose={contextMenu.close} />
    </div>
  );
}
