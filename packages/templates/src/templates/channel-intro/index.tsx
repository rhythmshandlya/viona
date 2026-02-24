import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { ChannelIntroProps } from './schema';

/* ------------------------------------------------------------------ */
/*  DotGrid SVG background                                            */
/* ------------------------------------------------------------------ */
const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="channel-dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#channel-dot-grid)" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Floating geometric shapes configuration                           */
/* ------------------------------------------------------------------ */
interface FloatingShape {
  type: 'circle' | 'square';
  size: number;
  startX: number;
  startY: number;
  driftFreqX: number;
  driftFreqY: number;
  driftAmpX: number;
  driftAmpY: number;
  opacity: number;
  enterFrame: number;
}

const SHAPES: FloatingShape[] = [
  { type: 'circle', size: 90,  startX: -60,   startY: 180,  driftFreqX: 0.012, driftFreqY: 0.018, driftAmpX: 18, driftAmpY: 12, opacity: 0.10, enterFrame: 10 },
  { type: 'square', size: 70,  startX: 1140,  startY: 320,  driftFreqX: 0.015, driftFreqY: 0.010, driftAmpX: 14, driftAmpY: 20, opacity: 0.08, enterFrame: 14 },
  { type: 'circle', size: 50,  startX: 200,   startY: -60,  driftFreqX: 0.020, driftFreqY: 0.014, driftAmpX: 22, driftAmpY: 16, opacity: 0.12, enterFrame: 12 },
  { type: 'square', size: 60,  startX: 880,   startY: 1140, driftFreqX: 0.010, driftFreqY: 0.016, driftAmpX: 16, driftAmpY: 18, opacity: 0.09, enterFrame: 16 },
  { type: 'circle', size: 40,  startX: -40,   startY: 780,  driftFreqX: 0.018, driftFreqY: 0.022, driftAmpX: 20, driftAmpY: 14, opacity: 0.15, enterFrame: 18 },
  { type: 'square', size: 80,  startX: 1140,  startY: 860,  driftFreqX: 0.013, driftFreqY: 0.011, driftAmpX: 12, driftAmpY: 22, opacity: 0.10, enterFrame: 20 },
];

/* Rest positions (inside the canvas) */
const SHAPE_REST: { x: number; y: number }[] = [
  { x: 160,  y: 220 },
  { x: 900,  y: 340 },
  { x: 320,  y: 140 },
  { x: 760,  y: 920 },
  { x: 140,  y: 800 },
  { x: 920,  y: 860 },
];

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
const ChannelIntro: React.FC<ChannelIntroProps> = (props) => {
  const { FONTS, SPRING_CONFIG } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  /* ------ global fade in / out ------ */
  const bgFadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ------ scale-down at outro ------ */
  const outroScale = interpolate(frame, [300, 330], [1, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const outroOpacity = interpolate(frame, [300, 330], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ------ channel name spring (frames 20-50) ------ */
  const nameSpring = spring({
    frame: frame - 20,
    fps,
    config: SPRING_CONFIG,
  });
  const nameScale = interpolate(nameSpring, [0, 1], [0.5, 1]);
  const nameOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ------ accent ring (SVG circle with dashOffset, frames 40-60) ------ */
  const ringRadius = s(180);
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProgress = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringDashOffset = ringCircumference * (1 - ringProgress);
  const ringOpacity = interpolate(frame, [40, 50], [0, 0.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ------ tagline (frames 55-75) ------ */
  const taglineOpacity = interpolate(frame, [55, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineSlideY = interpolate(frame, [55, 75], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ------ accent gradient glow behind name ------ */
  const glowOpacity = interpolate(frame, [30, 50], [0, 0.18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: bgFadeIn * fadeOut }}>
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* Floating geometric shapes */}
      {SHAPES.map((shape, i) => {
        const rest = SHAPE_REST[i];

        /* Fly-in from edge (shape.enterFrame to shape.enterFrame + 20) */
        const enterProgress = interpolate(
          frame,
          [shape.enterFrame, shape.enterFrame + 20],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        const x = interpolate(enterProgress, [0, 1], [shape.startX, rest.x])
          + Math.sin(frame * shape.driftFreqX) * shape.driftAmpX * enterProgress;
        const y = interpolate(enterProgress, [0, 1], [shape.startY, rest.y])
          + Math.sin(frame * shape.driftFreqY + i * 1.5) * shape.driftAmpY * enterProgress;

        const shapeOpacity = interpolate(enterProgress, [0, 0.4], [0, shape.opacity], {
          extrapolateRight: 'clamp',
        }) * outroOpacity;

        const rotation = Math.sin(frame * 0.008 + i * 2) * 15;

        const isCircle = shape.type === 'circle';

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - shape.size / 2,
              top: y - shape.size / 2,
              width: shape.size,
              height: shape.size,
              opacity: shapeOpacity,
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {isCircle ? (
              <svg width={shape.size} height={shape.size}>
                <circle
                  cx={shape.size / 2}
                  cy={shape.size / 2}
                  r={shape.size / 2 - 2}
                  fill="none"
                  stroke={props.accentColor}
                  strokeWidth={2}
                />
              </svg>
            ) : (
              <svg width={shape.size} height={shape.size}>
                <rect
                  x={2}
                  y={2}
                  width={shape.size - 4}
                  height={shape.size - 4}
                  rx={6}
                  ry={6}
                  fill="none"
                  stroke={props.accentColor}
                  strokeWidth={2}
                />
              </svg>
            )}
          </div>
        );
      })}

      {/* Center content wrapper (scales down during outro) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${outroScale})`,
          opacity: outroOpacity,
        }}
      >
        {/* Accent gradient glow */}
        <div
          style={{
            position: 'absolute',
            width: s(420),
            height: s(420),
            borderRadius: '50%',
            background: `radial-gradient(circle, ${props.accentColor} 0%, transparent 70%)`,
            opacity: glowOpacity,
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />

        {/* Accent ring (SVG circle with dashOffset animation) */}
        <svg
          width={ringRadius * 2 + s(20)}
          height={ringRadius * 2 + s(20)}
          style={{ position: 'absolute', pointerEvents: 'none', opacity: ringOpacity }}
        >
          <circle
            cx={ringRadius + s(10)}
            cy={ringRadius + s(10)}
            r={ringRadius}
            fill="none"
            stroke={props.accentColor}
            strokeWidth={2}
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringDashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${ringRadius + s(10)} ${ringRadius + s(10)})`}
          />
        </svg>

        {/* Channel name */}
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(72),
            fontWeight: 800,
            color: theme.text,
            letterSpacing: s(8),
            textAlign: 'center',
            opacity: nameOpacity,
            transform: `scale(${nameScale})`,
            lineHeight: 1.1,
            maxWidth: s(900),
            zIndex: 1,
          }}
        >
          {props.channelName}
        </span>

        {/* Tagline */}
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: s(24),
            fontWeight: 400,
            color: theme.textMuted,
            letterSpacing: s(4),
            textAlign: 'center',
            opacity: taglineOpacity,
            transform: `translateY(${taglineSlideY}px)`,
            marginTop: s(24),
            zIndex: 1,
          }}
        >
          {props.tagline}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export default ChannelIntro;
