import React from 'react';

interface RoughEdgeMaskProps {
  filterId?: string;
}

export const RoughEdgeMask: React.FC<RoughEdgeMaskProps> = ({ filterId = 'rough-edge' }) => {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <filter id={filterId} x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={4} seed={42} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={8} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
};
