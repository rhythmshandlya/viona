import React from 'react';
import { interpolate, spring } from 'remotion';

interface GrowingBubbleProps {
  x: number;
  y: number;
  label: string;
  currentValue: number;
  maxValue: number;
  color: string;
  frame: number;
  enterFrame: number;
  fps: number;
  font: string;
  darkMap?: boolean;
}

const MIN_RADIUS = 15;
const MAX_RADIUS = 80;

const GrowingBubble: React.FC<GrowingBubbleProps> = ({
  x,
  y,
  label,
  currentValue,
  maxValue,
  color,
  frame,
  enterFrame,
  fps,
  font,
  darkMap = false,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  // Spring entrance scale
  const enterScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // Radius proportional to value (normalized against maxValue)
  const normalizedValue = maxValue > 0 ? currentValue / maxValue : 0;
  const targetRadius = interpolate(normalizedValue, [0, 1], [MIN_RADIUS, MAX_RADIUS], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const radius = targetRadius * enterScale;
  const diameter = radius * 2;

  // Label opacity fades in after enter
  const labelOpacity = interpolate(localFrame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
        // Width/height = 0 so children flow outward from the anchor point
      }}
    >
      {/* Bubble: semi-transparent fill */}
      <div
        style={{
          width: diameter,
          height: diameter,
          borderRadius: '50%',
          backgroundColor: color,
          opacity: 0.3,
          border: `2px solid ${color}`,
          position: 'relative',
          boxShadow: `0 0 ${Math.max(4, radius * 0.5)}px ${color}55`,
          flexShrink: 0,
        }}
      />
      {/* Label below the bubble */}
      <div
        style={{
          marginTop: 6,
          opacity: labelOpacity,
          fontFamily: font,
          fontSize: 18,
          fontWeight: 700,
          color: darkMap ? '#FFFFFF' : '#2C3E50',
          textShadow: darkMap
            ? '0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)'
            : '0 1px 4px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.7)',
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

export default GrowingBubble;
