import React from 'react';
import { useCurrentFrame } from 'remotion';

/**
 * Construction paper background texture.
 */
export const ConstructionPaper: React.FC<{
  color?: string;
  opacity?: number;
  seed?: number;
}> = ({ color = '#F1F3F2', opacity = 0.6, seed = 7 }) => (
  <div style={{ position: 'absolute', inset: 0, backgroundColor: color }}>
    <svg width="100%" height="100%" style={{ opacity }}>
      <filter id={`vox-paper-${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="4" seed={seed} />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#vox-paper-${seed})`} />
    </svg>
  </div>
);

/**
 * Halftone dot-matrix newsprint overlay.
 */
export const NewsprintOverlay: React.FC<{
  opacity?: number;
  dotSize?: number;
  seed?: number;
}> = ({ opacity = 0.08, dotSize = 2, seed = 13 }) => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <svg width="100%" height="100%" style={{ opacity }}>
      <filter id={`vox-newsprint-${seed}`}>
        <feTurbulence type="turbulence" baseFrequency={0.1 / dotSize} numOctaves="1" seed={seed} />
        <feComponentTransfer>
          <feFuncA type="discrete" tableValues="0 1" />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#vox-newsprint-${seed})`} />
    </svg>
  </div>
);

/**
 * Frame-aware cycling grain texture — shifts every N frames for organic movement.
 */
export const GrainCycle: React.FC<{
  opacity?: number;
  speed?: number;
}> = ({ opacity = 0.15, speed = 8 }) => {
  const frame = useCurrentFrame();
  const cycleSeed = Math.floor(frame / speed);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ opacity }}>
        <filter id={`vox-cycle-${cycleSeed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" seed={cycleSeed * 7 + 3} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#vox-cycle-${cycleSeed})`} />
      </svg>
    </div>
  );
};
