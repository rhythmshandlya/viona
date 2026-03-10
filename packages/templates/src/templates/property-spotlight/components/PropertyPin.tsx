import React from 'react';
import { spring, interpolate } from 'remotion';

interface PropertyPinProps {
  x: number;
  y: number;
  frame: number;
  enterFrame: number;
  fps: number;
  color: string;
  size?: number;
}

const PropertyPin: React.FC<PropertyPinProps> = ({
  x,
  y,
  frame,
  enterFrame,
  fps,
  color,
  size = 28,
}) => {
  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 22, stiffness: 180, mass: 0.8 },
  });

  const scale = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const outerSize = size * 1.5 * 2; // diameter
  const innerSize = size * 0.6 * 2;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Outer ring */}
      <div
        style={{
          position: 'absolute',
          width: outerSize,
          height: outerSize,
          borderRadius: '50%',
          border: `3px solid ${color}`,
          opacity: 0.5,
        }}
      />
      {/* Middle ring */}
      <div
        style={{
          position: 'absolute',
          width: outerSize * 0.75,
          height: outerSize * 0.75,
          borderRadius: '50%',
          border: `3px solid ${color}`,
          opacity: 0.75,
        }}
      />
      {/* Inner filled dot */}
      <div
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 2px 12px ${color}88`,
        }}
      />
    </div>
  );
};

export default PropertyPin;
