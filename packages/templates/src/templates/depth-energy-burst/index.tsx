import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import type { DepthEnergyBurstProps } from './schema';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

/** Maximum ray length — long enough to reach canvas corners from center */
const MAX_RAY_LENGTH = Math.sqrt(CANVAS_W * CANVAS_W + CANVAS_H * CANVAS_H) / 2;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

const DepthEnergyBurst: React.FC<DepthEnergyBurstProps> = ({
  rayCount,
  color,
  intensity,
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();

  const { centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );

  const rgb = hexToRgb(color);

  // --- Build ray data ---
  const rays = Array.from({ length: rayCount }, (_, i) => {
    const angle = (i / rayCount) * Math.PI * 2;
    // Stagger each ray by a few frames
    const staggerDelay = (i / rayCount) * 15;
    const rayStart = 5 + staggerDelay;
    const rayGrowDuration = 25;

    // Ray grows from 0 to full length
    const rayLength = interpolate(
      frame,
      [rayStart, rayStart + rayGrowDuration],
      [0, MAX_RAY_LENGTH],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      },
    );

    // Ray fades in
    const rayOpacity = interpolate(
      frame,
      [rayStart, rayStart + 10],
      [0, intensity],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );

    // Subtle pulse after entrance
    const pulseActive = frame > rayStart + rayGrowDuration + 10;
    const pulse = pulseActive
      ? 1 + Math.sin(frame * 0.06 + i * 0.8) * 0.08
      : 1;

    return { angle, rayLength, rayOpacity, pulse };
  });

  // --- Optional center glow ---
  const glowOpacity = interpolate(
    frame,
    [3, 15],
    [0, intensity * 0.6],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const glowScale = interpolate(
    frame,
    [3, 25],
    [0.3, 1.0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.ease),
    },
  );
  // Glow breathing
  const glowBreathe = frame > 30
    ? 1 + Math.sin(frame * 0.04) * 0.06
    : 1;

  // --- Optional expanding ring ---
  const ringStart = 15;
  const ringDuration = 40;
  const ringScale = interpolate(
    frame,
    [ringStart, ringStart + ringDuration],
    [0.2, 2.5],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );
  const ringOpacity = interpolate(
    frame,
    [ringStart, ringStart + 10, ringStart + ringDuration - 5, ringStart + ringDuration],
    [0, intensity * 0.4, intensity * 0.4, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const cx = centerPx.x;
  const cy = centerPx.y;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Center glow */}
      <div
        style={{
          position: 'absolute',
          left: cx,
          top: cy,
          width: 400,
          height: 400,
          transform: `translate(-50%, -50%) scale(${glowScale * glowBreathe})`,
          transformOrigin: 'center center',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${rgb.r},${rgb.g},${rgb.b},${glowOpacity}) 0%, transparent 70%)`,
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      />

      {/* Expanding ring */}
      <div
        style={{
          position: 'absolute',
          left: cx,
          top: cy,
          width: 300,
          height: 300,
          transform: `translate(-50%, -50%) scale(${ringScale})`,
          transformOrigin: 'center center',
          borderRadius: '50%',
          border: `2px solid rgba(${rgb.r},${rgb.g},${rgb.b},${ringOpacity})`,
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      />

      {/* Rays */}
      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        {rays.map((ray, i) => {
          const endX = cx + Math.cos(ray.angle) * ray.rayLength * ray.pulse;
          const endY = cy + Math.sin(ray.angle) * ray.rayLength * ray.pulse;

          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={endX}
              y2={endY}
              stroke={`rgba(${rgb.r},${rgb.g},${rgb.b},${ray.rayOpacity})`}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export default DepthEnergyBurst;
