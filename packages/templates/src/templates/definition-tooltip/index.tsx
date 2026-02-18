import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { DefinitionTooltipProps } from './schema';

/* ── DotGrid SVG background ─────────────────────────────────────────── */
const DotGrid: React.FC<{ color: string; opacity: number }> = ({
  color,
  opacity,
}) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, opacity }}
  >
    <defs>
      <pattern
        id="dotgrid"
        x="0"
        y="0"
        width="30"
        height="30"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="15" cy="15" r="1.5" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dotgrid)" />
  </svg>
);

/* ── Main component ──────────────────────────────────────────────────── */
const DefinitionTooltip: React.FC<DefinitionTooltipProps> = (props) => {
  const { FONTS, SPRING_CONFIG } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  /* ── Animation timeline ───────────────────────────────────────────── */

  // 0-15: Background fade in
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // 15-35: Card container scales in (spring)
  const cardSpring = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: SPRING_CONFIG,
  });
  const cardScale = interpolate(cardSpring, [0, 1], [0.7, 1]);
  const cardOpacity = interpolate(frame, [15, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 30-45: Term text appears
  const termOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const termSlideY = interpolate(frame, [30, 45], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 40-55: Pronunciation fades in
  const pronOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 50-65: Part of speech badge appears
  const posBadgeSpring = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 16, stiffness: 160, mass: 0.5 },
  });
  const posBadgeScale = interpolate(posBadgeSpring, [0, 1], [0.5, 1]);
  const posBadgeOpacity = interpolate(frame, [50, 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 60-90: Definition text fades in
  const defOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const defSlideY = interpolate(frame, [60, 90], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 85-105: Example sentence fades in (if present)
  const exampleOpacity = interpolate(frame, [85, 105], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exampleSlideY = interpolate(frame, [85, 105], [8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 310-340: Card scales out
  const exitSpring = spring({
    frame: Math.max(0, frame - 310),
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.9 },
  });
  const exitScale = frame >= 310 ? interpolate(exitSpring, [0, 1], [1, 0.7]) : 1;
  const exitOpacity = frame >= 310
    ? interpolate(frame, [310, 340], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  // 330-360: Fade out
  const fadeOutOpacity = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ── Combined transforms ──────────────────────────────────────────── */
  const combinedCardScale = cardScale * exitScale;
  const combinedCardOpacity = cardOpacity * exitOpacity;
  const globalOpacity = bgOpacity * fadeOutOpacity;

  /* ── Left accent line height animation ────────────────────────────── */
  const accentLineHeight = interpolate(frame, [15, 50], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: globalOpacity,
      }}
    >
      {/* DotGrid background */}
      <DotGrid color={theme.dotColor} opacity={bgOpacity} />

      {/* Card */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 820,
            backgroundColor: theme.cardBg,
            borderRadius: 20,
            border: `1px solid ${theme.border}`,
            padding: '56px 64px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            opacity: combinedCardOpacity,
            transform: `scale(${combinedCardScale})`,
            boxShadow:
              props.background === 'dark'
                ? `0 30px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px ${theme.border}`
                : '0 20px 60px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0,0,0,0.04)',
          }}
        >
          {/* Left accent line */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              width: 4,
              height: `${accentLineHeight}%`,
              transform: 'translateY(-50%)',
              backgroundColor: props.accentColor,
              borderRadius: '0 4px 4px 0',
            }}
          />

          {/* Term */}
          <div
            style={{
              fontFamily: FONTS.headline,
              fontSize: 72,
              fontWeight: 700,
              color: theme.text,
              lineHeight: 1.1,
              opacity: termOpacity,
              transform: `translateY(${termSlideY}px)`,
            }}
          >
            {props.term}
          </div>

          {/* Pronunciation + Part of Speech row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {/* Pronunciation */}
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 26,
                fontWeight: 400,
                fontStyle: 'italic',
                color: theme.textMuted,
                opacity: pronOpacity,
                letterSpacing: 1,
              }}
            >
              {props.pronunciation}
            </span>

            {/* Part of speech badge */}
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 18,
                fontWeight: 600,
                color: props.accentColor,
                backgroundColor: `${props.accentColor}18`,
                padding: '4px 16px',
                borderRadius: 20,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                opacity: posBadgeOpacity,
                transform: `scale(${posBadgeScale})`,
                display: 'inline-block',
              }}
            >
              {props.partOfSpeech}
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              width: '100%',
              height: 1,
              backgroundColor: theme.border,
              opacity: defOpacity,
            }}
          />

          {/* Definition */}
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 30,
              fontWeight: 400,
              color: theme.text,
              lineHeight: 1.6,
              opacity: defOpacity,
              transform: `translateY(${defSlideY}px)`,
            }}
          >
            {props.definition}
          </div>

          {/* Example sentence */}
          {props.example && (
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 24,
                fontWeight: 400,
                fontStyle: 'italic',
                color: theme.textMuted,
                lineHeight: 1.5,
                paddingLeft: 20,
                borderLeft: `3px solid ${props.accentColor}40`,
                opacity: exampleOpacity,
                transform: `translateY(${exampleSlideY}px)`,
              }}
            >
              &ldquo;{props.example}&rdquo;
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default DefinitionTooltip;
