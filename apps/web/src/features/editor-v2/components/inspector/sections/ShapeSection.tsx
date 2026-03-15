'use client';

import React, { useCallback } from 'react';
import { NumberInput } from '../../properties/NumberInput';
import { useEditorStore } from '../../../store/use-editor-store';
import type { TimelineItem, ShapeItemData } from '../../../store/types';

interface ShapeSectionProps {
  item: TimelineItem;
}

const SHAPE_OPTIONS = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'line', label: 'Line' },
] as const;

export function ShapeSection({ item }: ShapeSectionProps) {
  const store = useEditorStore();
  const data = item.data as ShapeItemData;

  const updateData = useCallback(
    (updates: Record<string, unknown>) => {
      store.updateItemData(item.id, updates);
    },
    [store, item.id],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Shape type */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Type</span>
        <select
          className="rounded px-2 py-1.5 text-sm"
          style={{
            backgroundColor: 'var(--editor-bg-elevated)',
            border: '1px solid var(--editor-border-default)',
            color: 'var(--editor-text-primary)',
          }}
          value={data.shape}
          onChange={(e) => updateData({ shape: e.target.value })}
        >
          {SHAPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Fill color */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Fill</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={data.fill ?? '#ffffff'}
            onChange={(e) => updateData({ fill: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            style={{ backgroundColor: 'transparent' }}
          />
          <span className="text-xs font-mono text-[var(--editor-text-primary)]">
            {data.fill ?? '#ffffff'}
          </span>
        </div>
      </div>

      {/* Stroke Color */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Stroke</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={data.stroke || '#FFFFFF'}
            onChange={(e) => updateData({ stroke: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            style={{ backgroundColor: 'transparent' }}
          />
          <span className="text-xs font-mono text-[var(--editor-text-primary)]">
            {data.stroke || '#FFFFFF'}
          </span>
        </div>
      </div>

      {/* Stroke Width + Border Radius */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--editor-text-muted)]">Stroke Width</span>
          <NumberInput value={data.strokeWidth || 0} onChange={(v) => updateData({ strokeWidth: v })} min={0} max={20} step={1} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--editor-text-muted)]">Radius</span>
          <NumberInput value={data.borderRadius || 0} onChange={(v) => updateData({ borderRadius: v })} min={0} max={100} step={1} />
        </div>
      </div>
    </div>
  );
}
