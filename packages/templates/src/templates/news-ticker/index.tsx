import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { NewsTickerProps } from './schema';

const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="news-dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#news-dot-grid)" />
    </svg>
  );
};

const NewsTicker: React.FC<NewsTickerProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const TICKER_BAR_HEIGHT = s(80);
  const BADGE_LEFT_MARGIN = s(24);
  const TEXT_LEFT_OFFSET = s(200);
  const SCROLL_SPEED = s(3.2);

  // --- Animation timeline ---

  // 0-15: Background fade in
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // 10-25: Ticker bar slides up from bottom
  const barSlideY = interpolate(frame, [10, 25], [TICKER_BAR_HEIGHT + 10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 15-30: Badge appears with scale bounce
  const badgeScale = interpolate(frame, [15, 24, 30], [0, 1.15, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const badgeOpacity = interpolate(frame, [15, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 320-340: Ticker bar slides down
  const barExitY = interpolate(frame, [320, 340], [0, TICKER_BAR_HEIGHT + 10], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 330-360: Fade out
  const outroOpacity = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Combined bar Y position
  const barY = frame < 320 ? barSlideY : barSlideY + barExitY;

  // --- Scrolling text ---
  // Duplicate text for seamless loop
  const separator = '   \u2022   ';
  const fullText = props.tickerText + separator + props.tickerText + separator;

  // Measure approximate text width (character count * approximate char width)
  const charWidth = s(18);
  const singleTextWidth = (props.tickerText.length + separator.length) * charWidth;

  // 20-320: Continuous scroll from right to left
  const scrollActive = frame >= 20 && frame <= 320;
  const scrollFrame = scrollActive ? frame - 20 : frame < 20 ? 0 : 300;
  const translateX = width - scrollFrame * SCROLL_SPEED;

  // Reset position when first copy scrolls entirely off-screen for seamless loop
  const effectiveTranslateX =
    translateX < -singleTextWidth ? translateX + singleTextWidth : translateX;

  // Text visibility (only when bar is visible)
  const textOpacity = interpolate(frame, [20, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const textExitOpacity = interpolate(frame, [318, 328], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * outroOpacity,
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* Ticker bar at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: TICKER_BAR_HEIGHT,
          backgroundColor: theme.barBg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transform: `translateY(${barY}px)`,
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          borderTop: `1px solid ${
            props.background === 'dark'
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.06)'
          }`,
        }}
      >
        {/* Badge pill */}
        <div
          style={{
            position: 'absolute',
            left: BADGE_LEFT_MARGIN,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: props.accentColor,
            borderRadius: s(6),
            padding: `${s(8)}px ${s(18)}px`,
            transform: `scale(${badgeScale})`,
            opacity: badgeOpacity,
            boxShadow: `0 0 ${s(20)}px ${props.accentColor}44`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.headline,
              fontSize: s(18),
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: s(2),
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            {props.badge}
          </span>
        </div>

        {/* Scrolling text */}
        <div
          style={{
            position: 'absolute',
            left: TEXT_LEFT_OFFSET,
            right: 0,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: s(26),
              fontWeight: 500,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: textOpacity * textExitOpacity,
              transform: `translateX(${effectiveTranslateX}px)`,
              letterSpacing: 0.5,
            }}
          >
            {fullText}
          </span>
        </div>

        {/* Gradient fade on left edge of text area for smooth blending */}
        <div
          style={{
            position: 'absolute',
            left: TEXT_LEFT_OFFSET - s(4),
            top: 0,
            bottom: 0,
            width: s(60),
            background: `linear-gradient(to right, ${
              props.background === 'dark'
                ? 'rgba(0,0,0,0.75)'
                : 'rgba(255,255,255,0.85)'
            }, transparent)`,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Gradient fade on right edge */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: s(80),
            background: `linear-gradient(to left, ${
              props.background === 'dark'
                ? 'rgba(0,0,0,0.75)'
                : 'rgba(255,255,255,0.85)'
            }, transparent)`,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default NewsTicker;
