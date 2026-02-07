import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS, SPRING_CONFIG, KEY_SYNCS } from '../constants';
import { GearIcon, NetworkNodeIcon } from '../components/Icons';

interface Scene1Props {
  startFrame?: number;
}

// Rotating gear component for background
const RotatingGear: React.FC<{
  x: number;
  y: number;
  size: number;
  speed: number;
  delay: number;
  opacity: number;
}> = ({ x, y, size, speed, delay, opacity }) => {
  const frame = useCurrentFrame();
  const rotation = (frame + delay) * speed;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `rotate(${rotation}deg)`,
        opacity,
      }}
    >
      <GearIcon size={size} color={COLORS.secondary} />
    </div>
  );
};

// Network node with connections
const NetworkParticle: React.FC<{
  index: number;
}> = ({ index }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Create flowing motion
  const baseX = (index * 97) % width;
  const speed = 1 + (index % 3) * 0.5;
  const yPosition = ((frame * speed + index * 150) % (height + 100)) - 50;

  const opacity = interpolate(
    yPosition,
    [0, height * 0.3, height * 0.7, height],
    [0, 0.6, 0.6, 0],
    { extrapolateRight: 'clamp' }
  );

  const size = 12 + (index % 4) * 4;
  const xOffset = interpolate(
    (frame + index * 20) % 60,
    [0, 30, 60],
    [-10, 10, -10],
    { extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: baseX + xOffset,
        top: yPosition,
        opacity,
      }}
    >
      <NetworkNodeIcon size={size} color={COLORS.primary} />
    </div>
  );
};

// Challenge box with neon glow
const ChallengeBox: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Main scale animation
  const scaleProgress = spring({
    frame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 120 },
  });

  // Impact pulse at key sync frame 43
  const impactPulse = interpolate(
    frame,
    [KEY_SYNCS.challenge - 3, KEY_SYNCS.challenge, KEY_SYNCS.challenge + 10],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Glow intensity animation
  const glowIntensity = interpolate(
    frame,
    [0, 20, KEY_SYNCS.challenge, 60],
    [0, 0.5, 1, 0.7],
    { extrapolateRight: 'clamp' }
  );

  const boxWidth = 60; // percentage

  return (
    <div
      style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: `translateX(-50%) scale(${scaleProgress * (1 + impactPulse * 0.08)})`,
        width: `${boxWidth}%`,
        padding: '40px 30px',
        background: `linear-gradient(135deg, ${COLORS.dark}ee, ${COLORS.secondary}33)`,
        backdropFilter: 'blur(20px)',
        border: `3px solid ${COLORS.primary}`,
        borderRadius: 20,
        boxShadow: `
          0 0 ${20 + impactPulse * 40}px ${COLORS.primary}${Math.round(glowIntensity * 99).toString().padStart(2, '0')},
          0 0 ${40 + impactPulse * 60}px ${COLORS.primary}55,
          inset 0 0 30px ${COLORS.primary}22
        `,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      {/* Decorative corner elements */}
      <div
        style={{
          position: 'absolute',
          top: -2,
          left: -2,
          width: 40,
          height: 40,
          borderTop: `4px solid ${COLORS.accent}`,
          borderLeft: `4px solid ${COLORS.accent}`,
          borderRadius: '20px 0 0 0',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -2,
          right: -2,
          width: 40,
          height: 40,
          borderTop: `4px solid ${COLORS.accent}`,
          borderRight: `4px solid ${COLORS.accent}`,
          borderRadius: '0 20px 0 0',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -2,
          left: -2,
          width: 40,
          height: 40,
          borderBottom: `4px solid ${COLORS.accent}`,
          borderLeft: `4px solid ${COLORS.accent}`,
          borderRadius: '0 0 0 20px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 40,
          height: 40,
          borderBottom: `4px solid ${COLORS.accent}`,
          borderRight: `4px solid ${COLORS.accent}`,
          borderRadius: '0 0 20px 0',
        }}
      />

      {/* Title text */}
      <div
        style={{
          fontSize: 56,
          fontWeight: 900,
          fontFamily: 'system-ui, sans-serif',
          color: COLORS.white,
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: 4,
          textShadow: `
            0 0 10px ${COLORS.primary},
            0 0 20px ${COLORS.primary}88
          `,
        }}
      >
        System Design
      </div>
      <div
        style={{
          fontSize: 72,
          fontWeight: 900,
          fontFamily: 'system-ui, sans-serif',
          color: COLORS.primary,
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: 6,
          textShadow: `
            0 0 15px ${COLORS.primary},
            0 0 30px ${COLORS.primary}88,
            0 0 45px ${COLORS.primary}44
          `,
        }}
      >
        Challenge
      </div>
    </div>
  );
};

export const Scene1: React.FC<Scene1Props> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  useVideoConfig(); // For consistency with other scenes

  // Fade in the entire scene
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      {/* Rotating gears in background */}
      <RotatingGear key="gear1" x={80} y={200} size={80} speed={0.5} delay={0} opacity={0.15} />
      <RotatingGear key="gear2" x={920} y={350} size={60} speed={-0.3} delay={20} opacity={0.12} />
      <RotatingGear key="gear3" x={150} y={1400} size={100} speed={0.4} delay={40} opacity={0.1} />
      <RotatingGear key="gear4" x={850} y={1200} size={70} speed={-0.6} delay={60} opacity={0.15} />
      <RotatingGear key="gear5" x={500} y={1600} size={90} speed={0.35} delay={80} opacity={0.08} />

      {/* Network particles flowing */}
      {Array.from({ length: 15 }).map((_, i) => (
        <NetworkParticle key={`net-${i}`} index={i} />
      ))}

      {/* Main challenge box */}
      <ChallengeBox />

      {/* Subtitle text */}
      <div
        style={{
          position: 'absolute',
          bottom: '25%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 28,
          fontWeight: 500,
          fontFamily: 'system-ui, sans-serif',
          color: COLORS.gray,
          textAlign: 'center',
          opacity: interpolate(frame, [30, 50], [0, 0.8], { extrapolateRight: 'clamp' }),
        }}
      >
        How do you handle millions of connections?
      </div>
    </AbsoluteFill>
  );
};

export default Scene1;
