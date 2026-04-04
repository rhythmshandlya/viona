/**
 * Timeline Component
 * Two-column layout: track headers (left) + canvas area (right)
 * Linear/Figma inspired
 */

'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { TimelineCanvas } from './TimelineCanvas';
import { TimelineRuler } from './TimelineRuler';
import { Playhead } from './Playhead';
import { TrackHeaders } from './track-headers';
import { getAutoScroll } from './interactions/AutoScroll';
import {
  useEditorStore,
  useViewport,
  useIsPlaying,
  useViewportActions,
} from '../store/use-editor-store';
import { ZoomIn, ZoomOut, Maximize2, Magnet } from 'lucide-react';
import { getSnapEngine } from './interactions/SnapEngine';

interface TimelineProps {
  className?: string;
}

const RULER_HEIGHT = 24;

export function Timeline({ className }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // State
  const viewport = useViewport();
  const isPlaying = useIsPlaying();

  // Actions
  const { setZoom, setScrollX, setScrollY, zoomToFit } = useViewportActions();

  // Snap settings
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showSnapSettings, setShowSnapSettings] = useState(false);
  const [snapToPlayhead, setSnapToPlayhead] = useState(true);
  const [snapToItems, setSnapToItems] = useState(true);
  const snapSettingsRef = useRef<HTMLDivElement>(null);

  // Sync snap settings to engine
  useEffect(() => {
    const engine = getSnapEngine();
    engine.setOptions({
      threshold: snapEnabled ? 10 : 0,
      snapToPlayhead: snapEnabled && snapToPlayhead,
      snapToItems: snapEnabled && snapToItems,
    });
  }, [snapEnabled, snapToPlayhead, snapToItems]);

  // Close snap popover on outside click
  useEffect(() => {
    if (!showSnapSettings) return;
    const handleClick = (e: MouseEvent) => {
      if (snapSettingsRef.current && !snapSettingsRef.current.contains(e.target as Node)) {
        setShowSnapSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSnapSettings]);

  // AutoScroll: keep playhead visible during playback.
  // Uses subscribe + throttle so this runs at most every 200ms instead of every 33ms frame.
  useEffect(() => {
    if (!isPlaying) return;
    let lastScrollTime = 0;
    const autoScroll = getAutoScroll();
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (!state.isPlaying) return;
      const now = Date.now();
      if (now - lastScrollTime < 200) return;
      lastScrollTime = now;
      const canvasWidth = scrollContainerRef.current?.getBoundingClientRect().width || 0;
      autoScroll.update(state.currentTimeMs, state.isPlaying, state.viewport, canvasWidth, setScrollX);
    });
    return unsubscribe;
  }, [isPlaying, setScrollX]);

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
      className={`flex flex-row bg-[var(--editor-bg-surface)] select-none ${className || ''}`}
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

        {/* Zoom + snap controls - floating bottom right */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-[var(--editor-bg-elevated)]/90
                        backdrop-blur-sm rounded-md border border-[var(--editor-border-subtle)] p-0.5">
          {/* Snap toggle */}
          <div className="relative" ref={snapSettingsRef}>
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              onContextMenu={(e) => { e.preventDefault(); setShowSnapSettings(!showSnapSettings); }}
              className={`p-1.5 rounded transition-all active:scale-[0.97] ${
                snapEnabled
                  ? 'bg-[var(--editor-accent)]/20 text-[var(--editor-accent)] hover:bg-[var(--editor-accent)]/30'
                  : 'text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)]'
              }`}
              title={`Snapping ${snapEnabled ? 'on' : 'off'} (right-click for options)`}
            >
              <Magnet size={14} />
            </button>

            {/* Snap settings popover */}
            {showSnapSettings && (
              <div className="absolute bottom-full right-0 mb-1 w-44 bg-[var(--editor-bg-elevated)] border border-[var(--editor-border-subtle)]
                              rounded-lg shadow-xl p-2 space-y-1.5 z-50">
                <div className="text-[10px] font-normal text-[var(--editor-text-muted)] uppercase tracking-wider px-1 pb-0.5">
                  Snap To
                </div>
                <label className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[var(--editor-bg-hover)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={snapToPlayhead}
                    onChange={(e) => setSnapToPlayhead(e.target.checked)}
                    className="w-3 h-3 rounded accent-[var(--editor-accent)]"
                  />
                  <span className="text-xs text-[var(--editor-text-secondary)]">Playhead</span>
                </label>
                <label className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[var(--editor-bg-hover)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={snapToItems}
                    onChange={(e) => setSnapToItems(e.target.checked)}
                    className="w-3 h-3 rounded accent-[var(--editor-accent)]"
                  />
                  <span className="text-xs text-[var(--editor-text-secondary)]">Item edges</span>
                </label>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-[var(--editor-border-subtle)]" />

          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-secondary)]
                       hover:text-[var(--editor-text-primary)] active:scale-[0.97] transition-all"
            title="Zoom out (⌘-)"
          >
            <ZoomOut size={14} />
          </button>

          <span className="text-[10px] text-[var(--editor-text-muted)] w-10 text-center font-mono tabular-nums">
            {Math.round(viewport.zoom * 1000)}%
          </span>

          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-secondary)]
                       hover:text-[var(--editor-text-primary)] active:scale-[0.97] transition-all"
            title="Zoom in (⌘+)"
          >
            <ZoomIn size={14} />
          </button>

          <div className="w-px h-4 bg-[var(--editor-border-subtle)]" />

          <button
            onClick={zoomToFit}
            className="p-1.5 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-secondary)]
                       hover:text-[var(--editor-text-primary)] active:scale-[0.97] transition-all"
            title="Fit to view"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
