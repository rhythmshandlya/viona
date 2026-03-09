import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { NumberTickerProps } from './schema';

const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="nt-dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#nt-dot-grid)" />
    </svg>
  );
};

function formatNumberWithCommas(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

const NumberTicker: React.FC<NumberTickerProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  // --- Background fade in (0-15) ---
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Label fade in (10-25) ---
  const labelOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelSlideY = interpolate(frame, [10, 25], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Number count-up (20-200) ---
  const countProgress = interpolate(frame, [20, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const currentValue = props.decimals > 0
    ? parseFloat((props.value * countProgress).toFixed(props.decimals))
    : Math.round(props.value * countProgress);

  const formattedNumber = formatNumberWithCommas(currentValue, props.decimals);
  const displayValue = `${props.prefix}${formattedNumber}${props.suffix}`;

  // --- Scale pulse at completion (200-220) ---
  const pulseUp = interpolate(frame, [200, 210], [1.0, 1.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const pulseDown = interpolate(frame, [210, 220], [1.1, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const numberScale = frame < 210 ? pulseUp : pulseDown;

  // --- Glow intensifies (200-230) ---
  const glowIntensity = interpolate(frame, [200, 230], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // --- Elements fade out (310-340) ---
  const elementsFadeOut = interpolate(frame, [310, 340], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Overall fade out (330-360) ---
  const overallFadeOut = interpolate(frame, [330, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Number opacity: fades in with count start, fades out with elements
  const numberOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) * elementsFadeOut;

  const glowBlur = 40 + glowIntensity * 60;
  const glowOpacity = 0.15 + glowIntensity * 0.45;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * overallFadeOut,
        overflow: 'hidden',
      }}
    >
      <DotGrid color={theme.gridColor} />

      {/* Centered content container */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Label above number */}
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: s(28),
            fontWeight: 500,
            letterSpacing: s(4),
            color: theme.textMuted,
            textTransform: 'uppercase',
            opacity: labelOpacity * elementsFadeOut,
            transform: `translateY(${labelSlideY}px)`,
            marginBottom: s(32),
          }}
        >
          {props.label}
        </span>

        {/* Glow behind number */}
        <div
          style={{
            position: 'absolute',
            width: s(400),
            height: s(200),
            borderRadius: '50%',
            background: props.accentColor,
            filter: `blur(${glowBlur}px)`,
            opacity: glowOpacity * elementsFadeOut,
            pointerEvents: 'none',
          }}
        />

        {/* Big number */}
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(140),
            fontWeight: 800,
            color: theme.text,
            lineHeight: 1.1,
            letterSpacing: -2,
            transform: `scale(${numberScale})`,
            opacity: numberOpacity,
            textShadow: glowIntensity > 0
              ? `0 0 ${20 + glowIntensity * 40}px ${props.accentColor}${Math.round(glowIntensity * 80).toString(16).padStart(2, '0')}`
              : 'none',
            zIndex: 1,
          }}
        >
          {displayValue}
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default NumberTicker;
