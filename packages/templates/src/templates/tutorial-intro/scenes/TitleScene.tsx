import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CleanBg } from '../components/CleanBg';
import type { TutorialIntroProps } from '../schema';
import { getConstants } from '../constants';

export const TitleScene: React.FC<TutorialIntroProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { COLORS, FONTS, SPRING_CONFIG } = getConstants(props);

  // Title springs in from below
  const titleSpring = spring({
    frame,
    fps,
    config: SPRING_CONFIG,
    durationInFrames: 40,
  });

  const titleTranslateY = interpolate(titleSpring, [0, 1], [60, 0], {
    extrapolateRight: 'clamp',
  });

  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Subtitle fades in with delay
  const subtitleOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const subtitleTranslateY = interpolate(frame, [20, 40], [20, 0], {
    extrapolateRight: 'clamp',
  });

  // Author appears with delay
  const authorOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Decorative accent bar animates in
  const accentBarWidth = interpolate(frame, [10, 45], [0, 120], {
    extrapolateRight: 'clamp',
  });

  // Thin separator line for author
  const separatorWidth = interpolate(frame, [35, 55], [0, 60], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <CleanBg background={COLORS.background} accent={COLORS.accent} />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
        }}
      >
        {/* Decorative accent bar */}
        <div
          style={{
            width: accentBarWidth,
            height: 5,
            backgroundColor: COLORS.primary,
            borderRadius: 3,
            marginBottom: 40,
          }}
        />

        {/* Title */}
        <div
          style={{
            fontFamily: FONTS.headline,
            fontSize: 72,
            fontWeight: 700,
            color: COLORS.text,
            textAlign: 'center',
            lineHeight: 1.15,
            transform: `translateY(${titleTranslateY}px)`,
            opacity: titleOpacity,
            maxWidth: 1400,
          }}
        >
          {props.title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 32,
            fontWeight: 400,
            color: `${COLORS.text}99`,
            textAlign: 'center',
            marginTop: 24,
            transform: `translateY(${subtitleTranslateY}px)`,
            opacity: subtitleOpacity,
          }}
        >
          {props.subtitle}
        </div>

        {/* Separator line */}
        <div
          style={{
            width: separatorWidth,
            height: 1,
            backgroundColor: `${COLORS.text}20`,
            marginTop: 60,
          }}
        />

        {/* Author */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 22,
            fontWeight: 500,
            color: COLORS.primary,
            marginTop: 24,
            opacity: authorOpacity,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          {props.author}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
