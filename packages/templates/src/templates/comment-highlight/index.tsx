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
import type { CommentHighlightProps, Comment } from './schema';

/* -- Dot-grid background ------------------------------------------------- */

const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  const spacing = s(32);
  const radius = s(1.5);
  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="comment-dot-grid"
            x="0"
            y="0"
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={spacing / 2} cy={spacing / 2} r={radius} fill={color} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#comment-dot-grid)" />
      </svg>
    </AbsoluteFill>
  );
};

/* -- Heart icon SVG ------------------------------------------------------ */

const HeartIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

/* -- Avatar circle with initial ------------------------------------------ */

const AvatarCircle: React.FC<{
  username: string;
  accentColor: string;
  size: number;
}> = ({ username, accentColor, size }) => {
  // Extract first letter after @ or just first letter
  const raw = username.startsWith('@') ? username.slice(1) : username;
  const initial = raw.charAt(0).toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: accentColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: '#FFFFFF',
          fontSize: size * 0.45,
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        {initial}
      </span>
    </div>
  );
};

/* -- Comment bubble ------------------------------------------------------ */

const CommentBubble: React.FC<{
  comment: Comment;
  accentColor: string;
  theme: {
    bg: string;
    text: string;
    textMuted: string;
    gridColor: string;
    cardBg: string;
    cardBorder: string;
  };
  headlineFont: string;
  bodyFont: string;
  opacity: number;
  translateY: number;
  scale: number;
}> = ({ comment, accentColor, theme, headlineFont, bodyFont, opacity, translateY, scale }) => {
  const s = useScale();
  // Generate a pseudo-random timestamp based on username length
  const timestamps = ['2m ago', '5m ago', '12m ago', '23m ago', '1h ago', '3h ago'];
  const tsIndex = comment.username.length % timestamps.length;
  const timestamp = timestamps[tsIndex];

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        width: s(820),
        backgroundColor: theme.cardBg,
        borderRadius: s(28),
        padding: s(44),
        border: `1px solid ${theme.cardBorder}`,
        boxShadow: `0 ${s(20)}px ${s(60)}px rgba(0,0,0,0.25), 0 0 0 1px ${theme.cardBorder}`,
        display: 'flex',
        flexDirection: 'column',
        gap: s(24),
      }}
    >
      {/* Header row: avatar + username + timestamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: s(20),
        }}
      >
        <AvatarCircle
          username={comment.username}
          accentColor={accentColor}
          size={s(64)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: s(4), flex: 1 }}>
          <span
            style={{
              fontFamily: headlineFont,
              fontSize: s(28),
              fontWeight: 700,
              color: theme.text,
              letterSpacing: 0.2,
            }}
          >
            {comment.username}
          </span>
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: s(20),
              fontWeight: 400,
              color: theme.textMuted,
            }}
          >
            {timestamp}
          </span>
        </div>
      </div>

      {/* Comment text */}
      <div
        style={{
          fontFamily: bodyFont,
          fontSize: s(34),
          fontWeight: 400,
          lineHeight: 1.55,
          color: theme.text,
          paddingLeft: s(4),
        }}
      >
        {comment.text}
      </div>

      {/* Footer: like count */}
      {comment.likes !== undefined && comment.likes > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: s(10),
            paddingLeft: s(4),
            paddingTop: s(8),
          }}
        >
          <HeartIcon color={accentColor} size={s(24)} />
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: s(22),
              fontWeight: 600,
              color: theme.textMuted,
            }}
          >
            {comment.likes.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};

/* -- Main component ------------------------------------------------------ */

const CommentHighlight: React.FC<CommentHighlightProps> = (props) => {
  const { FONTS, SPRING_CONFIG } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background] || BACKGROUNDS.dark;
  const accent = props.accentColor;
  const comments = props.comments;
  const commentCount = comments.length;

  // -- Background fade in (0-15) --
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // -- Fade out (330-360) --
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // -- Comment cycling timing --
  // Comments are evenly distributed across frames 20-310
  const commentZoneStart = 20;
  const commentZoneEnd = 310;
  const commentZoneDuration = commentZoneEnd - commentZoneStart;
  const perCommentDuration = commentZoneDuration / commentCount;

  // Each comment: enter (spring slide up) -> hold -> fade out
  const enterDuration = Math.min(20, perCommentDuration * 0.25);
  const exitDuration = Math.min(15, perCommentDuration * 0.15);
  const holdDuration = perCommentDuration - enterDuration - exitDuration;

  return (
    <AbsoluteFill
      style={{
        opacity: bgOpacity * outroOpacity,
        backgroundColor: theme.bg,
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* Subtle radial gradient accent glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, ${accent}10 0%, transparent 70%)`,
        }}
      />

      {/* Comment bubbles container */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {comments.map((comment, i) => {
          const commentStart = commentZoneStart + i * perCommentDuration;
          const commentEnd = commentStart + perCommentDuration;

          // Spring animation for slide-in
          const slideSpring = spring({
            frame: frame - commentStart,
            fps,
            config: SPRING_CONFIG,
          });

          // Translate Y: starts 120px below, springs to 0
          const translateY = interpolate(slideSpring, [0, 1], [120, 0]);

          // Scale: subtle pop from 0.92 to 1
          const scale = interpolate(slideSpring, [0, 1], [0.92, 1]);

          // Enter opacity
          const enterOpacity = interpolate(
            frame,
            [commentStart, commentStart + enterDuration],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          // Exit opacity - fade out before next comment
          const exitStart = commentEnd - exitDuration;
          const exitOpacity = interpolate(
            frame,
            [exitStart, commentEnd],
            [1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          // Only render if within visible range (with small buffer)
          const isVisible = frame >= commentStart - 2 && frame <= commentEnd + 2;
          if (!isVisible) return null;

          return (
            <AbsoluteFill
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CommentBubble
                comment={comment}
                accentColor={accent}
                theme={theme}
                headlineFont={FONTS.headline}
                bodyFont={FONTS.body}
                opacity={enterOpacity * exitOpacity}
                translateY={translateY}
                scale={scale}
              />
            </AbsoluteFill>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default CommentHighlight;
