import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

interface DepthEntranceProps {
  /** Frame at which the entrance begins (relative to sequence) */
  startFrame?: number;
  /** Duration of the entrance animation in frames */
  durationFrames?: number;
  /** Origin point for the scale-up (CSS transform-origin, default "center center") */
  origin?: string;
  children: React.ReactNode;
}

/**
 * Animated entrance from behind the speaker center.
 * Scales from 0.3 to 1.0 with a slight overshoot (back easing).
 */
export const DepthEntrance: React.FC<DepthEntranceProps> = ({
  startFrame = 0,
  durationFrames = 20,
  origin = 'center center',
  children,
}) => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [startFrame, startFrame + durationFrames], [0.3, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.1)),
  });

  const opacity = interpolate(frame, [startFrame, startFrame + Math.min(durationFrames, 8)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: origin,
        opacity,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </div>
  );
};
