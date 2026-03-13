import React from 'react';
import { spring, interpolate, useVideoConfig } from 'remotion';

interface GlowMarkerProps {
  x: number;
  y: number;
  frame: number;
  enterFrame: number;
  neonColor: string;
  glowIntensity: number;
  size?: number;
}

const GlowMarker: React.FC<GlowMarkerProps> = ({
  x,
  y,
  frame,
  enterFrame,
  neonColor,
  glowIntensity,
  size = 12,
}) => {
  const { fps } = useVideoConfig();

  // Spring entrance
  const entranceScale = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const scale = frame >= enterFrame ? entranceScale : 0;

  // Pulsing breathing effect: cycle every 30 frames
  const cycleFrame = frame % 30;
  const pulseOpacity = interpolate(cycleFrame, [0, 15, 30], [0.6, 1.0, 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < enterFrame) return null;

  const glowSpread1 = 20 * glowIntensity;
  const glowSpread2 = 40 * glowIntensity;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: neonColor,
        boxShadow: `0 0 ${glowSpread1}px ${neonColor}, 0 0 ${glowSpread2}px ${neonColor}`,
        transform: `scale(${scale})`,
        opacity: pulseOpacity,
      }}
    />
  );
};

export default GlowMarker;
