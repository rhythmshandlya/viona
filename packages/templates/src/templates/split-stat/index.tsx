import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { SplitStatProps } from './schema';

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Format a number with commas: 5200 -> "5,200" */
function formatNumber(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** SVG DotGrid background */
const DotGrid: React.FC<{ color: string; size: number }> = ({
  color,
  size,
}) => {
  const s = useScale();
  const spacing = s(28);
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
        />,
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

/* ── Main Component ──────────────────────────────────────────────── */

const SplitStat: React.FC<SplitStatProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const maxValue = Math.max(props.leftValue, props.rightValue, 1);

  /* ── Animation helpers ─────────────────────────────────────────── */

  // Background fade in: 0-15
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Title fade in: 10-25
  const titleOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const titleY = interpolate(frame, [10, 25], [-20, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Divider line draws top to bottom: 20-35
  const dividerProgress = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // VS text appears: 25-40
  const vsOpacity = interpolate(frame, [25, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const vsScale = interpolate(frame, [25, 40], [0.5, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.6)),
  });

  // Number count up: 30-180 with easing
  const countProgress = interpolate(frame, [30, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const leftCurrent = props.leftValue * countProgress;
  const rightCurrent = props.rightValue * countProgress;

  // Fill bar growth: 30-180
  const leftBarWidth = interpolate(frame, [30, 180], [0, props.leftValue / maxValue], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const rightBarWidth = interpolate(frame, [30, 180], [0, props.rightValue / maxValue], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Labels fade in: 180-200
  const labelOpacity = interpolate(frame, [180, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelY = interpolate(frame, [180, 200], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Elements fade out: 310-340
  const elementsFadeOut = interpolate(frame, [310, 340], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Global fade out: 330-360
  const globalFadeOut = interpolate(
    frame,
    [330, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  /* ── Render ────────────────────────────────────────────────────── */

  const panelWidth = s(490);
  const barMaxWidth = s(380);
  const barHeight = s(64);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        opacity: globalFadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <div style={{ opacity: bgOpacity * 0.8, position: 'absolute', inset: 0 }}>
        <DotGrid color={COLORS.dotColor} size={width} />
      </div>

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: s(90),
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: titleOpacity * elementsFadeOut,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(56),
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: s(3),
            textTransform: 'uppercase',
          }}
        >
          {props.title}
        </span>
      </div>

      {/* Central vertical divider */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: s(200),
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: elementsFadeOut,
        }}
      >
        {/* Divider line */}
        <div
          style={{
            width: s(2),
            height: s(680) * dividerProgress,
            background: `linear-gradient(to bottom, transparent, ${COLORS.dividerLine} 10%, ${COLORS.dividerLine} 90%, transparent)`,
            position: 'absolute',
            top: 0,
          }}
        />

        {/* VS badge */}
        <div
          style={{
            position: 'absolute',
            top: s(280),
            opacity: vsOpacity,
            transform: `scale(${vsScale})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: s(80),
              height: s(80),
              borderRadius: '50%',
              backgroundColor: COLORS.background,
              border: `${s(2)}px solid ${COLORS.dividerLine}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontFamily: FONTS.headline,
                fontSize: s(30),
                fontWeight: 700,
                color: COLORS.subtleText,
                letterSpacing: s(2),
              }}
            >
              {props.dividerText}
            </span>
          </div>
        </div>
      </div>

      {/* Left panel */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: width / 2,
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: elementsFadeOut,
        }}
      >
        {/* Fill bar behind number */}
        <div
          style={{
            position: 'relative',
            width: panelWidth,
            height: barHeight,
            borderRadius: s(12),
            overflow: 'hidden',
            backgroundColor: `${props.leftColor}15`,
            marginBottom: s(24),
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${leftBarWidth * 100}%`,
              maxWidth: barMaxWidth,
              borderRadius: s(12),
              background: `linear-gradient(90deg, ${props.leftColor}40, ${props.leftColor}90)`,
            }}
          />
        </div>

        {/* Number */}
        <div
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(120),
            fontWeight: 700,
            color: props.leftColor,
            lineHeight: 1,
            letterSpacing: s(-2),
          }}
        >
          {props.prefix}
          {formatNumber(leftCurrent)}
          {props.suffix}
        </div>

        {/* Label */}
        <div
          style={{
            marginTop: s(28),
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: s(36),
              fontWeight: 500,
              color: COLORS.subtleText,
              letterSpacing: s(4),
              textTransform: 'uppercase',
            }}
          >
            {props.leftLabel}
          </span>
        </div>
      </div>

      {/* Right panel */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: width / 2,
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: elementsFadeOut,
        }}
      >
        {/* Fill bar behind number */}
        <div
          style={{
            position: 'relative',
            width: panelWidth,
            height: barHeight,
            borderRadius: s(12),
            overflow: 'hidden',
            backgroundColor: `${props.rightColor}15`,
            marginBottom: s(24),
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: `${rightBarWidth * 100}%`,
              maxWidth: barMaxWidth,
              borderRadius: s(12),
              background: `linear-gradient(270deg, ${props.rightColor}40, ${props.rightColor}90)`,
            }}
          />
        </div>

        {/* Number */}
        <div
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(120),
            fontWeight: 700,
            color: props.rightColor,
            lineHeight: 1,
            letterSpacing: s(-2),
          }}
        >
          {props.prefix}
          {formatNumber(rightCurrent)}
          {props.suffix}
        </div>

        {/* Label */}
        <div
          style={{
            marginTop: s(28),
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: s(36),
              fontWeight: 500,
              color: COLORS.subtleText,
              letterSpacing: s(4),
              textTransform: 'uppercase',
            }}
          >
            {props.rightLabel}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default SplitStat;
