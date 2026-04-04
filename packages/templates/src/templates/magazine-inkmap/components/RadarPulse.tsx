import { AbsoluteFill, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';

interface RadarPulseProps {
  frame: number;
  startFrame: number;
  cx?: number;
  cy?: number;
}

/**
 * Concentric circles that pulse outward from the pin location.
 * Two staggered rings with fade-out for a radar/sonar effect.
 */
export function RadarPulse({
  frame,
  startFrame,
  cx = 540,
  cy = 900,
}: RadarPulseProps) {
  const rings = [0, 10]; // stagger offsets in frames

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920"
        style={{ position: 'absolute', top: 0, left: 0 }}>
        {rings.map((offset, i) => {
          const ringStart = startFrame + offset;
          const ringDuration = 30;

          const radius = interpolate(
            frame,
            [ringStart, ringStart + ringDuration],
            [8, 120],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          const ringOpacity = interpolate(
            frame,
            [ringStart, ringStart + 5, ringStart + ringDuration],
            [0, 0.35, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={MAGAZINE_COLORS.accent}
              strokeWidth={1.5}
              opacity={ringOpacity}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}
