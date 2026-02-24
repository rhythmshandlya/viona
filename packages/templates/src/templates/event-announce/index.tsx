import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { EventAnnounceProps } from './schema';

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const DotGrid: React.FC<{ color: string; frame: number; size: number }> = ({
  color,
  frame,
  size,
}) => {
  const s = useScale();
  const dots: React.ReactNode[] = [];
  const spacing = s(40);
  const cols = Math.ceil(size / spacing);
  const rows = Math.ceil(size / spacing);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const delay = (r + c) * 0.3;
      const pulse = Math.sin((frame - delay) * 0.04) * 0.5 + 0.5;
      const radius = s(1.2) + pulse * s(0.6);
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={c * spacing + spacing / 2}
          cy={r * spacing + spacing / 2}
          r={radius}
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

const AccentLine: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  progress: number;
  strokeWidth?: number;
}> = ({ x1, y1, x2, y2, color, progress, strokeWidth = 3 }) => {
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const dashOffset = length * (1 - progress);

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={length}
      strokeDashoffset={dashOffset}
      strokeLinecap="round"
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const EventAnnounce: React.FC<EventAnnounceProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const s = useScale();
  const { FONTS, COLORS } = getConstants(props);
  const theme = BACKGROUNDS[props.background] || BACKGROUNDS.dark;

  /* ---- Global fade in/out ---- */
  const introOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames - 1],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const globalOpacity = introOpacity * outroOpacity;

  /* ---- Accent lines draw-in (0-15) ---- */
  const lineProgress = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  /* ---- Accent lines pulse during hold (130-330) ---- */
  const accentPulse =
    frame >= 130 && frame <= 330
      ? 0.7 + 0.3 * Math.sin((frame - 130) * 0.08)
      : 1;

  /* ---- Event title (15-40): spring scale + translateY ---- */
  const titleSpring = spring({
    frame: frame - 15,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });
  const titleScale = interpolate(titleSpring, [0, 1], [0.6, 1]);
  const titleTranslateY = interpolate(titleSpring, [0, 1], [60, 0]);
  const titleOpacity = frame >= 15 ? titleSpring : 0;

  /* ---- Date/time (40-70): slide from left ---- */
  const dateSpring = spring({
    frame: frame - 40,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.7 },
  });
  const dateTranslateX = interpolate(dateSpring, [0, 1], [-120, 0]);
  const dateOpacity = frame >= 40 ? dateSpring : 0;

  /* ---- Location (70-100): slide from right ---- */
  const locationSpring = spring({
    frame: frame - 70,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.7 },
  });
  const locationTranslateX = interpolate(locationSpring, [0, 1], [120, 0]);
  const locationOpacity = frame >= 70 ? locationSpring : 0;

  /* ---- CTA (100-130): fade up from bottom ---- */
  const ctaSpring = spring({
    frame: frame - 100,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.8 },
  });
  const ctaTranslateY = interpolate(ctaSpring, [0, 1], [40, 0]);
  const ctaOpacity = frame >= 100 ? ctaSpring : 0;

  /* ---- Split title into lines ---- */
  const titleLines = props.eventTitle.split('\n');

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: globalOpacity,
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} frame={frame} size={width} />

      {/* Accent lines SVG overlay */}
      <svg
        width={width}
        height={width}
        viewBox={`0 0 ${width} ${width}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          opacity: accentPulse,
        }}
      >
        {/* Top-left accent */}
        <AccentLine
          x1={s(80)}
          y1={s(200)}
          x2={s(300)}
          y2={s(200)}
          color={COLORS.primary}
          progress={lineProgress}
          strokeWidth={4}
        />
        <AccentLine
          x1={s(80)}
          y1={s(200)}
          x2={s(80)}
          y2={s(340)}
          color={COLORS.primary}
          progress={lineProgress}
          strokeWidth={4}
        />

        {/* Bottom-right accent */}
        <AccentLine
          x1={s(1000)}
          y1={s(880)}
          x2={s(780)}
          y2={s(880)}
          color={COLORS.accent}
          progress={lineProgress}
          strokeWidth={4}
        />
        <AccentLine
          x1={s(1000)}
          y1={s(880)}
          x2={s(1000)}
          y2={s(740)}
          color={COLORS.accent}
          progress={lineProgress}
          strokeWidth={4}
        />

        {/* Center horizontal dividers */}
        <AccentLine
          x1={s(200)}
          y1={s(520)}
          x2={s(880)}
          y2={s(520)}
          color={COLORS.secondary}
          progress={lineProgress}
          strokeWidth={2}
        />
        <AccentLine
          x1={s(200)}
          y1={s(700)}
          x2={s(880)}
          y2={s(700)}
          color={COLORS.secondary}
          progress={lineProgress}
          strokeWidth={2}
        />
      </svg>

      {/* Content container */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${s(80)}px ${s(100)}px`,
        }}
      >
        {/* Event Title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${titleScale}) translateY(${titleTranslateY}px)`,
            textAlign: 'center',
            marginBottom: s(50),
          }}
        >
          {titleLines.map((line, i) => (
            <div
              key={i}
              style={{
                fontFamily: FONTS.headline,
                fontSize: s(82),
                fontWeight: 700,
                color: theme.text,
                lineHeight: 1.05,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Date row */}
        <div
          style={{
            opacity: dateOpacity,
            transform: `translateX(${dateTranslateX}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: s(16),
            marginBottom: s(16),
            marginTop: s(20),
          }}
        >
          {/* Decorative diamond */}
          <svg width={s(20)} height={s(20)} viewBox="0 0 20 20">
            <rect
              x="4"
              y="4"
              width="12"
              height="12"
              rx="2"
              fill={COLORS.primary}
              transform="rotate(45 10 10)"
            />
          </svg>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: s(32),
              fontWeight: 600,
              color: COLORS.primary,
              letterSpacing: '0.02em',
            }}
          >
            {props.date}
          </span>
        </div>

        {/* Time row */}
        <div
          style={{
            opacity: dateOpacity,
            transform: `translateX(${dateTranslateX}px)`,
            marginBottom: s(30),
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: s(24),
              fontWeight: 400,
              color: theme.textMuted,
              letterSpacing: '0.01em',
            }}
          >
            {props.time}
          </span>
        </div>

        {/* Location row */}
        <div
          style={{
            opacity: locationOpacity,
            transform: `translateX(${locationTranslateX}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: s(16),
            marginBottom: s(50),
          }}
        >
          {/* Decorative diamond */}
          <svg width={s(18)} height={s(18)} viewBox="0 0 18 18">
            <rect
              x="3"
              y="3"
              width="12"
              height="12"
              rx="2"
              fill={COLORS.accent}
              transform="rotate(45 9 9)"
            />
          </svg>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: s(28),
              fontWeight: 500,
              color: theme.textMuted,
              letterSpacing: '0.02em',
            }}
          >
            {props.location}
          </span>
        </div>

        {/* CTA button */}
        <div
          style={{
            opacity: ctaOpacity,
            transform: `translateY(${ctaTranslateY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: s(26),
              fontWeight: 700,
              color: '#FFFFFF',
              backgroundColor: COLORS.primary,
              padding: `${s(18)}px ${s(56)}px`,
              borderRadius: s(50),
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              boxShadow: `0 8px 32px ${COLORS.primary}66`,
            }}
          >
            {props.cta}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default EventAnnounce;
