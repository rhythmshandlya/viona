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

// ============================================================================
// PREMIUM ANIMATIONS (A1 Quality)
// ============================================================================

/** Style-specific duration defaults for premium animations (in frames at 30fps) */
export const PREMIUM_DURATIONS = {
  minimal: { fast: 20, normal: 30, slow: 45 },
  modern: { fast: 15, normal: 24, slow: 36 },
  playful: { fast: 12, normal: 20, slow: 30 },
  bold: { fast: 10, normal: 18, slow: 28 },
  classic: { fast: 24, normal: 36, slow: 48 },
} as const;

interface PremiumAnimationProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StylePreset;
  speed?: 'fast' | 'normal' | 'slow';
}

// --- PREMIUM ENTRANCES ---

/**
 * BounceIn - Dramatic bouncing entrance with overshoot
 * Best for: hero titles, key reveals, playful/modern styles
 */
export const BounceIn: React.FC<PremiumAnimationProps> = ({
  children, delay = 0, duration, style = 'modern', speed = 'normal',
}) => {
  const frame = useCurrentFrame();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const t = Math.max(0, Math.min(1, (frame - delay) / dur));

  if (frame < delay) return <div style={{ opacity: 0 }}>{children}</div>;

  // animate.css bounceIn curve: scale overshoots then settles
  let scale: number;
  let opacity: number;
  if (t < 0.2) {
    scale = interpolate(t, [0, 0.2], [0.3, 1.1]);
    opacity = interpolate(t, [0, 0.2], [0, 1]);
  } else if (t < 0.4) {
    scale = interpolate(t, [0.2, 0.4], [1.1, 0.9]);
    opacity = 1;
  } else if (t < 0.6) {
    scale = interpolate(t, [0.4, 0.6], [0.9, 1.03]);
    opacity = 1;
  } else if (t < 0.8) {
    scale = interpolate(t, [0.6, 0.8], [1.03, 0.97]);
    opacity = 1;
  } else {
    scale = interpolate(t, [0.8, 1], [0.97, 1]);
    opacity = 1;
  }

  return (
    <div style={{ transform: `scale(${scale})`, opacity, transformOrigin: 'center' }}>
      {children}
    </div>
  );
};

/**
 * FadeInUp - Elegant upward fade entrance
 * Best for: text reveals, minimal/classic styles, professional content
 */
export const FadeInUp: React.FC<PremiumAnimationProps & { distance?: number }> = ({
  children, delay = 0, duration, style = 'modern', speed = 'normal', distance = 40,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const config = SPRING_CONFIGS[style];

  if (frame < delay) return <div style={{ opacity: 0 }}>{children}</div>;

  const progress = spring({ frame: frame - delay, fps, config, durationInFrames: dur });
  const translateY = interpolate(progress, [0, 1], [distance, 0]);
  const opacity = interpolate(progress, [0, 0.6], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ transform: `translateY(${translateY}px)`, opacity }}>
      {children}
    </div>
  );
};

/**
 * FadeInDown - Downward fade entrance
 * Best for: headers, dropdown reveals
 */
export const FadeInDown: React.FC<PremiumAnimationProps & { distance?: number }> = ({
  children, delay = 0, duration, style = 'modern', speed = 'normal', distance = 40,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const config = SPRING_CONFIGS[style];

  if (frame < delay) return <div style={{ opacity: 0 }}>{children}</div>;

  const progress = spring({ frame: frame - delay, fps, config, durationInFrames: dur });
  const translateY = interpolate(progress, [0, 1], [-distance, 0]);
  const opacity = interpolate(progress, [0, 0.6], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ transform: `translateY(${translateY}px)`, opacity }}>
      {children}
    </div>
  );
};

/**
 * ZoomIn - Dramatic zoom entrance from small to full
 * Best for: bold/modern styles, impactful reveals, stats
 */
