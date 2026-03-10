import React from 'react';
import { spring, useVideoConfig } from 'remotion';

interface AltitudeLabelProps {
  /** X position on the chart SVG (px) */
  x: number;
  /** Y position on the chart SVG (px) */
  y: number;
  /** Altitude value to display */
  altitude: number;
  /** Unit label */
  unit: 'meters' | 'feet';
  /** Current frame */
  frame: number;
  /** Frame at which this label should appear */
  enterFrame: number;
  /** Font family */
  font: string;
  /** Accent color for the badge background */
  accentColor: string;
}

const AltitudeLabel: React.FC<AltitudeLabelProps> = ({
  x,
  y,
  altitude,
  unit,
  frame,
  enterFrame,
  font,
  accentColor,
}) => {
  const { fps } = useVideoConfig();

  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const unitLabel = unit === 'meters' ? 'm' : 'ft';
  const text = `${altitude.toLocaleString()} ${unitLabel}`;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -100%) scale(${scale})`,
        transformOrigin: 'center bottom',
        pointerEvents: 'none',
      }}
    >
      {/* Connector line */}
      <div
        style={{
          width: 2,
          height: 12,
          backgroundColor: accentColor,
          margin: '0 auto',
          opacity: 0.6,
        }}
      />
      {/* Badge */}
      <div
        style={{
          backgroundColor: accentColor,
          color: '#FFFFFF',
          fontFamily: font,
          fontSize: 16,
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          marginTop: -2,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default AltitudeLabel;
