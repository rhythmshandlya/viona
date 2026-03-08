import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { FONTS } from '../../fonts';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { CouponBadgeProps } from './schema';

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

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const CouponBadge: React.FC<CouponBadgeProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const s = useScale();
  const { FONTS: PAIR_FONTS, COLORS, SPRING_CONFIG } = getConstants(props);
  const theme = BACKGROUNDS[props.background] || BACKGROUNDS.dark;

  const codeChars = props.code.split('');

  /* ---- 0-15: Background fade in ---- */
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  /* ---- 330-360: Fade out ---- */
  const outroOpacity = interpolate(
    frame,
    [330, 360],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const globalOpacity = bgOpacity * outroOpacity;

  /* ---- 20-45: Badge scales in with spring ---- */
  const badgeSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: SPRING_CONFIG.damping, stiffness: SPRING_CONFIG.stiffness, mass: SPRING_CONFIG.mass },
  });
  const badgeScale = frame >= 20 ? interpolate(badgeSpring, [0, 1], [0, 1]) : 0;
  const badgeOpacity = frame >= 20 ? badgeSpring : 0;

  /* ---- 310-340: Badge scales out ---- */
  const badgeOutSpring = spring({
    frame: frame - 310,
    fps,
    config: { damping: 20, stiffness: 120, mass: 0.8 },
  });
  const badgeOutScale = frame >= 310 ? interpolate(badgeOutSpring, [0, 1], [1, 0]) : 1;

  const finalBadgeScale = badgeScale * badgeOutScale;

  /* ---- 35-50: "USE CODE" label fades in ---- */
  const labelOpacity = interpolate(frame, [35, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- 45-65: Code text character-by-character reveal ---- */
  const codeRevealProgress = interpolate(frame, [45, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const charsVisible = Math.floor(codeRevealProgress * codeChars.length);

  /* ---- 60-80: Description fades in ---- */
  const descOpacity = interpolate(frame, [60, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const descTranslateY = interpolate(frame, [60, 80], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- 80-310: Shimmer effect on code text ---- */
  // Shimmer passes every ~60 frames during the hold phase
  const shimmerCycle = 60;
  const shimmerDuration = 30; // frames for one pass
  let shimmerTranslateX = -200; // off-screen left by default

  if (frame >= 80 && frame <= 310) {
    const holdFrame = (frame - 80) % shimmerCycle;
    if (holdFrame < shimmerDuration) {
      // Map holdFrame 0..shimmerDuration to -200..700 (across the code text area)
      shimmerTranslateX = interpolate(holdFrame, [0, shimmerDuration], [-200, 700], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }

  /* ---- Dashed border style ---- */
  const dashedBorder = `4px dashed ${COLORS.primary}`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: globalOpacity,
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} frame={frame} size={width} />

      {/* Centered badge container */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            transform: `scale(${finalBadgeScale})`,
            opacity: badgeOpacity,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: dashedBorder,
            borderRadius: s(24),
            padding: `${s(80)}px ${s(100)}px`,
            backgroundColor: props.background === 'dark'
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.03)',
            boxShadow: `0 0 80px ${COLORS.primary}22, 0 0 160px ${COLORS.primary}11`,
            position: 'relative',
            overflow: 'hidden',
            minWidth: s(600),
          }}
        >
          {/* Corner decorations */}
          <div
            style={{
              position: 'absolute',
              top: s(16),
              left: s(16),
              width: s(24),
              height: s(24),
              borderTop: `3px solid ${COLORS.primary}`,
              borderLeft: `3px solid ${COLORS.primary}`,
              borderRadius: '4px 0 0 0',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: s(16),
              right: s(16),
              width: s(24),
              height: s(24),
              borderTop: `3px solid ${COLORS.primary}`,
              borderRight: `3px solid ${COLORS.primary}`,
              borderRadius: '0 4px 0 0',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: s(16),
              left: s(16),
              width: s(24),
              height: s(24),
              borderBottom: `3px solid ${COLORS.primary}`,
              borderLeft: `3px solid ${COLORS.primary}`,
              borderRadius: '0 0 0 4px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: s(16),
              right: s(16),
              width: s(24),
              height: s(24),
              borderBottom: `3px solid ${COLORS.primary}`,
              borderRight: `3px solid ${COLORS.primary}`,
              borderRadius: '0 0 4px 0',
            }}
          />

          {/* "USE CODE" label */}
          <div
            style={{
              opacity: labelOpacity,
              fontFamily: PAIR_FONTS.body,
              fontSize: s(24),
              fontWeight: 600,
              color: theme.textMuted,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              marginBottom: s(24),
            }}
          >
            {props.label}
          </div>

          {/* Code text with character reveal + shimmer */}
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              padding: `${s(12)}px ${s(24)}px`,
            }}
          >
            {/* Code characters */}
            <div
              style={{
                fontFamily: FONTS.jetBrainsMono,
                fontSize: s(96),
                fontWeight: 700,
                color: COLORS.primary,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                display: 'flex',
                gap: s(4),
              }}
            >
              {codeChars.map((char, i) => (
                <span
                  key={i}
                  style={{
                    opacity: i < charsVisible ? 1 : 0,
                    transform: i < charsVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'none',
                  }}
                >
                  {char}
                </span>
              ))}
            </div>

            {/* Shimmer gradient overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: s(120),
                height: '100%',
                background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)`,
                transform: `translateX(${shimmerTranslateX}px)`,
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Divider line */}
          <div
            style={{
              width: s(120),
              height: 2,
              backgroundColor: COLORS.secondary,
              opacity: descOpacity * 0.5,
              marginTop: s(28),
              marginBottom: s(28),
              borderRadius: 1,
            }}
          />

          {/* Description */}
          <div
            style={{
              opacity: descOpacity,
              transform: `translateY(${descTranslateY}px)`,
              fontFamily: PAIR_FONTS.body,
              fontSize: s(32),
              fontWeight: 500,
              color: theme.textMuted,
              textAlign: 'center',
              lineHeight: 1.4,
              maxWidth: s(500),
              letterSpacing: '0.01em',
            }}
          >
            {props.description}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default CouponBadge;
