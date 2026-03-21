import React from 'react';
import { AbsoluteFill, random } from 'remotion';

// Deterministic filter IDs — no mutable counter (breaks Remotion SSR/multi-thread rendering).
// Each component receives a `seed` prop for unique but stable IDs.

// ── TornEdge ────────────────────────────────────────────────────────────────

type Edge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Generates a CSS polygon clip-path with torn (jagged) edges.
 * Uses Remotion's deterministic `random()` for reproducible results.
 *
 * @param edges Which edges to tear (untorn edges are straight)
 * @param roughness 0-1, controls max offset of torn points (in px: roughness * 15)
 * @param seed Deterministic seed for random()
 * @param width Container width in px (explicit — no DOM measurement)
 * @param height Container height in px (explicit — no DOM measurement)
 */
export function generateTornClipPath(
  edges: Edge[],
  roughness: number,
  seed: number,
  width: number,
  height: number,
): string {
  const pointsPerEdge = 20;
  const maxOffset = roughness * 15;
  const tornSet = new Set(edges);
  const points: string[] = [];

  // Top edge (left to right)
  for (let i = 0; i <= pointsPerEdge; i++) {
    const x = (i / pointsPerEdge) * width;
    const y = tornSet.has('top')
      ? random(`torn-top-${seed}-${i}`) * maxOffset
      : 0;
    points.push(`${x},${y}`);
  }
  // Right edge (top to bottom)
  for (let i = 1; i <= pointsPerEdge; i++) {
    const y = (i / pointsPerEdge) * height;
    const x = tornSet.has('right')
      ? width - random(`torn-right-${seed}-${i}`) * maxOffset
      : width;
    points.push(`${x},${y}`);
  }
  // Bottom edge (right to left)
  for (let i = pointsPerEdge; i >= 0; i--) {
    const x = (i / pointsPerEdge) * width;
    const y = tornSet.has('bottom')
      ? height - random(`torn-bottom-${seed}-${i}`) * maxOffset
      : height;
    points.push(`${x},${y}`);
  }
  // Left edge (bottom to top)
  for (let i = pointsPerEdge - 1; i >= 1; i--) {
    const y = (i / pointsPerEdge) * height;
    const x = tornSet.has('left')
      ? random(`torn-left-${seed}-${i}`) * maxOffset
      : 0;
    points.push(`${x},${y}`);
  }

  return `polygon(${points.map((p) => {
    const [x, y] = p.split(',');
    return `${(parseFloat(x) / width) * 100}% ${(parseFloat(y) / height) * 100}%`;
  }).join(', ')})`;
}

/**
 * Wraps children in a container with a torn-paper clip-path.
 * Uses explicit width/height props — no useRef/useEffect DOM measurement (breaks SSR).
 * Default 1080x1920 matches 9:16 overlay viewport.
 */
export function TornEdge({
  edges = ['top', 'bottom'],
  roughness = 0.6,
  seed = 42,
  width = 1080,
  height = 1920,
  children,
}: {
  edges?: Edge[];
  roughness?: number;
  seed?: number;
  width?: number;
  height?: number;
  children: React.ReactNode;
}) {
  const clipPath = React.useMemo(
    () => generateTornClipPath(edges, roughness, seed, width, height),
    [edges, roughness, seed, width, height],
  );

  return (
    <div style={{ clipPath, width: '100%', height: '100%' }}>
      {children}
    </div>
  );
}

// ── FoldShadow ──────────────────────────────────────────────────────────────

/**
 * CSS gradient simulating a paper fold crease shadow.
 */
export function FoldShadow({
  angle = 90,
  position = 0.5,
  depth = 0.3,
}: {
  angle?: number;
  position?: number;
  depth?: number;
}) {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `linear-gradient(${angle}deg,
          transparent ${(position - 0.02) * 100}%,
          rgba(0,0,0,${depth}) ${position * 100}%,
          transparent ${(position + 0.02) * 100}%
        )`,
      }}
    />
  );
}

// ── BurnEdge ────────────────────────────────────────────────────────────────

/**
 * Dark vignette with irregular edge for an aged/burned paper look.
 * @param seed Deterministic seed for unique SVG filter ID (required for SSR)
 */
export function BurnEdge({
  intensity = 0.4,
  opacity = 1,
  seed = 'burn',
}: {
  intensity?: number;
  opacity?: number;
  seed?: string;
}) {
  const filterId = `magazine-${seed}`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={filterId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves={3} />
            <feColorMatrix type="matrix"
              values={`0 0 0 0 0
                       0 0 0 0 0
                       0 0 0 0 0
                       0 0 0 ${intensity} 0`}
            />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <radialGradient id={`${filterId}-grad`} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="transparent" />
            <stop offset="100%" stopColor={`rgba(30,15,5,${intensity})`} />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${filterId}-grad)`} />
      </svg>
    </AbsoluteFill>
  );
}

// ── InkBleed ────────────────────────────────────────────────────────────────

/**
 * SVG filter definition for ink absorption/bleed effect on text.
 * Renders an invisible <svg> with the filter. Apply via style={{ filter: `url(#${id})` }}.
 * Returns the filter ID string.
 */
export function InkBleedFilter({ id }: { id: string }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id={id}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 1.8 -0.3"
          />
        </filter>
      </defs>
    </svg>
  );
}
