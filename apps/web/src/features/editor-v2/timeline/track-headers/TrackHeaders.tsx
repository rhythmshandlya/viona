'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTracks, useViewport, useEditorActions } from '../../store/use-editor-store';
import { TrackHeader } from './TrackHeader';
import type { Track } from '../../store/types';

interface TrackHeadersProps {
  rulerHeight?: number;
  className?: string;
}

export function TrackHeaders({ rulerHeight = 24, className }: TrackHeadersProps) {
  const tracks = useTracks();
  const viewport = useViewport();
  const actions = useEditorActions();
  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleAddTrack = (type: string) => {
    const count = tracks.filter((t) => t.type === type).length;
    const names: Record<string, string> = { video: 'Video', audio: 'Audio', overlay: 'Overlay' };
    actions.addTrack({
      type: type as Track['type'],
      name: `${names[type] || type} ${count + 1}`,
      position: tracks.length,
      height: 60,
      locked: false,
      visible: true,
      collapsed: false,
    });
    setShowAddMenu(false);
  };

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
        </div>
      </div>

      {/* Add Track button */}
      <div className="relative border-t border-[var(--editor-border-subtle)] p-1">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="flex items-center gap-1 w-full px-2 py-1 text-[11px]
                     text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)]
                     hover:bg-[var(--editor-bg-hover)] rounded transition-colors"
          title="Add track"
        >
          <Plus className="w-3 h-3" /> Add Track
        </button>
        {showAddMenu && (
          <div className="absolute bottom-full left-0 mb-1 w-full
                          bg-[var(--editor-bg-secondary,#1a1a1a)] border border-[var(--editor-border-subtle)]
                          rounded-md shadow-lg z-50 overflow-hidden">
            {['overlay', 'audio', 'video'].map((type) => (
              <button
                key={type}
                onClick={() => handleAddTrack(type)}
                className="block w-full px-3 py-1.5 text-left text-[11px]
                           text-[var(--editor-text-primary)] hover:bg-[var(--editor-bg-hover)]
                           transition-colors"
              >
                {type.charAt(0).toUpperCase() + type.slice(1)} Track
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
