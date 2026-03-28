import React from 'react';
import { random } from 'remotion';

/**
 * Small pushpin/tack mark decoration.
 * Pure CSS — a 10px circle with subtle shadow. Red or brass color.
 */
export function PinMark({
  x,
  y,
  seed,
}: {
  x: number;
  y: number;
  seed: number;
}) {
  const isBrass = random(`pin-color-${seed}`) > 0.5;
  const color = isBrass ? '#B8860B' : '#C0392B';
  const highlight = isBrass ? '#DAA520' : '#E74C3C';

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 5,
        top: y - 5,
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${highlight}, ${color})`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        zIndex: 11,
      }}
    />
  );
}
