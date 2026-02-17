import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import GradientBg from '../components/GradientBg';
import type { TemplateConstants } from '../constants';

interface IntroSceneProps {
  productName: string;
  tagline: string;
  colors: TemplateConstants['COLORS'];
  fonts: TemplateConstants['FONTS'];
  springConfig: TemplateConstants['SPRING_CONFIG'];
}

const IntroScene: React.FC<IntroSceneProps> = ({
  productName,
  tagline,
  colors,
  fonts,
  springConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Product name entrance: scale from 0.8, opacity fade
  const nameSpring = spring({
    frame,
    fps,
    config: springConfig,
  });

  const nameScale = interpolate(nameSpring, [0, 1], [0.8, 1], {
    extrapolateRight: 'clamp',
  });

  const nameOpacity = interpolate(nameSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Tagline entrance: stagger 8 frames after product name
  const taglineSpring = spring({
    frame: frame - 8,
    fps,
    config: springConfig,
  });

  const taglineOpacity = interpolate(taglineSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const taglineTranslateY = interpolate(taglineSpring, [0, 1], [20, 0], {
    extrapolateRight: 'clamp',
  });

  // Decorative accent ring: subtle pulse
  const ringScale = interpolate(
    frame,
    [0, 30, 60, 90],
    [0.9, 1.05, 0.95, 1],
    {
      extrapolateRight: 'clamp',
    }
  );

  const ringOpacity = interpolate(frame, [0, 15], [0, 0.3], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <GradientBg colors={[colors.primary, colors.secondary]} angle={160} />

      {/* Decorative accent ring */}
      <AbsoluteFill
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 500,
            height: 500,
            borderRadius: '50%',
            border: `3px solid ${colors.accent}`,
            opacity: ringOpacity,
            transform: `scale(${ringScale})`,
          }}
        />
      </AbsoluteFill>

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
        {/* Product name */}
        <div
          style={{
            fontFamily: fonts.headline,
            fontSize: 82,
            fontWeight: 700,
            color: colors.text,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: nameOpacity,
            transform: `scale(${nameScale})`,
            letterSpacing: '-0.02em',
          }}
        >
          {productName}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 36,
            fontWeight: 400,
            color: colors.accent,
            textAlign: 'center',
            marginTop: 30,
            opacity: taglineOpacity,
            transform: `translateY(${taglineTranslateY}px)`,
            letterSpacing: '0.05em',
          }}
        >
          {tagline}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default IntroScene;
