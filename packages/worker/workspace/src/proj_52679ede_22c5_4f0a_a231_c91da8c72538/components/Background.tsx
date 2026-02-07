import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS } from '../constants';

// Animated background with flowing particles and subtle grid
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {/* Radial gradient overlay */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse at 50% 30%, ${COLORS.secondary}22 0%, transparent 60%)`,
        }}
      />

      {/* Subtle animated grid lines */}
      <svg
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: 0.08,
        }}
      >
        {/* Vertical lines */}
        {Array.from({ length: 12 }).map((_, i) => {
          const x = (width / 12) * (i + 0.5);
          const yOffset = (frame * 0.5 + i * 20) % 60 - 30;
          return (
            <line
              key={`v-${i}`}
              x1={x}
              y1={0}
              x2={x}
              y2={height}
              stroke={COLORS.primary}
              strokeWidth={1}
              strokeDasharray="4 8"
              transform={`translate(0, ${yOffset})`}
            />
          );
        })}
        {/* Horizontal lines */}
        {Array.from({ length: 20 }).map((_, i) => {
          const y = (height / 20) * (i + 0.5);
          const xOffset = (frame * 0.3 + i * 15) % 40 - 20;
          return (
            <line
              key={`h-${i}`}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={COLORS.secondary}
              strokeWidth={1}
              strokeDasharray="2 12"
              transform={`translate(${xOffset}, 0)`}
            />
          );
        })}
      </svg>

      {/* Floating ambient particles */}
      {Array.from({ length: 20 }).map((_, i) => {
        const baseX = (i * 137.5) % width;
        const baseY = (i * 89.3) % height;
        const floatX = interpolate(
          (frame + i * 30) % 180,
          [0, 90, 180],
          [0, 20, 0],
          { extrapolateRight: 'clamp' }
        );
        const floatY = interpolate(
          (frame + i * 45) % 240,
          [0, 120, 240],
          [0, -30, 0],
          { extrapolateRight: 'clamp' }
        );
        const opacity = interpolate(
          (frame + i * 20) % 120,
          [0, 60, 120],
          [0.1, 0.4, 0.1],
          { extrapolateRight: 'clamp' }
        );
        const size = 3 + (i % 4) * 2;

        return (
          <div
            key={`particle-${i}`}
            style={{
              position: 'absolute',
              left: baseX + floatX,
              top: baseY + floatY,
              width: size,
              height: size,
              borderRadius: '50%',
              background: i % 2 === 0 ? COLORS.primary : COLORS.secondary,
              opacity,
              boxShadow: `0 0 ${size * 2}px ${i % 2 === 0 ? COLORS.primary : COLORS.secondary}`,
            }}
          />
        );
      })}

      {/* Vignette effect */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse at center, transparent 40%, ${COLORS.dark}dd 100%)`,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export default Background;
