/**
 * Playhead Component
 * Current time indicator with green accent (matches Linear/Figma style)
 */

'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import {
  useEditorStore,
  useViewport,
  useDuration,
  usePlaybackActions,
  useTimelineActions,
} from '../store/use-editor-store';

interface PlayheadProps {
  rulerHeight?: number;
  className?: string;
}

export function Playhead({ rulerHeight = 24, className }: PlayheadProps) {
  const viewport = useViewport();
  const duration = useDuration();
  const { setCurrentTime } = usePlaybackActions();
  const { startDrag, updateDrag, endDrag } = useTimelineActions();

  const playheadRef = useRef<HTMLDivElement>(null);

  // Keep viewport in a ref so the subscribe callback always reads the latest values
  // without needing to re-subscribe when viewport changes.
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // Subscribe to currentTimeMs changes and mutate the DOM directly — no React re-render.
  useEffect(() => {
    const applyPosition = (timeMs: number) => {
      if (!playheadRef.current) return;
      const { zoom, scrollX } = viewportRef.current;
      const x = timeMs * zoom - scrollX;
      // Hide if off-screen (matching original render-null logic)
      if (x < 0 || x > 10000) {
        playheadRef.current.style.visibility = 'hidden';
      } else {
        playheadRef.current.style.visibility = 'visible';
        playheadRef.current.style.left = `${x}px`;
      }
    };

    // Set initial position immediately
    applyPosition(useEditorStore.getState().currentTimeMs);

    let prev = useEditorStore.getState().currentTimeMs;
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.currentTimeMs !== prev) {
        prev = state.currentTimeMs;
        applyPosition(state.currentTimeMs);
      }
    });

    return unsubscribe;
  }, []);

  // Re-apply position when viewport changes (zoom/scroll) so the playhead doesn't lag.
  useEffect(() => {
    if (!playheadRef.current) return;
    const { zoom, scrollX } = viewport;
    const timeMs = useEditorStore.getState().currentTimeMs;
    const x = timeMs * zoom - scrollX;
    if (x < 0 || x > 10000) {
      playheadRef.current.style.visibility = 'hidden';
    } else {
      playheadRef.current.style.visibility = 'visible';
      playheadRef.current.style.left = `${x}px`;
    }
  }, [viewport]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);

      startDrag({
        type: 'scrub',
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    },
    [startDrag]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

      const rect = e.currentTarget.parentElement?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const timeMs = (x + viewport.scrollX) / viewport.zoom;
      setCurrentTime(Math.max(0, Math.min(timeMs, duration)));
      updateDrag(e.clientX, e.clientY);
    },
    [viewport, duration, setCurrentTime, updateDrag]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      endDrag();
    },
    [endDrag]
  );

  return (
    <div
      ref={playheadRef}
      className={`absolute top-0 bottom-0 pointer-events-none ${className || ''}`}
      style={{
        left: 0,
        transform: 'translateX(-50%)',
        zIndex: 20,
        visibility: 'hidden',
      }}
    >
      {/* Playhead handle (draggable) */}
      <div
        className="pointer-events-auto cursor-ew-resize"
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 16,
          height: rulerHeight,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Visual handle - green triangle */}
        <svg
          width="10"
          height="12"
          viewBox="0 0 10 12"
          fill="none"
          className="absolute top-0 left-1/2 -translate-x-1/2"
        >
          <path
            d="M0 0H10V6L5 12L0 6V0Z"
            fill="#10B981"
          />
        </svg>
      </div>

      {/* Playhead line - green */}
      <div
        className="absolute"
        style={{
          top: rulerHeight,
          bottom: 0,
          left: '50%',
          width: 2,
          transform: 'translateX(-50%)',
          backgroundColor: '#10B981', // --editor-accent
        }}
      />
    </div>
  );
}
