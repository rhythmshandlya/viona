'use client';

import React, { useCallback } from 'react';
import { useEditorStore } from '../../../store/use-editor-store';
import type { TimelineItem, TextItemData } from '../../../store/types';

interface ColorSectionProps {
  item: TimelineItem;
}

const QUICK_COLORS = ['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

export function ColorSection({ item }: ColorSectionProps) {
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
      {/* Text Color */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Text Color</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            style={{ backgroundColor: 'transparent' }}
            value={style.color || '#FFFFFF'}
            onChange={(e) => updateStyle({ color: e.target.value })}
          />
          <span className="text-xs font-mono text-[var(--editor-text-primary)]">
            {style.color || '#FFFFFF'}
          </span>
        </div>
      </div>

      {/* Background Color */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Background</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            style={{ backgroundColor: 'transparent' }}
            value={style.backgroundColor || '#000000'}
            onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
          />
          <span className="text-xs font-mono text-[var(--editor-text-primary)]">
            {style.backgroundColor || '#000000'}
          </span>
        </div>
      </div>

      {/* Quick Palette */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Quick Colors</span>
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_COLORS.map((color) => (
            <button
              key={color}
              className="w-6 h-6 rounded border border-[var(--editor-border-default)] cursor-pointer transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
              onClick={() => updateStyle({ color })}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
