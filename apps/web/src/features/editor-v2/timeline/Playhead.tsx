/**
 * Playhead Component
 * Current time indicator with green accent (matches Linear/Figma style)
 */

'use client';

import React, { useCallback } from 'react';
import {
  useCurrentTimeMs,
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
  const currentTimeMs = useCurrentTimeMs();
  const viewport = useViewport();
  const duration = useDuration();
  const { setCurrentTime } = usePlaybackActions();
  const { startDrag, updateDrag, endDrag } = useTimelineActions();

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

  // Calculate position
  const x = currentTimeMs * viewport.zoom - viewport.scrollX;

  // Don't render if off screen (after all hooks)
  if (x < 0 || x > 10000) {
    return null;
  }

  return (
    <div
      className={`absolute top-0 bottom-0 pointer-events-none ${className || ''}`}
      style={{
        left: x,
        transform: 'translateX(-50%)',
        zIndex: 20,
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
