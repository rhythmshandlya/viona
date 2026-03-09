import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { SubscribeNudgeProps } from './schema';

/* ------------------------------------------------------------------ */
/*  SVG background                                                     */
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
        <pattern id="sn-dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#sn-dot-grid)" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Inline SVG icons                                                   */
/* ------------------------------------------------------------------ */

const ThumbsUpIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    <path d="M14 2l-3 7v13h9a2 2 0 0 0 2-1.75l1.38-9A2 2 0 0 0 21.4 9H14" />
  </svg>
);

const BellIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const SubscribeNudge: React.FC<SubscribeNudgeProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  /* ---- global fades ---- */
  const bgFadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- card slide ---- */
  const cardSpringIn = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });

  const cardSlideOut = interpolate(frame, [300, 330], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Card slides from +400 up to 0, then back to +400
  const cardY = interpolate(cardSpringIn, [0, 1], [400, 0]) + cardSlideOut * 400;

  const cardOpacity = frame < 20 ? 0 : fadeOut;

  /* ---- subscribe button pulse ---- */
  const btnSpring = spring({
    frame: frame - 40,
    fps,
    config: { damping: 10, stiffness: 160, mass: 0.6 },
  });

  const btnScale = frame < 40 ? 0 : btnSpring;

  /* ---- like icon bounce ---- */
  const likeSpring = spring({
    frame: frame - 55,
    fps,
    config: { damping: 10, stiffness: 140, mass: 0.7 },
  });

  const likeScale = frame < 55 ? 0 : likeSpring;

  /* ---- bell icon bounce + wiggle ---- */
  const bellSpring = spring({
    frame: frame - 70,
    fps,
    config: { damping: 10, stiffness: 140, mass: 0.7 },
  });

  const bellScale = frame < 70 ? 0 : bellSpring;

  // Initial wiggle (70-90) + periodic subtle wiggle (90-300)
  let bellRotation = 0;
  if (frame >= 70 && frame <= 90) {
    // Entrance wiggle: stronger amplitude that decays
    const t = (frame - 70) / 20;
    bellRotation = Math.sin(t * Math.PI * 6) * 18 * (1 - t);
  } else if (frame > 90 && frame <= 300) {
    // Periodic subtle wiggle every ~60 frames
    const cycle = ((frame - 90) % 60) / 60;
    const inWiggleWindow = cycle < 0.25; // wiggle for first 25% of each cycle
    if (inWiggleWindow) {
      const t = cycle / 0.25;
      bellRotation = Math.sin(t * Math.PI * 4) * 8 * (1 - t);
    }
  }

  /* ---- styles ---- */
  const cardWidth = s(680);
  const cardHeight = s(200);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgFadeIn * fadeOut,
        overflow: 'hidden',
      }}
    >
      <DotGrid color={theme.gridColor} />

      {/* Floating card */}
      <div
        style={{
          position: 'absolute',
          bottom: s(180),
          left: '50%',
          transform: `translateX(-50%) translateY(${cardY}px)`,
          opacity: cardOpacity,
          width: cardWidth,
          height: cardHeight,
          background: theme.cardBg,
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: s(24),
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(20),
          boxShadow: `0 ${s(20)}px ${s(60)}px rgba(0, 0, 0, 0.3)`,
        }}
      >
        {/* Channel name */}
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: s(22),
            fontWeight: 500,
            color: theme.textMuted,
            letterSpacing: s(1.5),
            textTransform: 'uppercase',
          }}
        >
          {props.channelName}
        </span>

        {/* Action row: Subscribe button + Like + Bell */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: s(24),
          }}
        >
          {/* Subscribe button */}
          <div
            style={{
              transform: `scale(${btnScale})`,
              transformOrigin: 'center',
            }}
          >
            <div
              style={{
                backgroundColor: props.accentColor,
                borderRadius: s(50),
                padding: `${s(14)}px ${s(40)}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: `0 ${s(4)}px ${s(20)}px ${props.accentColor}66`,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.headline,
                  fontSize: s(24),
                  fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: s(1),
                  textTransform: 'uppercase',
                }}
              >
                {props.buttonText}
              </span>
            </div>
          </div>

          {/* Like icon */}
          {props.showLike && (
            <div
              style={{
                transform: `scale(${likeScale})`,
                transformOrigin: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: s(56),
                height: s(56),
                borderRadius: '50%',
                background: theme.cardBg,
                border: `1px solid ${theme.cardBorder}`,
              }}
            >
              <ThumbsUpIcon size={s(28)} color={theme.text} />
            </div>
          )}

          {/* Bell icon */}
          {props.showBell && (
            <div
              style={{
                transform: `scale(${bellScale}) rotate(${bellRotation}deg)`,
                transformOrigin: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: s(56),
                height: s(56),
                borderRadius: '50%',
                background: theme.cardBg,
                border: `1px solid ${theme.cardBorder}`,
              }}
            >
              <BellIcon size={s(28)} color={theme.text} />
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default SubscribeNudge;
