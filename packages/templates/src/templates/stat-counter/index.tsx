import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { StatCounterProps } from './schema';
import CardShell from './components/CardShell';
import TrendBadge from './components/TrendBadge';
import { formatCompact } from './lib/format';

const DotGrid: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <defs>
      <pattern id="dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="16" cy="16" r="1" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dot-grid)" />
  </svg>
);

const StatCounter: React.FC<StatCounterProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  // Intro / outro fades
  const introOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title fade in
  const titleOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleSlideY = interpolate(frame, [10, 25], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Counter animation (frames 20–260)
  const countProgress = interpolate(frame, [20, 260], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const targetValue = props.value;
  const currentValue = Math.round(targetValue * countProgress);
  const displayValue = formatCompact(currentValue, props.prefix);
  const finalDisplay = props.suffix ? `${displayValue}${props.suffix}` : displayValue;

  // Label fade in
  const labelOpacity = interpolate(frame, [240, 270], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bgStyle: React.CSSProperties = props.background === 'gradient'
    ? { background: theme.bg }
    : { backgroundColor: theme.bg };

  return (
    <AbsoluteFill style={{ ...bgStyle, opacity: introOpacity * outroOpacity, overflow: 'hidden' }}>
      <DotGrid color={theme.gridColor} />

      <CardShell
        frame={frame}
        enterFrame={0}
        exitFrame={durationInFrames}
        cardStyle={props.cardStyle}
        cardBg={theme.cardBg}
        cardBorder={theme.cardBorder}
        accentColor={props.accentColor}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16 }}>
          {/* Title */}
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: 3,
              color: theme.textMuted,
              textTransform: 'uppercase',
              opacity: titleOpacity,
              transform: `translateY(${titleSlideY}px)`,
            }}
          >
            {props.title}
          </span>

          {/* Big number */}
          <span
            style={{
              fontFamily: FONTS.headline,
              fontSize: 108,
              fontWeight: 800,
              color: theme.text,
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            {finalDisplay}
          </span>

          {/* Trend badge */}
          {props.trend && (
            <TrendBadge
              direction={props.trend.direction}
              value={props.trend.value}
              frame={frame}
              enterFrame={240}
              font={FONTS.body}
            />
          )}

          {/* Label */}
          {props.label && (
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 20,
                fontWeight: 400,
                color: theme.textMuted,
                opacity: labelOpacity,
                marginTop: 8,
              }}
            >
              {props.label}
            </span>
          )}
        </div>
      </CardShell>
    </AbsoluteFill>
  );
};

export default StatCounter;