export const ZoomIn: React.FC<PremiumAnimationProps> = ({
  children, delay = 0, duration, style = 'modern', speed = 'normal',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = duration || PREMIUM_DURATIONS[style][speed];

  if (frame < delay) return <div style={{ opacity: 0 }}>{children}</div>;

  const progress = spring({
    frame: frame - delay, fps,
    config: { damping: 14, stiffness: 100, mass: 1 },
    durationInFrames: dur,
  });
  const scale = interpolate(progress, [0, 1], [0.3, 1]);
  const opacity = interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ transform: `scale(${scale})`, opacity, transformOrigin: 'center' }}>
      {children}
    </div>
  );
};

/**
 * FlipInX - 3D flip entrance on X axis
 * Best for: card reveals, modern/playful styles
 */
export const FlipInX: React.FC<PremiumAnimationProps> = ({
  children, delay = 0, duration, style = 'modern', speed = 'normal',
}) => {
  const frame = useCurrentFrame();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const t = Math.max(0, Math.min(1, (frame - delay) / dur));

  if (frame < delay) return <div style={{ opacity: 0 }}>{children}</div>;

  let rotateX: number;
  let opacity: number;
  if (t < 0.4) {
    rotateX = interpolate(t, [0, 0.4], [90, -20]);
    opacity = interpolate(t, [0, 0.4], [0, 1]);
  } else if (t < 0.6) {
    rotateX = interpolate(t, [0.4, 0.6], [-20, 10]);
    opacity = 1;
  } else if (t < 0.8) {
    rotateX = interpolate(t, [0.6, 0.8], [10, -5]);
    opacity = 1;
  } else {
    rotateX = interpolate(t, [0.8, 1], [-5, 0]);
    opacity = 1;
  }

  return (
    <div style={{
      transform: `perspective(400px) rotateX(${rotateX}deg)`,
      opacity,
      backfaceVisibility: 'visible',
    }}>
      {children}
    </div>
  );
};

/**
 * RotateIn - Spinning entrance with fade
 * Best for: playful/bold styles, icons, badges
 */
export const RotateIn: React.FC<PremiumAnimationProps> = ({
  children, delay = 0, duration, style = 'modern', speed = 'normal',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = duration || PREMIUM_DURATIONS[style][speed];

  if (frame < delay) return <div style={{ opacity: 0 }}>{children}</div>;

  const progress = spring({
    frame: frame - delay, fps,
    config: SPRING_CONFIGS[style],
    durationInFrames: dur,
  });
  const rotate = interpolate(progress, [0, 1], [-200, 0]);
  const opacity = interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      transform: `rotate(${rotate}deg)`,
      opacity,
      transformOrigin: 'center',
    }}>
      {children}
    </div>
  );
};

/**
 * LightSpeedIn - Fast slide from right with skew
 * Best for: bold/modern, speed-themed content, competitive comparisons
 */
export const LightSpeedIn: React.FC<PremiumAnimationProps> = ({
  children, delay = 0, duration, style = 'modern', speed = 'normal',
}) => {
  const frame = useCurrentFrame();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const t = Math.max(0, Math.min(1, (frame - delay) / dur));

  if (frame < delay) return <div style={{ opacity: 0 }}>{children}</div>;

  let translateX: number;
  let skewX: number;
  let opacity: number;
  if (t < 0.6) {
    translateX = interpolate(t, [0, 0.6], [100, 0]);
    skewX = interpolate(t, [0, 0.6], [-30, 20]);
    opacity = interpolate(t, [0, 0.6], [0, 1]);
  } else if (t < 0.8) {
    translateX = 0;
    skewX = interpolate(t, [0.6, 0.8], [20, -5]);
    opacity = 1;
  } else {
    translateX = 0;
    skewX = interpolate(t, [0.8, 1], [-5, 0]);
    opacity = 1;
  }

  return (
    <div style={{
      transform: `translateX(${translateX}%) skewX(${skewX}deg)`,
      opacity,
    }}>
      {children}
    </div>
  );
};

