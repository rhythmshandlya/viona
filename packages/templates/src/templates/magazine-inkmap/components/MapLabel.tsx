import React from 'react';
import { AbsoluteFill } from 'remotion';
import { SerifHeadline } from '../../../magazine/typography';
import { editorialReveal } from '../../../magazine/animations';
import { FONT_SIZES } from '../../../magazine/constants';

interface MapLabelProps {
  label: string;
  frame: number;
  startFrame: number;
  duration?: number;
}

/**
 * Map label positioned at the bottom of the composition.
 * Uses SerifHeadline with showRule for editorial styling,
 * animated in with editorialReveal.
 */
export function MapLabel({
  label,
  frame,
  startFrame,
  duration = 20,
}: MapLabelProps) {
  const reveal = editorialReveal(frame, startFrame, duration);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 120,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity: reveal.opacity,
          transform: `translateY(${reveal.translateY}px)`,
          width: '80%',
          textAlign: 'center',
        }}
      >
        <SerifHeadline
          text={label}
          size={FONT_SIZES.h2}
          showRule
        />
      </div>
    </AbsoluteFill>
  );
}
