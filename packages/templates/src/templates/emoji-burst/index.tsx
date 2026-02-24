import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { EmojiBurstProps } from './schema';

/* -- Seeded pseudo-random number generator -------------------------------- */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* -- Particle type -------------------------------------------------------- */

interface Particle {
  emoji: string;
  startFrame: number;
  x: number;
  speed: number;
  scale: number;
  wobblePhase: number;
  wobbleAmplitude: number;
  rotation: number;
}

/* -- Generate particles --------------------------------------------------- */

function generateParticles(
  emojis: string[],
  particleCount: number,
  seed: number
): Particle[] {
  const rand = seededRandom(seed);
  const particles: Particle[] = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      emoji: emojis[Math.floor(rand() * emojis.length)],
      startFrame: 20 + Math.floor(rand() * 260),
      x: 60 + rand() * 960,
      speed: 60 + Math.floor(rand() * 61),
      scale: 0.8 + rand() * 0.7,
      wobblePhase: rand() * Math.PI * 2,
      wobbleAmplitude: 15 + rand() * 35,
      rotation: -20 + rand() * 40,
    });
  }

  return particles;
}

/* -- Dot-grid background -------------------------------------------------- */

const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern
          id="emoji-burst-dot-grid"
          width={s(32)}
          height={s(32)}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#emoji-burst-dot-grid)" />
    </svg>
  );
};

/* -- Main component ------------------------------------------------------- */

const EmojiBurst: React.FC<EmojiBurstProps> = (props) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];
  const { COLORS } = getConstants(props);

  // Generate particles deterministically
  const particles = React.useMemo(
    () => generateParticles(props.emojis, props.particleCount, 42),
    [props.emojis, props.particleCount]
  );

  // Background fade in (0-15)
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Fade out (330-360)
  const outroOpacity = interpolate(
    frame,
    [330, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * outroOpacity,
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* Subtle radial glow from accent */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 80%, ${COLORS.accent}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Emoji particles */}
      {particles.map((particle, i) => {
        const localFrame = frame - particle.startFrame;

        // Skip if particle hasn't started yet or has finished its journey
        if (localFrame < 0 || localFrame > particle.speed) {
          return null;
        }

        // Progress from 0 to 1 over the particle's lifetime
        const progress = localFrame / particle.speed;

        // Y position: bottom to top with easeOut
        const y = interpolate(progress, [0, 1], [height, s(-80)], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Horizontal wobble using sin wave
        const wobbleX =
          Math.sin(progress * Math.PI * 3 + particle.wobblePhase) *
          particle.wobbleAmplitude;

        // Opacity: fade in at bottom (first 15%), full in middle, fade out at top (last 20%)
        const opacity = interpolate(
          progress,
          [0, 0.15, 0.8, 1],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        // Slight rotation animation
        const currentRotation =
          particle.rotation + Math.sin(progress * Math.PI * 2) * 10;

        // Scale with a slight pulse at start
        const scaleMultiplier = interpolate(
          progress,
          [0, 0.1, 0.2, 1],
          [0.3, 1.15, 1, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: s(particle.x) + s(wobbleX),
              top: y,
              fontSize: s(64) * particle.scale * scaleMultiplier,
              opacity,
              transform: `rotate(${currentRotation}deg)`,
              transformOrigin: 'center center',
              pointerEvents: 'none',
              lineHeight: 1,
              willChange: 'transform, opacity',
            }}
          >
            {particle.emoji}
          </span>
        );
      })}
    </AbsoluteFill>
  );
};

export default EmojiBurst;
