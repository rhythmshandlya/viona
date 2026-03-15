'use client';

import React, { useCallback } from 'react';
import { NumberInput } from '../../properties/NumberInput';
import { useEditorStore } from '../../../store/use-editor-store';
import type { TimelineItem } from '../../../store/types';

interface EffectsSectionProps {
  item: TimelineItem;
}

export function EffectsSection({ item }: EffectsSectionProps) {
  const store = useEditorStore();
  const data = item.data as any;
  const style = data.style || {};

  const updateStyle = useCallback(
    (updates: Record<string, unknown>) => {
      store.updateItemData(item.id, { style: { ...style, ...updates } });
    },
    [store, item.id, style],
  );

  const shadow = style.textShadow || '';
  const strokeWidth = style.WebkitTextStrokeWidth || style.textStrokeWidth || 0;
  const strokeColor = style.WebkitTextStrokeColor || style.textStrokeColor || '#000000';

  return (
    <div className="flex flex-col gap-3">
      {/* Text Shadow */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--editor-text-muted)]">Shadow</span>
          <button
            className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
            style={{
              backgroundColor: shadow ? 'var(--editor-accent-soft)' : 'var(--editor-bg-elevated)',
              color: shadow ? 'var(--editor-accent)' : 'var(--editor-text-muted)',
            }}
            onClick={() => {
              updateStyle({
                textShadow: shadow ? '' : '2px 2px 4px rgba(0,0,0,0.8)',
              });
            }}
          >
            {shadow ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Text Stroke */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Stroke</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
            style={{ backgroundColor: 'transparent' }}
            value={strokeColor}
            onChange={(e) =>
              updateStyle({
                WebkitTextStrokeColor: e.target.value,
                textStrokeColor: e.target.value,
              })
            }
          />
          <NumberInput
            value={typeof strokeWidth === 'number' ? strokeWidth : parseFloat(strokeWidth) || 0}
            onChange={(v) =>
              updateStyle({
                WebkitTextStrokeWidth: v,
                textStrokeWidth: v,
              })
            }
            min={0}
            max={10}
            step={0.5}
            unit="px"
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
