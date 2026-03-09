import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { TopicTitleProps } from './schema';

const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="topic-dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#topic-dot-grid)" />
    </svg>
  );
};

const TopicTitle: React.FC<TopicTitleProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  // ── Background fade in (0-15) & fade out (330-360) ──
  const bgIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bgOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bgOpacity = bgIn * bgOut;

  // ── Category tag (10-25 in, 310-340 out) ──
  const tagIn = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tagSlideY = interpolate(frame, [10, 25], [-16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Title spring scale (20-45 in) ──
  const titleSpring = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.8 },
  });
  const titleScale = interpolate(titleSpring, [0, 1], [0.8, 1.0]);
  const titleOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Accent underline draw (35-55) ──
  const underlineProgress = interpolate(frame, [35, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const underlineWidth = s(320);

  // ── Subtitle (45-65 in) ──
  const subtitleOpacity = interpolate(frame, [45, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subtitleSlideY = interpolate(frame, [45, 65], [18, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Exit (310-340): elements fade out + scale down ──
  const exitOpacity = interpolate(frame, [310, 340], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitScale = interpolate(frame, [310, 340], [1, 0.95], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity,
        overflow: 'hidden',
      }}
    >
      <DotGrid color={theme.gridColor} />

      {/* Content container */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: exitOpacity,
          transform: `scale(${exitScale})`,
        }}
      >
        {/* Category tag pill */}
        {props.tag && (
          <div
            style={{
              opacity: tagIn,
              transform: `translateY(${tagSlideY}px)`,
              marginBottom: s(32),
            }}
          >
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: s(16),
                fontWeight: 600,
                letterSpacing: s(2.5),
                color: '#FFFFFF',
                textTransform: 'uppercase',
                backgroundColor: props.accentColor,
                padding: `${s(10)}px ${s(24)}px`,
                borderRadius: s(50),
                display: 'inline-block',
              }}
            >
              {props.tag}
            </span>
          </div>
        )}

        {/* Title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
          }}
        >
          <h1
            style={{
              fontFamily: FONTS.headline,
              fontSize: s(82),
              fontWeight: 800,
              color: theme.text,
              lineHeight: 1.1,
              letterSpacing: -1,
              textAlign: 'center',
              margin: 0,
              padding: `0 ${s(80)}px`,
              maxWidth: width,
            }}
          >
            {props.title}
          </h1>
        </div>

        {/* Accent underline — SVG line drawing from center outward */}
        <div
          style={{
            marginTop: s(24),
            marginBottom: s(24),
            height: s(6),
            width: underlineWidth,
            position: 'relative',
          }}
        >
          <svg
            width={underlineWidth}
            height="6"
            viewBox={`0 0 ${underlineWidth} 6`}
            style={{ display: 'block' }}
          >
            <line
              x1={underlineWidth / 2 - (underlineWidth / 2) * underlineProgress}
              y1="3"
              x2={underlineWidth / 2 + (underlineWidth / 2) * underlineProgress}
              y2="3"
              stroke={props.accentColor}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Subtitle */}
        {props.subtitle && (
          <div
            style={{
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleSlideY}px)`,
            }}
          >
            <p
              style={{
                fontFamily: FONTS.body,
                fontSize: s(30),
                fontWeight: 400,
                color: theme.textMuted,
                textAlign: 'center',
                margin: 0,
                padding: `0 ${s(120)}px`,
                lineHeight: 1.5,
              }}
            >
              {props.subtitle}
            </p>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default TopicTitle;
