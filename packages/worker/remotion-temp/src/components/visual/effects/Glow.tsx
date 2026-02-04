import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

interface GlowProps {
  /** Glow color */
  color?: string;
  /** Intensity multiplier (default: 1) */
  intensity?: number;
  /** Pulse animation (default: true) */
  pulse?: boolean;
  /** Pulse speed (default: 1) */
  pulseSpeed?: number;
  /** Glow radius as percentage of container */
  radius?: number;
  /** Children to wrap with glow */
  children: React.ReactNode;
}

/**
 * Glow - Adds animated glow effect to any element
 *
 * Wraps children with a pulsing glow effect.
 *
 * @example
 * <Glow color="#8b5cf6" intensity={1.5} pulse>
 *   <Icon />
 * </Glow>
 */
export const Glow: React.FC<GlowProps> = ({
  color = '#8b5cf6',
  intensity = 1,
  pulse = true,
  pulseSpeed = 1,
  radius = 50,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulse animation
  const cycleFrames = (fps * 2) / pulseSpeed;
  const pulseProgress = (frame % cycleFrames) / cycleFrames;
  const pulseFactor = pulse
    ? 1 + Math.sin(pulseProgress * Math.PI * 2) * 0.2
    : 1;

  const glowIntensity = intensity * pulseFactor;

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {/* Glow layer */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${radius * 2}%`,
          height: `${radius * 2}%`,
          background: `radial-gradient(circle, ${color}${Math.round(40 * glowIntensity).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
      {children}
    </div>
  );
};

export default Glow;
