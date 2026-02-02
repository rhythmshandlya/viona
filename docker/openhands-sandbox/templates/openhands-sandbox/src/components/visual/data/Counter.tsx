import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

type FormatType = 'none' | 'compact' | 'currency' | 'percent';
type AnimationStyle = 'smooth' | 'bounce' | 'spring' | 'dramatic';

interface CounterProps {
  /** Starting number */
  from: number;
  /** Target number */
  to: number;
  /** Frame to start counting */
  startFrame: number;
  /** Duration of count animation in frames */
  durationFrames: number;
  /** Number format */
  format?: FormatType;
  /** Text before number (e.g., '$') */
  prefix?: string;
  /** Text after number (e.g., '%') */
  suffix?: string;
  /** Decimal places (default: 0) */
  decimals?: number;
  /** Font size multiplier (default: 1) */
  fontSize?: number;
  /** Primary color */
  color?: string;
  /** Font weight (default: 700) */
  fontWeight?: string | number;
  /** Animation easing style */
  animationStyle?: AnimationStyle;
  /** Add glow effect */
  glow?: boolean;
  /** Glow color (defaults to primary color) */
  glowColor?: string;
  /** Add gradient to text */
  gradient?: boolean;
  /** Gradient colors (if gradient enabled) */
  gradientColors?: string[];
  /** Show scale punch on completion */
  punchOnComplete?: boolean;
  /** Font family override */
  fontFamily?: string;
}

/**
 * Counter - Premium animated counting number with typography refinement
 *
 * Features smooth easing, optional glow effects, gradient text,
 * and a satisfying scale punch on completion.
 *
 * @example
 * <Counter
 *   from={0}
 *   to={1000000}
 *   startFrame={0}
 *   durationFrames={90}
 *   format="compact"
 *   glow
 *   gradient
 * />
 */
export const Counter: React.FC<CounterProps> = ({
  from,
  to,
  startFrame,
  durationFrames,
  format = 'none',
  prefix = '',
  suffix = '',
  decimals = 0,
  fontSize = 1,
  color = '#ffffff',
  fontWeight = 700,
  animationStyle = 'smooth',
  glow = false,
  glowColor,
  gradient = false,
  gradientColors = ['#8b5cf6', '#06b6d4'],
  punchOnComplete = false,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  // Calculate progress based on animation style
  const rawProgress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Apply easing based on style
  const eased = applyEasing(rawProgress, animationStyle);
  const currentValue = from + (to - from) * eased;

  // Scale punch effect when complete
  let scale = 1;
  if (punchOnComplete && rawProgress >= 1) {
    const completedFrames = frame - (startFrame + durationFrames);
    if (completedFrames < 15) {
      const punchProgress = completedFrames / 15;
      // Quick scale up then settle
      scale = 1 + Math.sin(punchProgress * Math.PI) * 0.08;
    }
  }

  // Format the number
  const formattedValue = formatNumber(currentValue, format, decimals);

  // Determine font family with premium defaults
  const actualFontFamily = fontFamily || 'system-ui, -apple-system, "SF Pro Display", "Segoe UI", sans-serif';
  const actualGlowColor = glowColor || color;

  // Glow layers for premium effect
  const glowShadow = glow ? [
    `0 0 ${width * 0.01}px ${actualGlowColor}`,
    `0 0 ${width * 0.02}px ${actualGlowColor}80`,
    `0 0 ${width * 0.04}px ${actualGlowColor}40`,
  ].join(', ') : 'none';

  // Gradient text styles
  const gradientStyle: React.CSSProperties = gradient ? {
    background: `linear-gradient(135deg, ${gradientColors.join(', ')})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  } : {};

  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: actualFontFamily,
        fontSize: `${fontSize}em`,
        fontWeight,
        color: gradient ? undefined : color,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.03em',
        lineHeight: 1,
        textShadow: glowShadow,
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        ...gradientStyle,
      }}
    >
      {prefix && (
        <span style={{ opacity: 0.8, marginRight: '0.05em' }}>{prefix}</span>
      )}
      <span style={{ fontFeatureSettings: '"tnum"' }}>
        {formattedValue}
      </span>
      {suffix && (
        <span style={{ opacity: 0.8, marginLeft: '0.05em', fontWeight: 500 }}>{suffix}</span>
      )}
    </span>
  );
};

function applyEasing(progress: number, style: AnimationStyle): number {
  switch (style) {
    case 'bounce':
      // Overshoot then settle
      if (progress < 0.9) {
        return Easing.out(Easing.cubic)(progress / 0.9) * 1.05;
      }
      return 1.05 - 0.05 * ((progress - 0.9) / 0.1);

    case 'spring':
      // Quick start, bouncy end
      const springEased = 1 - Math.pow(1 - progress, 4);
      const oscillation = Math.sin(progress * Math.PI * 3) * Math.pow(1 - progress, 2) * 0.1;
      return springEased + oscillation;

    case 'dramatic':
      // Slow start, explosive finish
      return Easing.bezier(0.22, 1, 0.36, 1)(progress);

    case 'smooth':
    default:
      // Classic ease-out cubic
      return 1 - Math.pow(1 - progress, 3);
  }
}

function formatNumber(value: number, format: FormatType, decimals: number): string {
  switch (format) {
    case 'compact':
      return formatCompact(value, decimals);
    case 'currency':
      return value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    case 'percent':
      return value.toFixed(decimals);
    default:
      if (decimals > 0) {
        return value.toFixed(decimals);
      }
      return Math.round(value).toLocaleString('en-US');
  }
}

function formatCompact(value: number, decimals: number = 1): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000_000).toFixed(decimals)}T`;
  }
  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(decimals)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(decimals)}K`;
  }
  return `${sign}${decimals > 0 ? absValue.toFixed(decimals) : Math.round(absValue)}`;
}

export default Counter;
