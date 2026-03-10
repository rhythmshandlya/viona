import React from 'react';
import { spring, useVideoConfig } from 'remotion';
import type { ElevationPoint } from '../schema';

interface StatsBadgeProps {
  data: ElevationPoint[];
  unit: 'meters' | 'feet';
  frame: number;
  enterFrame: number;
  font: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
}

function computeStats(data: ElevationPoint[]): { totalAscent: number; totalDescent: number } {
  let totalAscent = 0;
  let totalDescent = 0;

  for (let i = 1; i < data.length; i++) {
    const diff = data[i].altitude - data[i - 1].altitude;
    if (diff > 0) totalAscent += diff;
    else totalDescent += Math.abs(diff);
  }

  return { totalAscent: Math.round(totalAscent), totalDescent: Math.round(totalDescent) };
}

const StatsBadge: React.FC<StatsBadgeProps> = ({
  data,
  unit,
  frame,
  enterFrame,
  font,
  bgColor,
  textColor,
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

  const { totalAscent, totalDescent } = computeStats(data);
  const unitLabel = unit === 'meters' ? 'm' : 'ft';

  return (
    <div
      style={{
        position: 'absolute',
        right: 40,
        bottom: 30,
        transform: `scale(${scale})`,
        transformOrigin: 'bottom right',
        backgroundColor: bgColor,
        borderRadius: 12,
        padding: '14px 20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        border: `2px solid ${accentColor}`,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 18,
          fontWeight: 700,
          color: '#27AE60',
          whiteSpace: 'nowrap',
        }}
      >
        &#8593; {totalAscent.toLocaleString()} {unitLabel}
      </div>
      <div
        style={{
          fontFamily: font,
          fontSize: 18,
          fontWeight: 700,
          color: '#E74C3C',
          whiteSpace: 'nowrap',
        }}
      >
        &#8595; {totalDescent.toLocaleString()} {unitLabel}
      </div>
    </div>
  );
};

export default StatsBadge;
