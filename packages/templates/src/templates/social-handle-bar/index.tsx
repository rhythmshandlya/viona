import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { getConstants, BACKGROUNDS, getPlatformInfo } from './constants';
import type { SocialHandleBarProps, Handle } from './schema';

const DotGrid: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <defs>
      <pattern
        id="social-dot-grid"
        width="32"
        height="32"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="16" cy="16" r="1" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#social-dot-grid)" />
  </svg>
);

const PlatformIcon: React.FC<{
  abbr: string;
  color: string;
  size: number;
}> = ({ abbr, color, size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <span
      style={{
        color: '#FFFFFF',
        fontSize: size * 0.4,
        fontWeight: 700,
        letterSpacing: -0.5,
        lineHeight: 1,
      }}
    >
      {abbr}
    </span>
  </div>
);

const HandleRow: React.FC<{
  handle: Handle;
  index: number;
  frame: number;
  fps: number;
  durationInFrames: number;
  theme: (typeof BACKGROUNDS)[keyof typeof BACKGROUNDS];
  headlineFont: string;
  bodyFont: string;
  springConfig: { damping: number; stiffness: number; mass: number };
}> = ({
  handle,
  index,
  frame,
  fps,
  durationInFrames,
  theme,
  headlineFont,
  bodyFont,
  springConfig,
}) => {
  const { abbr, color } = getPlatformInfo(handle.platform, handle.color);

  // Staggered entrance: first at frame 20, each subsequent 15 frames later
  const enterFrame = 20 + index * 15;

  const slideIn = spring({
    frame: frame - enterFrame,
    fps,
    config: springConfig,
  });

  // Exit: all slide out starting at frame 300
  const exitProgress = interpolate(frame, [300, 330], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const translateX = interpolate(slideIn, [0, 1], [-600, 0]) + exitProgress * 600;
  const opacity = slideIn * (1 - exitProgress);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        transform: `translateX(${translateX}px)`,
        opacity,
        padding: '20px 36px',
        borderRadius: 20,
        backgroundColor: theme.handleBg,
        border: `1px solid ${theme.handleBorder}`,
        backdropFilter: 'blur(8px)',
        width: 'fit-content',
        maxWidth: 700,
      }}
    >
      <PlatformIcon abbr={abbr} color={color} size={64} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: 18,
            fontWeight: 500,
            color: theme.textMuted,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          {handle.platform}
        </span>
        <span
          style={{
            fontFamily: headlineFont,
            fontSize: 32,
            fontWeight: 600,
            color: theme.text,
            letterSpacing: -0.3,
          }}
        >
          {handle.username}
        </span>
      </div>
    </div>
  );
};

const SocialHandleBar: React.FC<SocialHandleBarProps> = (props) => {
  const { FONTS, SPRING_CONFIG } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  // Background fade in (0-15)
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Final fade out (330-360)
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * fadeOut,
        overflow: 'hidden',
      }}
    >
      <DotGrid color={theme.gridColor} />

      {/* Lower-third positioning: bottom 40% of the frame */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          paddingBottom: 120,
          paddingLeft: 72,
          gap: 16,
        }}
      >
        {props.handles.map((handle, i) => (
          <HandleRow
            key={`${handle.platform}-${i}`}
            handle={handle}
            index={i}
            frame={frame}
            fps={fps}
            durationInFrames={durationInFrames}
            theme={theme}
            headlineFont={FONTS.headline}
            bodyFont={FONTS.body}
            springConfig={SPRING_CONFIG}
          />
        ))}
      </AbsoluteFill>

      {/* Subtle accent line at the bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${props.accentColor}, ${props.colors.accent})`,
          opacity: interpolate(frame, [20, 40, 300, 330], [0, 0.8, 0.8, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />
    </AbsoluteFill>
  );
};

export default SocialHandleBar;
