import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface Point {
  x: number;
  y: number;
}

interface ArcTravelProps {
  /** Start position as percentage { x: 0-100, y: 0-100 } */
  from: Point;
  /** End position as percentage { x: 0-100, y: 0-100 } */
  to: Point;
  /** Frame when animation starts */
  startFrame: number;
  /** Duration in frames */
  durationFrames: number;
  /** Arc direction: 'up' curves upward, 'down' curves downward */
  arcDirection?: 'up' | 'down';
  /** Arc intensity as percentage of distance (default: 30) */
  arcIntensity?: number;
  /** Children to animate */
  children: React.ReactNode;
}

/**
 * ArcTravel - Simple arc motion between two points
 *
 * Use for: object traveling, throwing motion, connections
 *
 * @example
 * <ArcTravel
 *   from={{ x: 20, y: 80 }}
 *   to={{ x: 80, y: 80 }}
 *   startFrame={30}
 *   durationFrames={45}
 * >
 *   <Ball />
 * </ArcTravel>
 */
export const ArcTravel: React.FC<ArcTravelProps> = ({
  from,
  to,
  startFrame,
  durationFrames,
  arcDirection = 'up',
  arcIntensity = 30,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Convert percentages to pixels
  const fromXPx = (from.x / 100) * width;
  const fromYPx = (from.y / 100) * height;
  const toXPx = (to.x / 100) * width;
  const toYPx = (to.y / 100) * height;

  // Calculate arc height based on distance and direction
  const distance = Math.sqrt(
    Math.pow(toXPx - fromXPx, 2) + Math.pow(toYPx - fromYPx, 2)
  );
  const arcHeightPx = (arcIntensity / 100) * distance * (arcDirection === 'up' ? -1 : 1);

  // Calculate progress
  const localFrame = frame - startFrame;
  const progress = interpolate(
    localFrame,
    [0, durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Use easing for more natural motion
  const eased = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  // Linear interpolation for X
  const x = fromXPx + (toXPx - fromXPx) * eased;

  // Parabolic arc for Y
  // y = startY + linearProgress * (endY - startY) + arc * 4 * progress * (1 - progress)
  const linearY = fromYPx + (toYPx - fromYPx) * eased;
  const arcOffset = arcHeightPx * 4 * progress * (1 - progress);
  const y = linearY + arcOffset;

  // Visibility
  const isVisible = frame >= startFrame && progress <= 1;

  // Scale pulse at midpoint for emphasis
  const scalePulse = interpolate(
    progress,
    [0, 0.5, 1],
    [1, 1.1, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scalePulse})`,
        opacity: isVisible ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
};

export default ArcTravel;
