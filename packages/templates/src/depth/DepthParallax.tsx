import React from 'react';
import { useCurrentFrame } from 'remotion';

/** Depth tier: 0 = near (most movement), 1 = mid, 2 = far (subtle) */
export type DepthTier = 0 | 1 | 2;

interface DepthParallaxProps {
  /** Depth tier controlling parallax intensity */
  tier?: DepthTier;
  /** Maximum pixel displacement at tier 0 (default 12) */
  maxDrift?: number;
  /** Speed of the sine cycle in frames (default 90) */
  cycleFrames?: number;
  children: React.ReactNode;
}

const TIER_MULTIPLIER: Record<DepthTier, number> = {
  0: 1.0,
  1: 0.5,
  2: 0.2,
};

/**
 * Sine-based parallax drift. Near elements (tier 0) move the most,
 * far elements (tier 2) barely move, creating depth illusion.
 */
export const DepthParallax: React.FC<DepthParallaxProps> = ({
  tier = 1,
  maxDrift = 12,
  cycleFrames = 90,
  children,
}) => {
  const frame = useCurrentFrame();

  const intensity = maxDrift * TIER_MULTIPLIER[tier];
  const dx = Math.sin((frame / cycleFrames) * Math.PI * 2) * intensity;
  const dy = Math.cos((frame / cycleFrames) * Math.PI * 2) * intensity * 0.5;

  return (
    <div
      style={{
        transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  );
};
