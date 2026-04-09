import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import { CREAM_PAPER_BASE64 } from './paper-texture-data';

// Deterministic filter IDs — no mutable counter (breaks Remotion SSR/multi-thread rendering).
// Each component receives a `seed` prop for unique but stable IDs.

/**
 * Full-screen editorial background for stacked/fullscreen magazine scenes.
 * Cool white base matching magazine theme (#ffffff bg, #0f172a text),
 * with subtle paper texture, fine grain, and light vignette.
 */
export function MagazineBackground({ seed = 'mag-bg' }: { seed?: string }) {
  const fiberId = `${seed}-fiber`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Layer 1: Clean white base */}
      <AbsoluteFill style={{ backgroundColor: '#f8fafc' }} />

      {/* Layer 2: Tileable paper texture (desaturated, very subtle) */}
      <AbsoluteFill style={{
        backgroundImage: `url(${CREAM_PAPER_BASE64})`,
        backgroundRepeat: 'repeat',
        backgroundSize: '300px 300px',
        opacity: 0.25,
        filter: 'saturate(0) brightness(1.1)',
      }} />

      {/* Layer 3: Fine grain (cool-neutral, breaks tiling) */}
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={fiberId} x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves={3} seed={7} stitchTiles="stitch" result="fiber" />
            <feColorMatrix in="fiber" type="matrix"
              values="0 0 0 0 0.95
                      0 0 0 0 0.96
                      0 0 0 0 0.97
                      0 0 0 0.03 0"
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${fiberId})`} />
      </svg>

      {/* Layer 4: Cool edge vignette */}
      <AbsoluteFill style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(15,23,42,0.06) 100%)',
      }} />

      {/* Layer 5: Faint editorial grid lines (slate-toned) */}
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, opacity: 0.03 }}>
        <defs>
          <pattern id={`${seed}-grid`} width="60" height="60" patternUnits="userSpaceOnUse">
            <line x1="0" y1="60" x2="60" y2="60" stroke="#64748b" strokeWidth="0.5" />
            <line x1="60" y1="0" x2="60" y2="60" stroke="#64748b" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${seed}-grid)`} />
      </svg>
    </AbsoluteFill>
  );
}

/**
 * Clean paper texture using subtle SVG feTurbulence.
 * @param age 0-1: 0 = pure white, 1 = slightly warm off-white (never yellowed)
 * @param opacity overall opacity of the texture layer
 */
export function PaperTexture({ age = 0.1, opacity = 1, seed = 'paper' }: { age?: number; opacity?: number; seed?: string }) {
  const filterId = `magazine-${seed}`;
  // Clean white to barely warm — no yellow/brown shift
  const r = Math.round(255 - age * 7);
  const g = Math.round(255 - age * 6);
  const b = Math.round(255 - age * 4);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      {/* Base paper color */}
      <AbsoluteFill style={{ backgroundColor: `rgb(${r},${g},${b})` }} />
      {/* Very subtle fiber grain */}
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={filterId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.5"
              numOctaves={3}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values={`0 0 0 0 0.94
                       0 0 0 0 0.93
                       0 0 0 0 0.92
                       0 0 0 ${0.03 + age * 0.02} 0`}
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
}

/**
 * Fine newsprint dot-matrix grain overlay — very subtle for modern look.
 * @param seed Deterministic seed for unique SVG filter ID (required for SSR)
 */
export function NewsprintGrain({ opacity = 0.02, seed = 'newsprint' }: { opacity?: number; seed?: string }) {
  const filterId = `magazine-${seed}`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={filterId}>
            <feTurbulence type="turbulence" baseFrequency="1.2" numOctaves={2} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
}

/**
 * Decorative coffee stain watermark — extremely faint for modern aesthetic.
 */
export function CoffeeStain({
  x, y, size, opacity = 0.03, seed = 0,
}: {
  x: number;
  y: number;
  size: number;
  opacity?: number;
  seed?: number;
}) {
  const jitterX = random(`coffee-x-${seed}`) * 10 - 5;
  const jitterY = random(`coffee-y-${seed}`) * 10 - 5;

  return (
    <div
      style={{
        position: 'absolute',
        left: x + jitterX - size / 2,
        top: y + jitterY - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(ellipse at 40% 45%, rgba(148,163,184,${opacity}) 0%, rgba(148,163,184,${opacity * 0.3}) 50%, transparent 70%)`,
        pointerEvents: 'none',
      }}
    />
  );
}
