'use client';

import React, { useCallback } from 'react';
import { NumberInput } from './NumberInput';
import { useEditorStore } from '../../store/use-editor-store';
import type {
  TimelineItem,
  VideoItemData,
  AudioItemData,
  TextItemData,
  ImageItemData,
  ShapeItemData,
} from '../../store/types';

interface DataTabProps {
  item: TimelineItem;
}

export const DataTab: React.FC<DataTabProps> = ({ item }) => {
  const store = useEditorStore();

  const updateData = useCallback(
    (updates: Record<string, unknown>) => {
      store.updateItemData(item.id, updates);
    },
    [store, item.id],
  );

  switch (item.type) {
    case 'video':
      return <VideoProperties item={item} onUpdate={updateData} />;
    case 'audio':
      return <AudioProperties item={item} onUpdate={updateData} />;
    case 'text':
      return <TextProperties item={item} onUpdate={updateData} />;
    case 'image':
      return <ImageProperties item={item} onUpdate={updateData} />;
    case 'shape':
      return <ShapeProperties item={item} onUpdate={updateData} />;
    case 'caption':
      return (
        <div className="p-3">
          <p
            className="text-xs italic"
            style={{ color: 'var(--editor-text-muted)' }}
          >
            Caption styles are edited in the Caption Style panel.
          </p>
        </div>
      );
    default:
      return (
        <div className="p-3">
          <p
            className="text-xs"
            style={{ color: 'var(--editor-text-muted)' }}
          >
            No editable properties for this item type.
          </p>
        </div>
      );
  }
};

/* -------------------------------------------------- */
/* Type-specific sub-components                        */
/* -------------------------------------------------- */

interface SubProps {
  item: TimelineItem;
  onUpdate: (updates: Record<string, unknown>) => void;
}

function VideoProperties({ item, onUpdate }: SubProps) {
  const data = item.data as VideoItemData;
  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Volume */}
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>
          Volume
        </span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={Math.round((data.volume ?? 1) * 100)}
            onChange={(e) => onUpdate({ volume: parseInt(e.target.value) / 100 })}
            className="flex-1 h-1 rounded appearance-none cursor-pointer"
            style={{
              accentColor: 'var(--editor-accent)',
              backgroundColor: 'var(--editor-border-default)',
            }}
          />
          <NumberInput
            value={Math.round((data.volume ?? 1) * 100)}
            onChange={(v) => onUpdate({ volume: v / 100 })}
            min={0}
            max={200}
            unit="%"
            className="w-20 shrink-0"
          />
        </div>
      </div>

      {/* Playback Rate */}
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>
          Playback Rate
        </span>
        <NumberInput
          value={data.playbackRate ?? 1}
          onChange={(v) => onUpdate({ playbackRate: v })}
          min={0.25}
          max={4}
          step={0.25}
          unit="x"
        />
      </div>
    </div>
  );
}

function AudioProperties({ item, onUpdate }: SubProps) {
  const data = item.data as AudioItemData;
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>
          Volume
        </span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={Math.round((data.volume ?? 1) * 100)}
            onChange={(e) => onUpdate({ volume: parseInt(e.target.value) / 100 })}
            className="flex-1 h-1 rounded appearance-none cursor-pointer"
            style={{
              accentColor: 'var(--editor-accent)',
              backgroundColor: 'var(--editor-border-default)',
            }}
          />
          <NumberInput
            value={Math.round((data.volume ?? 1) * 100)}
            onChange={(v) => onUpdate({ volume: v / 100 })}
            min={0}
            max={200}
            unit="%"
            className="w-20 shrink-0"
          />
        </div>
      </div>
    </div>
  );
}

function TextProperties({ item, onUpdate }: SubProps) {
  const data = item.data as TextItemData;
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>
          Text Content
        </span>
        <textarea
          className="w-full rounded px-2 py-1.5 text-sm resize-y min-h-[80px]"
          style={{
            backgroundColor: 'var(--editor-bg-elevated)',
            border: '1px solid var(--editor-border-default)',
            color: 'var(--editor-text-primary)',
          }}
          value={data.text ?? ''}
          onChange={(e) => onUpdate({ text: e.target.value })}
        />
      </div>
    </div>
  );
}

function ImageProperties({ item, onUpdate }: SubProps) {
  const data = item.data as ImageItemData;
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>
          Opacity
        </span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round((data.opacity ?? 1) * 100)}
            onChange={(e) => onUpdate({ opacity: parseInt(e.target.value) / 100 })}
            className="flex-1 h-1 rounded appearance-none cursor-pointer"
            style={{
              accentColor: 'var(--editor-accent)',
              backgroundColor: 'var(--editor-border-default)',
            }}
          />
          <NumberInput
            value={Math.round((data.opacity ?? 1) * 100)}
            onChange={(v) => onUpdate({ opacity: v / 100 })}
            min={0}
            max={100}
            unit="%"
            className="w-20 shrink-0"
          />
        </div>
      </div>
    </div>
  );
}

const SHAPE_OPTIONS = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'line', label: 'Line' },
] as const;

function ShapeProperties({ item, onUpdate }: SubProps) {
  const data = item.data as ShapeItemData;
  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Shape type */}
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>
          Shape
        </span>
        <select
          className="rounded px-2 py-1.5 text-sm"
          style={{
            backgroundColor: 'var(--editor-bg-elevated)',
            border: '1px solid var(--editor-border-default)',
            color: 'var(--editor-text-primary)',
          }}
          value={data.shape}
          onChange={(e) => onUpdate({ shape: e.target.value })}
        >
          {SHAPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Fill color */}
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>
          Fill Color
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={data.fill ?? '#ffffff'}
            onChange={(e) => onUpdate({ fill: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            style={{ backgroundColor: 'transparent' }}
          />
          <span
            className="text-xs font-mono"
            style={{ color: 'var(--editor-text-primary)' }}
          >
            {data.fill ?? '#ffffff'}
          </span>
        </div>
      </div>
    </div>
  );
}
