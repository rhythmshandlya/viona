import React from 'react';

interface RetroOverlayProps {
  width: number;
  height: number;
  opacity?: number;
}

/**
 * Retro Americana overlay with film grain, warm tint, and vignette.
 * Higher-frequency noise than the indiana-jones parchment for a filmic look.
 */
const RetroOverlay: React.FC<RetroOverlayProps> = ({
  width,
  height,
  opacity = 1,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        opacity,
      }}
    >
      {/* SVG noise filter for film grain */}
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <defs>
          <filter id="retro-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves={3}
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="noise"
              result="grayNoise"
            />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" />
          </filter>
        </defs>
      </svg>

      {/* Warm color tint */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(232, 114, 42, 0.08) 0%, rgba(61, 43, 31, 0.15) 100%)',
          filter: 'url(#retro-grain)',
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 180px rgba(61, 43, 31, 0.3)',
        }}
      />

      {/* Edge darkening */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(61, 43, 31, 0.15) 100%)',
        }}
      />
    </div>
  );
};

export default RetroOverlay;
