import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface GradientTextProps {
  /** Text to display */
  text: string;
  /** Gradient colors (min 2) */
  colors?: string[];
  /** Gradient direction in degrees (default: 90) */
  angle?: number;
  /** Font size multiplier (default: 1) */
  fontSize?: number;
  /** Font weight (default: 700) */
  fontWeight?: number;
  /** Frame when text appears */
  enterFrame?: number;
  /** Animate gradient movement */
  animateGradient?: boolean;
  /** Gradient animation speed (default: 1) */
  gradientSpeed?: number;
  /** Add text shadow/glow */
  glow?: boolean;
  /** Custom font family */
  fontFamily?: string;
  /** Letter spacing multiplier */
  letterSpacing?: number;
}

/**
 * GradientText - Animated gradient text for headings
 *
 * Creates eye-catching text with animated gradient fills.
 * Perfect for titles and hero text.
 *
 * @example
 * <GradientText
 *   text="Amazing Feature"
 *   colors={['#8b5cf6', '#06b6d4', '#22c55e']}
 *   animateGradient
 *   glow
 * />
 */
export const GradientText: React.FC<GradientTextProps> = ({
  text,
  colors = ['#8b5cf6', '#3b82f6', '#06b6d4'],
  angle = 90,
  fontSize = 1,
  fontWeight = 700,
  enterFrame = 0,
  animateGradient = false,
  gradientSpeed = 1,
  glow = false,
  fontFamily = 'system-ui, -apple-system, sans-serif',
  letterSpacing = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  const localFrame = Math.max(0, frame - enterFrame);
  const isVisible = frame >= enterFrame;

  // Entrance animation
  const springValue = spring({
    frame: localFrame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const opacity = isVisible ? springValue : 0;
  const scale = isVisible ? springValue : 0;

  // Animated gradient position
  const gradientOffset = animateGradient
    ? interpolate(
        frame,
        [0, fps * 3 / gradientSpeed],
        [0, 200],
        { extrapolateRight: 'extend' }
      ) % 200
    : 0;

  // Build gradient with animation offset
  const gradientColors = [...colors, ...colors]; // Duplicate for seamless loop
  const gradientString = `linear-gradient(${angle}deg, ${gradientColors.join(', ')})`;

  const textSize = height * 0.06 * fontSize;
  const glowColor = colors[0];

  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: textSize,
        fontWeight,
        fontFamily,
        letterSpacing: `${letterSpacing * 0.1}em`,
        background: gradientString,
        backgroundSize: animateGradient ? '200% 100%' : '100% 100%',
        backgroundPosition: animateGradient ? `${gradientOffset}% 0` : '0 0',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        textShadow: glow
          ? `0 0 ${textSize * 0.3}px ${glowColor}40, 0 0 ${textSize * 0.6}px ${glowColor}20`
          : 'none',
      }}
    >
      {text}
    </span>
  );
};

export default GradientText;
