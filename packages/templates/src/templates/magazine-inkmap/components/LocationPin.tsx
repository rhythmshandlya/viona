import { AbsoluteFill, interpolate, Easing } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';

interface LocationPinProps {
  frame: number;
  startFrame: number;
  cx?: number;
  cy?: number;
}

/**
 * Animated location pin that drops in with a bounce and shadow.
 * Clean SVG pin shape with accent color fill.
 */
export function LocationPin({
  frame,
  startFrame,
  cx = 540,
  cy = 900,
}: LocationPinProps) {
  const dropDuration = 18;

  const dropY = interpolate(
    frame,
    [startFrame, startFrame + dropDuration],
    [-200, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.back(1.4)),
    },
  );

  const pinOpacity = interpolate(
    frame,
    [startFrame, startFrame + 4],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Shadow grows as pin lands
  const shadowScale = interpolate(
    frame,
    [startFrame, startFrame + dropDuration],
    [0.3, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const shadowOpacity = interpolate(
    frame,
    [startFrame, startFrame + dropDuration],
    [0, 0.15],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: pinOpacity }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920"
        style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Drop shadow ellipse */}
        <ellipse
          cx={cx}
          cy={cy + 52}
          rx={20 * shadowScale}
          ry={6 * shadowScale}
          fill={MAGAZINE_COLORS.primary}
          opacity={shadowOpacity}
        />
        {/* Pin shape */}
        <g transform={`translate(${cx}, ${cy + dropY})`}>
          <path
            d="M0,-40 C-22,-40 -40,-22 -40,0 C-40,22 0,48 0,48 C0,48 40,22 40,0 C40,-22 22,-40 0,-40 Z"
            fill={MAGAZINE_COLORS.accent}
          />
          <circle cx={0} cy={-2} r={14} fill="white" opacity={0.95} />
          <circle cx={0} cy={-2} r={6} fill={MAGAZINE_COLORS.accent} />
        </g>
      </svg>
    </AbsoluteFill>
  );
}
