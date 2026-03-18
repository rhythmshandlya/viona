'use client';

import React, { useState, useCallback } from 'react';
import { MiniTimeline } from './MiniTimeline';
import { CurveEditor } from './CurveEditor';
import { KeyframeList } from './KeyframeList';
import { useSingleSelectedItem } from '../../store/use-editor-store';

export const KeyframeEditor: React.FC = () => {
  const item = useSingleSelectedItem();
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number | null>(null);

  // When MiniTimeline segment is selected, pick the "to" keyframe for easing editing
  const handleSelectSegment = useCallback(
    (_fromIndex: number, toIndex: number, _property: string) => {
      setSelectedKeyframeIndex(toIndex);
    },
    [],
  );

  const handleSelectKeyframe = useCallback((index: number) => {
    setSelectedKeyframeIndex(index);
  }, []);

  if (!item) return null;

  const keyframes = item.keyframes ?? [];
  const hasKeyframes = keyframes.length > 0;

  // Resolve the easing for the currently selected keyframe
  const selectedKf =
    selectedKeyframeIndex !== null && selectedKeyframeIndex < keyframes.length
      ? keyframes[selectedKeyframeIndex]
      : null;

  // Truncate item ID for display
  const shortId = item.id.length > 12 ? `${item.id.slice(0, 12)}...` : item.id;

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-normal"
          style={{ color: 'var(--editor-text-primary)' }}
        >
          Keyframe Editor
        </span>
        <span
          className="text-[10px] font-mono truncate max-w-[120px]"
          style={{ color: 'var(--editor-text-muted)' }}
          title={item.id}
        >
          {shortId}
        </span>
      </div>

      {hasKeyframes ? (
        <>
          {/* Mini timeline with property lanes */}
          <MiniTimeline item={item} onSelectSegment={handleSelectSegment} />

          {/* Curve editor for selected keyframe easing */}
          {selectedKf && selectedKeyframeIndex !== null && (
            <CurveEditor
              itemId={item.id}
              keyframeIndex={selectedKeyframeIndex}
              currentEasing={selectedKf.easing}
            />
          )}
        </>
      ) : (
        <div
          className="rounded-md px-3 py-4 text-xs text-center select-none"
          style={{
            backgroundColor: 'var(--editor-bg-elevated)',
            border: '1px solid var(--editor-border-default)',
            color: 'var(--editor-text-muted)',
          }}
        >
          <p className="mb-1">No keyframes yet</p>
          <p className="text-[10px]">
            Use the diamond toggles in Properties or click &quot;+ Add Keyframe&quot; below.
          </p>
        </div>
      )}

      {/* Keyframe list (always shown — includes + Add Keyframe button) */}
      <KeyframeList
        item={item}
        onSelectKeyframe={handleSelectKeyframe}
        selectedIndex={selectedKeyframeIndex}
      />
    </div>
  );
};
