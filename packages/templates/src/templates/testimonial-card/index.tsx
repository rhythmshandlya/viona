import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { TestimonialCardProps } from './schema';

/* ── Dot-grid background ──────────────────────────────────────────── */

const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  const spacing = s(32);
  const radius = s(1.5);
  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="dot-grid"
            x="0"
            y="0"
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={spacing / 2} cy={spacing / 2} r={radius} fill={color} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>
    </AbsoluteFill>
  );
};

/* ── Star icon ────────────────────────────────────────────────────── */

const Star: React.FC<{ filled: boolean; color: string; size: number }> = ({
  filled,
  color,
  size,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? color : 'none'}
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

/* ── Quotation mark SVG ───────────────────────────────────────────── */

const QuoteMark: React.FC<{ color: string; opacity: number; scale: number }> = ({
  color,
  opacity,
  scale,
}) => (
  <div
    style={{
      opacity,
      transform: `scale(${scale})`,
      transformOrigin: 'center center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
      <path
        d="M26 100C18.6667 100 12.5 97.5 7.5 92.5C2.5 87.5 0 81.3333 0 74C0 70.6667 0.333333 67.6667 1 65C1.66667 62.3333 3 59 5 55L30 5C31.3333 2.33333 33.3333 0.666667 36 0H52L38 50C45 51.3333 50.5 54.5 54.5 59.5C58.5 64.5 60.5 70 60.5 76C60.5 82.6667 58 88.5 53 93.5C48 98 42 100.167 35 100H26ZM86 100C78.6667 100 72.5 97.5 67.5 92.5C62.5 87.5 60 81.3333 60 74C60 70.6667 60.3333 67.6667 61 65C61.6667 62.3333 63 59 65 55L90 5C91.3333 2.33333 93.3333 0.666667 96 0H112L98 50C105 51.3333 110.5 54.5 114.5 59.5C118.5 64.5 120.5 70 120.5 76C120.5 82.6667 118 88.5 113 93.5C108 98 102 100.167 95 100H86Z"
        fill={color}
      />
    </svg>
  </div>
);

/* ── Avatar with initials ─────────────────────────────────────────── */

const Avatar: React.FC<{
  name: string;
  accentColor: string;
  size: number;
  opacity: number;
  translateY: number;
}> = ({ name, accentColor, size, opacity, translateY }) => {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: accentColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        transform: `translateY(${translateY}px)`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: '#0B0F1A',
          fontSize: size * 0.4,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        {initials}
      </span>
    </div>
  );
};

/* ── Main component ───────────────────────────────────────────────── */

const TestimonialCard: React.FC<TestimonialCardProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background] || BACKGROUNDS.dark;
  const accent = props.accentColor;

  // ── Intro / outro opacity ─────────────────────────────────────
  const introOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // ── Quotation mark (frames 10-25) ────────────────────────────
  const quoteMarkScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.8 },
  });
  const quoteMarkOpacity = interpolate(frame, [10, 18], [0, 0.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Quote text word-by-word (frames 20-120) ──────────────────
  const words = props.quote.split(' ');
  const totalWords = words.length;
  const wordDuration = (120 - 20) / totalWords; // frames per word

  // ── Star rating (frames 100-140) ──────────────────────────────
  const starCount = Math.round(props.rating);

  // ── Author slide-in (frames 130-160) ──────────────────────────
  const authorProgress = spring({
    frame: frame - 130,
    fps,
    config: { damping: 15, stiffness: 80, mass: 1 },
  });
  const authorOpacity = interpolate(frame, [130, 145], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const authorTranslateY = interpolate(authorProgress, [0, 1], [40, 0]);

  return (
    <AbsoluteFill
      style={{
        opacity: introOpacity * outroOpacity,
        backgroundColor: theme.bg,
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* Subtle gradient overlay */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${accent}08 0%, transparent 70%)`,
        }}
      />

      {/* Card container */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: s(80),
        }}
      >
        {/* Large decorative quotation mark */}
        <div
          style={{
            position: 'absolute',
            top: s(140),
            left: s(100),
          }}
        >
          <QuoteMark
            color={accent}
            opacity={quoteMarkOpacity}
            scale={quoteMarkScale}
          />
        </div>

        {/* Quote text */}
        <div
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(46),
            fontWeight: 500,
            lineHeight: 1.5,
            color: theme.text,
            textAlign: 'center',
            maxWidth: s(860),
            marginBottom: s(50),
            letterSpacing: -0.3,
          }}
        >
          {words.map((word, i) => {
            const wordStart = 20 + i * wordDuration;
            const wordOpacity = interpolate(
              frame,
              [wordStart, wordStart + wordDuration * 0.6],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );
            const wordTranslateY = interpolate(
              frame,
              [wordStart, wordStart + wordDuration * 0.8],
              [8, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );
            return (
              <span
                key={i}
                style={{
                  opacity: wordOpacity,
                  display: 'inline-block',
                  transform: `translateY(${wordTranslateY}px)`,
                  marginRight: '0.3em',
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Star rating */}
        {props.showStars && (
          <div
            style={{
              display: 'flex',
              gap: s(8),
              marginBottom: s(40),
              justifyContent: 'center',
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => {
              const starStart = 100 + i * 8; // 8-frame stagger
              const starOpacity = interpolate(
                frame,
                [starStart, starStart + 10],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
              const starScale = spring({
                frame: frame - starStart,
                fps,
                config: { damping: 10, stiffness: 150, mass: 0.5 },
              });
              return (
                <div
                  key={i}
                  style={{
                    opacity: starOpacity,
                    transform: `scale(${starScale})`,
                  }}
                >
                  <Star filled={i < starCount} color={accent} size={s(38)} />
                </div>
              );
            })}
          </div>
        )}

        {/* Divider line */}
        <div
          style={{
            width: interpolate(authorProgress, [0, 1], [0, s(60)]),
            height: s(2),
            backgroundColor: accent,
            marginBottom: s(36),
            borderRadius: s(1),
            opacity: authorOpacity,
          }}
        />

        {/* Author section */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: s(20),
            opacity: authorOpacity,
            transform: `translateY(${authorTranslateY}px)`,
          }}
        >
          <Avatar
            name={props.authorName}
            accentColor={accent}
            size={s(56)}
            opacity={1}
            translateY={0}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: s(4) }}>
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: s(26),
                fontWeight: 700,
                color: theme.text,
                letterSpacing: 0.3,
              }}
            >
              {props.authorName}
            </span>
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: s(20),
                fontWeight: 400,
                color: theme.textMuted,
              }}
            >
              {props.authorTitle}
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default TestimonialCard;
