import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';

interface GrainOverlayProps {
  intensity?: number;
}

export const GrainOverlay: React.FC<GrainOverlayProps> = ({ intensity = 0.3 }) => {
  const frame = useCurrentFrame();
  const seed = useMemo(() => (Math.floor(frame / 10) % 3) + 1, [frame]);

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
        opacity: intensity,
      }}
    >
      <filter id={`grain-${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={3} seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
    </svg>
  );
};
