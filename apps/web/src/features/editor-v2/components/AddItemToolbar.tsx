'use client';

import React, { useRef } from 'react';
import { Type, ImageIcon, Music, Film, Square } from 'lucide-react';
import { useEditorStore, useTimelineActions, useTrackActions } from '../store/use-editor-store';
import { api } from '@/lib/api';
import { findOrCreateTrack } from '../utils/track-utils';
import type { TimelineItem, TextItemData, TextStyle, ShapeItemData } from '../store/types';

export function AddItemToolbar() {
  const timelineActions = useTimelineActions();
  const trackActions = useTrackActions();
  const actions = { ...timelineActions, ...trackActions };
  const projectId = useEditorStore((s) => s.project?.id);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleAddText = () => {
    const state = useEditorStore.getState();
    const trackId = findOrCreateTrack(state.tracks, 'overlay', actions.addTrack);
    const startMs = state.currentTimeMs;
    const id = crypto.randomUUID();
    const data: TextItemData = {
      text: 'Your text here',
      style: {
        fontFamily: 'Inter',
        fontSize: 48,
        fontWeight: 600,
        color: '#FFFFFF',
        textAlign: 'center',
      } as TextStyle,
      position: { x: 0, y: 0 },
      size: { width: 800, height: 200 },
    };
    const item: TimelineItem = {
      id,
      type: 'text',
      trackId,
      startMs,
      endMs: startMs + 3000,
      data,
      transform: { x: '10%', y: '40%', width: '80%', height: '20%', rotation: 0, opacity: 1 },
    };
    actions.addItem(trackId, item);
    actions.select([id]);
  };

  const handleMediaUpload = async (
    file: File,
    itemType: 'image' | 'audio' | 'video',
    trackType: string,
  ) => {
    if (!projectId) return;
    try {
      const asset = await api.uploadProjectMedia(projectId, file);
      const state = useEditorStore.getState();
      const trackId = findOrCreateTrack(state.tracks, trackType, actions.addTrack);
      const startMs = state.currentTimeMs;
      const id = crypto.randomUUID();
      const durationMs = itemType === 'image' ? 5000 : 10000;

      const baseItem: Partial<TimelineItem> = {
        id,
        type: itemType,
        trackId,
        startMs,
        endMs: startMs + durationMs,
      };

      if (itemType === 'image') {
        baseItem.data = { src: asset.url } as any;
        baseItem.transform = { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 };
      } else if (itemType === 'audio') {
        baseItem.data = { src: asset.url, volume: 1 } as any;
      } else if (itemType === 'video') {
        baseItem.data = { src: asset.url, width: 1920, height: 1080, volume: 1, playbackRate: 1, startFrom: 0 } as any;
        baseItem.transform = { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 };
      }

      actions.addItem(trackId, baseItem as TimelineItem);
      actions.select([id]);
    } catch (err) {
      console.error(`Failed to upload ${itemType}:`, err);
    }
  };

  const handleAddShape = () => {
    const state = useEditorStore.getState();
    const trackId = findOrCreateTrack(state.tracks, 'overlay', actions.addTrack);
    const startMs = state.currentTimeMs;
    const id = crypto.randomUUID();
    const data: ShapeItemData = {
      shape: 'rectangle',
      fill: '#3B82F6',
      borderRadius: 8,
    };
    const item: TimelineItem = {
      id,
      type: 'shape',
      trackId,
      startMs,
      endMs: startMs + 3000,
      data,
      transform: { x: '25%', y: '25%', width: '50%', height: '50%', rotation: 0, opacity: 1 },
    };
    actions.addItem(trackId, item);
    actions.select([id]);
  };

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--editor-border-subtle)] flex-shrink-0">
      <ToolbarButton icon={<Type size={13} />} label="Text" onClick={handleAddText} />
      <ToolbarButton icon={<ImageIcon size={13} />} label="Image" onClick={() => imageInputRef.current?.click()} />
      <ToolbarButton icon={<Music size={13} />} label="Audio" onClick={() => audioInputRef.current?.click()} />
      <ToolbarButton icon={<Film size={13} />} label="Video" onClick={() => videoInputRef.current?.click()} />
      <ToolbarButton icon={<Square size={13} />} label="Shape" onClick={handleAddShape} />

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleMediaUpload(file, 'image', 'overlay');
          e.target.value = '';
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleMediaUpload(file, 'audio', 'audio');
          e.target.value = '';
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleMediaUpload(file, 'video', 'video');
          e.target.value = '';
        }}
      />
    </div>
  );
}

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-normal rounded-lg
        bg-white/[0.04] border border-white/[0.08] text-[var(--editor-text-secondary)]
        hover:bg-white/[0.08] hover:text-[var(--editor-text-primary)] hover:border-white/[0.14]
        active:scale-[0.97] transition-all"
    >
      {icon}
      {label}
    </button>
  );
}
