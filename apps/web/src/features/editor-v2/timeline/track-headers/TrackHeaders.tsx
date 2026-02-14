'use client';

import React from 'react';
import { Maximize2 } from 'lucide-react';
import { useTracks, useViewport, useFullscreenSegments } from '../../store/use-editor-store';
import { TrackHeader } from './TrackHeader';

const FULLSCREEN_LANE_HEIGHT = 28;

interface TrackHeadersProps {
  rulerHeight?: number;
  className?: string;
}

export function TrackHeaders({ rulerHeight = 24, className }: TrackHeadersProps) {
  const tracks = useTracks();
  const viewport = useViewport();
  const fullscreenSegments = useFullscreenSegments();

  return (
    <div
      className={`flex flex-col border-r border-[var(--editor-border-subtle)] bg-[var(--editor-bg-surface)] ${className || ''}`}
      style={{ width: 140 }}
    >
      {/* Header row aligned with ruler */}
      <div
        className="flex items-center px-2 border-b border-[var(--editor-border-subtle)]
                   text-[10px] text-[var(--editor-text-muted)] uppercase tracking-wider"
        style={{ height: rulerHeight }}
      >
        Tracks
      </div>

      {/* Track headers - scroll vertically in sync with canvas */}
      <div className="flex-1 overflow-hidden">
        <div
          style={{
            transform: `translateY(${-viewport.scrollY}px)`,
          }}
        >
          {tracks.map((track) => (
            <TrackHeader key={track.id} track={track} />
          ))}

          {/* Fullscreen segments lane header */}
          <div
            className="flex items-center gap-1.5 px-2 border-b border-[var(--editor-border-subtle)]
                       text-[var(--editor-text-muted)]"
            style={{ height: FULLSCREEN_LANE_HEIGHT }}
          >
            <Maximize2 size={12} className="text-cyan-500 flex-shrink-0" />
            <span className="text-[11px] truncate">Fullscreen</span>
          </div>
        </div>
      </div>
    </div>
  );
}
