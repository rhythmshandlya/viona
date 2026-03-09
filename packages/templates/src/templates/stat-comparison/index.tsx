import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, spring } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { StatComparisonProps } from './schema';
import CardShell from './components/CardShell';
import { formatCompact } from './lib/format';

const DotGrid: React.FC<{ color: string; s: (px: number) => number }> = ({ color, s }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <defs>
      <pattern id="dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
        <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dot-grid)" />
  </svg>
);

const StatComparison: React.FC<StatComparisonProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const from = props.compareFrom;
  const to = props.compareTo;
  const prefix = props.prefix;

  const introOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleSlideY = interpolate(frame, [10, 25], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Left value counts up (frames 20–140)
  const leftProgress = interpolate(frame, [20, 140], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Right value counts up (frames 70–200)
  const rightProgress = interpolate(frame, [70, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Arrow animation (spring at frame 100)
  const arrowScale = spring({
    frame: frame - 100,
    fps,
    config: { damping: 14, stiffness: 150, mass: 0.6 },
  });

  // Change label (frames 200–240)
  const changeLabelOpacity = interpolate(frame, [200, 240], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const leftValue = Math.round(from.value * leftProgress);
  const rightValue = Math.round(to.value * rightProgress);

  const bgStyle: React.CSSProperties = props.background === 'gradient'
    ? { background: theme.bg }
    : { backgroundColor: theme.bg };

  return (
    <AbsoluteFill style={{ ...bgStyle, opacity: introOpacity * outroOpacity, overflow: 'hidden' }}>
      <DotGrid color={theme.gridColor} s={s} />

      <CardShell
        frame={frame}
        enterFrame={0}
        exitFrame={durationInFrames}
        cardStyle={props.cardStyle}
        cardBg={theme.cardBg}
        cardBorder={theme.cardBorder}
        accentColor={props.accentColor}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', gap: s(20) }}>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: s(22),
              fontWeight: 500,
              letterSpacing: s(3),
              color: theme.textMuted,
              textTransform: 'uppercase',
              opacity: titleOpacity,
              transform: `translateY(${titleSlideY}px)`,
            }}
          >
            {props.title}
          </span>

          {/* Comparison row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: s(40),
              flex: 1,
            }}
          >
            {/* Left (from) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s(12) }}>
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: s(22),
                  fontWeight: 500,
                  color: theme.textMuted,
                }}
              >
                {from.label}
              </span>
              <span
                style={{
                  fontFamily: FONTS.headline,
                  fontSize: s(80),
                  fontWeight: 800,
                  color: `${theme.text}AA`,
                  letterSpacing: s(-2),
                }}
              >
                {formatCompact(leftValue, prefix)}
              </span>
            </div>

            {/* Arrow */}
            <div
              style={{
                transform: `scale(${arrowScale})`,
                opacity: arrowScale,
              }}
            >
              <svg width={s(64)} height={s(64)} viewBox="0 0 64 64">
                <path
                  d="M8 32 H48 M36 20 L48 32 L36 44"
                  fill="none"
                  stroke={props.accentColor}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Right (to) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s(12) }}>
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: s(22),
                  fontWeight: 500,
                  color: theme.textMuted,
                }}
              >
                {to.label}
              </span>
              <span
                style={{
                  fontFamily: FONTS.headline,
                  fontSize: s(80),
                  fontWeight: 800,
                  color: theme.text,
                  letterSpacing: s(-2),
                }}
              >
                {formatCompact(rightValue, prefix)}
              </span>
            </div>
          </div>

          {/* Change label */}
          {props.changeLabel && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: s(8),
                padding: `${s(10)}px ${s(24)}px`,
                borderRadius: s(100),
                background: `${props.accentColor}18`,
                border: `1px solid ${props.accentColor}30`,
                opacity: changeLabelOpacity,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: s(24),
                  fontWeight: 600,
                  color: props.accentColor,
                }}
              >
                {props.changeLabel}
              </span>
            </div>
          )}
        </div>
      </CardShell>
    </AbsoluteFill>
  );
};

export default StatComparison;
