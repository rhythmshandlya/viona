import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import type { TemplateConstants } from '../constants';

interface CTASceneProps {
  ctaText: string;
  productName: string;
  colors: TemplateConstants['COLORS'];
  fonts: TemplateConstants['FONTS'];
  springConfig: TemplateConstants['SPRING_CONFIG'];
}

const CTAScene: React.FC<CTASceneProps> = ({
  ctaText,
  productName,
  colors,
  fonts,
  springConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Button entrance spring
  const buttonSpring = spring({
    frame,
    fps,
    config: springConfig,
  });

  const buttonScale = interpolate(buttonSpring, [0, 1], [0.5, 1], {
    extrapolateRight: 'clamp',
  });

  const buttonOpacity = interpolate(buttonSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Button pulse after entrance (looping subtle scale)
  const pulsePhase = Math.max(0, frame - 25);
  const pulseScale = 1 + Math.sin(pulsePhase * 0.1) * 0.03;

  // Product name subtle entrance with stagger
  const nameSpring = spring({
    frame: frame - 15,
    fps,
    config: springConfig,
  });

  const nameOpacity = interpolate(nameSpring, [0, 1], [0, 0.7], {
    extrapolateRight: 'clamp',
  });

  const nameTranslateY = interpolate(nameSpring, [0, 1], [15, 0], {
    extrapolateRight: 'clamp',
  });

  // Background glow
  const glowSize = interpolate(frame, [0, 60], [100, 300], {
    extrapolateRight: 'clamp',
  });

  const glowOpacity = interpolate(frame, [0, 30], [0, 0.4], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
      }}
    >
      {/* Background accent glow */}
      <AbsoluteFill
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: glowSize,
            height: glowSize,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors.accent}60 0%, transparent 70%)`,
            opacity: glowOpacity,
            filter: 'blur(40px)',
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
          gap: 50,
        }}
      >
        {/* CTA Button */}
        <div
          style={{
            opacity: buttonOpacity,
            transform: `scale(${buttonScale * pulseScale})`,
          }}
        >
          <div
            style={{
              fontFamily: fonts.headline,
              fontSize: 48,
              fontWeight: 700,
              color: colors.text,
              backgroundColor: colors.accent,
              paddingTop: 28,
              paddingBottom: 28,
              paddingLeft: 64,
              paddingRight: 64,
              borderRadius: 60,
              textAlign: 'center',
              letterSpacing: '0.02em',
              boxShadow: `0 8px 32px ${colors.accent}50, 0 0 60px ${colors.accent}25`,
            }}
          >
            {ctaText}
          </div>
        </div>

        {/* Product name reference */}
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 28,
            fontWeight: 400,
            color: colors.text,
            textAlign: 'center',
            opacity: nameOpacity,
            transform: `translateY(${nameTranslateY}px)`,
            letterSpacing: '0.08em',
          }}
        >
          {productName}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default CTAScene;
