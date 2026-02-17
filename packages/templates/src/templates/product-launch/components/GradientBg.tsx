import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

interface GradientBgProps {
  colors: string[];
  angle?: number;
}

const GradientBg: React.FC<GradientBgProps> = ({ colors, angle = 135 }) => {
  const frame = useCurrentFrame();

  const backgroundPositionY = interpolate(frame, [0, 300], [0, 30], {
    extrapolateRight: 'clamp',
  });

  const backgroundPositionX = interpolate(frame, [0, 300], [0, 15], {
    extrapolateRight: 'clamp',
  });

  const gradient = `linear-gradient(${angle}deg, ${colors.join(', ')})`;

  return (
    <AbsoluteFill
      style={{
        background: gradient,
        backgroundSize: '200% 200%',
        backgroundPosition: `${50 + backgroundPositionX}% ${50 + backgroundPositionY}%`,
      }}
    />
  );
};

export default GradientBg;
