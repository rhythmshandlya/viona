import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import type { DepthContextShiftProps } from './schema';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

function lerpColors(colors: string[], progress: number): string {
  if (colors.length < 2) return '0, 0, 0';
  const segmentCount = colors.length - 1;
  const segment = Math.min(Math.floor(progress * segmentCount), segmentCount - 1);
  const segmentProgress = (progress * segmentCount) - segment;
  const from = hexToRgb(colors[segment]);
  const to = hexToRgb(colors[segment + 1]);
  const r = Math.round(from.r + (to.r - from.r) * segmentProgress);
  const g = Math.round(from.g + (to.g - from.g) * segmentProgress);
  const b = Math.round(from.b + (to.b - from.b) * segmentProgress);
  return `${r}, ${g}, ${b}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function noiseFilter(seed: number): string {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' seed='${seed}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E")`;
}

const DepthContextShift: React.FC<DepthContextShiftProps> = ({
  colors, direction, opacity, speakerBbox, speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const totalFrames = 150;
  const { centerPx } = computeSpeakerPx(speakerBbox, speakerCenter, CANVAS_W, CANVAS_H);

  const colorProgress = interpolate(frame, [0, totalFrames], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const currentColorRgb = lerpColors(colors, colorProgress);

  const entranceOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });

  let gradientStyle: React.CSSProperties;
  if (direction === 'horizontal') {
    const sweepProgress = interpolate(frame, [0, totalFrames], [0, 100], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    gradientStyle = {
      background: `linear-gradient(90deg, rgba(${currentColorRgb}, ${opacity}) ${sweepProgress - 30}%, rgba(${currentColorRgb}, ${opacity * 0.6}) ${sweepProgress}%, rgba(${currentColorRgb}, ${opacity * 0.2}) ${sweepProgress + 40}%)`,
    };
  } else {
    const breathe = interpolate(frame, [0, totalFrames], [40, 90], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    const cxPct = ((centerPx.x / CANVAS_W) * 100).toFixed(1);
    const cyPct = ((centerPx.y / CANVAS_H) * 100).toFixed(1);
    gradientStyle = {
      background: `radial-gradient(ellipse ${breathe}% ${breathe * 1.2}% at ${cxPct}% ${cyPct}%, rgba(${currentColorRgb}, ${opacity}) 0%, rgba(${currentColorRgb}, ${opacity * 0.4}) 50%, transparent 100%)`,
    };
  }

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H, opacity: entranceOpacity, willChange: 'opacity', ...gradientStyle }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H, backgroundImage: noiseFilter(42), backgroundSize: '300px 300px', opacity: entranceOpacity * 0.5, mixBlendMode: 'overlay', pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

export default DepthContextShift;
