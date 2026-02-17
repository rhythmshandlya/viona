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

interface BenefitsSceneProps {
  benefits: string[];
  colors: TemplateConstants['COLORS'];
  fonts: TemplateConstants['FONTS'];
  springConfig: TemplateConstants['SPRING_CONFIG'];
}

const BenefitsScene: React.FC<BenefitsSceneProps> = ({
  benefits,
  colors,
  fonts,
  springConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Header entrance
  const headerSpring = spring({
    frame,
    fps,
    config: springConfig,
    durationInFrames: 30,
  });

  const headerOpacity = interpolate(headerSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const headerTranslateY = interpolate(headerSpring, [0, 1], [-30, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <BoldBg color={colors.primary} />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 70,
        }}
      >
        {/* Header */}
        <div
          style={{
            fontFamily: fonts.headline,
            fontSize: 60,
            fontWeight: 700,
            color: colors.text,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 80,
            opacity: headerOpacity,
            transform: `translateY(${headerTranslateY}px)`,
          }}
        >
          Why You Need This
        </div>

        {/* Benefits list */}
        {benefits.map((benefit, index) => {
          const staggerDelay = 10 + index * 18;

          const benefitSpring = spring({
            frame: frame - staggerDelay,
            fps,
            config: springConfig,
            durationInFrames: 30,
          });

          const benefitOpacity = interpolate(benefitSpring, [0, 1], [0, 1], {
            extrapolateRight: 'clamp',
          });

          const benefitTranslateY = interpolate(
            benefitSpring,
            [0, 1],
            [40, 0],
            {
              extrapolateRight: 'clamp',
            }
          );

          // Checkmark scale-in slightly after text
          const checkSpring = spring({
            frame: frame - staggerDelay - 4,
            fps,
            config: {
              ...springConfig,
              stiffness: 150,
            },
            durationInFrames: 20,
          });

          const checkScale = interpolate(checkSpring, [0, 1], [0, 1], {
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 40,
                opacity: benefitOpacity,
                transform: `translateY(${benefitTranslateY}px)`,
                width: '100%',
                maxWidth: 850,
              }}
            >
              {/* Checkmark indicator */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.accent,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexShrink: 0,
                  transform: `scale(${checkScale})`,
                }}
              >
                <div
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 30,
                    fontWeight: 700,
                    color: colors.background,
                    lineHeight: 1,
                  }}
                >
                  ✓
                </div>
              </div>

              {/* Benefit text */}
              <div
                style={{
                  fontFamily: fonts.body,
                  fontSize: 42,
                  fontWeight: 700,
                  color: colors.text,
                  marginLeft: 28,
                  lineHeight: 1.3,
                }}
              >
                {benefit}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default BenefitsScene;
