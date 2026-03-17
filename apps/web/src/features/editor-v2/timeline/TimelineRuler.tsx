/**
 * Timeline Ruler Component
 * Minimal ruler with time markers.
 * Alt+drag to select a time range for AI editing.
 */

'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  useViewport,
  useDuration,
  useCurrentTimeMs,
  useSelectedTimeRange,
  usePlaybackActions,
  useAIActions,
} from '../store/use-editor-store';

interface TimelineRulerProps {
  height?: number;
  className?: string;
}

/**
 * Format time in milliseconds to a human-readable string
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `0:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate appropriate tick interval based on zoom level
 */
function getTickInterval(zoom: number): { major: number; minor: number } {
  const targetPixelInterval = 150;
  const targetMsInterval = targetPixelInterval / zoom;

  const intervals = [100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000];
  let major = intervals[intervals.length - 1];

  for (const interval of intervals) {
    if (targetMsInterval <= interval) {
      major = interval;
      break;
    }
  }

  const minor = major / 5;
  return { major, minor };
}

export function TimelineRuler({ height = 24, className }: TimelineRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewport = useViewport();
  const duration = useDuration();
  const currentTimeMs = useCurrentTimeMs();
  const selectedTimeRange = useSelectedTimeRange();
  const { setCurrentTime } = usePlaybackActions();
  const { setSelectedTimeRange } = useAIActions();

  // Track whether the current drag is a range selection (Alt+drag)
  const [rangeDrag, setRangeDrag] = useState<{ startMs: number; currentMs: number } | null>(null);

  // Convert pixel x to time ms
  const xToTime = useCallback(
    (x: number) => Math.max(0, Math.min((x + viewport.scrollX) / viewport.zoom, duration)),
    [viewport, duration]
  );

  // Render ruler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Setup canvas
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;

    // Clear with editor ruler background - liquid glass theme
    ctx.fillStyle = 'rgba(14, 14, 20, 0.7)';
    ctx.fillRect(0, 0, width, height);

    // Draw selected time range highlight (committed or in-progress)
    const activeRange = rangeDrag
      ? { startMs: Math.min(rangeDrag.startMs, rangeDrag.currentMs), endMs: Math.max(rangeDrag.startMs, rangeDrag.currentMs) }
      : selectedTimeRange;

    if (activeRange) {
      const x1 = activeRange.startMs * viewport.zoom - viewport.scrollX;
      const x2 = activeRange.endMs * viewport.zoom - viewport.scrollX;
      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)'; // indigo highlight
      ctx.fillRect(x1, 0, x2 - x1, height);
      // Range edges
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, height);
      ctx.moveTo(x2, 0);
      ctx.lineTo(x2, height);
      ctx.stroke();
    }

    // Calculate visible time range
    const visibleStartMs = viewport.scrollX / viewport.zoom;
    const visibleEndMs = (viewport.scrollX + width) / viewport.zoom;

    // Get tick intervals
    const { major, minor } = getTickInterval(viewport.zoom);

    // Draw minor ticks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    const firstMinor = Math.floor(visibleStartMs / minor) * minor;
    for (let ms = firstMinor; ms <= visibleEndMs; ms += minor) {
      const x = ms * viewport.zoom - viewport.scrollX;
      ctx.beginPath();
      ctx.moveTo(x, height - 4);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw major ticks and labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const firstMajor = Math.floor(visibleStartMs / major) * major;
    for (let ms = firstMajor; ms <= visibleEndMs; ms += major) {
      const x = ms * viewport.zoom - viewport.scrollX;

      // Tick
      ctx.beginPath();
      ctx.moveTo(x, height - 8);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Label
      const label = formatTime(ms);
      ctx.fillText(label, x, height - 10);
    }

    // Bottom border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();
  }, [viewport, duration, currentTimeMs, height, selectedTimeRange, rangeDrag]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = height * dpr;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [height]);

  // Handle click / drag
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timeMs = xToTime(x);

      canvas.setPointerCapture(e.pointerId);

      if (e.altKey) {
        // Alt+drag: start range selection
        setRangeDrag({ startMs: timeMs, currentMs: timeMs });
        // Clear any existing range
        setSelectedTimeRange(null);
      } else {
        // Normal click/drag: scrub playhead and clear any range
        setCurrentTime(timeMs);
        setSelectedTimeRange(null);
      }
    },
    [xToTime, setCurrentTime, setSelectedTimeRange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.hasPointerCapture(e.pointerId)) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timeMs = xToTime(x);

      if (rangeDrag) {
        // Update range drag
        setRangeDrag((prev) => prev ? { ...prev, currentMs: timeMs } : null);
      } else {
        // Scrub playhead
        setCurrentTime(timeMs);
      }
    },
    [xToTime, rangeDrag, setCurrentTime]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.releasePointerCapture(e.pointerId);

      if (rangeDrag) {
        const startMs = Math.min(rangeDrag.startMs, rangeDrag.currentMs);
        const endMs = Math.max(rangeDrag.startMs, rangeDrag.currentMs);
        // Only commit if the range is at least 100ms (not just a click)
        if (endMs - startMs >= 100) {
          setSelectedTimeRange({ startMs: Math.round(startMs), endMs: Math.round(endMs) });
        }
        setRangeDrag(null);
      }
    },
    [rangeDrag, setSelectedTimeRange]
  );

  return (
    <canvas
      ref={canvasRef}
      className={`w-full cursor-pointer ${className || ''}`}
      style={{ height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}
