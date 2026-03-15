'use client';

import React, { useCallback } from 'react';
import { useEditorStore } from '../../../store/use-editor-store';
import type { TimelineItem, TextItemData } from '../../../store/types';

interface TextSectionProps {
  item: TimelineItem;
}

export function TextSection({ item }: TextSectionProps) {
  const store = useEditorStore();
  const data = item.data as TextItemData;

  const updateData = useCallback(
    (updates: Record<string, unknown>) => {
      store.updateItemData(item.id, updates);
    },
    [store, item.id],
  );

  return (
    <div className="flex flex-col gap-3">
      <textarea
        className="w-full rounded px-2 py-1.5 text-sm resize-y min-h-[80px]"
        style={{
          backgroundColor: 'var(--editor-bg-elevated)',
          border: '1px solid var(--editor-border-default)',
          color: 'var(--editor-text-primary)',
        }}
        value={data.text ?? ''}
        onChange={(e) => updateData({ text: e.target.value })}
      />

      {/* Text Align */}
      <div className="flex gap-1">
        {(['left', 'center', 'right'] as const).map((align) => (
          <button
            key={align}
            className="flex-1 py-1 text-xs rounded transition-colors"
            style={{
              backgroundColor: ((data as any).style?.textAlign || 'center') === align ? 'var(--editor-accent)' : 'var(--editor-bg-elevated)',
              color: ((data as any).style?.textAlign || 'center') === align ? '#FFFFFF' : 'var(--editor-text-muted)',
            }}
            onClick={() => updateData({ style: { ...((data as any).style || {}), textAlign: align } })}
          >
            {align}
          </button>
        ))}
      </div>
    </div>
  );
}
