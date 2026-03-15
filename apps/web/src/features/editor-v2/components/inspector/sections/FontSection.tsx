'use client';

import React, { useCallback } from 'react';
import { NumberInput } from '../../properties/NumberInput';
import { useEditorStore } from '../../../store/use-editor-store';
import type { TimelineItem, TextItemData } from '../../../store/types';

interface FontSectionProps {
  item: TimelineItem;
}

export function FontSection({ item }: FontSectionProps) {
  const store = useEditorStore();
  const data = item.data as TextItemData;
  const style = (data as any).style || {};

  const updateStyle = useCallback(
    (updates: Record<string, unknown>) => {
      store.updateItemData(item.id, { style: { ...style, ...updates } });
    },
    [store, item.id, style],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Font Family */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Font Family</span>
        <input
          type="text"
          className="w-full rounded px-2 py-1.5 text-sm"
          style={{
            backgroundColor: 'var(--editor-bg-elevated)',
            border: '1px solid var(--editor-border-default)',
            color: 'var(--editor-text-primary)',
          }}
          value={style.fontFamily || 'Inter'}
          onChange={(e) => updateStyle({ fontFamily: e.target.value })}
        />
      </div>

      {/* Font Size + Weight */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--editor-text-muted)]">Size</span>
          <NumberInput
            value={style.fontSize || 48}
            onChange={(v) => updateStyle({ fontSize: v })}
            min={8}
            max={200}
            step={1}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--editor-text-muted)]">Weight</span>
          <NumberInput
            value={style.fontWeight || 600}
            onChange={(v) => updateStyle({ fontWeight: v })}
            min={100}
            max={900}
            step={100}
          />
        </div>
      </div>

      {/* Letter Spacing + Line Height */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--editor-text-muted)]">Spacing</span>
          <NumberInput
            value={style.letterSpacing ?? 0}
            onChange={(v) => updateStyle({ letterSpacing: v })}
            min={-10}
            max={20}
            step={0.5}
            unit="px"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--editor-text-muted)]">Line Height</span>
          <NumberInput
            value={style.lineHeight ?? 1.4}
            onChange={(v) => updateStyle({ lineHeight: v })}
            min={0.8}
            max={3}
            step={0.1}
          />
        </div>
      </div>

      {/* Text Transform */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Transform</span>
        <div className="flex gap-1">
          {(['none', 'uppercase', 'lowercase'] as const).map((transform) => (
            <button
              key={transform}
              className="flex-1 py-1 text-xs rounded transition-colors"
              style={{
                backgroundColor: (style.textTransform || 'none') === transform ? 'var(--editor-accent)' : 'var(--editor-bg-elevated)',
                color: (style.textTransform || 'none') === transform ? '#FFFFFF' : 'var(--editor-text-muted)',
              }}
              onClick={() => updateStyle({ textTransform: transform })}
            >
              {transform === 'none' ? 'Aa' : transform === 'uppercase' ? 'AA' : 'aa'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
