import React from 'react';
import { AbsoluteFill, random } from 'remotion';

// Deterministic filter IDs — no mutable counter (breaks Remotion SSR/multi-thread rendering).
// Each component receives a `seed` prop for unique but stable IDs.

/**
 * Aged parchment paper texture using SVG feTurbulence.
 * @param age 0-1: 0 = fresh white paper, 1 = heavily aged/yellowed
 * @param opacity overall opacity of the texture layer
 */
export function PaperTexture({ age = 0.5, opacity = 1, seed = 'paper' }: { age?: number; opacity?: number; seed?: string }) {
  const filterId = `magazine-${seed}`;
  // Interpolate base color from fresh cream to aged yellow-brown
  const r = Math.round(245 - age * 30);
  const g = Math.round(240 - age * 40);
  const b = Math.round(232 - age * 60);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      {/* Base paper color */}
      <AbsoluteFill style={{ backgroundColor: `rgb(${r},${g},${b})` }} />
      {/* Fiber grain */}
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={filterId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves={6}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values={`0 0 0 0 ${0.9 - age * 0.15}
                       0 0 0 0 ${0.85 - age * 0.2}
                       0 0 0 0 ${0.78 - age * 0.25}
                       0 0 0 ${0.08 + age * 0.06} 0`}
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </AbsoluteFill>
  );
}

/**
 * Fine newsprint dot-matrix grain overlay.
 * @param seed Deterministic seed for unique SVG filter ID (required for SSR)
 */
export function NewsprintGrain({ opacity = 0.04, seed = 'newsprint' }: { opacity?: number; seed?: string }) {
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
 * Decorative coffee stain watermark.
 */
export function CoffeeStain({
  x, y, size, opacity = 0.08, seed = 0,
}: {
  x: number;
  y: number;
  size: number;
  opacity?: number;
  seed?: number;
}) {
  // Use Remotion's deterministic random for slight position jitter
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
        background: `radial-gradient(ellipse at 40% 45%, rgba(139,105,20,${opacity}) 0%, rgba(139,105,20,${opacity * 0.4}) 50%, transparent 70%)`,
        pointerEvents: 'none',
      }}
    />
  );
}
