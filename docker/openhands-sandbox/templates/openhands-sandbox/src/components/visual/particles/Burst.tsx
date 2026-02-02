import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

interface BurstProps {
  /** Frame when burst occurs */
  triggerFrame: number;
  /** Center X position as percentage (default: 50) */
  x?: number;
  /** Center Y position as percentage (default: 50) */
  y?: number;
  /** Burst color */
  color?: string;
  /** Number of particles (default: 12) */
  particleCount?: number;
  /** Burst radius as percentage of min dimension (default: 20) */
  radius?: number;
  /** Duration in frames (default: 45) */
  durationFrames?: number;
}

/**
 * Burst - Radial burst effect - particles explode outward from center
 *
 * Use for: impact moments, reveals, emphasis
 *
 * @example
 * <Burst triggerFrame={60} x={50} y={50} color="#8b5cf6" />
 */
export const Burst: React.FC<BurstProps> = ({
  triggerFrame,
  x = 50,
  y = 50,
  color = '#8b5cf6',
  particleCount = 12,
  radius = 20,
  durationFrames = 45,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const minDim = Math.min(width, height);

  const localFrame = frame - triggerFrame;

  if (localFrame < 0 || localFrame > durationFrames) {
    return null;
  }

  const centerX = (x / 100) * width;
  const centerY = (y / 100) * height;
  const maxRadius = (radius / 100) * minDim;
  const particleSize = minDim * 0.02;

  // Create particles evenly distributed around the center
  const particles = Array.from({ length: particleCount }, (_, i) => {
    const angle = (i / particleCount) * Math.PI * 2;
    return { angle, id: i };
  });

  // Spring for smooth expansion
  const expansionProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  // Fade out
  const opacity = interpolate(
    localFrame,
    [0, durationFrames * 0.6, durationFrames],
    [1, 1, 0],
    { extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {/* Central flash */}
      <div
        style={{
          position: 'absolute',
          left: centerX,
          top: centerY,
          width: particleSize * 3,
          height: particleSize * 3,
          borderRadius: '50%',
          background: color,
          opacity: interpolate(localFrame, [0, 15], [1, 0]),
          transform: `translate(-50%, -50%) scale(${interpolate(localFrame, [0, 15], [0.5, 2])})`,
          boxShadow: `0 0 ${particleSize * 4}px ${color}`,
        }}
      />

      {/* Particles */}
      {particles.map((particle) => {
        const particleX = centerX + Math.cos(particle.angle) * maxRadius * expansionProgress;
        const particleY = centerY + Math.sin(particle.angle) * maxRadius * expansionProgress;

        // Scale down as they move out
        const scale = interpolate(expansionProgress, [0, 1], [1, 0.3]);

        return (
          <div
            key={particle.id}
            style={{
              position: 'absolute',
              left: particleX,
              top: particleY,
              width: particleSize,
              height: particleSize,
              borderRadius: '50%',
              background: color,
              opacity,
              transform: `translate(-50%, -50%) scale(${scale})`,
              boxShadow: `0 0 ${particleSize}px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
};

export default Burst;
