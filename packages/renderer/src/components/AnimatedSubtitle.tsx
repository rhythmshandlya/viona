import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { resolveAnimation, isAnimationConfig, migrateAnimation } from '../animations';
import type { AnimationConfig } from '../animations';

export interface WordStyleOverrides {
  color?: string;
  activeColor?: string;
  fontWeight?: number;
  fontFamily?: string;
  fontSize?: number;
  scale?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  emphasisBg?: string;
}

export interface SubtitleWord {
  text: string;
  startMs: number;
  endMs: number;
  styleOverrides?: WordStyleOverrides;
}

export interface StrokeStyle {
  width: number;
  color: string;
}

// Effects types for Phase 3
export interface ShadowEffect {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
  opacity: number;
}

export interface GlowEffect {
  enabled: boolean;
  color: string;
  intensity: number;
  size: number;
}

export interface CaptionEffects {
  shadow: ShadowEffect | null;
  shadowSecondary: ShadowEffect | null;
  glow: GlowEffect | null;
}

// Effects helper functions
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

function shadowToCss(shadow: ShadowEffect): string {
  const { offsetX, offsetY, blur, color, opacity } = shadow;
  return `${offsetX}px ${offsetY}px ${blur}px rgba(${hexToRgb(color)}, ${opacity})`;
}

function effectsToCss(effects: CaptionEffects | undefined): React.CSSProperties {
  if (!effects) {
    return {};
  }

  const shadows: string[] = [];

  if (effects.shadow) {
    shadows.push(shadowToCss(effects.shadow));
  }

  if (effects.shadowSecondary) {
    shadows.push(shadowToCss(effects.shadowSecondary));
  }

  if (effects.glow?.enabled) {
    const { color, intensity, size } = effects.glow;
    const rgb = hexToRgb(color);
    shadows.push(`0 0 ${Math.round(size * 0.3)}px rgba(${rgb}, ${intensity})`);
    shadows.push(`0 0 ${Math.round(size * 0.6)}px rgba(${rgb}, ${intensity * 0.7})`);
    shadows.push(`0 0 ${size}px rgba(${rgb}, ${intensity * 0.4})`);
  }

  return {
    textShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
  };
}