// --- PREMIUM EXITS ---

/**
 * BounceOut - Bouncing exit animation
 * Best for: playful transitions, dismissals
 */
export const BounceOut: React.FC<PremiumAnimationProps> = ({
  children, delay = 0, duration, style = 'modern', speed = 'normal',
}) => {
  const frame = useCurrentFrame();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const t = Math.max(0, Math.min(1, (frame - delay) / dur));

  if (frame < delay) return <div>{children}</div>;

  let scale: number;
  let opacity: number;
  if (t < 0.2) {
    scale = interpolate(t, [0, 0.2], [1, 0.9]);
    opacity = 1;
  } else if (t < 0.5) {
    scale = interpolate(t, [0.2, 0.5], [0.9, 1.1]);
    opacity = 1;
  } else if (t < 0.55) {
    scale = interpolate(t, [0.5, 0.55], [1.1, 1.1]);
    opacity = 1;
  } else {
    scale = interpolate(t, [0.55, 1], [1.1, 0.3]);
    opacity = interpolate(t, [0.55, 1], [1, 0]);
  }

  return (
    <div style={{ transform: `scale(${scale})`, opacity, transformOrigin: 'center' }}>
      {children}
    </div>
  );
};

/**
 * FadeOutUp - Elegant upward fade exit
 */
export const FadeOutUp: React.FC<PremiumAnimationProps & { distance?: number }> = ({
  children, delay = 0, duration, style = 'modern', speed = 'normal', distance = 40,
}) => {
  const frame = useCurrentFrame();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const t = Math.max(0, Math.min(1, (frame - delay) / dur));

  if (frame < delay) return <div>{children}</div>;

  const translateY = interpolate(t, [0, 1], [0, -distance]);
  const opacity = interpolate(t, [0, 1], [1, 0]);

  return (
    <div style={{ transform: `translateY(${translateY}px)`, opacity }}>
      {children}
    </div>
  );
};

/**
 * ZoomOut - Zoom exit to nothing
 */
export const ZoomOut: React.FC<PremiumAnimationProps> = ({
  children, delay = 0, duration, style = 'modern', speed = 'normal',
}) => {
  const frame = useCurrentFrame();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const t = Math.max(0, Math.min(1, (frame - delay) / dur));

  if (frame < delay) return <div>{children}</div>;

  const scale = interpolate(t, [0, 0.5, 1], [1, 0.4, 0]);
  const opacity = interpolate(t, [0, 0.5, 1], [1, 0.6, 0]);

  return (
    <div style={{ transform: `scale(${scale})`, opacity, transformOrigin: 'center' }}>
      {children}
    </div>
  );
};

// --- PREMIUM EMPHASIS (Attention Seekers) ---

/**
 * Pulse - Breathing scale effect for emphasis
 * Best for: highlighting active elements, drawing attention
 */
export const Pulse: React.FC<PremiumAnimationProps & { intensity?: number }> = ({
  children, delay = 0, duration = 30, intensity = 1.08,
}) => {
  const frame = useCurrentFrame();
  if (frame < delay) return <div>{children}</div>;

  const t = ((frame - delay) % duration) / duration;
  // Smooth pulse: scale up then back down
  const scale = t < 0.5
    ? interpolate(t, [0, 0.5], [1, intensity])
    : interpolate(t, [0.5, 1], [intensity, 1]);

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
      {children}
    </div>
  );
};

/**
 * Shake - Horizontal shake for errors/warnings/emphasis
 * Best for: error states, bold style, attention-grabbing
 */
export const Shake: React.FC<PremiumAnimationProps & { intensity?: number }> = ({
  children, delay = 0, duration = 20, intensity = 10,
}) => {
  const frame = useCurrentFrame();
  if (frame < delay) return <div>{children}</div>;

  const elapsed = frame - delay;
  if (elapsed > duration) return <div>{children}</div>;

  const t = elapsed / duration;
  // Rapid oscillation with decay
  const decay = 1 - t;
  const translateX = Math.sin(elapsed * 2.5) * intensity * decay;

  return (
    <div style={{ transform: `translateX(${translateX}px)` }}>
      {children}
    </div>
  );
};

