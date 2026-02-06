import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from '../constants';

export const Background: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle animated gradient background
  const gradientShift = interpolate(frame, [0, 600], [0, 30], {
    extrapolateRight: 'extend',
  });

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(
            ellipse at ${50 + Math.sin(gradientShift * 0.02) * 10}% ${30 + Math.cos(gradientShift * 0.015) * 10}%,
            ${COLORS.secondary}22 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse at ${50 - Math.sin(gradientShift * 0.018) * 15}% ${70 + Math.cos(gradientShift * 0.02) * 10}%,
            ${COLORS.primary}15 0%,
            transparent 45%
          ),
          ${COLORS.dark}
        `,
      }}
    >
      {/* Subtle floating particles */}
      {Array.from({ length: 20 }).map((_, i) => {
        const baseX = (i * 137.5) % 100;
        const baseY = (i * 73.3) % 100;
        const size = 2 + (i % 3) * 2;
        const speed = 0.3 + (i % 5) * 0.1;
        const yOffset = Math.sin((frame * speed + i * 50) * 0.02) * 20;
        const opacity = interpolate(
          Math.sin((frame * 0.02 + i) * 0.5),
          [-1, 1],
          [0.1, 0.3],
        );

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${baseX}%`,
              top: `calc(${baseY}% + ${yOffset}px)`,
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
    </AbsoluteFill>
  );
};

// Central dividing line that persists throughout
export const CentralDivider: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const frame = useCurrentFrame();

  // Subtle pulse animation
  const glowIntensity = interpolate(
    Math.sin(frame * 0.05),
    [-1, 1],
    [0.3, 0.6],
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 0,
        width: 2,
        height: '100%',
        background: `linear-gradient(
          180deg,
          transparent 0%,
          ${COLORS.primary}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')} 20%,
          ${COLORS.secondary}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')} 50%,
          ${COLORS.accent}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')} 80%,
          transparent 100%
        )`,
        boxShadow: `0 0 20px ${COLORS.primary}${Math.round(glowIntensity * 128).toString(16).padStart(2, '0')}`,
        opacity,
        transform: 'translateX(-50%)',
      }}
    />
  );
};
