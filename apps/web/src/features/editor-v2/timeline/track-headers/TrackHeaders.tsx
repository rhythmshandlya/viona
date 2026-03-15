'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTracks, useViewport, useTrackActions } from '../../store/use-editor-store';
import { TrackHeader } from './TrackHeader';
import type { Track } from '../../store/types';

interface TrackHeadersProps {
  rulerHeight?: number;
  className?: string;
}

export function TrackHeaders({ rulerHeight = 24, className }: TrackHeadersProps) {
  const tracks = useTracks();
  const viewport = useViewport();
  const actions = useTrackActions();
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
      className={`flex flex-col border-r border-white/[0.04] ${className || ''}`}
      style={{ width: 280 }}
    >
      {/* Header row aligned with ruler */}
      <div
        className="flex items-center px-3 border-b border-white/[0.06]
                   text-[10px] text-[var(--editor-text-muted)] uppercase tracking-wider font-medium"
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
      <div className="relative border-t border-white/[0.04] p-1">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="flex items-center gap-1 w-full px-2 py-1.5 text-[11px]
                     text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)]
                     hover:bg-white/[0.06] rounded-lg transition-colors"
          title="Add track"
        >
          <Plus className="w-3 h-3" /> Add Track
        </button>
        {showAddMenu && (
          <div className="absolute bottom-full left-1 right-1 mb-1
                          bg-[rgba(28,28,35,0.9)] backdrop-blur-xl border border-white/[0.08]
                          rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 overflow-hidden p-1">
            {['overlay', 'audio', 'video'].map((type) => (
              <button
                key={type}
                onClick={() => handleAddTrack(type)}
                className="block w-full px-3 py-1.5 text-left text-[11px]
                           text-[var(--editor-text-primary)] hover:bg-white/[0.06]
                           rounded-lg transition-colors"
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
