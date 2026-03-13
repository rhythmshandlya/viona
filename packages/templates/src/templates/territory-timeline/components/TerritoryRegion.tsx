import React from 'react';
import { interpolate, spring } from 'remotion';

interface TerritoryRegionProps {
  x: number;
  y: number;
  label: string;
  date: string;
  radius?: number;
  showDate: boolean;
  frame: number;
  enterFrame: number;
  fps: number;
  color: string;
  font: string;
  darkMap: boolean;
}

const DEFAULT_RADIUS = 38;

const TerritoryRegion: React.FC<TerritoryRegionProps> = ({
  x,
  y,
  label,
  date,
  radius,
  showDate,
  frame,
  enterFrame,
  fps,
  color,
  font,
  darkMap,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  // Spring scale entrance (SNAPPY config)
  const enterScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 22, stiffness: 180, mass: 0.8 },
  });

  const circleRadius = radius ?? DEFAULT_RADIUS;
  const diameter = circleRadius * 2;

  // Label fades in after the circle pops in
  const labelOpacity = interpolate(localFrame, [8, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Date badge fades in with label
  const badgeOpacity = interpolate(localFrame, [5, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const textShadow = darkMap
    ? '0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)'
    : '0 1px 4px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.7)';

  const textColor = darkMap ? '#FFFFFF' : '#2C3E50';

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Date badge above the circle */}
      {showDate && (
        <div
          style={{
            opacity: badgeOpacity,
            marginBottom: 6,
            backgroundColor: color,
            borderRadius: 20,
            paddingTop: 3,
            paddingBottom: 3,
            paddingLeft: 10,
            paddingRight: 10,
            fontFamily: font,
            fontSize: 14,
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: 0.5,
            whiteSpace: 'nowrap',
            boxShadow: `0 2px 8px ${color}66`,
            transform: `scale(${enterScale})`,
            transformOrigin: 'center bottom',
          }}
        >
          {date}
        </div>
      )}

      {/* Territory circle: semi-transparent fill with solid border */}
      <div
        style={{
          width: diameter * enterScale,
          height: diameter * enterScale,
          borderRadius: '50%',
          backgroundColor: color,
          opacity: 0.25,
          border: `2px solid ${color}`,
          position: 'relative',
          boxShadow: `0 0 ${Math.max(6, circleRadius * 0.4)}px ${color}55`,
          flexShrink: 0,
        }}
      />

      {/* Solid border ring on top for visibility */}
      <div
        style={{
          position: 'absolute',
          width: diameter * enterScale,
          height: diameter * enterScale,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          transform: `scale(1)`,
          pointerEvents: 'none',
        }}
      />

      {/* Label below the circle */}
      <div
        style={{
          marginTop: 8,
          opacity: labelOpacity,
          fontFamily: font,
          fontSize: 18,
          fontWeight: 700,
          color: textColor,
          textShadow,
          whiteSpace: 'nowrap',
          textAlign: 'center',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default TerritoryRegion;
