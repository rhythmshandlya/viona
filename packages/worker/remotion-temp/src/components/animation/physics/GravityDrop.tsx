import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface GravityDropProps {
  /** Frame when the drop animation starts */
  dropFrame: number;
  /** Target Y position as percentage of height (e.g., 80 = 80% from top) */
  targetY: number;
  /** Number of bounces (default: 2) */
  bounceCount?: number;
  /** Initial Y position as percentage (default: -10 = above screen) */
  startY?: number;
  /** Children to animate */
  children: React.ReactNode;
}

/**
 * GravityDrop - Objects fall with realistic gravity and bounce
 *
 * Use for: dropping items, impact effects, physics demos
 *
 * @example
 * <GravityDrop dropFrame={30} targetY={80} bounceCount={3}>
 *   <Ball />
 * </GravityDrop>
 */
export const GravityDrop: React.FC<GravityDropProps> = ({
  dropFrame,
  targetY,
  bounceCount = 2,
  startY = -10,
  children,
}) => {
  const frame = useCurrentFrame();
  const { height, fps } = useVideoConfig();

  // Calculate animation timing
  const dropDuration = fps * 0.5; // 0.5 seconds to fall
  const bounceDuration = fps * 0.2; // 0.2 seconds per bounce

  // Not started yet
  if (frame < dropFrame) {
    const startYPx = (startY / 100) * height;
    return (
      <div style={{ transform: `translateY(${startYPx}px)`, opacity: 0 }}>
        {children}
      </div>
    );
  }

  const localFrame = frame - dropFrame;
  const targetYPx = (targetY / 100) * height;
  const startYPx = (startY / 100) * height;
  const fallDistance = targetYPx - startYPx;

  // Phase 1: Initial drop with gravity (easeIn for acceleration)
  if (localFrame < dropDuration) {
    const progress = localFrame / dropDuration;
    // Quadratic easing for gravity effect (accelerating fall)
    const eased = progress * progress;
    const y = startYPx + fallDistance * eased;

    return (
      <div style={{
        transform: `translateY(${y}px)`,
        opacity: interpolate(localFrame, [0, 5], [0, 1], { extrapolateRight: 'clamp' }),
      }}>
        {children}
      </div>
    );
  }

  // Phase 2: Bounces
  let currentY = targetYPx;
  let currentFrame = localFrame - dropDuration;
  let currentBounceHeight = fallDistance * 0.4; // First bounce is 40% of fall

  for (let bounce = 0; bounce < bounceCount; bounce++) {
    if (currentFrame < bounceDuration) {
      // Going up
      const upProgress = currentFrame / (bounceDuration / 2);
      if (upProgress < 1) {
        // Rising
        const eased = 1 - Math.pow(1 - upProgress, 2);
        currentY = targetYPx - currentBounceHeight * eased;
      } else {
        // Falling
        const downProgress = (upProgress - 1);
        const eased = downProgress * downProgress;
        currentY = targetYPx - currentBounceHeight * (1 - eased);
      }
      break;
    }

    currentFrame -= bounceDuration;
    currentBounceHeight *= 0.5; // Each bounce is half the previous
  }

  return (
    <div style={{ transform: `translateY(${currentY}px)` }}>
      {children}
    </div>
  );
};

export default GravityDrop;
