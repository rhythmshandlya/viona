import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BLACKBOARD_COLORS } from './constants';

export function BoardTexture({
  opacity = 0.04,
  seed = 'board',
}: {
  opacity?: number;
  seed?: string;
}) {
  const filterId = `blackboard-${seed}`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ backgroundColor: BLACKBOARD_COLORS.background }} />
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0, opacity }}
      >
        <defs>
          <filter id={filterId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves={3}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values={`0 0 0 0 0.06
                       0 0 0 0 0.05
                       0 0 0 0 0.04
                       0 0 0 0.5 0`}
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
}

export function ChalkDust({
  opacity = 0.03,
  seed = 'dust',
}: {
  opacity?: number;
  seed?: string;
}) {
  const filterId = `blackboard-dust-${seed}`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          <filter id={filterId}>
            <feTurbulence
              type="turbulence"
              baseFrequency="1.5"
              numOctaves={2}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values={`0 0 0 0 0.96
                       0 0 0 0 0.62
                       0 0 0 0 0.04
                       0 0 0 0.3 0`}
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
}
