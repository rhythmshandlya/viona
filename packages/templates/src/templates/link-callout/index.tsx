import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { LinkCalloutProps } from './schema';

/* ─── SVG Background: Dot Grid ─────────────────────────────────────── */

const DotGrid: React.FC<{ color: string; size: number }> = ({ color, size }) => {
  const s = useScale();
  const spacing = s(32);
  const dotR = s(2);
  const cols = Math.ceil(size / spacing) + 1;
  const rows = Math.ceil(size / spacing) + 1;

  const dots: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={c * spacing}
          cy={r * spacing}
          r={dotR}
          fill={color}
        />
      );
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {dots}
    </svg>
  );
};

/* ─── SVG: Link Chain Icon ──────────────────────────────────────────── */

const LinkChainIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
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
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

/* ─── SVG: Bouncing Arrow ───────────────────────────────────────────── */

const BouncingArrow: React.FC<{
  color: string;
  size: number;
  bounceOffset: number;
}> = ({ color, size, bounceOffset }) => (
  <div style={{ transform: `translateY(${bounceOffset}px)` }}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  </div>
);

/* ─── Main Component ────────────────────────────────────────────────── */

const LinkCallout: React.FC<LinkCalloutProps> = (props) => {
  const { COLORS, FONTS, SPRING_CONFIG } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const s = useScale();

  // ── Background fade in (0-15) ──────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Bubble scale in (20-40) with spring ────────────────────────────
  const bubbleProgress = spring({
    frame: frame - 20,
    fps,
    config: {
      damping: SPRING_CONFIG.damping,
      stiffness: SPRING_CONFIG.stiffness,
      mass: SPRING_CONFIG.mass,
    },
  });
  const bubbleScale = frame < 20 ? 0 : bubbleProgress;

  // ── Text typing effect (35-50) ─────────────────────────────────────
  const fullText = props.text;
  const typingStart = 35;
  const typingEnd = 50;
  const typingProgress = interpolate(frame, [typingStart, typingEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.linear,
  });
  const visibleChars = Math.floor(typingProgress * fullText.length);
  const displayText = fullText.slice(0, visibleChars);
  const showCursor = frame >= typingStart && frame <= typingEnd + 8;

  // ── URL text fade in (after main text finishes) ────────────────────
  const urlOpacity = interpolate(frame, [typingEnd + 2, typingEnd + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Arrow entrance (50-70) with spring ─────────────────────────────
  const arrowEntrance = spring({
    frame: frame - 50,
    fps,
    config: {
      damping: 10,
      stiffness: 100,
      mass: 1,
    },
  });
  const arrowScale = frame < 50 ? 0 : arrowEntrance;

  // ── Arrow bounce loop (70-300) ─────────────────────────────────────
  const arrowBounce =
    frame >= 70 && frame <= 300
      ? Math.sin(((frame - 70) / fps) * Math.PI * 2.5) * 10
      : frame > 300
        ? 0
        : 0;

  // ── Bubble scale out (300-330) ─────────────────────────────────────
  const bubbleOut = interpolate(frame, [300, 330], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.back(1.4)),
  });

  // ── Final fade out (330-360) ───────────────────────────────────────
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Combine scale: entrance * exit ─────────────────────────────────
  const finalBubbleScale = frame < 300 ? bubbleScale : bubbleScale * bubbleOut;

  // ── Link icon entrance (synced with bubble) ────────────────────────
  const iconOpacity = interpolate(frame, [28, 38], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        opacity: fadeOut,
      }}
    >
      {/* Dot grid background */}
      <div style={{ opacity: bgOpacity }}>
        <DotGrid color={COLORS.dotColor} size={width} />
      </div>

      {/* Subtle radial glow behind bubble */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -55%)',
          width: s(700),
          height: s(700),
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.bubbleBorder}15 0%, transparent 70%)`,
          opacity: bgOpacity * finalBubbleScale,
          pointerEvents: 'none',
        }}
      />

      {/* Centered content container */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Pill-shaped callout bubble */}
        <div
          style={{
            transform: `scale(${finalBubbleScale})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: s(24),
          }}
        >
          {/* Pill container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: s(16),
              padding: `${s(48)}px ${s(64)}px`,
              borderRadius: s(60),
              backgroundColor: COLORS.bubbleBg,
              border: `${s(3)}px solid ${COLORS.bubbleBorder}`,
              boxShadow: `0 0 ${s(60)}px ${COLORS.bubbleBorder}20, 0 ${s(20)}px ${s(60)}px rgba(0,0,0,0.3)`,
              minWidth: s(420),
              maxWidth: s(720),
            }}
          >
            {/* Link chain icon */}
            <div style={{ opacity: iconOpacity }}>
              <div
                style={{
                  width: s(72),
                  height: s(72),
                  borderRadius: '50%',
                  backgroundColor: `${COLORS.bubbleBorder}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LinkChainIcon color={COLORS.bubbleBorder} size={s(36)} />
              </div>
            </div>

            {/* Main text with typing effect */}
            <div
              style={{
                fontFamily: FONTS.headline,
                fontSize: s(52),
                fontWeight: 700,
                color: COLORS.text,
                textAlign: 'center',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                minHeight: s(63),
                whiteSpace: 'pre',
              }}
            >
              {displayText}
              {showCursor && (
                <span
                  style={{
                    opacity: Math.sin(frame * 0.4) > 0 ? 1 : 0,
                    color: COLORS.bubbleBorder,
                    fontWeight: 300,
                  }}
                >
                  |
                </span>
              )}
            </div>

            {/* URL display */}
            <div
              style={{
                opacity: urlOpacity,
                fontFamily: FONTS.body,
                fontSize: s(28),
                color: COLORS.bubbleBorder,
                textAlign: 'center',
                letterSpacing: '0.02em',
                padding: `${s(8)}px ${s(24)}px`,
                borderRadius: s(30),
                backgroundColor: `${COLORS.bubbleBorder}12`,
              }}
            >
              {props.url}
            </div>
          </div>

          {/* Bouncing arrow below the bubble */}
          {props.showArrow && (
            <div
              style={{
                transform: `scale(${arrowScale})`,
                marginTop: s(12),
                opacity: frame >= 300 ? bubbleOut : 1,
              }}
            >
              <BouncingArrow
                color={COLORS.bubbleBorder}
                size={s(56)}
                bounceOffset={arrowBounce}
              />
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default LinkCallout;
