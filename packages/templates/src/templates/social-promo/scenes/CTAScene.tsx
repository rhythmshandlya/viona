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

interface CTASceneProps {
  ctaText: string;
  socialHandles: { instagram: string; tiktok: string };
  colors: TemplateConstants['COLORS'];
  fonts: TemplateConstants['FONTS'];
  springConfig: TemplateConstants['SPRING_CONFIG'];
}

const CTAScene: React.FC<CTASceneProps> = ({
  ctaText,
  socialHandles,
  colors,
  fonts,
  springConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // CTA text entrance with bounce
  const ctaSpring = spring({
    frame,
    fps,
    config: {
      ...springConfig,
      stiffness: 120,
      damping: 12,
    },
    durationInFrames: 30,
  });

  const ctaScale = interpolate(ctaSpring, [0, 1], [0.3, 1], {
    extrapolateRight: 'clamp',
  });

  const ctaOpacity = interpolate(ctaSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // CTA pulsing effect after entrance (starts at frame 30)
  const pulsePhase = Math.max(0, frame - 30);
  const pulseScale = interpolate(
    pulsePhase % 30,
    [0, 15, 30],
    [1, 1.06, 1],
    {
      extrapolateRight: 'clamp',
    }
  );

  // Social handles entrance: staggered
  const instagramSpring = spring({
    frame: frame - 20,
    fps,
    config: springConfig,
    durationInFrames: 25,
  });

  const instagramOpacity = interpolate(instagramSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const instagramTranslateY = interpolate(instagramSpring, [0, 1], [30, 0], {
    extrapolateRight: 'clamp',
  });

  const tiktokSpring = spring({
    frame: frame - 32,
    fps,
    config: springConfig,
    durationInFrames: 25,
  });

  const tiktokOpacity = interpolate(tiktokSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const tiktokTranslateY = interpolate(tiktokSpring, [0, 1], [30, 0], {
    extrapolateRight: 'clamp',
  });

  // Decorative top bar
  const barWidth = interpolate(frame, [5, 35], [0, 100], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <BoldBg color={colors.primary} gradientTo={colors.secondary} />

      {/* Decorative top accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${barWidth}%`,
          height: 6,
          backgroundColor: colors.accent,
        }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 70,
        }}
      >
        {/* CTA text with pulse */}
        <div
          style={{
            fontFamily: fonts.headline,
            fontSize: 96,
            fontWeight: 900,
            color: colors.text,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            lineHeight: 1.1,
            opacity: ctaOpacity,
            transform: `scale(${ctaScale * pulseScale})`,
          }}
        >
          {ctaText}
        </div>

        {/* Accent arrow/indicator */}
        <div
          style={{
            width: 60,
            height: 60,
            borderBottom: `5px solid ${colors.accent}`,
            borderRight: `5px solid ${colors.accent}`,
            transform: `rotate(45deg) scale(${ctaScale})`,
            marginTop: 40,
            opacity: ctaOpacity,
          }}
        />

        {/* Social handles */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: 80,
            gap: 20,
          }}
        >
          {/* Instagram */}
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 36,
              fontWeight: 600,
              color: colors.text,
              opacity: instagramOpacity,
              transform: `translateY(${instagramTranslateY}px)`,
              letterSpacing: '0.02em',
            }}
          >
            IG {socialHandles.instagram}
          </div>

          {/* TikTok */}
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 36,
              fontWeight: 600,
              color: colors.text,
              opacity: tiktokOpacity,
              transform: `translateY(${tiktokTranslateY}px)`,
              letterSpacing: '0.02em',
            }}
          >
            TT {socialHandles.tiktok}
          </div>
        </div>
      </AbsoluteFill>

      {/* Bottom accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: `${barWidth}%`,
          height: 6,
          backgroundColor: colors.accent,
        }}
      />
    </AbsoluteFill>
  );
};

export default CTAScene;
