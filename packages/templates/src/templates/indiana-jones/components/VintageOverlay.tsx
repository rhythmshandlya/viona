import React from 'react';

interface VintageOverlayProps {
  width: number;
  height: number;
  opacity?: number;
}

/**
 * Parchment texture overlay with vignette effect.
 * Uses CSS gradients and an SVG feTurbulence filter for subtle noise.
 */
const VintageOverlay: React.FC<VintageOverlayProps> = ({
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
      {/* SVG noise filter for parchment texture */}
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <defs>
          <filter id="parchment-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
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

      {/* Parchment color tint */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(245, 230, 200, 0.15) 0%, rgba(210, 180, 140, 0.25) 100%)',
          filter: 'url(#parchment-noise)',
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 150px rgba(0, 0, 0, 0.3)',
        }}
      />

      {/* Edge darkening */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(139, 90, 43, 0.15) 100%)',
        }}
      />
    </div>
  );
};

export default VintageOverlay;