function migrateTextShadow(legacy: string | undefined): CaptionEffects {
  if (!legacy) {
    return { shadow: null, shadowSecondary: null, glow: null };
  }

  const match = legacy.match(
    /(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
  );

  if (!match) {
    return {
      shadow: { offsetX: 2, offsetY: 2, blur: 4, color: '#000000', opacity: 0.8 },
      shadowSecondary: null,
      glow: null,
    };
  }

  const [, x, y, blur, r, g, b, a] = match;
  const color = `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`;

  return {
    shadow: {
      offsetX: parseInt(x),
      offsetY: parseInt(y),
      blur: parseInt(blur),
      color,
      opacity: a ? parseFloat(a) : 1,
    },
    shadowSecondary: null,
    glow: null,
  };
}

// V2 Position System
export interface SubtitlePosition {
  anchor: 'top' | 'center' | 'bottom';
  offsetX: number;
  offsetY: number;
  rotation: number;
  textAlign: 'left' | 'center' | 'right';
}

const DEFAULT_POSITION: SubtitlePosition = {
  anchor: 'bottom',
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  textAlign: 'center',
};

// Resolve position (handles both legacy string and new SubtitlePosition object)
function resolvePosition(position?: SubtitlePosition | 'top' | 'center' | 'bottom'): SubtitlePosition {
  if (!position) {
    return DEFAULT_POSITION;
  }
  if (typeof position === 'object' && 'anchor' in position) {
    return position;
  }
  // Legacy string format
  return {
    ...DEFAULT_POSITION,
    anchor: position,
  };
}

// Calculate position styles for caption rendering
function calculatePositionStyles(
  position: SubtitlePosition,
  lineHeight: number
): React.CSSProperties {
  const { anchor, offsetX, offsetY, rotation, textAlign } = position;

  // Base position from anchor — matches preview's Composition.tsx exactly
  const baseStyles: React.CSSProperties = {
    position: 'absolute',
    left: `${50 + offsetX}%`,
    width: '90%',
    maxWidth: '90%',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    lineHeight,
    textAlign,
  };

  // Build transform
  const transforms: string[] = ['translateX(-50%)'];

  switch (anchor) {
    case 'top':
      baseStyles.top = `${10 + offsetY}%`;
      break;
    case 'center':
      baseStyles.top = `${50 + offsetY}%`;
      transforms[0] = 'translate(-50%, -50%)';
      break;
    case 'bottom':
      baseStyles.bottom = `${15 - offsetY}%`;
      break;
  }

  if (rotation !== 0) {
    transforms.push(`rotate(${rotation}deg)`);
  }

  baseStyles.transform = transforms.join(' ');

  // Justify content based on text alignment
  switch (textAlign) {
    case 'left':
      baseStyles.justifyContent = 'flex-start';
      break;
    case 'right':
      baseStyles.justifyContent = 'flex-end';
      break;
    default:
      baseStyles.justifyContent = 'center';
      break;
  }

  return baseStyles;
}

export interface SubtitleStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  activeColor?: string;
  backgroundColor?: string;
  activeBackgroundColor?: string;
  // Position - V2: SubtitlePosition object, V1: string (migrated at load)
  position?: SubtitlePosition | 'top' | 'center' | 'bottom';
  animation?: string | AnimationConfig;
  textShadow?: string;  // @deprecated - use effects instead
  effects?: CaptionEffects;  // V3: Full effects system
  // Phase 1 typography properties
  opacity?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  stroke?: StrokeStyle | null;
  // Display mode
  displayMode?: 'word-by-word' | 'phrase' | 'karaoke';
  wordsPerPhrase?: number;
}

export interface AnimatedSubtitleProps {
  words: SubtitleWord[];
  startMs: number;
  endMs: number;
  style?: SubtitleStyle;
}

const defaultStyle: SubtitleStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 56,
  fontWeight: 800,
  color: '#ffffff',
  activeColor: '#ffff00',
  backgroundColor: 'transparent',
  activeBackgroundColor: 'transparent',
  position: 'bottom',
  animation: 'highlight',
  // Phase 1 typography defaults
  opacity: 1,
  lineHeight: 1.4,
  letterSpacing: 0,
  textTransform: 'none',
  stroke: null,
};

