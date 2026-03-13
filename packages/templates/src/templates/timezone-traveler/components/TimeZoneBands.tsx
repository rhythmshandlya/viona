import React from 'react';
import { interpolate } from 'remotion';
import { lngToPixelX } from '../../../lib/map';
import type { Viewport } from '../../../lib/map';

interface TimeZoneBandsProps {
  viewport: Viewport;
  width: number;
  height: number;
  frame: number;
  enterFrame: number;
}

/**
 * Renders vertical semi-transparent timezone bands at each 15-degree longitude
 * interval (360 / 24 = 15 degrees per timezone). Alternating tints for
 * visual distinction.
 */
const TimeZoneBands: React.FC<TimeZoneBandsProps> = ({
  viewport,
  width,
  height,
  frame,
  enterFrame,
}) => {
  const opacity = interpolate(frame, [enterFrame, enterFrame + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < enterFrame) return null;

  // Determine the visible longitude range from the viewport
  // Reverse of lngToPixelX: given screenX, what lng does it correspond to?
  // screenX = lngToPixelX(lng, zoom) + offsetX
  // so worldPixelX = screenX - offsetX
  // lngToPixelX(lng, zoom) = ((lng+180)/360) * 2^zoom * 256
  // so lng = (worldPixelX / (2^zoom * 256)) * 360 - 180
  const { zoom, offsetX } = viewport;
  const totalPixels = Math.pow(2, zoom) * 256;

  // Build bands for every 15-degree interval
  const bands: React.ReactNode[] = [];

  for (let lngStart = -180; lngStart < 180; lngStart += 15) {
    const lngEnd = lngStart + 15;

    const screenLeft = lngToPixelX(lngStart, zoom) + offsetX;
    const screenRight = lngToPixelX(lngEnd, zoom) + offsetX;

    // Skip bands entirely outside the viewport (with some margin)
    if (screenRight < -200 || screenLeft > width + 200) continue;

    const zoneIndex = Math.floor((lngStart + 180) / 15);
    const isEven = zoneIndex % 2 === 0;

    bands.push(
      <div
        key={lngStart}
        style={{
          position: 'absolute',
          left: screenLeft,
          top: 0,
          width: screenRight - screenLeft,
          height,
          backgroundColor: isEven ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.07)',
          pointerEvents: 'none',
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        pointerEvents: 'none',
      }}
    >
      {bands}
    </div>
  );
};

export default TimeZoneBands;
