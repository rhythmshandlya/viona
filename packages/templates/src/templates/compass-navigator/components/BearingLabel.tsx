import React from 'react';
import { interpolate } from 'remotion';

interface BearingLabelProps {
  bearingDeg: number;
  frame: number;
  enterFrame: number;
  font: string;
  color: string;
}

/**
 * Displays bearing in degrees with compass direction label (e.g., "72 NE").
 */
const BearingLabel: React.FC<BearingLabelProps> = ({
  bearingDeg,
  frame,
  enterFrame,
  font,
  color,
}) => {
  const opacity = interpolate(frame, [enterFrame, enterFrame + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < enterFrame) return null;

  const normalizedBearing = ((bearingDeg % 360) + 360) % 360;
  const direction = getCompassDirection(normalizedBearing);
  const displayDeg = Math.round(normalizedBearing);

  return (
    <div
      style={{
        opacity,
        fontFamily: font,
        fontSize: 26,
        fontWeight: 600,
        color,
        textAlign: 'center',
        letterSpacing: '0.05em',
        textShadow: '0 1px 3px rgba(0,0,0,0.2)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {displayDeg}&deg; {direction}
    </div>
  );
};

function getCompassDirection(deg: number): string {
  if (deg >= 337.5 || deg < 22.5) return 'N';
  if (deg >= 22.5 && deg < 67.5) return 'NE';
  if (deg >= 67.5 && deg < 112.5) return 'E';
  if (deg >= 112.5 && deg < 157.5) return 'SE';
  if (deg >= 157.5 && deg < 202.5) return 'S';
  if (deg >= 202.5 && deg < 247.5) return 'SW';
  if (deg >= 247.5 && deg < 292.5) return 'W';
  return 'NW';
}

export default BearingLabel;
