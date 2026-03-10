import React from 'react';
import { spring, useVideoConfig } from 'remotion';

interface NumberedMarkerProps {
  x: number;
  y: number;
  frame: number;
  enterFrame: number;
  color: string;
  number: number;
  size?: number;
}

const NumberedMarker: React.FC<NumberedMarkerProps> = ({
  x,
  y,
  frame,
  enterFrame,
  color,
  number: markerNumber,
  size = 28,
}) => {
  const { fps } = useVideoConfig();

  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const borderWidth = Math.max(2, size * 0.1);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          border: `${borderWidth}px solid ${color}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color,
            fontSize: size * 0.48,
            fontWeight: 700,
            lineHeight: 1,
            fontFamily: 'sans-serif',
          }}
        >
          {markerNumber}
        </span>
      </div>
    </div>
  );
};

export default NumberedMarker;