export const AnimatedSubtitle: React.FC<AnimatedSubtitleProps> = ({
  words,
  startMs,
  style: customStyle = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = { ...defaultStyle, ...customStyle };

  // Words from the DB have absolute timing (relative to video start).
  // Inside a Remotion Sequence, useCurrentFrame() is relative to the Sequence start.
  // Add startMs to convert back to absolute time so word active checks match.
  const currentTimeMs = startMs + (frame / fps) * 1000;

  // Position styles - use new position system
  const position = resolvePosition(style.position);
  const positionStyles = calculatePositionStyles(position, style.lineHeight ?? 1.4);

  const displayMode = style.displayMode || 'phrase';

  // Find active word index
  const activeWordIndex = words.findIndex(
    (word) => currentTimeMs >= word.startMs && currentTimeMs < word.endMs
  );

  // Resolve animation config
  const animConfig: AnimationConfig = isAnimationConfig(style.animation)
    ? style.animation
    : migrateAnimation(style.animation as string);

  // Resolve effects
  const effects: CaptionEffects = style.effects ?? migrateTextShadow(style.textShadow);
  const effectsStyles = effectsToCss(effects);

  // Typography styles helper
  const getTypographyStyles = (): React.CSSProperties => ({
    opacity: style.opacity ?? 1,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
    textTransform: style.textTransform ?? 'none',
    WebkitTextStroke: style.stroke
      ? `${style.stroke.width}px ${style.stroke.color}`
      : undefined,
    paintOrder: style.stroke ? 'stroke fill' : undefined,
    WebkitFontSmoothing: 'antialiased' as const,
    ...effectsStyles,
  });

  // ── Word-by-word mode: only show the active word ──
  if (displayMode === 'word-by-word') {
    if (activeWordIndex < 0) return null;
    const activeWord = words[activeWordIndex];
    const overrides = activeWord.styleOverrides;

    const elapsedMs = currentTimeMs - activeWord.startMs;
    const wordDurationMs = activeWord.endMs - activeWord.startMs;
    const { style: animStyle } = resolveAnimation(animConfig, {
      elapsedMs: Math.max(0, elapsedMs),
      wordDurationMs,
      isActive: true,
      hasAppeared: false,
      isFuture: false,
    });

    return (
      <div style={positionStyles}>
        <span
          style={{
            fontFamily: overrides?.fontFamily || style.fontFamily,
            fontSize: (overrides?.scale || 1) * (overrides?.fontSize || style.fontSize || 56),
            fontWeight: overrides?.fontWeight || style.fontWeight,
            color: overrides?.activeColor || overrides?.color || style.activeColor,
            backgroundColor: overrides?.emphasisBg || style.activeBackgroundColor || 'transparent',
            padding: '4px 12px',
            borderRadius: '8px',
            display: 'inline-block',
            whiteSpace: 'nowrap',
            ...getTypographyStyles(),
            ...(overrides?.letterSpacing != null ? { letterSpacing: `${overrides.letterSpacing}px` } : {}),
            ...(overrides?.textTransform ? { textTransform: overrides.textTransform } : {}),
            ...animStyle,
          }}
        >
          {activeWord.text}
        </span>
      </div>
    );
  }

  // ── Karaoke mode: progressive color fill ──
  if (displayMode === 'karaoke') {
    return (
      <div style={positionStyles}>
        {words.map((word, index) => {
          const isActive = index === activeWordIndex;
          const hasAppeared = currentTimeMs >= word.startMs;
          const overrides = word.styleOverrides;

          const elapsedMs = currentTimeMs - word.startMs;
          const wordDurationMs = word.endMs - word.startMs;
          const { style: animStyle } = resolveAnimation(animConfig, {
            elapsedMs: Math.max(0, elapsedMs),
            wordDurationMs,
            isActive,
            hasAppeared: hasAppeared && !isActive,
            isFuture: !hasAppeared,
          });

          let fillPercent = 0;
          if (hasAppeared && !isActive) {
            fillPercent = 100;
          } else if (isActive) {
            fillPercent = Math.min((elapsedMs / wordDurationMs) * 100, 100);
          }

          return (
            <span
              key={index}
              style={{
                fontFamily: overrides?.fontFamily || style.fontFamily,
                fontSize: (overrides?.scale || 1) * (overrides?.fontSize || style.fontSize || 56),
                fontWeight: overrides?.fontWeight || style.fontWeight,
                padding: '4px 12px',
                borderRadius: '8px',
                display: 'inline-block',
                whiteSpace: 'nowrap',
                backgroundImage: hasAppeared
                  ? `linear-gradient(90deg, ${overrides?.activeColor || style.activeColor} ${fillPercent}%, ${style.color} ${fillPercent}%)`
                  : `linear-gradient(90deg, ${style.color}, ${style.color})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                ...getTypographyStyles(),
                ...(overrides?.letterSpacing != null ? { letterSpacing: `${overrides.letterSpacing}px` } : {}),
                ...(overrides?.textTransform ? { textTransform: overrides.textTransform } : {}),
                ...animStyle,
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    );
  }

  // ── Default phrase mode: show all words, highlight active ──
  return (
    <div style={positionStyles}>
      {words.map((word, index) => (
        <Word
          key={index}
          word={word}
          style={style}
          currentTimeMs={currentTimeMs}
        />
      ))}
    </div>
  );
};

interface WordProps {
  word: SubtitleWord;
  style: SubtitleStyle;
  currentTimeMs: number;
}

const Word: React.FC<WordProps> = ({
  word,
  style,
  currentTimeMs,
}) => {
  // 1. Resolve animation config (handle legacy strings via migrateAnimation)
  const animConfig: AnimationConfig = isAnimationConfig(style.animation)
    ? style.animation
    : migrateAnimation(style.animation as string);

  // 2. Calculate timing context
  const isActive = currentTimeMs >= word.startMs && currentTimeMs < word.endMs;
  const hasAppeared = currentTimeMs >= word.startMs;
  const elapsedMs = currentTimeMs - word.startMs;
  const wordDurationMs = word.endMs - word.startMs;

  // 3. Call resolveAnimation
  const { style: animStyle } = resolveAnimation(animConfig, {
    elapsedMs: Math.max(0, elapsedMs),
    wordDurationMs,
    isActive,
    hasAppeared: hasAppeared && !isActive,
    isFuture: !hasAppeared,
  });

  // 4. Apply per-word style overrides if present
  const overrides = word.styleOverrides;

  // 5. Resolve effects (handles both legacy textShadow and new effects object)
  const effects: CaptionEffects = style.effects ?? migrateTextShadow(style.textShadow);
  const effectsStyles = effectsToCss(effects);

  // 6. Typography styles helper
  const getTypographyStyles = (): React.CSSProperties => ({
    opacity: style.opacity ?? 1,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
    textTransform: style.textTransform ?? 'none',
    // Use paint-order to draw stroke behind fill for cleaner rendering
    WebkitTextStroke: style.stroke
      ? `${style.stroke.width}px ${style.stroke.color}`
      : undefined,
    paintOrder: style.stroke ? 'stroke fill' : undefined,
    WebkitFontSmoothing: 'antialiased' as const,
    ...effectsStyles,
  });

  // 7. Build final CSS
  const baseFontSize = overrides?.fontSize ?? (style.fontSize || 56);
  const wordCss: React.CSSProperties = {
    fontFamily: overrides?.fontFamily ?? style.fontFamily,
    fontSize: (overrides?.scale || 1) * baseFontSize,
    fontWeight: overrides?.fontWeight ?? style.fontWeight,
    color: isActive
      ? (overrides?.activeColor ?? overrides?.color ?? style.activeColor)
      : (overrides?.color ?? style.color),
    backgroundColor: overrides?.emphasisBg
      || (isActive ? style.activeBackgroundColor : style.backgroundColor),
    padding: '4px 12px',
    borderRadius: '8px',
    display: 'inline-block',
    ...getTypographyStyles(),
    // Per-word letter spacing and text transform override the caption-level values
    ...(overrides?.letterSpacing != null ? { letterSpacing: `${overrides.letterSpacing}px` } : {}),
    ...(overrides?.textTransform ? { textTransform: overrides.textTransform } : {}),
    ...animStyle,
  };

  // 8. Karaoke gradient effect for 'karaoke' legacy or 'color-wipe' animation
  if (style.animation === 'karaoke' && hasAppeared) {
    const fillPercent = isActive
      ? ((currentTimeMs - word.startMs) / (word.endMs - word.startMs)) * 100
      : (hasAppeared ? 100 : 0);
    wordCss.backgroundImage = `linear-gradient(90deg, ${style.activeColor} ${fillPercent}%, ${style.color} ${fillPercent}%)`;
    wordCss.WebkitBackgroundClip = 'text';
    wordCss.WebkitTextFillColor = 'transparent';
    wordCss.backgroundClip = 'text';
  }

  return <span style={wordCss}>{word.text}</span>;
};

export default AnimatedSubtitle;
