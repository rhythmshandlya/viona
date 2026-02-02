import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface GlassCardProps {
  /** Card width as percentage of container (default: auto) */
  width?: number | 'auto';
  /** Card height as percentage of container (default: auto) */
  height?: number | 'auto';
  /** Background blur intensity (default: 20) */
  blur?: number;
  /** Background opacity (default: 0.08) */
  backgroundOpacity?: number;
  /** Border opacity (default: 0.15) */
  borderOpacity?: number;
  /** Accent color for subtle tint */
  accentColor?: string;
  /** Frame when card appears */
  enterFrame?: number;
  /** Animation style: 'scale' | 'fade' | 'slideUp' | 'none' */
  animation?: 'scale' | 'fade' | 'slideUp' | 'none';
  /** Add subtle glow effect */
  glow?: boolean;
  /** Glow color (default: accent or white) */
  glowColor?: string;
  /** Add inner highlight reflection */
  innerHighlight?: boolean;
  /** Add animated shimmer effect */
  shimmer?: boolean;
  /** Border radius multiplier (default: 1) */
  borderRadius?: number;
  /** Children to render inside the card */
  children: React.ReactNode;
  /** Additional styles */
  style?: React.CSSProperties;
}

/**
 * GlassCard - Premium glassmorphism card with layered depth
 *
 * Features multi-layered glass effects with inner reflections,
 * gradient borders, and sophisticated shadows. Perfect for
 * modern, premium UI aesthetics in explainer videos.
 *
 * @example
 * <GlassCard enterFrame={30} animation="scale" glow innerHighlight>
 *   <h2>Premium Feature</h2>
 *   <p>Description here</p>
 * </GlassCard>
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  width = 'auto',
  height = 'auto',
  blur = 20,
  backgroundOpacity = 0.08,
  borderOpacity = 0.15,
  accentColor,
  enterFrame = 0,
  animation = 'scale',
  glow = false,
  glowColor,
  innerHighlight = true,
  shimmer = false,
  borderRadius = 1,
  children,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps, width: videoWidth, height: videoHeight } = useVideoConfig();
  const minDim = Math.min(videoWidth, videoHeight);

  const localFrame = Math.max(0, frame - enterFrame);
  const isVisible = frame >= enterFrame;

  // Smooth spring animation with refined physics
  const springValue = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.8 },
  });

  // Animation values
  let opacity = 1;
  let scale = 1;
  let translateY = 0;

  if (animation !== 'none' && isVisible) {
    switch (animation) {
      case 'scale':
        scale = springValue;
        opacity = interpolate(springValue, [0, 0.5, 1], [0, 0.8, 1]);
        break;
      case 'fade':
        opacity = interpolate(localFrame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
        break;
      case 'slideUp':
        opacity = interpolate(localFrame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
        translateY = interpolate(springValue, [0, 1], [minDim * 0.06, 0]);
        break;
    }
  }

  if (!isVisible) {
    opacity = 0;
    scale = animation === 'scale' ? 0.8 : 1;
  }

  // Color calculations
  const effectiveGlowColor = glowColor || accentColor || 'rgba(255, 255, 255, 0.4)';
  const accentHex = accentColor || '#ffffff';

  // Multi-layered background for depth
  const bgLayers = [
    `linear-gradient(135deg, ${accentHex}08 0%, transparent 50%)`,
    `linear-gradient(315deg, ${accentHex}05 0%, transparent 50%)`,
    `rgba(255, 255, 255, ${backgroundOpacity})`,
  ].join(', ');

  const cardWidth = width === 'auto' ? 'auto' : `${width}%`;
  const cardHeight = height === 'auto' ? 'auto' : `${height}%`;
  const radius = minDim * 0.025 * borderRadius;

  // Shimmer animation position
  const shimmerPosition = shimmer ? (frame % 120) / 120 * 200 - 50 : 0;

  // Multi-layered shadow for depth
  const shadowLayers = [
    // Ambient shadow
    `0 ${minDim * 0.005}px ${minDim * 0.015}px rgba(0, 0, 0, 0.1)`,
    // Depth shadow
    `0 ${minDim * 0.015}px ${minDim * 0.035}px rgba(0, 0, 0, 0.15)`,
    // Soft spread
    `0 ${minDim * 0.025}px ${minDim * 0.06}px rgba(0, 0, 0, 0.08)`,
  ];

  if (glow) {
    // Multi-layered glow
    shadowLayers.push(
      `0 0 ${minDim * 0.02}px ${effectiveGlowColor}`,
      `0 0 ${minDim * 0.04}px ${effectiveGlowColor}80`,
      `0 0 ${minDim * 0.08}px ${effectiveGlowColor}40`
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: cardWidth,
        height: cardHeight,
        background: bgLayers,
        backdropFilter: `blur(${blur}px) saturate(1.2)`,
        WebkitBackdropFilter: `blur(${blur}px) saturate(1.2)`,
        borderRadius: radius,
        padding: minDim * 0.03,
        opacity,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        transformOrigin: 'center center',
        boxShadow: shadowLayers.join(', '),
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Gradient border overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          padding: 1,
          background: `linear-gradient(135deg, rgba(255,255,255,${borderOpacity * 2}) 0%, rgba(255,255,255,${borderOpacity * 0.5}) 50%, rgba(255,255,255,${borderOpacity}) 100%)`,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          pointerEvents: 'none',
        }}
      />

      {/* Inner highlight reflection */}
      {innerHighlight && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '10%',
            right: '10%',
            height: minDim * 0.003,
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)`,
            borderRadius: radius,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Shimmer sweep effect */}
      {shimmer && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: `${shimmerPosition}%`,
            width: '30%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            transform: 'skewX(-20deg)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Inner shadow for depth */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          boxShadow: `inset 0 ${minDim * 0.002}px ${minDim * 0.01}px rgba(255,255,255,0.1), inset 0 -${minDim * 0.005}px ${minDim * 0.015}px rgba(0,0,0,0.1)`,
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};

export default GlassCard;
