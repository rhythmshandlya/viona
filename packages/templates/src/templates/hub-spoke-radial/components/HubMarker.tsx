import React from 'react';
import { spring, useVideoConfig } from 'remotion';

interface HubMarkerProps {
  x: number;
  y: number;
  frame: number;
  enterFrame: number;
  accentColor: string;
  size: number;
}

const HubMarker: React.FC<HubMarkerProps> = ({
  x,
  y,
  frame,
  enterFrame,
  accentColor,
  size,
}) => {
  const { fps } = useVideoConfig();

  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const markerSize = size * 1.5;
  const outerRingSize = markerSize * 2.2;
  const innerDotSize = markerSize * 0.6;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        pointerEvents: 'none',
      }}
    >
      {/* Outer ring */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: outerRingSize,
          height: outerRingSize,
          borderRadius: '50%',
          border: `3px solid ${accentColor}`,
          transform: 'translate(-50%, -50%)',
          opacity: 0.6,
        }}
      />
      {/* Inner filled circle with border */}
      <div
        style={{
          width: markerSize,
          height: markerSize,
          borderRadius: '50%',
          backgroundColor: accentColor,
          border: `3px solid white`,
          boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Inner dot */}
        <div
          style={{
            width: innerDotSize,
            height: innerDotSize,
            borderRadius: '50%',
            backgroundColor: 'white',
            opacity: 0.9,
          }}
        />
      </div>
    </div>
  );
};

export default HubMarker;
