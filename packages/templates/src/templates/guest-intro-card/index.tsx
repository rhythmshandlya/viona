import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { getConstants } from './constants';
import type { GuestIntroCardProps } from './schema';

/* ── Helper: extract initials from a name ──────────────────────── */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/* ── DotGrid SVG background ────────────────────────────────────── */
const DotGrid: React.FC<{ color: string; opacity: number }> = ({
  color,
  opacity,
}) => {
  const dots: React.ReactNode[] = [];
  const spacing = 30;
  const cols = Math.ceil(1080 / spacing);
  const rows = Math.ceil(1080 / spacing);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={c * spacing + spacing / 2}
          cy={r * spacing + spacing / 2}
          r={1.5}
          fill={color}
        />
      );
    }
  }

  return (
    <svg
      width={1080}
      height={1080}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        opacity,
      }}
    >
      {dots}
    </svg>
  );
};

/* ── Main component ────────────────────────────────────────────── */
const GuestIntroCard: React.FC<GuestIntroCardProps> = (props) => {
  const { COLORS, FONTS, SPRING_CONFIG } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const initials = getInitials(props.guestName);

  /* ── Background fade in (0-15) ─────────────────────────────── */
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  /* ── Card slide in from right (20-45, spring) ──────────────── */
  const cardSlideIn = spring({
    frame: frame - 20,
    fps,
    config: SPRING_CONFIG,
  });
  const cardTranslateX = interpolate(cardSlideIn, [0, 1], [600, 0]);

  /* ── Card slide out right (300-330) ────────────────────────── */
  const cardSlideOut = interpolate(frame, [300, 330], [0, 700], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cardX = frame < 300 ? cardTranslateX : cardSlideOut;

  /* ── Avatar scale in with bounce (35-50) ───────────────────── */
  const avatarScale = spring({
    frame: frame - 35,
    fps,
    config: {
      damping: 12,
      stiffness: 150,
      mass: 0.6,
    },
  });

  /* ── Name appears (45-60) ──────────────────────────────────── */
  const nameOpacity = interpolate(frame, [45, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const nameTranslateY = interpolate(frame, [45, 60], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ── Title fades in (55-70) ────────────────────────────────── */
  const titleOpacity = interpolate(frame, [55, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleTranslateY = interpolate(frame, [55, 70], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ── Bio text fades in (65-85) ─────────────────────────────── */
  const bioOpacity = interpolate(frame, [65, 85], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bioTranslateY = interpolate(frame, [65, 85], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ── Social handle slides in (80-95) ───────────────────────── */
  const socialSlide = spring({
    frame: frame - 80,
    fps,
    config: {
      damping: 20,
      stiffness: 100,
      mass: 0.7,
    },
  });
  const socialTranslateX = interpolate(socialSlide, [0, 1], [40, 0]);
  const socialOpacity = interpolate(socialSlide, [0, 1], [0, 1]);

  /* ── Global fade out (330-360) ─────────────────────────────── */
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ── Dot grid color ────────────────────────────────────────── */
  const dotColor =
    props.background === 'dark'
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(0,0,0,0.06)';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={dotColor} opacity={bgOpacity} />

      {/* Card container — positioned center-right */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + 40px), -50%) translateX(${cardX}px)`,
          width: 680,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '64px 48px',
          backgroundColor: COLORS.cardBg,
          borderRadius: 32,
          border: `1px solid ${COLORS.cardBorder}`,
          boxShadow:
            props.background === 'dark'
              ? '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
              : '0 40px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
      >
        {/* Avatar with accent circle behind */}
        <div
          style={{
            position: 'relative',
            width: 140,
            height: 140,
            marginBottom: 36,
            transform: `scale(${avatarScale})`,
          }}
        >
          {/* Accent circle behind avatar */}
          <div
            style={{
              position: 'absolute',
              top: -10,
              left: -10,
              width: 160,
              height: 160,
              borderRadius: '50%',
              backgroundColor: COLORS.accent,
              opacity: 0.2,
            }}
          />
          {/* Avatar circle with initials */}
          <div
            style={{
              position: 'relative',
              width: 140,
              height: 140,
              borderRadius: '50%',
              backgroundColor: COLORS.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontFamily: FONTS.headline,
                fontSize: 52,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: 2,
              }}
            >
              {initials}
            </span>
          </div>
        </div>

        {/* Guest name */}
        <div
          style={{
            opacity: nameOpacity,
            transform: `translateY(${nameTranslateY}px)`,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.headline,
              fontSize: 48,
              fontWeight: 700,
              color: COLORS.text,
              textAlign: 'center',
              lineHeight: 1.15,
              display: 'block',
            }}
          >
            {props.guestName}
          </span>
        </div>

        {/* Title / role */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleTranslateY}px)`,
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 24,
              fontWeight: 500,
              color: COLORS.accent,
              textAlign: 'center',
              lineHeight: 1.4,
              display: 'block',
            }}
          >
            {props.guestTitle}
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 60,
            height: 3,
            backgroundColor: COLORS.accent,
            borderRadius: 2,
            marginBottom: 24,
            opacity: bioOpacity,
          }}
        />

        {/* Bio */}
        <div
          style={{
            opacity: bioOpacity,
            transform: `translateY(${bioTranslateY}px)`,
            marginBottom: 28,
            maxWidth: 560,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 22,
              fontWeight: 400,
              color: COLORS.subtleText,
              textAlign: 'center',
              lineHeight: 1.6,
              display: 'block',
            }}
          >
            {props.bio}
          </span>
        </div>

        {/* Social handle */}
        {props.socialHandle && (
          <div
            style={{
              opacity: socialOpacity,
              transform: `translateX(${socialTranslateX}px)`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 24px',
                backgroundColor:
                  props.background === 'dark'
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                borderRadius: 100,
              }}
            >
              {/* Simple @ icon indicator */}
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: COLORS.accent,
                }}
              />
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 20,
                  fontWeight: 500,
                  color: COLORS.subtleText,
                }}
              >
                {props.socialHandle}
              </span>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export default GuestIntroCard;
