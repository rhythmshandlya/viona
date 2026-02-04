/**
 * Animation Primitives Library
 *
 * These are the ONLY animations that should be used in generated visuals.
 * Using consistent primitives ensures predictable, quality output.
 */

import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// ============================================================================
// ANIMATION CONFIGS (Style-specific presets)
// ============================================================================

export const SPRING_CONFIGS = {
  minimal: { damping: 20, stiffness: 60, mass: 1 },
  modern: { damping: 12, stiffness: 80, mass: 1 },
  playful: { damping: 8, stiffness: 200, mass: 1 },
  bold: { damping: 15, stiffness: 150, mass: 1 },
  classic: { damping: 25, stiffness: 50, mass: 1 },
} as const;

export const STAGGER_DELAYS = {
  minimal: 20,
  modern: 15,
  playful: 10,
  bold: 12,
  classic: 25,
} as const;

export type StylePreset = keyof typeof SPRING_CONFIGS;

// ============================================================================
// ANIMATION PRIMITIVES
// ============================================================================

interface AnimationProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StylePreset;
}

/**
 * FadeIn - Simple opacity fade
 */
export const FadeIn: React.FC<AnimationProps> = ({
  children,
  delay = 0,
  duration = 20,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame - delay,
    [0, duration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return <div style={{ opacity }}>{children}</div>;
};

/**
 * SlideUp - Slide from bottom with fade
 */
export const SlideUp: React.FC<AnimationProps & { distance?: number }> = ({
  children,
  delay = 0,
  distance = 30,
  style = 'modern'
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const config = SPRING_CONFIGS[style];

  const progress = spring({
    frame: frame - delay,
    fps,
    config,
  });

  const translateY = interpolate(progress, [0, 1], [distance, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div style={{
      transform: `translateY(${translateY}px)`,
      opacity
    }}>
      {children}
    </div>
  );
};

/**
 * SlideLeft - Slide from right with fade
 */
export const SlideLeft: React.FC<AnimationProps & { distance?: number }> = ({
  children,
  delay = 0,
  distance = 50,
  style = 'modern'
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const config = SPRING_CONFIGS[style];

  const progress = spring({
    frame: frame - delay,
    fps,
    config,
  });

  const translateX = interpolate(progress, [0, 1], [distance, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div style={{
      transform: `translateX(${translateX}px)`,
      opacity
    }}>
      {children}
    </div>
  );
};

/**
 * ScaleIn - Scale from small/zero with fade
 */
export const ScaleIn: React.FC<AnimationProps & { from?: number }> = ({
  children,
  delay = 0,
  from = 0.8,
  style = 'modern'
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const config = SPRING_CONFIGS[style];

  const progress = spring({
    frame: frame - delay,
    fps,
    config,
  });

  const scale = interpolate(progress, [0, 1], [from, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div style={{
      transform: `scale(${scale})`,
      opacity
    }}>
      {children}
    </div>
  );
};

/**
 * PopIn - Bouncy scale entrance (playful)
 */
export const PopIn: React.FC<AnimationProps> = ({
  children,
  delay = 0,
  style = 'playful'
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 8, stiffness: 200, mass: 1 },
  });

  const scale = interpolate(progress, [0, 1], [0, 1]);
  const opacity = progress > 0 ? 1 : 0;

  return (
    <div style={{
      transform: `scale(${scale})`,
      opacity
    }}>
      {children}
    </div>
  );
};

/**
 * Stagger - Wrapper that staggers children animations
 */
export const Stagger: React.FC<{
  children: React.ReactNode[];
  delayPerItem?: number;
  startDelay?: number;
  animation?: 'fadeIn' | 'slideUp' | 'scaleIn' | 'popIn';
  style?: StylePreset;
}> = ({
  children,
  delayPerItem,
  startDelay = 0,
  animation = 'slideUp',
  style = 'modern'
}) => {
  const stagger = delayPerItem ?? STAGGER_DELAYS[style];

  const AnimationComponent = {
    fadeIn: FadeIn,
    slideUp: SlideUp,
    scaleIn: ScaleIn,
    popIn: PopIn,
  }[animation];

  return (
    <>
      {React.Children.map(children, (child, index) => (
        <AnimationComponent
          key={index}
          delay={startDelay + (index * stagger)}
          style={style}
        >
          {child}
        </AnimationComponent>
      ))}
    </>
  );
};

/**
 * ProgressBar - Animated progress indicator
 */
export const ProgressBar: React.FC<{
  progress: number; // 0-1
  delay?: number;
  color?: string;
  height?: number;
  style?: StylePreset;
}> = ({
  progress,
  delay = 0,
  color = '#3b82f6',
  height = 8,
  style = 'modern'
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const config = SPRING_CONFIGS[style];

  const animProgress = spring({
    frame: frame - delay,
    fps,
    config,
  });

  const width = interpolate(animProgress, [0, 1], [0, progress * 100]);

  return (
    <div style={{
      width: '100%',
      height,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: height / 2,
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${width}%`,
        height: '100%',
        backgroundColor: color,
        borderRadius: height / 2,
      }} />
    </div>
  );
};

/**
 * TypeWriter - Text that types in character by character
 */
export const TypeWriter: React.FC<{
  text: string;
  startFrame?: number;
  charsPerFrame?: number;
}> = ({ text, startFrame = 0, charsPerFrame = 0.5 }) => {
  const frame = useCurrentFrame();

  const charsToShow = Math.floor((frame - startFrame) * charsPerFrame);
  const displayText = text.slice(0, Math.max(0, charsToShow));

  return <span>{displayText}</span>;
};

/**
 * CountUp - Animated number counter
 */
export const CountUp: React.FC<{
  from?: number;
  to: number;
  delay?: number;
  duration?: number;
  format?: (n: number) => string;
}> = ({ from = 0, to, delay = 0, duration = 30, format = (n) => n.toFixed(0) }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame - delay,
    [0, duration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const value = interpolate(progress, [0, 1], [from, to]);

  return <span>{format(value)}</span>;
};
