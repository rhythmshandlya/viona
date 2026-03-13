import React from 'react';
import { spring, useVideoConfig } from 'remotion';

interface NeonLabelProps {
  x: number;
  y: number;
  label: string;
  frame: number;
  enterFrame: number;
  neonColor: string;
  glowIntensity: number;
  font: string;
}

const NeonLabel: React.FC<NeonLabelProps> = ({
  x,
  y,
  label,
  frame,
  enterFrame,
  neonColor,
  glowIntensity,
  font,
}) => {
  const { fps } = useVideoConfig();

  const entranceProgress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const opacity = frame >= enterFrame ? entranceProgress : 0;

  if (frame < enterFrame) return null;

  const glow10 = 10 * glowIntensity;
  const glow20 = 20 * glowIntensity;
  const glow40 = 40 * glowIntensity;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + 20,
        transform: 'translateX(-50%)',
        opacity,
        fontFamily: font,
        fontSize: 18,
        fontWeight: 700,
        color: '#FFFFFF',
        textShadow: `0 0 ${glow10}px ${neonColor}, 0 0 ${glow20}px ${neonColor}, 0 0 ${glow40}px ${neonColor}`,
        whiteSpace: 'nowrap',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  );
};

export default NeonLabel;
