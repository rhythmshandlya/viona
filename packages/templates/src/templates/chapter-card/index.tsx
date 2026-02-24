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
import type { ChapterCardProps } from './schema';

/* ── DotGrid SVG Background ─────────────────────────────────────── */

const DotGrid: React.FC<{ color: string; opacity: number; gridWidth: number; gridHeight: number }> = ({
  color,
  opacity,
  gridWidth,
  gridHeight,
}) => {
  const s = useScale();
  const spacing = s(30);
  const radius = s(1.5);
  const cols = Math.ceil(gridWidth / spacing) + 1;
  const rows = Math.ceil(gridHeight / spacing) + 1;

  const dots: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={c * spacing}
          cy={r * spacing}
          r={radius}
          fill={color}
        />
      );
    }
  }

  return (
    <svg
      width={gridWidth}
      height={gridHeight}
      viewBox={`0 0 ${gridWidth} ${gridHeight}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        opacity,
      }}
    >
      {dots}
    </svg>
  );
};

/* ── Accent Line SVG ─────────────────────────────────────────────── */

const AccentLine: React.FC<{
  progress: number;
  color: string;
  y: number;
  canvasWidth: number;
  s: (px: number) => number;
}> = ({ progress, color, y, canvasWidth, s }) => {
  const lineWidth = s(200);
  const strokeWidth = s(4);
  const dashOffset = lineWidth * (1 - progress);

  return (
    <svg
      width={lineWidth}
      height={strokeWidth + 2}
      viewBox={`0 0 ${lineWidth} ${strokeWidth + 2}`}
      style={{
        position: 'absolute',
        top: y,
        left: (canvasWidth - lineWidth) / 2,
      }}
    >
      <line
        x1={0}
        y1={(strokeWidth + 2) / 2}
        x2={lineWidth}
        y2={(strokeWidth + 2) / 2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={lineWidth}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />
    </svg>
  );
};

/* ── Main Component ──────────────────────────────────────────────── */

const ChapterCard: React.FC<ChapterCardProps> = (props) => {
  const { COLORS, FONTS, SPRING_CONFIG } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const s = useScale();
  const palette = BACKGROUNDS[props.background];

  const formattedNumber = String(props.chapterNumber).padStart(2, '0');

  // ── Phase: Background fade in (0-15) ─────────────────────────
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // ── Phase: Chapter number scales in (10-30, spring) ──────────
  const numberScale = spring({
    frame: frame - 10,
    fps,
    config: {
      damping: SPRING_CONFIG.damping,
      stiffness: SPRING_CONFIG.stiffness,
      mass: SPRING_CONFIG.mass,
    },
  });

  const numberOpacity = interpolate(frame, [10, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase: Title slides in from right (25-50, spring) ────────
  const titleSpring = spring({
    frame: frame - 25,
    fps,
    config: {
      damping: 20,
      stiffness: 90,
      mass: 0.8,
    },
  });

  const titleTranslateX = interpolate(titleSpring, [0, 1], [120, 0]);
  const titleOpacity = interpolate(frame, [25, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase: Subtitle fades in (35-55) ─────────────────────────
  const subtitleOpacity = interpolate(frame, [35, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const subtitleTranslateY = interpolate(frame, [35, 55], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase: Accent line draws (40-60) ─────────────────────────
  const lineProgress = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase: Exit — all elements slide/fade out (300-330) ──────
  const exitOpacity = interpolate(frame, [300, 330], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const exitSlideY = interpolate(frame, [300, 330], [0, -40], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase: Final fade out (330-360) ──────────────────────────
  const finalFade = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Combined exit multiplier
  const exitMultiplier = exitOpacity * finalFade;

  // ── Vertical positioning ─────────────────────────────────────
  const centerY = height / 2;
  const numberY = centerY - s(60);
  const titleY = centerY + s(20);
  const subtitleY = titleY + s(65);
  const lineY = titleY - s(20);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.bg,
        opacity: bgOpacity * finalFade,
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={palette.dotColor} opacity={bgOpacity} gridWidth={width} gridHeight={height} />

      {/* Content wrapper for exit animation */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: exitOpacity,
          transform: `translateY(${exitSlideY}px)`,
        }}
      >
        {/* Large chapter number — semi-transparent behind everything */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            textAlign: 'center',
            top: numberY - s(110),
            fontFamily: FONTS.headline,
            fontSize: s(280),
            fontWeight: 900,
            color: palette.numberColor,
            opacity: numberOpacity * 0.08,
            transform: `scale(${numberScale})`,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {formattedNumber}
        </div>

        {/* Accent line */}
        <AccentLine
          progress={lineProgress}
          color={props.accentColor}
          y={lineY}
          canvasWidth={width}
          s={s}
        />

        {/* Chapter label (small) */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            textAlign: 'center',
            top: titleY - s(50),
            fontFamily: FONTS.body,
            fontSize: s(18),
            fontWeight: 600,
            color: props.accentColor,
            opacity: titleOpacity,
            transform: `translateX(${titleTranslateX}px)`,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
          }}
        >
          Chapter {formattedNumber}
        </div>

        {/* Chapter title */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            textAlign: 'center',
            top: titleY,
            padding: `0 ${s(80)}px`,
            fontFamily: FONTS.headline,
            fontSize: s(64),
            fontWeight: 900,
            color: palette.text,
            opacity: titleOpacity,
            transform: `translateX(${titleTranslateX}px)`,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
          }}
        >
          {props.chapterTitle}
        </div>

        {/* Subtitle */}
        {props.subtitle && (
          <div
            style={{
              position: 'absolute',
              width: '100%',
              textAlign: 'center',
              top: subtitleY,
              padding: `0 ${s(140)}px`,
              fontFamily: FONTS.body,
              fontSize: s(24),
              fontWeight: 400,
              color: palette.subtitleColor,
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleTranslateY}px)`,
              lineHeight: 1.5,
            }}
          >
            {props.subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export default ChapterCard;
