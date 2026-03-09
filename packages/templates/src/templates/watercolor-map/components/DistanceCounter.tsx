import React from 'react';
import { interpolate } from 'remotion';

interface DistanceCounterProps {
  totalKm: number;
  progress: number;
  frame: number;
  enterFrame: number;
  font: string;
  color: string;
  darkMap?: boolean;
}

const DistanceCounter: React.FC<DistanceCounterProps> = ({
  totalKm,
  progress,
  frame,
  enterFrame,
  font,
  color,
  darkMap = false,
}) => {
  const opacity = interpolate(frame, [enterFrame, enterFrame + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < enterFrame) return null;

  const currentKm = Math.round(totalKm * progress);
  const formatted = currentKm.toLocaleString('en-US');

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        opacity,
        fontFamily: font,
        fontSize: 24,
        fontWeight: 600,
        color,
        textShadow: darkMap
          ? '0 1px 4px rgba(0,0,0,0.9)'
          : '0 1px 4px rgba(255,255,255,0.9)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {formatted} km
    </div>
  );
};

export default DistanceCounter;
