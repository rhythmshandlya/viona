'use client';

import React, { useCallback } from 'react';
import { NumberInput } from '../../properties/NumberInput';
import { useEditorStore } from '../../../store/use-editor-store';
import type { TimelineItem, VideoItemData, AudioItemData } from '../../../store/types';

interface AdjustSectionProps {
  item: TimelineItem;
}

export function AdjustSection({ item }: AdjustSectionProps) {
  const store = useEditorStore();
  const data = item.data as VideoItemData | AudioItemData;

  const updateData = useCallback(
    (updates: Record<string, unknown>) => {
      store.updateItemData(item.id, updates);
    },
    [store, item.id],
  );

  const isVideo = item.type === 'video';

  return (
    <div className="flex flex-col gap-3">
      {/* Volume */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Volume</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={Math.round((data.volume ?? 1) * 100)}
            onChange={(e) => updateData({ volume: parseInt(e.target.value) / 100 })}
            className="flex-1 h-1 rounded appearance-none cursor-pointer"
            style={{ accentColor: 'var(--editor-accent)', backgroundColor: 'var(--editor-border-default)' }}
          />
          <NumberInput
            value={Math.round((data.volume ?? 1) * 100)}
            onChange={(v) => updateData({ volume: v / 100 })}
            min={0}
            max={200}
            unit="%"
            className="w-20 shrink-0"
          />
        </div>
      </div>

      {/* Playback Rate */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--editor-text-muted)]">Playback Rate</span>
        <NumberInput
          value={(data as any).playbackRate ?? 1}
          onChange={(v) => updateData({ playbackRate: v })}
          min={0.25}
          max={4}
          step={0.25}
          unit="x"
        />
      </div>

      {/* Start From (video only) */}
      {isVideo && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--editor-text-muted)]">Start From (ms)</span>
          <NumberInput
            value={(data as any).startFrom || 0}
            onChange={(v) => updateData({ startFrom: v })}
            min={0}
            step={100}
          />
        </div>
      )}

      {/* Fade In/Out */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--editor-text-muted)]">Fade In (ms)</span>
          <NumberInput
            value={(data as any).fadeInMs || 0}
            onChange={(v) => updateData({ fadeInMs: v })}
            min={0}
            max={5000}
            step={100}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--editor-text-muted)]">Fade Out (ms)</span>
          <NumberInput
            value={(data as any).fadeOutMs || 0}
            onChange={(v) => updateData({ fadeOutMs: v })}
            min={0}
            max={5000}
            step={100}
          />
        </div>
      </div>
    </div>
  );
}