/**
 * Tada - Dramatic scale + rotate attention seeker
 * Best for: celebrations, achievements, playful emphasis
 */
export const Tada: React.FC<PremiumAnimationProps> = ({
  children, delay = 0, duration = 30,
}) => {
  const frame = useCurrentFrame();
  if (frame < delay) return <div>{children}</div>;

  const elapsed = frame - delay;
  if (elapsed > duration) return <div>{children}</div>;

  const t = elapsed / duration;

  let scale: number;
  let rotate: number;
  if (t < 0.1) {
    scale = interpolate(t, [0, 0.1], [1, 0.9]);
    rotate = interpolate(t, [0, 0.1], [0, -3]);
  } else if (t < 0.3) {
    scale = interpolate(t, [0.1, 0.2], [0.9, 1.1]);
    rotate = Math.sin((t - 0.1) * Math.PI * 15) * 3;
  } else if (t < 0.8) {
    scale = 1.1;
    rotate = Math.sin((t - 0.1) * Math.PI * 10) * 3 * (1 - (t - 0.3) / 0.5);
  } else {
    scale = interpolate(t, [0.8, 1], [1.1, 1]);
    rotate = 0;
  }

  return (
    <div style={{
      transform: `scale(${scale}) rotate(${rotate}deg)`,
      transformOrigin: 'center',
    }}>
      {children}
    </div>
  );
};

/**
 * Wobble - Wobbly side-to-side with rotation
 * Best for: playful emphasis, drawing eye to elements
 */
export const Wobble: React.FC<PremiumAnimationProps> = ({
  children, delay = 0, duration = 30,
}) => {
  const frame = useCurrentFrame();
  if (frame < delay) return <div>{children}</div>;

  const elapsed = frame - delay;
  if (elapsed > duration) return <div>{children}</div>;

  const t = elapsed / duration;
  const decay = 1 - t;
  const translateX = Math.sin(t * Math.PI * 5) * 25 * decay;
  const rotate = Math.sin(t * Math.PI * 5) * 5 * decay;

  return (
    <div style={{
      transform: `translateX(${translateX}px) rotate(${rotate}deg)`,
    }}>
      {children}
    </div>
  );
};

/**
 * HeartBeat - Double-pulse scale like a heartbeat
 * Best for: health/vitality themes, important notifications
 */
export const HeartBeat: React.FC<PremiumAnimationProps & { intensity?: number }> = ({
  children, delay = 0, duration = 30, intensity = 1.3,
}) => {
  const frame = useCurrentFrame();
  if (frame < delay) return <div>{children}</div>;

  const t = ((frame - delay) % duration) / duration;

  let scale: number;
  if (t < 0.14) {
    scale = interpolate(t, [0, 0.14], [1, intensity]);
  } else if (t < 0.28) {
    scale = interpolate(t, [0.14, 0.28], [intensity, 1]);
  } else if (t < 0.42) {
    scale = interpolate(t, [0.28, 0.42], [1, intensity * 1.05]);
  } else if (t < 0.7) {
    scale = interpolate(t, [0.42, 0.7], [intensity * 1.05, 1]);
  } else {
    scale = 1;
  }

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
      {children}
    </div>
  );
};

/**
 * Flash - Rapid opacity flash for alerts
 * Best for: warnings, urgent content, bold style
 */
export const Flash: React.FC<PremiumAnimationProps & { flashes?: number }> = ({
  children, delay = 0, duration = 24, flashes = 3,
}) => {
  const frame = useCurrentFrame();
  if (frame < delay) return <div>{children}</div>;

  const elapsed = frame - delay;
  if (elapsed > duration) return <div>{children}</div>;

  const t = elapsed / duration;
  // Rapid on/off flashes
  const opacity = Math.abs(Math.sin(t * Math.PI * flashes));

  return <div style={{ opacity }}>{children}</div>;
};

