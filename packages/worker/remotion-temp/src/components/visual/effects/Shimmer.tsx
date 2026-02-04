import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface ShimmerProps {
  /** Shimmer color (default: white) */
  color?: string;
  /** Animation duration in frames (default: 60) */
  durationFrames?: number;
  /** Delay before shimmer starts (default: 0) */
  delayFrames?: number;
  /** Shimmer angle in degrees (default: -45) */
  angle?: number;
  /** Shimmer width as percentage (default: 30) */
  width?: number;
  /** Loop the animation (default: false) */
  loop?: boolean;
  /** Children to apply shimmer to */
  children: React.ReactNode;
}

/**
 * Shimmer - Adds a sweeping shimmer/shine effect
 *
 * Creates a premium shine effect that sweeps across the element.
 * Great for highlighting new items or adding polish.
 *
 * @example
 * <Shimmer delayFrames={30} durationFrames={45}>
 *   <Card>Premium Feature</Card>
 * </Shimmer>
 */
export const Shimmer: React.FC<ShimmerProps> = ({
  color = 'rgba(255, 255, 255, 0.4)',
  durationFrames = 60,
  delayFrames = 0,
  angle = -45,
  width = 30,
  loop = false,
  children,
}) => {
  const frame = useCurrentFrame();

  let localFrame = frame - delayFrames;
  if (loop && localFrame > 0) {
    const totalCycle = durationFrames + 60; // Add pause between loops
    localFrame = localFrame % totalCycle;
  }

  const progress = interpolate(
    localFrame,
    [0, durationFrames],
    [-width, 100 + width],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const isActive = localFrame >= 0 && localFrame <= durationFrames;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'inline-block',
      }}
    >
      {children}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(${angle}deg, transparent ${progress - width}%, ${color} ${progress}%, transparent ${progress + width}%)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};

export default Shimmer;
