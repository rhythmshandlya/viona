'use client';

import React from 'react';
import type { TimelineItem } from '../../store/types';
import { useEditorStore } from '../../store/use-editor-store';

interface KeyframeListProps {
  item: TimelineItem;
  onSelectKeyframe: (index: number) => void;
  selectedIndex: number | null;
}

/** Format milliseconds as seconds with one decimal. */
function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Diamond icon for keyframe marker. */
function DiamondIcon({ size = 10 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="currentColor"
      style={{ flexShrink: 0 }}
    >
      <polygon points="5,0 10,5 5,10 0,5" />
    </svg>
  );
}

/** Summarise the animated properties on a keyframe. */
function propsLabel(props: Record<string, unknown>): string {
  const keys = Object.keys(props);
  if (keys.length === 0) return '—';
  return keys
    .map((k) => {
      const v = props[k as keyof typeof props];
      if (typeof v === 'number') return `${k}: ${Math.round(v as number)}`;
      return `${k}: ${v}`;
    })
    .join(', ');
}

export const KeyframeList: React.FC<KeyframeListProps> = ({
  item,
  onSelectKeyframe,
  selectedIndex,
}) => {
  const addKeyframeAtTime = useEditorStore((s) => s.addKeyframeAtTime);
  const deleteKeyframe = useEditorStore((s) => s.deleteKeyframe);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);

  const keyframes = item.keyframes ?? [];

  const handleSelect = (index: number) => {
    onSelectKeyframe(index);
    const kf = keyframes[index];
    if (kf) {
      // Seek to the keyframe time (absolute)
      setCurrentTime(item.startMs + kf.timeMs);
    }
  };

  const handleAdd = () => {
    // Compute time relative to item start
    const relativeMs = Math.max(0, currentTimeMs - item.startMs);
    // Snapshot current transform (or empty)
    const currentTransform = item.transform ?? {
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      rotation: 0,
      opacity: 1,
    };
    addKeyframeAtTime(item.id, relativeMs, { ...currentTransform });
  };

  const handleDelete = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    deleteKeyframe(item.id, index);
  };

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        backgroundColor: 'var(--editor-bg-elevated)',
        border: '1px solid var(--editor-border-default)',
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-1.5 text-[10px] font-normal uppercase tracking-wide select-none"
        style={{
          color: 'var(--editor-text-muted)',
          borderBottom: '1px solid var(--editor-border-default)',
        }}
      >
        Keyframes ({keyframes.length})
      </div>

      {/* Keyframe rows */}
      {keyframes.length === 0 ? (
        <div
          className="px-3 py-3 text-xs text-center select-none"
          style={{ color: 'var(--editor-text-muted)' }}
        >
          No keyframes on this item
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          {keyframes.map((kf, index) => {
            const isSelected = selectedIndex === index;
            return (
              <button
                key={`${kf.timeMs}-${index}`}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
                style={{
                  backgroundColor: isSelected
                    ? 'var(--editor-accent-soft, rgba(168, 85, 247, 0.15))'
                    : 'transparent',
                  borderBottom: '1px solid var(--editor-border-subtle)',
                }}
                onClick={() => handleSelect(index)}
              >
                {/* Diamond icon */}
                <span style={{ color: isSelected ? 'var(--editor-accent)' : 'var(--editor-text-muted)' }}>
                  <DiamondIcon />
                </span>

                {/* Time */}
                <span
                  className="text-xs font-mono tabular-nums w-12 flex-shrink-0"
                  style={{ color: 'var(--editor-text-primary)' }}
                >
                  {formatTime(kf.timeMs)}
                </span>

                {/* Property values (truncated) */}
                <span
                  className="text-[10px] truncate flex-1"
                  style={{ color: 'var(--editor-text-secondary)' }}
                >
                  {propsLabel(kf.props as Record<string, unknown>)}
                </span>

                {/* Easing badge */}
                <span
                  className="text-[9px] px-1 py-0.5 rounded flex-shrink-0"
                  style={{
                    backgroundColor: 'var(--editor-bg-surface)',
                    color: 'var(--editor-text-muted)',
                    border: '1px solid var(--editor-border-default)',
                  }}
                >
                  {kf.easing?.startsWith('cubic-bezier') ? 'custom' : (kf.easing ?? 'linear')}
                </span>

                {/* Delete button */}
                <span
                  role="button"
                  tabIndex={-1}
                  className="text-xs flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-red-500/20 transition-colors"
                  style={{ color: 'var(--editor-text-muted)' }}
                  onClick={(e) => handleDelete(e, index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDelete(e as unknown as React.MouseEvent, index);
                  }}
                >
                  &times;
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Add Keyframe button */}
      <button
        className="w-full px-3 py-2 text-xs font-normal transition-colors hover:bg-[var(--editor-bg-hover)]"
        style={{
          color: 'var(--editor-accent)',
          borderTop: '1px solid var(--editor-border-default)',
        }}
        onClick={handleAdd}
      >
        + Add Keyframe
      </button>
    </div>
  );
};
