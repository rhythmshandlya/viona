import React from 'react';
import { spring, interpolate } from 'remotion';

interface CenterMarkerProps {
  x: number;
  y: number;
  frame: number;
  enterFrame: number;
  fps: number;
  color: string;
}

const CenterMarker: React.FC<CenterMarkerProps> = ({
  x,
  y,
  frame,
  enterFrame,
  fps,
  color,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  // Spring entrance for inner dot + label
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // Pulsing ring: expands from 1x to 2.4x and fades out, looping every 60 frames
  const pulseFrame = localFrame % 60;
  const pulseScale = interpolate(pulseFrame, [0, 60], [1, 2.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pulseOpacity = interpolate(pulseFrame, [0, 50, 60], [0.8, 0, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const INNER_SIZE = 16;
  const RING_SIZE = 28;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
        pointerEvents: 'none',
      }}
    >
      {/* Pulsing outer ring */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: '50%',
          border: `2.5px solid ${color}`,
          transform: `translate(-50%, -50%) scale(${pulseScale})`,
          opacity: pulseOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Outer white ring */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: INNER_SIZE + 6,
          height: INNER_SIZE + 6,
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Inner solid dot */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: INNER_SIZE,
          height: INNER_SIZE,
          borderRadius: '50%',
          backgroundColor: color,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* "You are here" label */}
      <div
        style={{
          position: 'absolute',
          top: INNER_SIZE + 8,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: color,
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'sans-serif',
          padding: '2px 7px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
        }}
      >
        You Are Here
      </div>
    </div>
  );
};

export default CenterMarker;
