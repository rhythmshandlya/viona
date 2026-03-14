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
    const id = `item-text-${Date.now()}`;
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
      const id = `item-${itemType}-${Date.now()}`;
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
    const id = `item-shape-${Date.now()}`;
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

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid var(--editor-border-subtle, #333)',
    borderRadius: 6,
    background: 'var(--editor-bg-secondary, #1a1a1a)',
    color: 'var(--editor-text-secondary, #999)',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '4px 12px',
        borderBottom: '1px solid var(--editor-border-subtle, #2a2a2a)',
        background: 'var(--editor-bg-primary, #111)',
      }}
    >
      <button style={buttonStyle} onClick={handleAddText} title="Add text overlay">
        <Type size={14} /> Text
      </button>
      <button
        style={buttonStyle}
        onClick={() => imageInputRef.current?.click()}
        title="Add image overlay"
      >
        <ImageIcon size={14} /> Image
      </button>
      <button
        style={buttonStyle}
        onClick={() => audioInputRef.current?.click()}
        title="Add background audio"
      >
        <Music size={14} /> Audio
      </button>
      <button
        style={buttonStyle}
        onClick={() => videoInputRef.current?.click()}
        title="Add video clip"
      >
        <Film size={14} /> Video
      </button>
      <button style={buttonStyle} onClick={handleAddShape} title="Add shape">
        <Square size={14} /> Shape
      </button>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
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
        style={{ display: 'none' }}
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
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleMediaUpload(file, 'video', 'video');
          e.target.value = '';
        }}
      />
    </div>
  );
}
