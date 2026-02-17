import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';

interface LocationMarkerProps {
  x: number;
  y: number;
  frame: number;
  enterFrame: number;
  color: string;
  size: number;
}

const LocationMarker: React.FC<LocationMarkerProps> = ({
  x,
  y,
  frame,
  enterFrame,
  color,
  size,
}) => {
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.8 },
  });

  // Pulse ring animation — expands and fades out over ~30 frames after entrance
  const pulseFrame = frame - enterFrame;
  const pulseScale = interpolate(pulseFrame, [0, 30], [1, 2.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pulseOpacity = interpolate(pulseFrame, [0, 30], [0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      {/* Pulse ring */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size * 2,
          height: size * 2,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          transform: `translate(-50%, -50%) scale(${pulseScale})`,
          opacity: pulseOpacity,
          pointerEvents: 'none',
        }}
      />
      {/* Main marker */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: color,
          border: `${Math.max(2, size * 0.15)}px solid white`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
};

export default LocationMarker;
