import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { PopupFactProps } from './schema';

/* ── Dot-grid SVG background ─────────────────────────────────────── */

const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const spacing = 32;
  const radius = 1.5;
  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="popup-dot-grid"
            x="0"
            y="0"
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={spacing / 2} cy={spacing / 2} r={radius} fill={color} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#popup-dot-grid)" />
      </svg>
    </AbsoluteFill>
  );
};

/* ── SVG Icons ───────────────────────────────────────────────────── */

const InfoCircleIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const LightbulbIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
);

const StarIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ICON_MAP = {
  info: InfoCircleIcon,
  lightbulb: LightbulbIcon,
  star: StarIcon,
} as const;

/* ── Main component ──────────────────────────────────────────────── */

const PopupFact: React.FC<PopupFactProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background] || BACKGROUNDS.dark;
  const accent = props.accentColor;
  const facts = props.facts;
  const factCount = facts.length;

  // ── Global intro / outro ────────────────────────────────────────
  const introOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const outroOpacity = interpolate(
    frame,
    [330, 360],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // ── Per-fact timing ─────────────────────────────────────────────
  const factsStart = 20;
  const factsEnd = 320;
  const framesPerFact = Math.floor((factsEnd - factsStart) / factCount);

  // Slide-in: 15 frames, hold: middle, slide-out: 15 frames
  const slideInDuration = 15;
  const slideOutDuration = 15;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: introOpacity * outroOpacity,
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* Subtle radial glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 70% 25%, ${accent}10 0%, transparent 60%)`,
        }}
      />

      {/* Fact toast cards */}
      {facts.map((fact, i) => {
        const factEnter = factsStart + i * framesPerFact;
        const factExit = factEnter + framesPerFact;
        const localFrame = frame - factEnter;

        // Only render while active (with a small buffer)
        if (frame < factEnter - 2 || frame >= factExit + 5) return null;

        // Slide in from right using spring
        const slideInProgress = spring({
          frame: Math.max(0, localFrame),
          fps,
          config: { damping: 16, stiffness: 120, mass: 0.8 },
        });
        const enterTranslateX = interpolate(slideInProgress, [0, 1], [500, 0]);

        // Slide out to right
        const slideOutStart = framesPerFact - slideOutDuration;
        const slideOutProgress = interpolate(
          localFrame,
          [slideOutStart, framesPerFact],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
        const exitTranslateX = interpolate(slideOutProgress, [0, 1], [0, 600]);
        const exitOpacity = interpolate(slideOutProgress, [0, 0.8], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Combined transform
        const translateX = enterTranslateX + exitTranslateX;

        // Icon component
        const IconComponent = ICON_MAP[fact.icon || 'info'];

        // Stagger internal elements
        const titleOpacity = interpolate(localFrame, [0, slideInDuration], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const textOpacity = interpolate(localFrame, [8, slideInDuration + 8], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Icon pulse on enter
        const iconScale = spring({
          frame: Math.max(0, localFrame - 5),
          fps,
          config: { damping: 10, stiffness: 200, mass: 0.4 },
        });

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 160,
              right: 60,
              width: 680,
              transform: `translateX(${translateX}px)`,
              opacity: exitOpacity,
            }}
          >
            {/* Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 28,
                padding: '40px 44px',
                borderRadius: 24,
                backgroundColor: theme.cardBg,
                border: `1px solid ${theme.cardBorder}`,
                boxShadow: `0 20px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.15)`,
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Icon container */}
              <div
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: `${accent}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${iconScale})`,
                  marginTop: 4,
                }}
              >
                <IconComponent color={accent} size={30} />
              </div>

              {/* Text content */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {/* Title */}
                <span
                  style={{
                    fontFamily: FONTS.headline,
                    fontSize: 28,
                    fontWeight: 700,
                    color: accent,
                    letterSpacing: 0.5,
                    opacity: titleOpacity,
                    lineHeight: 1.2,
                  }}
                >
                  {fact.title}
                </span>

                {/* Fact text */}
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 24,
                    fontWeight: 400,
                    color: theme.text,
                    lineHeight: 1.55,
                    opacity: textOpacity,
                  }}
                >
                  {fact.text}
                </span>
              </div>
            </div>

            {/* Accent bar on the left edge */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 20,
                bottom: 20,
                width: 4,
                borderRadius: 2,
                backgroundColor: accent,
                opacity: slideInProgress,
              }}
            />
          </div>
        );
      })}

      {/* Progress indicator dots */}
      {frame >= factsStart && frame <= factsEnd + 10 && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 12,
          }}
        >
          {facts.map((_, i) => {
            const factEnter = factsStart + i * framesPerFact;
            const isActive = frame >= factEnter && frame < factEnter + framesPerFact;
            const isPast = frame >= factEnter + framesPerFact;

            return (
              <div
                key={i}
                style={{
                  width: isActive ? 28 : 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: isActive
                    ? accent
                    : isPast
                      ? `${accent}60`
                      : `${theme.text}15`,
                  transition: 'width 0.2s',
                }}
              />
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

export default PopupFact;
