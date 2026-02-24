import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { FollowerMilestoneProps } from './schema';

// ── DotGrid SVG background ─────────────────────────────────────────────
const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="fm-dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#fm-dot-grid)" />
    </svg>
  );
};

// ── Format number with commas ───────────────────────────────────────────
function formatWithCommas(n: number): string {
  return n.toLocaleString('en-US');
}

// ── Seeded pseudo-random for deterministic particles ────────────────────
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ── Particle type ───────────────────────────────────────────────────────
interface Particle {
  id: number;
  startX: number;
  startY: number;
  velocityX: number;
  velocityY: number;
  size: number;
  color: string;
  shape: 'circle' | 'square';
  rotation: number;
  rotationSpeed: number;
  delay: number;
}

// ── Generate confetti particles ─────────────────────────────────────────
function generateParticles(accentColor: string): Particle[] {
  const count = 36;
  const colors = [
    accentColor,
    '#FBBF24', // amber
    '#34D399', // emerald
    '#60A5FA', // blue
    '#F472B6', // pink
    '#A78BFA', // violet
    '#FB923C', // orange
  ];

  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const seed = i;
    const angle = seededRandom(seed * 1) * Math.PI * 2;
    const speed = 3 + seededRandom(seed * 2) * 6;

    particles.push({
      id: i,
      startX: 540 + (seededRandom(seed * 3) - 0.5) * 100,
      startY: 500 + (seededRandom(seed * 4) - 0.5) * 60,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - 3,
      size: 6 + seededRandom(seed * 5) * 14,
      color: colors[Math.floor(seededRandom(seed * 6) * colors.length)],
      shape: seededRandom(seed * 7) > 0.5 ? 'circle' : 'square',
      rotation: seededRandom(seed * 8) * 360,
      rotationSpeed: (seededRandom(seed * 9) - 0.5) * 12,
      delay: Math.floor(seededRandom(seed * 10) * 15),
    });
  }

  return particles;
}

// ── Confetti component ──────────────────────────────────────────────────
const ConfettiParticles: React.FC<{
  particles: Particle[];
  frame: number;
  burstFrame: number;
  width: number;
  height: number;
}> = ({ particles, frame, burstFrame, width, height }) => {
  if (frame < burstFrame) return null;

  const elapsed = frame - burstFrame;

  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {particles.map((p) => {
        const particleElapsed = Math.max(0, elapsed - p.delay);
        if (particleElapsed <= 0) return null;

        const t = particleElapsed;
        const gravity = 0.15;
        const x = p.startX + p.velocityX * t;
        const y = p.startY + p.velocityY * t + 0.5 * gravity * t * t;
        const rot = p.rotation + p.rotationSpeed * t;

        // Fade out towards end
        const opacity = interpolate(
          frame,
          [burstFrame, burstFrame + 40, burstFrame + 60, burstFrame + 70],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        // Skip if out of view
        if (x < -20 || x > 1100 || y < -20 || y > 1100) return null;

        if (p.shape === 'circle') {
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={p.size / 2}
              fill={p.color}
              opacity={opacity}
            />
          );
        }

        return (
          <rect
            key={p.id}
            x={x - p.size / 2}
            y={y - p.size / 2}
            width={p.size}
            height={p.size}
            fill={p.color}
            opacity={opacity}
            transform={`rotate(${rot} ${x} ${y})`}
          />
        );
      })}
    </svg>
  );
};

// ── Main component ──────────────────────────────────────────────────────
const FollowerMilestone: React.FC<FollowerMilestoneProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const particles = React.useMemo(
    () => generateParticles(props.accentColor),
    [props.accentColor]
  );

  // ── Background fade in (0-15) ───────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // ── Brand name fade in (10-25) ──────────────────────────────────────
  const brandOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const brandSlideY = interpolate(frame, [10, 25], [-20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // ── Number count-up (20-180) ────────────────────────────────────────
  const countProgress = interpolate(frame, [20, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const currentValue = Math.round(props.milestone * countProgress);
  const displayNumber = `${props.prefix}${formatWithCommas(currentValue)}${props.suffix}`;

  // ── Scale pulse when milestone reached (180-200) ────────────────────
  const pulseScale = interpolate(
    frame,
    [180, 190, 200],
    [1.0, 1.15, 1.0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }
  );

  // ── Accent glow behind number (appears at milestone) ────────────────
  const glowOpacity = interpolate(
    frame,
    [170, 185, 200, 320],
    [0, 0.8, 0.5, 0.3],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // ── Label fade in (200-220) ─────────────────────────────────────────
  const labelOpacity = interpolate(frame, [200, 220], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelSlideY = interpolate(frame, [200, 220], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // ── Fade out (320-360) ──────────────────────────────────────────────
  const fadeOut = interpolate(frame, [320, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* DotGrid background */}
      <DotGrid color={theme.gridColor} />

      {/* Celebratory accent glow behind number */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: s(500),
          height: s(500),
          borderRadius: '50%',
          background: `radial-gradient(circle, ${props.accentColor}40 0%, transparent 70%)`,
          opacity: glowOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Brand name at top */}
      <div
        style={{
          position: 'absolute',
          top: s(180),
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: brandOpacity,
          transform: `translateY(${brandSlideY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: s(28),
            fontWeight: 500,
            letterSpacing: s(4),
            color: theme.textMuted,
            textTransform: 'uppercase',
          }}
        >
          {props.brandName}
        </span>
      </div>

      {/* Large number */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(130),
            fontWeight: 900,
            color: theme.text,
            lineHeight: 1.1,
            letterSpacing: s(-2),
            transform: `scale(${pulseScale})`,
            textShadow:
              glowOpacity > 0.1
                ? `0 0 40px ${props.accentColor}60, 0 0 80px ${props.accentColor}30`
                : 'none',
          }}
        >
          {displayNumber}
        </span>

        {/* Label below */}
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: s(36),
            fontWeight: 600,
            letterSpacing: s(8),
            color: props.accentColor,
            textTransform: 'uppercase',
            marginTop: s(20),
            opacity: labelOpacity,
            transform: `translateY(${labelSlideY}px)`,
          }}
        >
          {props.label}
        </span>
      </div>

      {/* Confetti particles burst */}
      <ConfettiParticles
        particles={particles}
        frame={frame}
        burstFrame={180}
        width={width}
        height={height}
      />
    </AbsoluteFill>
  );
};

export default FollowerMilestone;
