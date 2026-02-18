import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { ScoreMeterProps } from './schema';

/* ------------------------------------------------------------------ */
/*  DotGrid SVG background                                            */
/* ------------------------------------------------------------------ */
const DotGrid: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <defs>
      <pattern id="score-meter-dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="16" cy="16" r="1" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#score-meter-dot-grid)" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  SVG arc path helper                                                */
/* ------------------------------------------------------------------ */
function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startX = cx + radius * Math.cos(toRad(startAngle));
  const startY = cy + radius * Math.sin(toRad(startAngle));
  const endX = cx + radius * Math.cos(toRad(endAngle));
  const endY = cy + radius * Math.sin(toRad(endAngle));
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
}

/* ------------------------------------------------------------------ */
/*  Semicircular Gauge SVG                                             */
/* ------------------------------------------------------------------ */
const GaugeSVG: React.FC<{
  progress: number;
  arcDrawProgress: number;
  needleAngle: number;
  trackColor: string;
  accentColor: string;
  size: number;
}> = ({ progress, arcDrawProgress, needleAngle, trackColor, accentColor, size }) => {
  const cx = size / 2;
  const cy = size / 2 + 20;
  const radius = size / 2 - 40;
  const strokeWidth = 28;

  // Semicircle goes from 180 degrees (left) to 360 degrees (right)
  const startAngle = 180;
  const endAngle = 360;

  // Background track arc (draws in during arcDrawProgress)
  const trackEnd = startAngle + (endAngle - startAngle) * arcDrawProgress;
  const trackPath = describeArc(cx, cy, radius, startAngle, trackEnd);

  // Foreground arc fills to score percentage
  const fillEnd = startAngle + (endAngle - startAngle) * progress;
  const fillPath = progress > 0.001 ? describeArc(cx, cy, radius, startAngle, fillEnd) : '';

  // Needle geometry
  const needleLength = radius - 20;
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleEndX = cx + needleLength * Math.cos(needleRad);
  const needleEndY = cy + needleLength * Math.sin(needleRad);

  // Tick marks at 0%, 25%, 50%, 75%, 100%
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size / 2 + 80} viewBox={`0 0 ${size} ${size / 2 + 80}`}>
      {/* Gradient definition for the foreground arc */}
      <defs>
        <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="40%" stopColor="#EAB308" />
          <stop offset="75%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
        {/* Glow filter for the foreground arc */}
        <filter id="arc-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Needle glow */}
        <filter id="needle-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Tick marks */}
      {ticks.map((t, i) => {
        const angle = startAngle + (endAngle - startAngle) * t;
        const rad = (angle * Math.PI) / 180;
        const innerR = radius - strokeWidth / 2 - 12;
        const outerR = radius - strokeWidth / 2 - 4;
        const x1 = cx + innerR * Math.cos(rad);
        const y1 = cy + innerR * Math.sin(rad);
        const x2 = cx + outerR * Math.cos(rad);
        const y2 = cy + outerR * Math.sin(rad);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={trackColor}
            strokeWidth="2"
            strokeLinecap="round"
            opacity={arcDrawProgress}
          />
        );
      })}

      {/* Background track arc */}
      <path
        d={trackPath}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Foreground filled arc */}
      {fillPath && (
        <path
          d={fillPath}
          fill="none"
          stroke="url(#gauge-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter="url(#arc-glow)"
        />
      )}

      {/* Needle */}
      {progress > 0.001 && (
        <>
          {/* Needle line */}
          <line
            x1={cx}
            y1={cy}
            x2={needleEndX}
            y2={needleEndY}
            stroke={accentColor}
            strokeWidth="4"
            strokeLinecap="round"
            filter="url(#needle-glow)"
          />
          {/* Needle center dot */}
          <circle cx={cx} cy={cy} r="10" fill={accentColor} />
          <circle cx={cx} cy={cy} r="5" fill="#FFFFFF" />
        </>
      )}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
const ScoreMeter: React.FC<ScoreMeterProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  const scorePercent = Math.min(props.score / props.maxScore, 1);

  /* ---- 0-15: Background fade in ---- */
  const bgFadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  /* ---- 15-35: Gauge outline appears (arc draws) ---- */
  const arcDrawProgress = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  /* ---- 30-150: Needle sweeps from 0 to target score ---- */
  const sweepProgress = interpolate(frame, [30, 150], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const currentProgress = sweepProgress * scorePercent;

  // Needle angle: 180 degrees (left, 0%) to 360 degrees (right, 100%)
  const needleAngle = 180 + currentProgress * 180;

  /* ---- 30-150: Score number counts up in sync ---- */
  const currentScore = Math.round(sweepProgress * props.score);

  /* ---- Score scale entrance ---- */
  const scoreScale = interpolate(frame, [28, 45], [0.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.4)),
  });

  const scoreOpacity = interpolate(frame, [28, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- 130-155: Label text fades in ---- */
  const labelOpacity = interpolate(frame, [130, 155], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const labelSlideY = interpolate(frame, [130, 155], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  /* ---- 310-340: Elements fade out ---- */
  const elementsFadeOut = interpolate(frame, [310, 340], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- 330-360: Final fade out ---- */
  const finalFadeOut = interpolate(frame, [330, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- Accent glow pulse ---- */
  const glowPulse = interpolate(
    frame % 90,
    [0, 45, 90],
    [0.8, 1.2, 0.8],
    { extrapolateRight: 'clamp' },
  );

  const glowScale = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const gaugeSize = 600;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgFadeIn * finalFadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* Accent glow behind gauge */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          width: 500,
          height: 500,
          marginTop: -250,
          marginLeft: -250,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${props.accentColor}${props.background === 'dark' ? '44' : '25'} 0%, transparent 70%)`,
          opacity: theme.glowOpacity * glowPulse * glowScale * elementsFadeOut,
          transform: `scale(${glowPulse * glowScale})`,
          pointerEvents: 'none',
        }}
      />

      {/* Central content */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: elementsFadeOut,
        }}
      >
        {/* Gauge SVG */}
        <div style={{ marginTop: -60 }}>
          <GaugeSVG
            progress={currentProgress}
            arcDrawProgress={arcDrawProgress}
            needleAngle={needleAngle}
            trackColor={theme.arcTrack}
            accentColor={props.accentColor}
            size={gaugeSize}
          />
        </div>

        {/* Score number */}
        <div
          style={{
            fontFamily: FONTS.headline,
            fontSize: 140,
            fontWeight: 800,
            color: theme.text,
            lineHeight: 1,
            letterSpacing: -4,
            opacity: scoreOpacity,
            transform: `scale(${scoreScale})`,
            marginTop: -40,
            textAlign: 'center',
          }}
        >
          {currentScore}
        </div>

        {/* "out of X" subtext */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 26,
            fontWeight: 400,
            color: theme.textMuted,
            opacity: scoreOpacity,
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          out of {props.maxScore}
        </div>

        {/* Label text */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: 'uppercase' as const,
            color: props.accentColor,
            opacity: labelOpacity,
            transform: `translateY(${labelSlideY}px)`,
            marginTop: 32,
            textAlign: 'center',
          }}
        >
          {props.label}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ScoreMeter;
