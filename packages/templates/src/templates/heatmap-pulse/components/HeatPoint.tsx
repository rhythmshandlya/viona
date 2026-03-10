import React from 'react';
import { spring, interpolate, useVideoConfig } from 'remotion';

type ColorScale = 'warm' | 'cool' | 'green';

interface HeatPointProps {
  x: number;
  y: number;
  value: number;
  maxValue: number;
  label: string;
  colorScale: ColorScale;
  showLabel: boolean;
  frame: number;
  enterFrame: number;
  fps: number;
  font: string;
  darkMap: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getHeatColor(normalizedValue: number, colorScale: ColorScale): string {
  // normalizedValue is 0–1
  const t = Math.max(0, Math.min(1, normalizedValue));

  if (colorScale === 'warm') {
    // low: green(0,200,80) → mid: yellow(255,220,0) → high: red(220,20,20)
    if (t < 0.5) {
      const s = t / 0.5;
      const r = Math.round(lerp(0, 255, s));
      const g = Math.round(lerp(200, 220, s));
      const b = Math.round(lerp(80, 0, s));
      return `rgb(${r},${g},${b})`;
    } else {
      const s = (t - 0.5) / 0.5;
      const r = Math.round(lerp(255, 220, s));
      const g = Math.round(lerp(220, 20, s));
      const b = Math.round(lerp(0, 20, s));
      return `rgb(${r},${g},${b})`;
    }
  } else if (colorScale === 'cool') {
    // low: deep blue(10,30,180) → mid: cyan(0,210,240) → high: white(230,245,255)
    if (t < 0.5) {
      const s = t / 0.5;
      const r = Math.round(lerp(10, 0, s));
      const g = Math.round(lerp(30, 210, s));
      const b = Math.round(lerp(180, 240, s));
      return `rgb(${r},${g},${b})`;
    } else {
      const s = (t - 0.5) / 0.5;
      const r = Math.round(lerp(0, 230, s));
      const g = Math.round(lerp(210, 245, s));
      const b = Math.round(lerp(240, 255, s));
      return `rgb(${r},${g},${b})`;
    }
  } else {
    // green scale: low: green(30,160,50) → mid: yellow(240,200,0) → high: red(210,30,30)
    if (t < 0.5) {
      const s = t / 0.5;
      const r = Math.round(lerp(30, 240, s));
      const g = Math.round(lerp(160, 200, s));
      const b = Math.round(lerp(50, 0, s));
      return `rgb(${r},${g},${b})`;
    } else {
      const s = (t - 0.5) / 0.5;
      const r = Math.round(lerp(240, 210, s));
      const g = Math.round(lerp(200, 30, s));
      const b = Math.round(lerp(0, 30, s));
      return `rgb(${r},${g},${b})`;
    }
  }
}

const HeatPoint: React.FC<HeatPointProps> = ({
  x,
  y,
  value,
  maxValue,
  label,
  colorScale,
  showLabel,
  frame,
  enterFrame,
  fps,
  font,
  darkMap,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;
  const normalizedValue = maxValue > 0 ? value / maxValue : 0;

  // Radius: scale 20–60px based on value
  const radius = 20 + normalizedValue * 40;

  const color = getHeatColor(normalizedValue, colorScale);

  // Spring pop-in
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // Pulse opacity oscillation every 40 frames
  const pulseOpacity = interpolate(
    frame % 40,
    [0, 20, 40],
    [0.3, 0.8, 0.3],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Core opacity fades in
  const coreOpacity = interpolate(localFrame, [0, 15], [0, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const labelColor = darkMap ? '#FFFFFF' : '#1a1a2e';
  const labelBg = darkMap ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.75)';

  const glowSize = radius * 1.5;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        pointerEvents: 'none',
      }}
    >
      {/* Outer glow ring — pulsing */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: glowSize * 2,
          height: glowSize * 2,
          borderRadius: '50%',
          backgroundColor: color,
          transform: 'translate(-50%, -50%)',
          opacity: pulseOpacity * 0.4,
          filter: `blur(${glowSize * 0.5}px)`,
        }}
      />

      {/* Middle glow layer */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: radius * 2.2,
          height: radius * 2.2,
          borderRadius: '50%',
          backgroundColor: color,
          transform: 'translate(-50%, -50%)',
          opacity: pulseOpacity * 0.55,
          filter: `blur(${radius * 0.35}px)`,
        }}
      />

      {/* Core circle */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: radius * 2,
          height: radius * 2,
          borderRadius: '50%',
          backgroundColor: color,
          transform: 'translate(-50%, -50%)',
          opacity: coreOpacity,
          filter: `blur(${radius * 0.15}px)`,
          boxShadow: `0 0 ${radius}px ${radius * 0.5}px ${color}`,
        }}
      />

      {/* Label */}
      {showLabel && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: `${radius + 10}px`,
            transform: 'translateX(-50%)',
            fontFamily: font,
            fontSize: 18,
            fontWeight: 700,
            color: labelColor,
            backgroundColor: labelBg,
            backdropFilter: 'blur(4px)',
            padding: '3px 10px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
            opacity: interpolate(localFrame, [10, 25], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

export default HeatPoint;
