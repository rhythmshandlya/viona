/**
 * Timeline Component
 * Two-column layout: track headers (left) + canvas area (right)
 * Linear/Figma inspired
 */

'use client';

import { useRef, useEffect, useCallback } from 'react';
import { TimelineCanvas } from './TimelineCanvas';
import { TimelineRuler } from './TimelineRuler';
import { Playhead } from './Playhead';
import { TrackHeaders } from './track-headers';
import { getAutoScroll } from './interactions/AutoScroll';
import {
  useViewport,
  useCurrentTimeMs,
  useIsPlaying,
  useEditorActions,
} from '../store/use-editor-store';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface TimelineProps {
  className?: string;
}

const RULER_HEIGHT = 24;

export function Timeline({ className }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // State
  const viewport = useViewport();
  const currentTimeMs = useCurrentTimeMs();
  const isPlaying = useIsPlaying();

  // Actions
  const { setZoom, setScrollX, setScrollY, zoomToFit } = useEditorActions();

  // AutoScroll: keep playhead visible during playback
  useEffect(() => {
    if (!isPlaying) return;
    const autoScroll = getAutoScroll();
    const canvasWidth = scrollContainerRef.current?.getBoundingClientRect().width || 0;
    autoScroll.update(currentTimeMs, isPlaying, viewport, canvasWidth, setScrollX);
  }, [currentTimeMs, isPlaying, viewport, setScrollX]);

  // Handle horizontal scroll
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = viewport.zoom * zoomFactor;
        setZoom(newZoom);
      } else if (e.shiftKey) {
        // Vertical scroll
        setScrollY(viewport.scrollY + e.deltaY);
      } else {
        // Horizontal scroll
        setScrollX(viewport.scrollX + e.deltaX + e.deltaY);
      }
    },
    [viewport, setZoom, setScrollX, setScrollY]
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(viewport.zoom * 1.2);
  }, [viewport.zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(viewport.zoom / 1.2);
  }, [viewport.zoom, setZoom]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-row bg-[var(--editor-bg-surface)] ${className || ''}`}
    >
      {/* Track headers - fixed width left column */}
      <TrackHeaders rulerHeight={RULER_HEIGHT} />

      {/* Canvas area - flexible right column */}
      <div ref={scrollContainerRef} className="flex-1 relative overflow-hidden">
        {/* Ruler */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <TimelineRuler height={RULER_HEIGHT} />
        </div>

        {/* Tracks area */}
        <div
          className="absolute left-0 right-0 overflow-hidden"
          style={{
            top: RULER_HEIGHT,
            bottom: 0,
          }}
        >
          <TimelineCanvas />
        </div>

        {/* Playhead overlay */}
        <Playhead rulerHeight={RULER_HEIGHT} />

        {/* Zoom controls - floating bottom right */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-[var(--editor-bg-elevated)]/90
                        backdrop-blur-sm rounded-md border border-[var(--editor-border-subtle)] p-0.5">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-secondary)]
                       hover:text-[var(--editor-text-primary)] transition-colors"
            title="Zoom out (⌘-)"
          >
            <ZoomOut size={14} />
          </button>

          <span className="text-[10px] text-[var(--editor-text-muted)] w-10 text-center font-mono">
            {Math.round(viewport.zoom * 1000)}%
          </span>

          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-secondary)]
                       hover:text-[var(--editor-text-primary)] transition-colors"
            title="Zoom in (⌘+)"
          >
            <ZoomIn size={14} />
          </button>

          <div className="w-px h-4 bg-[var(--editor-border-subtle)]" />

          <button
            onClick={zoomToFit}
            className="p-1.5 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-secondary)]
                       hover:text-[var(--editor-text-primary)] transition-colors"
            title="Fit to view"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
