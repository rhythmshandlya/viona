import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { WarmIntroProps } from './schema';

/* ------------------------------------------------------------------ */
/*  Soft floating orb - the key visual element                        */
/* ------------------------------------------------------------------ */
interface OrbConfig {
  size: number;
  x: number;
  y: number;
  color: 'primary' | 'secondary';
  delay: number;
  driftX: number;
  driftY: number;
  driftSpeed: number;
}

const ORBS: OrbConfig[] = [
  // Large background orbs - subtle, atmospheric
  { size: 280, x: -80, y: -60, color: 'secondary', delay: 0, driftX: 12, driftY: 8, driftSpeed: 0.004 },
  { size: 220, x: 920, y: 180, color: 'secondary', delay: 5, driftX: -10, driftY: 14, driftSpeed: 0.005 },
  { size: 180, x: 100, y: 800, color: 'secondary', delay: 8, driftX: 16, driftY: -10, driftSpeed: 0.004 },
  { size: 200, x: 850, y: 720, color: 'secondary', delay: 12, driftX: -8, driftY: 12, driftSpeed: 0.006 },

  // Medium accent orbs - warmer, more present
  { size: 90, x: 180, y: 280, color: 'primary', delay: 15, driftX: 20, driftY: 15, driftSpeed: 0.008 },
  { size: 70, x: 780, y: 400, color: 'primary', delay: 20, driftX: -18, driftY: 12, driftSpeed: 0.007 },
  { size: 60, x: 320, y: 680, color: 'primary', delay: 25, driftX: 14, driftY: -16, driftSpeed: 0.009 },
  { size: 80, x: 700, y: 620, color: 'primary', delay: 18, driftX: -12, driftY: 18, driftSpeed: 0.006 },

  // Small detail orbs - subtle touches
  { size: 40, x: 450, y: 200, color: 'secondary', delay: 30, driftX: 10, driftY: 8, driftSpeed: 0.01 },
  { size: 35, x: 600, y: 750, color: 'primary', delay: 35, driftX: -8, driftY: 10, driftSpeed: 0.011 },
  { size: 45, x: 150, y: 500, color: 'secondary', delay: 28, driftX: 12, driftY: -6, driftSpeed: 0.009 },
];

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
const WarmIntro: React.FC<WarmIntroProps> = (props) => {
  const { FONTS, SPRING_CONFIG } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  // Gentle fade in - slow, welcoming
  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  // Soft fade out
  const fadeOut = interpolate(frame, [durationInFrames - 45, durationInFrames - 5], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });

  // Title animation - gentle rise
  const titleProgress = spring({
    frame: frame - 40,
    fps,
    config: SPRING_CONFIG,
  });

  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = interpolate(frame, [40, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Subtitle - follows gently
  const subtitleProgress = spring({
    frame: frame - 60,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 70 },
  });

  const subtitleY = interpolate(subtitleProgress, [0, 1], [30, 0]);
  const subtitleOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Accent line - subtle underline
  const lineWidth = interpolate(frame, [80, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: fadeIn * fadeOut }}>

      {/* Floating orbs - soft, atmospheric */}
      {ORBS.map((orb, i) => {
        // Gentle scale in
        const orbScale = interpolate(
          frame,
          [orb.delay, orb.delay + 40],
          [0.3, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
        );

        // Full opacity - solid circles, not translucent
        const orbOpacity = interpolate(
          frame,
          [orb.delay, orb.delay + 30],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        ) * fadeOut;

        // Soft, slow drift - breathing motion
        const driftX = Math.sin(frame * orb.driftSpeed) * orb.driftX;
        const driftY = Math.cos(frame * orb.driftSpeed * 0.8 + i) * orb.driftY;

        const orbColor = orb.color === 'primary' ? props.accentColor : props.colors.secondary;

        // Shadow scales with circle size - soft, diffused, paper-cutout style
        const shadowBlur = s(orb.size * 0.25);
        const shadowOffsetY = s(orb.size * 0.06);

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s(orb.x) + driftX - s(orb.size) / 2,
              top: s(orb.y) + driftY - s(orb.size) / 2,
              width: s(orb.size),
              height: s(orb.size),
              borderRadius: '50%',
              // Flat solid color - no gradient, matte finish
              backgroundColor: orbColor,
              opacity: orbOpacity,
              transform: `scale(${orbScale})`,
              // Soft diffused drop shadow - paper cutout floating effect
              boxShadow: `0 ${shadowOffsetY}px ${shadowBlur}px rgba(0, 0, 0, 0.12)`,
            }}
          />
        );
      })}

      {/* Center content - breathing room, not cramped */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: s(80),
        }}
      >
        {/* Title - warm, inviting */}
        <h1
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(64),
            fontWeight: 600,
            color: theme.text,
            letterSpacing: s(-1),
            textAlign: 'center',
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {props.title}
        </h1>

        {/* Accent line - subtle warmth */}
        <div
          style={{
            width: s(60),
            height: s(3),
            backgroundColor: props.accentColor,
            borderRadius: s(2),
            marginTop: s(24),
            marginBottom: s(24),
            transform: `scaleX(${lineWidth})`,
            opacity: titleOpacity,
          }}
        />

        {/* Subtitle - softer, supporting */}
        <p
          style={{
            fontFamily: FONTS.body,
            fontSize: s(22),
            fontWeight: 400,
            color: theme.textMuted,
            letterSpacing: s(0.5),
            textAlign: 'center',
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
            margin: 0,
            maxWidth: s(500),
            lineHeight: 1.5,
          }}
        >
          {props.subtitle}
        </p>
      </div>
    </AbsoluteFill>
  );
};

export default WarmIntro;
