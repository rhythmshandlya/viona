import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface CityMarkerProps {
  x: number;
  y: number;
  label: string;
  enterFrame: number;
  color: string;
  fontFamily: string;
}

const CityMarker: React.FC<CityMarkerProps> = ({
  x,
  y,
  label,
  enterFrame,
  color,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - enterFrame;

  const dropY = spring({
    frame: Math.max(0, localFrame),
    fps,
    config: {
      damping: 12,
      stiffness: 180,
      mass: 0.8,
    },
  });

  const labelOpacity = interpolate(localFrame, [8, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < enterFrame) return null;

  const dotSize = 14;
  const offsetY = interpolate(dropY, [0, 1], [-200, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) translateY(${offsetY}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Pin dot */}
      <div
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: color,
          border: '3px solid white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          flexShrink: 0,
        }}
      />
      {/* Label */}
      <span
        style={{
          fontFamily,
          fontWeight: 500,
          fontSize: 24,
          color: 'white',
          textShadow: '0 1px 6px rgba(0,0,0,0.7), 0 0px 3px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap',
          opacity: labelOpacity,
        }}
      >
        {label}
      </span>
    </div>
  );
};

export default CityMarker;
