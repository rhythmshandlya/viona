/**
 * Timeline Ruler Component
 * Minimal ruler with time markers
 */

'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import {
  useViewport,
  useDuration,
  useCurrentTimeMs,
  useEditorActions,
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
  const targetPixelInterval = 100;
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
  const { setCurrentTime } = useEditorActions();

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

    // Clear with editor surface color
    ctx.fillStyle = '#111111'; // --editor-bg-surface
    ctx.fillRect(0, 0, width, height);

    // Calculate visible time range
    const visibleStartMs = viewport.scrollX / viewport.zoom;
    const visibleEndMs = (viewport.scrollX + width) / viewport.zoom;

    // Get tick intervals
    const { major, minor } = getTickInterval(viewport.zoom);

    // Draw minor ticks
    ctx.strokeStyle = '#1F1F1F'; // --editor-border-subtle
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
    ctx.strokeStyle = '#2A2A2A'; // --editor-border-default
    ctx.fillStyle = '#525252'; // --editor-text-muted
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
    ctx.strokeStyle = '#1F1F1F'; // --editor-border-subtle
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();
  }, [viewport, duration, currentTimeMs, height]);

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

  // Handle click to seek
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timeMs = (x + viewport.scrollX) / viewport.zoom;

      setCurrentTime(Math.max(0, Math.min(timeMs, duration)));
      canvas.setPointerCapture(e.pointerId);
    },
    [viewport, duration, setCurrentTime]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.hasPointerCapture(e.pointerId)) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timeMs = (x + viewport.scrollX) / viewport.zoom;

      setCurrentTime(Math.max(0, Math.min(timeMs, duration)));
    },
    [viewport, duration, setCurrentTime]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.releasePointerCapture(e.pointerId);
    },
    []
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
