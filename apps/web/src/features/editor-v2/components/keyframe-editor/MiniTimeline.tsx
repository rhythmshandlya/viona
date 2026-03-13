'use client';

import React, { useRef, useCallback } from 'react';
import type { TimelineItem } from '../../store/types';
import { useEditorStore } from '../../store/use-editor-store';
import { PropertyLane } from './PropertyLane';

interface MiniTimelineProps {
  item: TimelineItem;
  onSelectSegment: (fromIndex: number, toIndex: number, property: string) => void;
}

const PROPERTIES = ['x', 'y', 'width', 'height', 'rotation', 'opacity'] as const;

/** Time ruler tick labels at 0%, 25%, 50%, 75%, 100% of item duration. */
function formatMs(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toFixed(0).padStart(2, '0')}`;
}

export const MiniTimeline: React.FC<MiniTimelineProps> = ({
  item,
  onSelectSegment,
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);
  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const duration = item.endMs - item.startMs;

  // Compute which properties have keyframes
  const animatedProperties = PROPERTIES.filter((prop) =>
    (item.keyframes ?? []).some((kf) => prop in kf.props),
  );

  // Playhead position relative to item (clamped 0-100%)
  const relativeTime = currentTimeMs - item.startMs;
  const playheadPct =
    duration > 0
      ? Math.max(0, Math.min(100, (relativeTime / duration) * 100))
      : 0;

  // Click ruler to seek
  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      const timeMs = item.startMs + Math.round(pct * duration);
      setCurrentTime(Math.max(item.startMs, Math.min(item.endMs, timeMs)));
    },
    [item.startMs, item.endMs, duration, setCurrentTime],
  );

  const tickMarks = [0, 25, 50, 75, 100];

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        backgroundColor: 'var(--editor-bg-elevated)',
        border: '1px solid var(--editor-border-default)',
      }}
    >
      {/* Time ruler */}
      <div
        ref={rulerRef}
        className="relative h-5 cursor-pointer select-none"
        style={{
          borderBottom: '1px solid var(--editor-border-default)',
          backgroundColor: 'var(--editor-bg-elevated)',
        }}
        onClick={handleRulerClick}
      >
        {/* Tick marks & labels */}
        {tickMarks.map((pct) => (
          <div
            key={pct}
            className="absolute top-0 h-full flex flex-col items-center"
            style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
          >
            <div
              className="w-px h-2"
              style={{ backgroundColor: 'var(--editor-text-muted)' }}
            />
            <span
              className="text-[9px] leading-none mt-px"
              style={{ color: 'var(--editor-text-muted)' }}
            >
              {formatMs((pct / 100) * duration)}
            </span>
          </div>
        ))}

        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-px"
          style={{
            left: `${playheadPct}%`,
            backgroundColor: '#ef4444',
            zIndex: 2,
          }}
        >
          {/* Playhead triangle */}
          <div
            className="absolute -top-px left-1/2 -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '5px solid #ef4444',
            }}
          />
        </div>
      </div>

      {/* Property lanes */}
      {animatedProperties.length > 0 ? (
        <div className="px-1 py-1 flex flex-col gap-0.5">
          {animatedProperties.map((prop) => (
            <PropertyLane
              key={prop}
              property={prop}
              item={item}
              duration={duration}
              onSelectSegment={(from, to) => onSelectSegment(from, to, prop)}
            />
          ))}
        </div>
      ) : (
        <div
          className="px-3 py-2 text-center text-xs select-none"
          style={{ color: 'var(--editor-text-muted)' }}
        >
          No keyframes
        </div>
      )}
    </div>
  );
};
