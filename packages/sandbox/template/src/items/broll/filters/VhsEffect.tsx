import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface VhsEffectProps {
  intensity?: number;
}

export const VhsEffect: React.FC<VhsEffectProps> = ({ intensity = 0.5 }) => {
  const frame = useCurrentFrame();
  const scanOffset = interpolate(frame % 120, [0, 120], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: intensity }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)`,
          transform: `translateY(${scanOffset % 4}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 2px 0 0 rgba(255,0,0,0.08), inset -2px 0 0 rgba(0,0,255,0.08)',
        }}
      />
    </div>
  );
};
