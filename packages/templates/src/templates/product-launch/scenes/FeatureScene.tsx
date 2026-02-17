import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import type { TemplateConstants } from '../constants';

interface Feature {
  title: string;
  description: string;
}

interface FeatureSceneProps {
  features: Feature[];
  colors: TemplateConstants['COLORS'];
  fonts: TemplateConstants['FONTS'];
  springConfig: TemplateConstants['SPRING_CONFIG'];
}

const FeatureScene: React.FC<FeatureSceneProps> = ({
  features,
  colors,
  fonts,
  springConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
        gap: 40,
      }}
    >
      {/* Section title */}
      <div
        style={{
          fontFamily: fonts.headline,
          fontSize: 52,
          fontWeight: 700,
          color: colors.text,
          textAlign: 'center',
          marginBottom: 20,
          opacity: interpolate(
            spring({ frame, fps, config: springConfig }),
            [0, 1],
            [0, 1],
            { extrapolateRight: 'clamp' }
          ),
        }}
      >
        Features
      </div>

      {/* Feature cards */}
      {features.map((feature, index) => {
        const staggerDelay = index * 25;
        const cardSpring = spring({
          frame: frame - staggerDelay,
          fps,
          config: springConfig,
        });

        const translateX = interpolate(cardSpring, [0, 1], [200, 0], {
          extrapolateRight: 'clamp',
        });

        const opacity = interpolate(cardSpring, [0, 1], [0, 1], {
          extrapolateRight: 'clamp',
        });

        return (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              width: '100%',
              maxWidth: 900,
              backgroundColor: `${colors.primary}18`,
              borderRadius: 16,
              overflow: 'hidden',
              opacity,
              transform: `translateX(${translateX}px)`,
            }}
          >
            {/* Accent left border */}
            <div
              style={{
                width: 6,
                backgroundColor: colors.accent,
                flexShrink: 0,
              }}
            />

            {/* Card content */}
            <div
              style={{
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.headline,
                  fontSize: 34,
                  fontWeight: 700,
                  color: colors.text,
                  lineHeight: 1.2,
                }}
              >
                {feature.title}
              </div>
              <div
                style={{
                  fontFamily: fonts.body,
                  fontSize: 24,
                  fontWeight: 400,
                  color: `${colors.text}B3`,
                  lineHeight: 1.4,
                }}
              >
                {feature.description}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default FeatureScene;
