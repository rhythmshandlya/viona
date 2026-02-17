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

interface TestimonialSceneProps {
  testimonial: { quote: string; author: string };
  colors: TemplateConstants['COLORS'];
  fonts: TemplateConstants['FONTS'];
  springConfig: TemplateConstants['SPRING_CONFIG'];
}

const TestimonialScene: React.FC<TestimonialSceneProps> = ({
  testimonial,
  colors,
  fonts,
  springConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Quote entrance: fade and scale
  const quoteSpring = spring({
    frame,
    fps,
    config: springConfig,
    durationInFrames: 35,
  });

  const quoteScale = interpolate(quoteSpring, [0, 1], [0.85, 1], {
    extrapolateRight: 'clamp',
  });

  const quoteOpacity = interpolate(quoteSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Decorative quote marks entrance
  const quoteMarkOpacity = interpolate(frame, [0, 20], [0, 0.15], {
    extrapolateRight: 'clamp',
  });

  const quoteMarkScale = interpolate(frame, [0, 25], [0.6, 1], {
    extrapolateRight: 'clamp',
  });

  // Author entrance: staggered after quote
  const authorSpring = spring({
    frame: frame - 18,
    fps,
    config: springConfig,
    durationInFrames: 30,
  });

  const authorOpacity = interpolate(authorSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const authorTranslateY = interpolate(authorSpring, [0, 1], [20, 0], {
    extrapolateRight: 'clamp',
  });

  // Accent underline under author name
  const underlineWidth = interpolate(frame, [30, 55], [0, 120], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <BoldBg color={colors.background} gradientTo={colors.secondary} />

      {/* Decorative large quote mark */}
      <AbsoluteFill
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 350,
            left: 80,
            fontFamily: fonts.headline,
            fontSize: 400,
            fontWeight: 900,
            color: colors.accent,
            opacity: quoteMarkOpacity,
            transform: `scale(${quoteMarkScale})`,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          &ldquo;
        </div>
      </AbsoluteFill>

      {/* Content */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
        }}
      >
        {/* Quote text */}
        <div
          style={{
            fontFamily: fonts.headline,
            fontSize: 54,
            fontWeight: 400,
            fontStyle: 'italic',
            color: colors.text,
            textAlign: 'center',
            lineHeight: 1.4,
            opacity: quoteOpacity,
            transform: `scale(${quoteScale})`,
            maxWidth: 900,
          }}
        >
          &ldquo;{testimonial.quote}&rdquo;
        </div>

        {/* Author section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: 60,
            opacity: authorOpacity,
            transform: `translateY(${authorTranslateY}px)`,
          }}
        >
          {/* Accent underline */}
          <div
            style={{
              width: underlineWidth,
              height: 4,
              backgroundColor: colors.accent,
              borderRadius: 2,
              marginBottom: 24,
            }}
          />

          {/* Author name */}
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 34,
              fontWeight: 600,
              color: colors.accent,
              letterSpacing: '0.05em',
            }}
          >
            {testimonial.author}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default TestimonialScene;
