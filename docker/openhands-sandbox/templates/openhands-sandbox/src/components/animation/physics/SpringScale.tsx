import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';

interface SpringConfig {
  damping?: number;
  stiffness?: number;
  mass?: number;
}

interface SpringScaleProps {
  /** Frame when animation starts */
  startFrame: number;
  /** Initial scale (default: 0) */
  fromScale?: number;
  /** Final scale (default: 1) */
  toScale?: number;
  /** Spring configuration */
  config?: SpringConfig;
  /** Children to animate */
  children: React.ReactNode;
}

/**
 * SpringScale - Scale animation with spring physics
 *
 * Use for: element entrances, reveals, emphasis
 *
 * @example
 * <SpringScale startFrame={0}>
 *   <Card />
 * </SpringScale>
 *
 * @example
 * <SpringScale startFrame={30} fromScale={0.5} toScale={1.2} config={{ damping: 12, stiffness: 100 }}>
 *   <Emphasis />
 * </SpringScale>
 */
export const SpringScale: React.FC<SpringScaleProps> = ({
  startFrame,
  fromScale = 0,
  toScale = 1,
  config = { damping: 12, stiffness: 80 },
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  const springProgress = spring({
    frame: localFrame,
    fps,
    config: {
      damping: config.damping ?? 12,
      stiffness: config.stiffness ?? 80,
      mass: config.mass ?? 1,
    },
  });

  const scale = fromScale + (toScale - fromScale) * springProgress;
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

export default SpringScale;
