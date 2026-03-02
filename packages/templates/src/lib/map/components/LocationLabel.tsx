import React from 'react';
import { interpolate } from 'remotion';

interface LocationLabelProps {
  x: number;
  y: number;
  label: string;
  frame: number;
  enterFrame: number;
  font: string;
  color: string;
  viewportWidth: number;
  darkMap?: boolean;
}

const LocationLabel: React.FC<LocationLabelProps> = ({
  x,
  y,
  label,
  frame,
  enterFrame,
  font,
  color,
  viewportWidth,
  darkMap = false,
}) => {
  const opacity = interpolate(frame, [enterFrame, enterFrame + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < enterFrame) return null;

  // Place label on the side with more space
  const isLeftHalf = x < viewportWidth / 2;
  const offsetX = isLeftHalf ? 20 : -20;

  return (
    <div
      style={{
        position: 'absolute',
        left: x + offsetX,
        top: y - 12,
        transform: isLeftHalf ? 'translateY(-50%)' : 'translate(-100%, -50%)',
        opacity,
        fontFamily: font,
        fontSize: 28,
        fontWeight: 700,
        color,
        textShadow: darkMap
          ? '0 1px 4px rgba(0,0,0,0.9), 0 0px 8px rgba(0,0,0,0.7)'
          : '0 1px 4px rgba(255,255,255,0.9), 0 0px 8px rgba(255,255,255,0.7)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {label}
    </div>
  );
};

export default LocationLabel;
