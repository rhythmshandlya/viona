import React from 'react';
import { spring, interpolate } from 'remotion';

interface CenterMarkerProps {
  x: number;
  y: number;
  frame: number;
  enterFrame: number;
  fps: number;
  color: string;
  label: string;
  font: string;
}

const CenterMarker: React.FC<CenterMarkerProps> = ({
  x,
  y,
  frame,
  enterFrame,
  fps,
  color,
  label,
  font,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  // Spring pop-in
  const popSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 22, stiffness: 180, mass: 0.8 },
  });

  const scale = interpolate(popSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Pulsing outer ring every 80 frames
  const pulseFrame = localFrame % 80;
  const pulseScale = interpolate(pulseFrame, [0, 80], [1, 2.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pulseOpacity = interpolate(pulseFrame, [0, 50, 80], [0.7, 0, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const OUTER_RING = 36;
  const INNER_DOT = 16;
  const LABEL_OFFSET = 28;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
        opacity,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {/* Pulse ring */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: OUTER_RING,
          height: OUTER_RING,
          borderRadius: '50%',
          border: `2px solid ${color}`,
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
          width: OUTER_RING,
          height: OUTER_RING,
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          boxShadow: `0 0 0 3px ${color}, 0 4px 16px rgba(0,0,0,0.35)`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Inner filled circle */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: INNER_DOT,
          height: INNER_DOT,
          borderRadius: '50%',
          backgroundColor: color,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* HQ label */}
      <div
        style={{
          position: 'absolute',
          top: LABEL_OFFSET,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: color,
          color: '#FFFFFF',
          fontFamily: font,
          fontSize: 13,
          fontWeight: 800,
          padding: '3px 10px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          letterSpacing: 0.5,
          pointerEvents: 'none',
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default CenterMarker;
