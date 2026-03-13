import React from 'react';
import { interpolate } from 'remotion';
import { lngToPixelX } from '../../../lib/map';
import type { Viewport } from '../../../lib/map';

interface ZoneLabelProps {
  viewport: Viewport;
  width: number;
  frame: number;
  enterFrame: number;
  font: string;
}

/**
 * Renders UTC offset labels at the top of each visible timezone band.
 * Labels are centered within each 15-degree longitude band.
 */
const ZoneLabel: React.FC<ZoneLabelProps> = ({
  viewport,
  width,
  frame,
  enterFrame,
  font,
}) => {
  const opacity = interpolate(frame, [enterFrame, enterFrame + 30], [0, 0.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < enterFrame) return null;

  const { zoom, offsetX } = viewport;

  const labels: React.ReactNode[] = [];

  for (let lngStart = -180; lngStart < 180; lngStart += 15) {
    const lngEnd = lngStart + 15;
    const lngMid = lngStart + 7.5;

    const screenLeft = lngToPixelX(lngStart, zoom) + offsetX;
    const screenRight = lngToPixelX(lngEnd, zoom) + offsetX;
    const screenMid = (screenLeft + screenRight) / 2;

    // Skip labels outside the viewport
    if (screenRight < -100 || screenLeft > width + 100) continue;

    // Compute UTC offset: UTC-12 at lng -180, UTC+12 at lng +180
    const utcOffset = Math.round(lngMid / 15);
    const sign = utcOffset >= 0 ? '+' : '';
    const label = `UTC${sign}${utcOffset}`;

    labels.push(
      <div
        key={lngStart}
        style={{
          position: 'absolute',
          left: screenMid,
          top: 18,
          transform: 'translateX(-50%)',
          fontFamily: font,
          fontSize: 13,
          fontWeight: 500,
          color: 'rgba(0,0,0,0.45)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
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
      {labels}
    </div>
  );
};

export default ZoneLabel;
