import { AbsoluteFill } from 'remotion';
import { BLACKBOARD_COLORS } from './constants';

export function BoardTexture({
  opacity = 0.03,
  seed = 'board',
}: {
  opacity?: number;
  seed?: string;
}) {
  const filterId = `blackboard-${seed}`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ backgroundColor: BLACKBOARD_COLORS.background }} />
      {/* Very subtle noise for texture */}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0, opacity }}
      >
        <defs>
          <filter id={filterId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves={3}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values={`0 0 0 0 0.5
                       0 0 0 0 0.5
                       0 0 0 0 0.5
                       0 0 0 0.3 0`}
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
}

export function ChalkDust({
  opacity = 0.02,
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
              values={`0 0 0 0 0.5
                       0 0 0 0 0.5
                       0 0 0 0 0.5
                       0 0 0 0.2 0`}
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
}
