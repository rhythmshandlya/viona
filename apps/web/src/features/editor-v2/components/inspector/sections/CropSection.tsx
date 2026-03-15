'use client';

import React, { useCallback } from 'react';
import { NumberInput } from '../../properties/NumberInput';
import { useEditorStore } from '../../../store/use-editor-store';
import type { TimelineItem } from '../../../store/types';

interface CropSectionProps {
  item: TimelineItem;
}

export function CropSection({ item }: CropSectionProps) {
  const store = useEditorStore();
  const data = item.data as any;
  const crop = data.crop || { x: 50, y: 50, scale: 1 };

  const updateData = useCallback(
    (updates: Record<string, unknown>) => {
      store.updateItemData(item.id, updates);
    },
    [store, item.id],
  );

  const updateCrop = useCallback(
    (updates: Partial<{ x: number; y: number; scale: number }>) => {
      updateData({ crop: { ...crop, ...updates } });
    },
    [updateData, crop],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--editor-text-muted)]">Pan X</span>
          <NumberInput
            value={crop.x}
            onChange={(v) => updateCrop({ x: v })}
            min={0}
            max={100}
            step={1}
            unit="%"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--editor-text-muted)]">Pan Y</span>
          <NumberInput
            value={crop.y}
            onChange={(v) => updateCrop({ y: v })}
            min={0}
            max={100}
            step={1}
            unit="%"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Zoom</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={50}
            max={300}
            step={10}
            value={Math.round(crop.scale * 100)}
            onChange={(e) => updateCrop({ scale: parseInt(e.target.value) / 100 })}
            className="flex-1 h-1 rounded appearance-none cursor-pointer"
            style={{ accentColor: 'var(--editor-accent)', backgroundColor: 'var(--editor-border-default)' }}
          />
          <NumberInput
            value={Math.round(crop.scale * 100)}
            onChange={(v) => updateCrop({ scale: v / 100 })}
            min={50}
            max={300}
            step={10}
            unit="%"
            className="w-20 shrink-0"
          />
        </div>
      </div>

      {(crop.x !== 50 || crop.y !== 50 || crop.scale !== 1) && (
        <button
          className="text-xs px-2 py-1 rounded self-end transition-colors"
          style={{ color: 'var(--editor-accent)', backgroundColor: 'var(--editor-accent-soft)' }}
          onClick={() => updateData({ crop: { x: 50, y: 50, scale: 1 } })}
        >
          Reset
        </button>
      )}
    </div>
  );
}
