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

      {/* Start From */}
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Start From (ms)</span>
        <NumberInput
          value={data.startFrom || 0}
          onChange={(v) => onUpdate({ startFrom: v })}
          min={0} step={100}
        />
      </div>

      {/* Fade In/Out */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Fade In (ms)</span>
          <NumberInput value={(data as any).fadeInMs || 0} onChange={(v) => onUpdate({ fadeInMs: v })} min={0} max={5000} step={100} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Fade Out (ms)</span>
          <NumberInput value={(data as any).fadeOutMs || 0} onChange={(v) => onUpdate({ fadeOutMs: v })} min={0} max={5000} step={100} />
        </div>
      </div>

      {/* Crop */}
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Crop</span>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px]" style={{ color: 'var(--editor-text-muted)' }}>X</span>
            <NumberInput value={(data as any).crop?.x ?? 50} onChange={(v) => onUpdate({ crop: { ...((data as any).crop || { x: 50, y: 50, scale: 1 }), x: v } })} min={0} max={100} step={1} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px]" style={{ color: 'var(--editor-text-muted)' }}>Y</span>
            <NumberInput value={(data as any).crop?.y ?? 50} onChange={(v) => onUpdate({ crop: { ...((data as any).crop || { x: 50, y: 50, scale: 1 }), y: v } })} min={0} max={100} step={1} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px]" style={{ color: 'var(--editor-text-muted)' }}>Scale</span>
            <NumberInput value={(data as any).crop?.scale ?? 1} onChange={(v) => onUpdate({ crop: { ...((data as any).crop || { x: 50, y: 50, scale: 1 }), scale: v } })} min={0.5} max={3} step={0.1} />
          </div>
        </div>
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

      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>
          Playback Rate
        </span>
        <NumberInput
          value={(data as any).playbackRate ?? 1}
          onChange={(v) => onUpdate({ playbackRate: v })}
          min={0.25}
          max={4}
          step={0.25}
          unit="x"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Fade In (ms)</span>
          <NumberInput value={(data as any).fadeInMs || 0} onChange={(v) => onUpdate({ fadeInMs: v })} min={0} max={5000} step={100} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Fade Out (ms)</span>
          <NumberInput value={(data as any).fadeOutMs || 0} onChange={(v) => onUpdate({ fadeOutMs: v })} min={0} max={5000} step={100} />
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

      {/* Font Family */}
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Font Family</span>
        <input
          type="text"
          className="w-full rounded px-2 py-1.5 text-sm"
          style={{
            backgroundColor: 'var(--editor-bg-elevated)',
            border: '1px solid var(--editor-border-default)',
            color: 'var(--editor-text-primary)',
          }}
          value={(data as any).style?.fontFamily || 'Inter'}
          onChange={(e) => onUpdate({ style: { ...((data as any).style || {}), fontFamily: e.target.value } })}
        />
      </div>

      {/* Font Size + Weight */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Font Size</span>
          <NumberInput
            value={(data as any).style?.fontSize || 48}
            onChange={(v) => onUpdate({ style: { ...((data as any).style || {}), fontSize: v } })}
            min={8} max={200} step={1}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Weight</span>
          <NumberInput
            value={(data as any).style?.fontWeight || 600}
            onChange={(v) => onUpdate({ style: { ...((data as any).style || {}), fontWeight: v } })}
            min={100} max={900} step={100}
          />
        </div>
      </div>

      {/* Color + Background */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Color</span>
          <input
            type="color"
            className="w-full h-8 rounded cursor-pointer border-0 p-0"
            style={{ backgroundColor: 'transparent' }}
            value={(data as any).style?.color || '#FFFFFF'}
            onChange={(e) => onUpdate({ style: { ...((data as any).style || {}), color: e.target.value } })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Background</span>
          <input
            type="color"
            className="w-full h-8 rounded cursor-pointer border-0 p-0"
            style={{ backgroundColor: 'transparent' }}
            value={(data as any).style?.backgroundColor || '#000000'}
            onChange={(e) => onUpdate({ style: { ...((data as any).style || {}), backgroundColor: e.target.value } })}
          />
        </div>
      </div>

      {/* Text Align */}
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Align</span>
        <div className="flex gap-1">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              className="flex-1 py-1 text-xs rounded"
              style={{
                backgroundColor: ((data as any).style?.textAlign || 'center') === align ? 'var(--editor-accent)' : 'var(--editor-bg-elevated)',
                color: ((data as any).style?.textAlign || 'center') === align ? '#FFFFFF' : 'var(--editor-text-muted)',
              }}
              onClick={() => onUpdate({ style: { ...((data as any).style || {}), textAlign: align } })}
            >
              {align}
            </button>
          ))}
        </div>
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

      {/* Stroke Color */}
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>
          Stroke
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={data.stroke || '#FFFFFF'}
            onChange={(e) => onUpdate({ stroke: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            style={{ backgroundColor: 'transparent' }}
          />
          <span
            className="text-xs font-mono"
            style={{ color: 'var(--editor-text-primary)' }}
          >
            {data.stroke || '#FFFFFF'}
          </span>
        </div>
      </div>

      {/* Stroke Width + Border Radius */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Stroke Width</span>
          <NumberInput value={data.strokeWidth || 0} onChange={(v) => onUpdate({ strokeWidth: v })} min={0} max={20} step={1} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--editor-text-muted)' }}>Border Radius</span>
          <NumberInput value={data.borderRadius || 0} onChange={(v) => onUpdate({ borderRadius: v })} min={0} max={100} step={1} />
        </div>
      </div>
    </div>
  );
}