/**
 * GlowPulse - Pulsing glow/shadow for premium emphasis
 * Best for: modern/bold styles, highlighting key elements, CTAs
 */
export const GlowPulse: React.FC<PremiumAnimationProps & {
  color?: string;
  intensity?: number;
}> = ({
  children, delay = 0, duration = 40, color = '#3b82f6', intensity = 30,
}) => {
  const frame = useCurrentFrame();
  if (frame < delay) return <div>{children}</div>;

  const t = ((frame - delay) % duration) / duration;
  const glowSize = interpolate(
    Math.sin(t * Math.PI * 2),
    [-1, 1],
    [intensity * 0.3, intensity]
  );
  const glowOpacity = interpolate(
    Math.sin(t * Math.PI * 2),
    [-1, 1],
    [0.3, 0.8]
  );

  return (
    <div style={{
      filter: `drop-shadow(0 0 ${glowSize}px ${color})`,
      opacity: interpolate(glowOpacity, [0.3, 0.8], [0.85, 1]),
    }}>
      {children}
    </div>
  );
};

/**
 * SlideInRotate - Slide in from side with slight rotation
 * Best for: modern/playful card entrances, list items
 */
export const SlideInRotate: React.FC<PremiumAnimationProps & {
  direction?: 'left' | 'right';
  distance?: number;
  angle?: number;
}> = ({
  children, delay = 0, duration, style = 'modern', speed = 'normal',
  direction = 'left', distance = 80, angle = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = duration || PREMIUM_DURATIONS[style][speed];

  if (frame < delay) return <div style={{ opacity: 0 }}>{children}</div>;

  const progress = spring({
    frame: frame - delay, fps,
    config: SPRING_CONFIGS[style],
    durationInFrames: dur,
  });

  const dir = direction === 'left' ? -1 : 1;
  const translateX = interpolate(progress, [0, 1], [distance * dir, 0]);
  const rotate = interpolate(progress, [0, 1], [angle * dir, 0]);
  const opacity = interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      transform: `translateX(${translateX}px) rotate(${rotate}deg)`,
      opacity,
    }}>
      {children}
    </div>
  );
};

// --- PREMIUM STAGGER (supports premium animations) ---

/**
 * PremiumStagger - Enhanced stagger supporting all animation types
 */
export const PremiumStagger: React.FC<{
  children: React.ReactNode[];
  delayPerItem?: number;
  startDelay?: number;
  animation?: 'fadeInUp' | 'bounceIn' | 'zoomIn' | 'slideInRotate' | 'fadeIn' | 'slideUp' | 'scaleIn';
  style?: StylePreset;
  speed?: 'fast' | 'normal' | 'slow';
}> = ({
  children, delayPerItem, startDelay = 0,
  animation = 'fadeInUp', style = 'modern', speed = 'normal',
}) => {
  const stagger = delayPerItem ?? STAGGER_DELAYS[style];

  const AnimationComponent: Record<string, React.FC<PremiumAnimationProps>> = {
    fadeInUp: FadeInUp,
    bounceIn: BounceIn,
    zoomIn: ZoomIn,
    slideInRotate: SlideInRotate,
    fadeIn: FadeIn as React.FC<PremiumAnimationProps>,
    slideUp: SlideUp as React.FC<PremiumAnimationProps>,
    scaleIn: ScaleIn as React.FC<PremiumAnimationProps>,
  };

  const Comp = AnimationComponent[animation] || FadeInUp;

  return (
    <>
      {React.Children.map(children, (child, index) => (
        <Comp
          key={index}
          delay={startDelay + index * stagger}
          style={style}
          speed={speed}
        >
          {child}
        </Comp>
      ))}
    </>
  );
};
