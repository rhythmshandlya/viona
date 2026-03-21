import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { InkBleedFilter } from '../../../magazine/effects';
import { magazineEasing } from '../../../magazine/animations';

interface InkBordersProps {
  frame: number;
  /** Frame at which the border drawing starts */
  startFrame: number;
  /** Duration (in frames) for the border to fully draw */
  duration: number;
  /** Padding from viewport edges in px */
  padding?: number;
  seed?: string;
}

/**
 * Animated rectangular border that draws itself via stroke-dasharray/dashoffset.
 * Represents a simplified region outline on the cartographic map.
 */
export function InkBorders({
  frame,
  startFrame,
  duration,
  padding = 60,
  seed = 'inkmap-border',
}: InkBordersProps) {
  const inkFilterId = `ink-bleed-${seed}`;

  const rect = useMemo(() => {
    const x = padding;
    const y = padding + 200; // offset down to leave room for top UI
    const w = 1080 - padding * 2;
    const h = 1920 - padding * 2 - 400; // leave room for label at bottom
    return { x, y, w, h };
  }, [padding]);

  const pathLength = useMemo(() => {
    return 2 * (rect.w + rect.h);
  }, [rect.w, rect.h]);

  const dashOffset = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [pathLength, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: magazineEasing,
    },
  );

  const borderOpacity = interpolate(
    frame,
    [startFrame, startFrame + 5],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: borderOpacity }}>
      <InkBleedFilter id={inkFilterId} />
      <svg
        width={1080}
        height={1920}
        viewBox="0 0 1080 1920"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          filter: `url(#${inkFilterId})`,
        }}
      >
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          fill="none"
          stroke={MAGAZINE_COLORS.inkBlack}
          strokeWidth={2}
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
        />
      </svg>
    </AbsoluteFill>
  );
}
