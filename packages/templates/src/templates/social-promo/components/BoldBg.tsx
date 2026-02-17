import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

interface BoldBgProps {
  color: string;
  gradientTo?: string;
}

const BoldBg: React.FC<BoldBgProps> = ({ color, gradientTo }) => {
  const frame = useCurrentFrame();

  // Subtle grain/noise overlay opacity pulse
  const grainOpacity = interpolate(
    frame % 60,
    [0, 30, 60],
    [0.03, 0.06, 0.03],
    {
      extrapolateRight: 'clamp',
    }
  );

  const background = gradientTo
    ? `linear-gradient(160deg, ${color} 0%, ${gradientTo} 100%)`
    : color;

  return (
    <AbsoluteFill
      style={{
        background,
      }}
    >
      {/* Subtle animated noise/grain texture overlay */}
      <AbsoluteFill
        style={{
          opacity: grainOpacity,
          backgroundImage: `repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)`,
          backgroundSize: '4px 4px',
          mixBlendMode: 'overlay',
        }}
      />
    </AbsoluteFill>
  );
};

export default BoldBg;
