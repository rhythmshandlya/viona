import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

interface CleanBgProps {
  background: string;
  accent: string;
}

export const CleanBg: React.FC<CleanBgProps> = ({ background, accent }) => {
  const frame = useCurrentFrame();

  const accentLineWidth = interpolate(frame, [0, 30], [0, 100], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: background,
      }}
    >
      {/* Subtle gradient overlay */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 70% 20%, ${accent}08 0%, transparent 60%)`,
        }}
      />

      {/* Top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${accentLineWidth}%`,
          height: 4,
          background: `linear-gradient(90deg, ${accent}, ${accent}00)`,
        }}
      />

      {/* Bottom accent line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: `${accentLineWidth}%`,
          height: 2,
          background: `linear-gradient(270deg, ${accent}40, ${accent}00)`,
        }}
      />
    </AbsoluteFill>
  );
};
