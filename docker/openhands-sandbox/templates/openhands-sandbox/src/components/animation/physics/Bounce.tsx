import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';

interface BounceProps {
  /** Frame when bounce animation starts */
  startFrame: number;
  /** Spring damping - lower = more bounce (default: 8) */
  damping?: number;
  /** Spring stiffness (default: 200) */
  stiffness?: number;
  /** Children to animate */
  children: React.ReactNode;
}

/**
 * Bounce - Bouncy entrance animation wrapper
 *
 * Use for: playful entrances, attention-grabbing reveals
 *
 * @example
 * <Bounce startFrame={15} damping={8}>
 *   <Icon />
 * </Bounce>
 */
export const Bounce: React.FC<BounceProps> = ({
  startFrame,
  damping = 8,
  stiffness = 200,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  const scale = spring({
    frame: localFrame,
    fps,
    config: {
      damping,
      stiffness,
    },
  });

  const opacity = frame >= startFrame ? 1 : 0;

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        transformOrigin: 'center center',
      }}
    >
      {children}
    </div>
  );
};

export default Bounce;
