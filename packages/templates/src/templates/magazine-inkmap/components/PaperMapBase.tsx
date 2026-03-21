import React from 'react';
import { AbsoluteFill } from 'remotion';
import { PaperTexture } from '../../../magazine/textures';
import { MAGAZINE_COLORS } from '../../../magazine/constants';

/**
 * Cartography-style paper base with faint grid lines over aged paper texture.
 * The grid lines simulate longitude/latitude graticule on a printed map.
 */
export function PaperMapBase({
  opacity = 1,
  gridOpacity = 0.1,
}: {
  opacity?: number;
  gridOpacity?: number;
}) {
  const gridSpacing = 80;
  // Generate vertical and horizontal grid lines
  const verticalLines: React.ReactNode[] = [];
  const horizontalLines: React.ReactNode[] = [];

  // 1080 / 80 = 13.5 → 14 lines max
  for (let x = gridSpacing; x < 1080; x += gridSpacing) {
    verticalLines.push(
      <line
        key={`v-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={1920}
        stroke={MAGAZINE_COLORS.secondary}
        strokeWidth={1}
        opacity={gridOpacity}
      />
    );
  }

  // 1920 / 80 = 24 lines
  for (let y = gridSpacing; y < 1920; y += gridSpacing) {
    horizontalLines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={y}
        x2={1080}
        y2={y}
        stroke={MAGAZINE_COLORS.secondary}
        strokeWidth={1}
        opacity={gridOpacity}
      />
    );
  }

  return (
    <AbsoluteFill style={{ opacity }}>
      <PaperTexture age={0.6} seed="inkmap-paper" />
      <svg
        width={1080}
        height={1920}
        viewBox="0 0 1080 1920"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        {verticalLines}
        {horizontalLines}
      </svg>
    </AbsoluteFill>
  );
}
