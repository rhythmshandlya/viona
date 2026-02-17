import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import BoldBg from '../components/BoldBg';
import type { TemplateConstants } from '../constants';

interface HookSceneProps {
  hookText: string;
  colors: TemplateConstants['COLORS'];
  fonts: TemplateConstants['FONTS'];
  springConfig: TemplateConstants['SPRING_CONFIG'];
}

const HookScene: React.FC<HookSceneProps> = ({
  hookText,
  colors,
  fonts,
  springConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Accent color burst flash on entry
  const flashOpacity = interpolate(frame, [0, 6, 18], [0.9, 0.6, 0], {
    extrapolateRight: 'clamp',
  });

  // Hook text slams in: large scale to normal with aggressive spring
  const textSpring = spring({
    frame,
    fps,
    config: {
      ...springConfig,
      stiffness: 180,
      damping: 14,
      mass: 0.8,
    },
    durationInFrames: 30,
  });

  const textScale = interpolate(textSpring, [0, 1], [2.8, 1], {
    extrapolateRight: 'clamp',
  });

  const textOpacity = interpolate(textSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Subtle shake/bounce after slam (starts after initial spring settles)
  const shakeX = interpolate(
    frame,
    [15, 18, 21, 24, 27, 30],
    [0, -4, 4, -2, 2, 0],
    {
      extrapolateRight: 'clamp',
    }
  );

  const shakeY = interpolate(
    frame,
    [15, 18, 21, 24, 27, 30],
    [0, 3, -3, 1, -1, 0],
    {
      extrapolateRight: 'clamp',
    }
  );

  // Accent underline expands after text lands
  const underlineWidth = interpolate(frame, [20, 45], [0, 100], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <BoldBg color={colors.background} />

      {/* Accent color burst flash */}
      <AbsoluteFill
        style={{
          backgroundColor: colors.accent,
          opacity: flashOpacity,
        }}
      />

      {/* Content */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 60,
        }}
      >
        {/* Hook text */}
        <div
          style={{
            fontFamily: fonts.headline,
            fontSize: 110,
            fontWeight: 900,
            color: colors.text,
            textAlign: 'center',
            textTransform: 'uppercase',
            lineHeight: 1.05,
            letterSpacing: '0.04em',
            opacity: textOpacity,
            transform: `scale(${textScale}) translate(${shakeX}px, ${shakeY}px)`,
          }}
        >
          {hookText}
        </div>

        {/* Accent underline */}
        <div
          style={{
            width: `${underlineWidth}%`,
            maxWidth: 400,
            height: 8,
            backgroundColor: colors.accent,
            borderRadius: 4,
            marginTop: 30,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default HookScene;
