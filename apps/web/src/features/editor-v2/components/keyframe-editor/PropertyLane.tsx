'use client';

import React, { useCallback } from 'react';
import type { TimelineItem, Keyframe } from '../../store/types';
import { useEditorStore } from '../../store/use-editor-store';

interface PropertyLaneProps {
  property: string;
  item: TimelineItem;
  duration: number;
  onSelectSegment: (fromIndex: number, toIndex: number) => void;
}

/** Per-property keyframe lane showing diamond markers and interpolation lines. */
export const PropertyLane: React.FC<PropertyLaneProps> = ({
  property,
  item,
  duration,
  onSelectSegment,
}) => {
  const store = useEditorStore();

  // Filter keyframes that have this property
  const keyframes: (Keyframe & { originalIndex: number })[] = (item.keyframes ?? [])
    .map((kf, i) => ({ ...kf, originalIndex: i }))
    .filter((kf) => property in kf.props);

  const toPercent = (timeMs: number) =>
    duration > 0 ? (timeMs / duration) * 100 : 0;

  const handleDiamondClick = useCallback(
    (kf: Keyframe) => {
      // Seek to keyframe time (absolute: item start + keyframe offset)
      store.setCurrentTime(item.startMs + kf.timeMs);
    },
    [store, item.startMs],
  );

  const handleDiamondContextMenu = useCallback(
    (e: React.MouseEvent, originalIndex: number) => {
      e.preventDefault();
      store.deleteKeyframe(item.id, originalIndex);
    },
    [store, item.id],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      const timeMs = Math.round(pct * duration);
      store.addKeyframeAtTime(item.id, timeMs, { [property]: 0 });
    },
    [store, item.id, duration, property],
  );

  const handleSegmentClick = useCallback(
    (fromIdx: number, toIdx: number) => {
      onSelectSegment(fromIdx, toIdx);
    },
    [onSelectSegment],
  );

  return (
    <div className="flex items-center gap-2 h-6">
      {/* Property label */}
      <span
        className="text-[10px] w-12 shrink-0 text-right select-none"
        style={{ color: 'var(--editor-text-muted)' }}
      >
        {property}
      </span>

      {/* Lane area */}
      <div
        className="relative flex-1 h-full cursor-crosshair"
        onDoubleClick={handleDoubleClick}
      >
        {/* Background track line */}
        <div
          className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2"
          style={{ backgroundColor: 'var(--editor-border-default)' }}
        />

        {/* Interpolation lines between consecutive keyframes */}
        {keyframes.map((kf, i) => {
          if (i >= keyframes.length - 1) return null;
          const next = keyframes[i + 1];
          const left = toPercent(kf.timeMs);
          const width = toPercent(next.timeMs) - left;
          return (
            <div
              key={`seg-${kf.originalIndex}-${next.originalIndex}`}
              className="absolute top-1/2 -translate-y-1/2 h-[3px] cursor-pointer hover:opacity-80"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: 'var(--editor-accent-muted)',
              }}
              onClick={() =>
                handleSegmentClick(kf.originalIndex, next.originalIndex)
              }
            />
          );
        })}

        {/* Diamond markers */}
        {keyframes.map((kf) => (
          <div
            key={`kf-${kf.originalIndex}`}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
            style={{ left: `${toPercent(kf.timeMs)}%` }}
            onClick={() => handleDiamondClick(kf)}
            onContextMenu={(e) => handleDiamondContextMenu(e, kf.originalIndex)}
          >
            <svg
              viewBox="0 0 12 12"
              className="w-3 h-3 group-hover:scale-125 transition-transform"
              style={{ color: 'var(--editor-accent)' }}
              fill="currentColor"
            >
              <rect
                x="3"
                y="3"
                width="6"
                height="6"
                transform="rotate(45 6 6)"
              />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
};
