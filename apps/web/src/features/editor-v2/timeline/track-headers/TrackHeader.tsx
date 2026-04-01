'use client';

import React, { useState, useRef } from 'react';
import { Film, Volume2, MessageSquare, Type, Image, Lock, Unlock, Eye, EyeOff, ChevronRight, ChevronDown, Sparkles, ArrowDownFromLine, ArrowUpFromLine, User } from 'lucide-react';
import { Track, VideoItemData } from '../../store/types';
import { useTrackActions, useEditorStore } from '../../store/use-editor-store';
import { SegmentationStatus } from '../../components/SegmentationStatus';

interface TrackHeaderProps {
  track: Track;
}

// Map track type to icon
const TRACK_ICONS: Record<string, React.ComponentType<any>> = {
  video: Film,
  audio: Volume2,
  caption: MessageSquare,
  text: Type,
  overlay: Image,
  visual: Sparkles,
};

const TRACK_NAME_ICONS: Record<string, React.ComponentType<any>> = {
  'scene-bg': ArrowDownFromLine,
  'person': User,
  'scene-fg': ArrowUpFromLine,
};

const TRACK_NAME_COLORS: Record<string, string> = {
  'scene-bg': 'text-blue-400',
  'person': 'text-emerald-400',
  'scene-fg': 'text-amber-400',
};

export function TrackHeader({ track }: TrackHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateTrack } = useTrackActions();

  const selectAllOnTrack = () => {
    const { items, itemIds, select } = useEditorStore.getState();
    const trackItemIds = itemIds.filter((id) => items[id]?.trackId === track.id);
    if (trackItemIds.length > 0) {
      select(trackItemIds, 'replace');
    }
  };

  const segmentation = useEditorStore((state) => {
    if (track.type !== 'video') return undefined;
    const videoItem = state.itemIds
      .map(id => state.items[id])
      .find(item => item?.trackId === track.id && item.type === 'video');
    if (!videoItem) return undefined;
    return (videoItem.data as VideoItemData).segmentation;
  });

  const Icon = TRACK_NAME_ICONS[track.name] || TRACK_ICONS[track.type] || Type;
  const nameColor = TRACK_NAME_COLORS[track.name];

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditName(track.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleNameSubmit = () => {
    setIsEditing(false);
    if (editName.trim() && editName !== track.name) {
      updateTrack(track.id, { name: editName.trim() });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameSubmit();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(track.name);
    }
  };

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTrack(track.id, { locked: !track.locked });
  };

  const toggleVisible = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTrack(track.id, { visible: !track.visible });
  };

  const toggleCollapsed = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTrack(track.id, { collapsed: !track.collapsed });
  };

  // Collapsed state — just icon + chevron
  if (track.collapsed) {
    return (
      <div
        className="flex items-center gap-1 px-2 border-b border-[var(--editor-border-subtle)] cursor-pointer
                   hover:bg-[var(--editor-bg-hover)] transition-colors"
        style={{ height: 24 }}
        onClick={toggleCollapsed}
      >
        <ChevronRight size={12} className="text-[var(--editor-text-muted)]" />
        <Icon size={12} className={nameColor || 'text-[var(--editor-text-secondary)]'} />
        <span className={`text-[10px] truncate ${nameColor || 'text-[var(--editor-text-muted)]'}`}>{track.name}</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 border-b border-[var(--editor-border-subtle)]
                 hover:bg-[var(--editor-bg-hover)]/50 transition-colors group cursor-pointer"
      style={{ height: track.height }}
      onClick={selectAllOnTrack}
    >
      {/* Collapse chevron */}
      <button
        onClick={toggleCollapsed}
        className="p-0.5 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-muted)]
                   opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronDown size={12} />
      </button>

      {/* Track type icon */}
      <Icon size={14} className={`${nameColor || 'text-[var(--editor-text-secondary)]'} flex-shrink-0`} />

      {/* Track name */}
      {isEditing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleNameSubmit}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-transparent text-[11px] text-[var(--editor-text-primary)]
                     border border-[var(--editor-accent)] rounded px-1 py-0 outline-none"
        />
      ) : (
        <span
          className={`flex-1 min-w-0 text-[11px] truncate cursor-default ${nameColor || 'text-[var(--editor-text-secondary)]'}`}
          onDoubleClick={handleDoubleClick}
        >
          {track.name}
        </span>
      )}

      {segmentation !== undefined && (
        <SegmentationStatus segmentation={segmentation} className="ml-auto mr-1" />
      )}

      {/* Controls - visible on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={toggleLock}
          className="p-0.5 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-muted)]"
          title={track.locked ? 'Unlock track' : 'Lock track'}
        >
          {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
        <button
          onClick={toggleVisible}
          className="p-0.5 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-muted)]"
          title={track.visible ? 'Hide track' : 'Show track'}
        >
          {track.visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
      </div>
    </div>
  );
}
