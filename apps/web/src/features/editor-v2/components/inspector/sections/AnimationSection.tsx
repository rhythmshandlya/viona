'use client';

import React, { useCallback } from 'react';
import { useEditorStore } from '../../../store/use-editor-store';
import type { TimelineItem, TextItemData } from '../../../store/types';

interface AnimationSectionProps {
  item: TimelineItem;
}

const ANIMATION_PRESETS = [
  { value: 'none', label: 'None' },
  { value: 'pop', label: 'Pop' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'bounce-up', label: 'Bounce' },
] as const;

export function AnimationSection({ item }: AnimationSectionProps) {
  const store = useEditorStore();
  const data = item.data as any;
  const animation = data.style?.animation || data.animation || 'none';

  const updateData = useCallback(
    (updates: Record<string, unknown>) => {
      store.updateItemData(item.id, updates);
    },
    [store, item.id],
  );

  const currentValue = typeof animation === 'string' ? animation : (animation?.in || 'none');

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-[var(--editor-text-muted)]">Preset</span>
      <div className="grid grid-cols-3 gap-1">
        {ANIMATION_PRESETS.map((preset) => (
          <button
            key={preset.value}
            className="py-1.5 text-xs rounded transition-colors"
            style={{
              backgroundColor: currentValue === preset.value ? 'var(--editor-accent)' : 'var(--editor-bg-elevated)',
              color: currentValue === preset.value ? '#FFFFFF' : 'var(--editor-text-muted)',
            }}
            onClick={() => {
              const style = (data as any).style || {};
              updateData({ style: { ...style, animation: preset.value } });
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
