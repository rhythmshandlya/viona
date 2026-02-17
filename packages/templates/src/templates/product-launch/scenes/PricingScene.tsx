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

interface PricingSceneProps {
  price: string;
  colors: TemplateConstants['COLORS'];
  fonts: TemplateConstants['FONTS'];
  springConfig: TemplateConstants['SPRING_CONFIG'];
}

const PricingScene: React.FC<PricingSceneProps> = ({
  price,
  colors,
  fonts,
  springConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "Starting at" label entrance
  const labelSpring = spring({
    frame,
    fps,
    config: springConfig,
  });

  const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const labelTranslateY = interpolate(labelSpring, [0, 1], [-15, 0], {
    extrapolateRight: 'clamp',
  });

  // Price scales up dramatically with stagger
  const priceSpring = spring({
    frame: frame - 10,
    fps,
    config: springConfig,
  });

  const priceScale = interpolate(priceSpring, [0, 1], [0.3, 1], {
    extrapolateRight: 'clamp',
  });

  const priceOpacity = interpolate(priceSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Glow intensity pulse
  const glowIntensity = interpolate(frame, [10, 40, 70], [0, 25, 18], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <GradientBg
        colors={[colors.secondary, colors.background, colors.secondary]}
        angle={180}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 60,
        }}
      >
        {/* "Starting at" label */}
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 32,
            fontWeight: 400,
            color: `${colors.text}B3`,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            opacity: labelOpacity,
            transform: `translateY(${labelTranslateY}px)`,
            marginBottom: 16,
          }}
        >
          Starting at
        </div>

        {/* Price */}
        <div
          style={{
            fontFamily: fonts.headline,
            fontSize: 140,
            fontWeight: 800,
            color: colors.text,
            textAlign: 'center',
            lineHeight: 1,
            opacity: priceOpacity,
            transform: `scale(${priceScale})`,
            textShadow: `0 0 ${glowIntensity}px ${colors.accent}, 0 0 ${glowIntensity * 2}px ${colors.primary}80`,
          }}
        >
          {price}
        </div>

        {/* Decorative line below price */}
        <div
          style={{
            width: interpolate(priceSpring, [0, 1], [0, 200], {
              extrapolateRight: 'clamp',
            }),
            height: 4,
            backgroundColor: colors.accent,
            borderRadius: 2,
            marginTop: 30,
            opacity: priceOpacity,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default PricingScene;
