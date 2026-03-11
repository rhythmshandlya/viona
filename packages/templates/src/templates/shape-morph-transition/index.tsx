import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { ShapeMorphTransitionProps } from './schema';

const ShapeMorphTransition: React.FC<ShapeMorphTransitionProps> = (props) => {
  const { COLORS, FONTS, BACKGROUNDS: BG_THEME } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();

  const morphStart = props.morphFrame;
  const morphEnd = morphStart + 25;

  // --- Cross-fade: before shape fades out, after shape fades in ---
  const beforeOpacity = interpolate(frame, [morphStart, morphEnd], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const afterOpacity = interpolate(frame, [morphStart, morphEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Scale pulse at morph point ---
  const pulseSpring = spring({
    frame: frame - morphStart,
    fps,
    config: { damping: 22, stiffness: 170, mass: 0.8 },
  });
  const settleSpring = spring({
    frame: frame - morphEnd,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const pulseScale = interpolate(pulseSpring, [0, 1], [1, 1.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const settleScale = interpolate(settleSpring, [0, 1], [1.15, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shapeScale = frame < morphEnd ? pulseScale : settleScale;

  // --- Glow ring at morph ---
  const glowOpacity = interpolate(frame, [morphStart, morphStart + 12, morphEnd, morphEnd + 10], [0, 0.6, 0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Label animations ---
  const beforeLabelOpacity = interpolate(frame, [morphStart, morphStart + 15], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const afterLabelOpacity = interpolate(frame, [morphStart + 10, morphEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Intro / outro ---
  const introOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const svgSize = s(200);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG_THEME.bg,
        opacity: introOpacity * outroOpacity,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Shape container */}
      <div
        style={{
          position: 'relative',
          width: svgSize,
          height: svgSize,
          transform: `scale(${shapeScale})`,
        }}
      >
        {/* Glow ring */}
        <div
          style={{
            position: 'absolute',
            inset: -s(30),
            borderRadius: '50%',
            background: `radial-gradient(circle, ${COLORS.accent}44 0%, transparent 70%)`,
            opacity: glowOpacity,
            pointerEvents: 'none',
          }}
        />

        {/* Before shape: rounded square */}
        <svg
          viewBox="0 0 24 24"
          width={svgSize}
          height={svgSize}
          style={{ position: 'absolute', inset: 0, opacity: beforeOpacity }}
        >
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="4"
            fill="none"
            stroke={BG_THEME.textMuted}
            strokeWidth="2"
          />
        </svg>

        {/* After shape: 5-point star */}
        <svg
          viewBox="0 0 24 24"
          width={svgSize}
          height={svgSize}
          style={{ position: 'absolute', inset: 0, opacity: afterOpacity }}
        >
          <polygon
            points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
            fill="none"
            stroke={COLORS.accent}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Labels */}
      <div style={{ position: 'relative', height: s(40), marginTop: s(32) }}>
        <span
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: FONTS.headline,
            fontSize: s(24),
            fontWeight: 700,
            letterSpacing: s(3),
            color: BG_THEME.textMuted,
            textTransform: 'uppercase',
            opacity: beforeLabelOpacity,
            whiteSpace: 'nowrap',
          }}
        >
          {props.beforeLabel}
        </span>
        <span
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: FONTS.headline,
            fontSize: s(24),
            fontWeight: 700,
            letterSpacing: s(3),
            color: COLORS.accent,
            textTransform: 'uppercase',
            opacity: afterLabelOpacity,
            whiteSpace: 'nowrap',
          }}
        >
          {props.afterLabel}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export default ShapeMorphTransition;
