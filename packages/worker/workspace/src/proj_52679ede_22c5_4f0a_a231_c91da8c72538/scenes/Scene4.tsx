import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS, SPRING_CONFIG } from '../constants';
import { CheckCircleIcon } from '../components/Icons';

interface Scene4Props {
  startFrame?: number;
}

// Dissolving particle from the chaos
const DissolveParticle: React.FC<{
  index: number;
  centerX: number;
  centerY: number;
}> = ({ index, centerX, centerY }) => {
  const frame = useCurrentFrame();

  // Particles fly outward and fade
  const angle = (index / 30) * Math.PI * 2;
  const speed = 8 + (index % 5) * 2;
  const distance = frame * speed;

  const x = centerX + distance * Math.cos(angle);
  const y = centerY + distance * Math.sin(angle);

  const opacity = interpolate(frame, [0, 5, 30], [0, 1, 0], { extrapolateRight: 'clamp' });
  const size = interpolate(frame, [0, 30], [15, 5], { extrapolateRight: 'clamp' });

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: index % 2 === 0 ? COLORS.accent : COLORS.secondary,
        opacity,
        boxShadow: `0 0 ${size}px ${index % 2 === 0 ? COLORS.accent : COLORS.secondary}`,
      }}
    />
  );
};

// The timing wheel with 60 slots
const TimingWheel: React.FC<{
  size: number;
  rotation: number;
  scale: number;
  glowIntensity: number;
}> = ({ size, rotation, scale, glowIntensity }) => {
  const slotCount = 60;
  const outerRadius = size / 2;
  const innerRadius = outerRadius * 0.75;
  const tickLength = outerRadius - innerRadius - 10;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '40%',
        transform: `translate(-50%, -50%) scale(${scale}) rotateZ(${rotation}deg)`,
        width: size,
        height: size,
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
    >
      {/* Outer glow ring */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: `4px solid ${COLORS.primary}`,
          boxShadow: `
            0 0 ${20 + glowIntensity * 40}px ${COLORS.primary}aa,
            0 0 ${40 + glowIntensity * 60}px ${COLORS.primary}55,
            inset 0 0 ${30 + glowIntensity * 30}px ${COLORS.primary}33
          `,
          background: `radial-gradient(circle at center, ${COLORS.dark}ee, ${COLORS.secondary}22)`,
        }}
      />

      {/* Inner circle */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: innerRadius * 2,
          height: innerRadius * 2,
          borderRadius: '50%',
          border: `2px solid ${COLORS.primary}66`,
          background: `radial-gradient(circle at center, ${COLORS.dark}, ${COLORS.secondary}11)`,
        }}
      />

      {/* 60 slot ticks */}
      <svg
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
        }}
        viewBox={`0 0 ${size} ${size}`}
      >
        {Array.from({ length: slotCount }).map((_, i) => {
          const angle = (i / slotCount) * 360 - 90;
          const radians = (angle * Math.PI) / 180;
          const isMajor = i % 5 === 0;
          const tickStart = outerRadius - 8;
          const tickEnd = tickStart - (isMajor ? tickLength : tickLength * 0.5);

          const x1 = outerRadius + tickStart * Math.cos(radians);
          const y1 = outerRadius + tickStart * Math.sin(radians);
          const x2 = outerRadius + tickEnd * Math.cos(radians);
          const y2 = outerRadius + tickEnd * Math.sin(radians);

          return (
            <line
              key={`tick-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={COLORS.primary}
              strokeWidth={isMajor ? 3 : 1.5}
              opacity={isMajor ? 1 : 0.6}
            />
          );
        })}
      </svg>

      {/* Center hub */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: COLORS.primary,
          boxShadow: `0 0 20px ${COLORS.primary}`,
        }}
      />

      {/* Clock hand (second hand style) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 4,
          height: innerRadius * 0.8,
          background: `linear-gradient(to top, ${COLORS.primary}, ${COLORS.success})`,
          borderRadius: 2,
          transformOrigin: 'bottom center',
          transform: 'translateX(-50%) translateY(-100%)',
          boxShadow: `0 0 10px ${COLORS.primary}`,
        }}
      />
    </div>
  );
};

// Success indicator
const SuccessIndicator: React.FC<{ appear: number }> = ({ appear }) => {
  if (appear <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '18%',
        left: '50%',
        transform: `translateX(-50%) scale(${appear})`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 32px',
        background: `${COLORS.dark}ee`,
        border: `2px solid ${COLORS.success}`,
        borderRadius: 16,
        boxShadow: `0 0 30px ${COLORS.success}44`,
      }}
    >
      <CheckCircleIcon size={40} color={COLORS.success} />
      <span
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: COLORS.success,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        O(1) Insertion!
      </span>
    </div>
  );
};

export const Scene4: React.FC<Scene4Props> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const centerX = width / 2;
  const centerY = height * 0.4;

  // Wheel emergence animation
  const wheelScale = spring({
    frame: frame - 15,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 80 },
  });

  // Rotation animation
  const rotation = interpolate(frame, [15, 100], [0, 30], { extrapolateRight: 'clamp' });

  // Glow pulse at key sync (frame 26)
  const glowIntensity = interpolate(
    frame,
    [20, 26, 40, 60],
    [0.3, 1, 0.7, 0.5],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Success indicator appearance
  const successAppear = spring({
    frame: frame - 35,
    fps,
    config: SPRING_CONFIG,
  });

  // Flash at emergence
  const flashOpacity = interpolate(
    frame,
    [22, 26, 35],
    [0, 0.3, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill>
      {/* Cyan flash at emergence */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: COLORS.primary,
          opacity: flashOpacity,
          pointerEvents: 'none',
          zIndex: 50,
        }}
      />

      {/* Dissolving particles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <DissolveParticle
          key={`dissolve-${i}`}
          index={i}
          centerX={centerX}
          centerY={centerY}
        />
      ))}

      {/* The timing wheel */}
      <TimingWheel
        size={500}
        rotation={rotation}
        scale={Math.max(0, wheelScale)}
        glowIntensity={glowIntensity}
      />

      {/* Success indicator */}
      <SuccessIndicator appear={Math.max(0, successAppear)} />

      {/* Title text */}
      <div
        style={{
          position: 'absolute',
          bottom: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 48,
          fontWeight: 800,
          color: COLORS.primary,
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          textShadow: `0 0 20px ${COLORS.primary}88`,
          opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        TIMING WHEEL
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 28,
          fontWeight: 500,
          color: COLORS.gray,
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          opacity: interpolate(frame, [55, 75], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        No sorting. Just placement.
      </div>
    </AbsoluteFill>
  );
};

export default Scene4;
