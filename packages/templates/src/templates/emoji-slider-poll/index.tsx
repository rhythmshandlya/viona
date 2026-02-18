import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { EmojiSliderPollProps } from './schema';

/* ── SVG dot-grid background ────────────────────────────────── */
const DotGrid: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <defs>
      <pattern id="emoji-poll-dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="16" cy="16" r="1" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#emoji-poll-dot-grid)" />
  </svg>
);

/* ── Main component ─────────────────────────────────────────── */
const EmojiSliderPoll: React.FC<EmojiSliderPollProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  const TRACK_WIDTH = 600;
  const TRACK_HEIGHT = 16;
  const TRACK_RADIUS = TRACK_HEIGHT / 2;
  const EMOJI_SIZE = 56;
  const TRACK_Y = 540; // vertical center of the composition
  const TRACK_X = (1080 - TRACK_WIDTH) / 2;

  /* ── Animation timeline ─────────────────────────────────── */

  // 0-15: Background fade in
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // 15-35: Question text fades in
  const questionOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const questionSlideY = interpolate(frame, [15, 35], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // 30-50: Slider track appears (draws from left to right)
  const trackScaleX = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // 50-60: Emoji appears at left end of track
  const emojiAppearScale = interpolate(frame, [50, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(2)),
  });

  // 60-180: Emoji slides along track to result position (eased cubic)
  const resultFraction = props.result / 100;
  const slideProgress = interpolate(frame, [60, 180], [0, resultFraction], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Emoji x position along the track
  const emojiX = TRACK_X + slideProgress * TRACK_WIDTH;

  // 60-180: Track gradient fill in sync with emoji
  const fillWidth = slideProgress * TRACK_WIDTH;

  // 180-200: Result label appears
  const resultOpacity = interpolate(frame, [180, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const resultSlideY = interpolate(frame, [180, 200], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // 200-310: Hold — emoji does subtle bounce
  const bouncePhase = frame >= 200 && frame <= 310;
  let emojiBounceY = 0;
  if (bouncePhase) {
    const bounceFrame = frame - 200;
    const cycle = (bounceFrame % 30) / 30; // 1-second cycle at 30fps
    emojiBounceY = Math.sin(cycle * Math.PI * 2) * 4;
  }

  // 310-340: Elements fade out
  const elementsFadeOut = interpolate(frame, [310, 340], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 330-360: Full fade out
  const finalFadeOut = interpolate(frame, [330, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const contentOpacity = frame < 310 ? 1 : elementsFadeOut;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * finalFadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* Question text */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: questionOpacity * contentOpacity,
          transform: `translateY(${questionSlideY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: 48,
            fontWeight: 700,
            color: theme.text,
            lineHeight: 1.3,
            padding: '0 80px',
            display: 'inline-block',
          }}
        >
          {props.question}
        </span>
      </div>

      {/* Slider track container */}
      <div
        style={{
          position: 'absolute',
          top: TRACK_Y - TRACK_HEIGHT / 2,
          left: TRACK_X,
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          opacity: contentOpacity,
        }}
      >
        {/* Track background (draws in from left) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: TRACK_RADIUS,
            backgroundColor: theme.trackBg,
            border: `1px solid ${theme.trackBorder}`,
            transform: `scaleX(${trackScaleX})`,
            transformOrigin: 'left center',
          }}
        />

        {/* Gradient fill (follows emoji) */}
        {frame >= 60 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: Math.max(fillWidth, TRACK_HEIGHT),
              height: TRACK_HEIGHT,
              borderRadius: TRACK_RADIUS,
              background: `linear-gradient(90deg, ${props.accentColor}88, ${props.accentColor})`,
              opacity: trackScaleX,
            }}
          />
        )}
      </div>

      {/* Emoji on the track */}
      {frame >= 50 && (
        <div
          style={{
            position: 'absolute',
            top: TRACK_Y - EMOJI_SIZE / 2 + emojiBounceY,
            left: emojiX - EMOJI_SIZE / 2,
            width: EMOJI_SIZE,
            height: EMOJI_SIZE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${emojiAppearScale})`,
            opacity: contentOpacity,
            fontSize: 44,
            lineHeight: 1,
            userSelect: 'none',
            filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3))',
          }}
        >
          {props.emoji}
        </div>
      )}

      {/* Result label */}
      {frame >= 180 && (
        <div
          style={{
            position: 'absolute',
            top: TRACK_Y + TRACK_HEIGHT / 2 + 32,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: resultOpacity * contentOpacity,
            transform: `translateY(${resultSlideY}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 32,
              fontWeight: 600,
              color: props.accentColor,
              letterSpacing: 1,
            }}
          >
            {props.resultLabel}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default EmojiSliderPoll;
