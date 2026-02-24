import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { getConstants, SEVERITY_COLORS, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { AlertBannerProps } from './schema';

/* ------------------------------------------------------------------ */
/*  DotGrid SVG background                                             */
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

/* ------------------------------------------------------------------ */
/*  Warning triangle SVG icon                                          */
/* ------------------------------------------------------------------ */

const WarningIcon: React.FC<{ color: string; size: number }> = ({
  color,
  size,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      fill={color}
      opacity={0.15}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="12"
      y1="9"
      x2="12"
      y2="13"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <circle cx="12" cy="17" r="0.5" fill={color} stroke={color} strokeWidth={1} />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const AlertBanner: React.FC<AlertBannerProps> = (props) => {
  const { FONTS, SPRING_CONFIG } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];
  const severityColor = SEVERITY_COLORS[props.severity];

  /* ---- Background fade in (0-15) ---- */
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- Banner drop from top with spring (20-40) ---- */
  const bannerSpring = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: {
      damping: SPRING_CONFIG.damping,
      stiffness: SPRING_CONFIG.stiffness,
      mass: SPRING_CONFIG.mass,
    },
  });
  const bannerTranslateY = interpolate(bannerSpring, [0, 1], [-100, 0]);

  /* ---- Icon scale bounce (35-50) ---- */
  const iconSpring = spring({
    frame: Math.max(0, frame - 35),
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
  });

  /* ---- Text fade in (45-60) ---- */
  const textOpacity = interpolate(frame, [45, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- Hold pulse (60-300): banner opacity oscillates 0.95-1.0 ---- */
  const pulseOpacity =
    frame >= 60 && frame <= 300
      ? 0.95 + Math.sin((frame - 60) * 0.15) * 0.05
      : 1.0;

  /* ---- Banner slides back up (300-320) ---- */
  const exitSlide = interpolate(frame, [300, 320], [0, -100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- Fade out (330-360) ---- */
  const fadeOut = interpolate(
    frame,
    [330, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  /* ---- Composite banner Y position ---- */
  const bannerY = frame < 300 ? bannerTranslateY : exitSlide;

  /* ---- Banner visibility: hidden before drop starts ---- */
  const bannerVisible = frame >= 20;

  /* ---- Banner height and vertical center position ---- */
  const bannerHeight = s(120);
  const bannerTop = (width - bannerHeight) / 2;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * fadeOut,
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} frame={frame} size={width} />

      {/* Banner */}
      {bannerVisible && (
        <div
          style={{
            position: 'absolute',
            top: bannerTop,
            left: 0,
            right: 0,
            height: bannerHeight,
            backgroundColor: severityColor,
            transform: `translateY(${bannerY}px)`,
            opacity: pulseOpacity,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(24),
            padding: `0 ${s(60)}px`,
            boxShadow: `0 ${s(8)}px ${s(32)}px ${severityColor}40, 0 ${s(2)}px ${s(8)}px rgba(0,0,0,0.3)`,
          }}
        >
          {/* Icon */}
          {props.showIcon && (
            <div
              style={{
                transform: `scale(${iconSpring})`,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <WarningIcon color="#FFFFFF" size={s(56)} />
            </div>
          )}

          {/* Text */}
          <div
            style={{
              opacity: textOpacity,
              fontFamily: FONTS.headline,
              fontSize: s(42),
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: s(1.5),
              textTransform: 'uppercase',
              textAlign: 'center',
              lineHeight: 1.2,
              textShadow: `0 ${s(2)}px ${s(4)}px rgba(0,0,0,0.2)`,
            }}
          >
            {props.text}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default AlertBanner;
