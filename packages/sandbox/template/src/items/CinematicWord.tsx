import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { resolveAnimation } from '../animations/resolve';
import type { AnimationConfig } from '../animations/types';

// --- Inline types (caption-analysis.ts is not exported from @viona/shared) ---

export type CinematicTier = 'hero' | 'accent' | 'normal' | 'whisper';
export type FontRole = 'bold-sans' | 'elegant-cursive' | 'default';
export type ColorRole = 'primary' | 'accent' | 'glow';

export type CinematicAnimation =
  | 'elastic-pop'
  | 'slide-up'
  | 'blur-zoom'
  | 'bounce-up'
  | 'typewriter'
  | 'fade-rise'
  | 'slam-down'
  | 'scale-bounce'
  | 'fade'
  | 'none';

export interface WordDirective {
  wordIndex: number;
  tier: CinematicTier;
  fontRole: FontRole;
  animation: CinematicAnimation;
  entryDelayMs: number;
  colorRole: ColorRole;
  textTransform?: 'uppercase' | 'none';
  scaleOverride?: number;
}

// --- Props ---

export interface CinematicWordWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface CinematicFonts {
  boldSans: string;
  elegantCursive: string;
  default: string;
}

export interface CinematicColors {
  primary: string;
  accent: string;
  accentGradient?: string;
  glow: string;
}

export interface CinematicScales {
  hero: number;
  accent: number;
  normal: number;
  whisper: number;
}

export interface CinematicWordProps {
  /** The word timing data from Whisper */
  word: CinematicWordWord;
  /** AI classification directive for this word */
  directive: WordDirective;
  /** Font family config from preset */
  fonts: CinematicFonts;
  /** Color config from preset */
  colors: CinematicColors;
  /** Scale multipliers from preset */
  scales: CinematicScales;
  /** Base font size from preset (authored for 1080px canvas) */
  baseFontSize: number;
  /** Canvas width for responsive scaling */
  canvasWidth: number;
  /** Fallback animation config */
  defaultAnimation: AnimationConfig;
  /** Absolute start time of the caption block (ms) */
  captionStartMs: number;
}

// --- Helpers ---

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

function buildTextShadow(tier: CinematicTier, glowColor: string): string | undefined {
  const rgb = hexToRgb(glowColor);
  switch (tier) {
    case 'hero':
      // Strong glow + drop shadow
      return [
        `0 0 8px rgba(${rgb}, 0.9)`,
        `0 0 20px rgba(${rgb}, 0.6)`,
        `0 0 40px rgba(${rgb}, 0.35)`,
        `0 4px 8px rgba(0,0,0,0.8)`,
      ].join(', ');
    case 'accent':
      // Medium glow + subtle shadow
      return [
        `0 0 6px rgba(${rgb}, 0.55)`,
        `0 0 16px rgba(${rgb}, 0.3)`,
        `0 2px 6px rgba(0,0,0,0.6)`,
      ].join(', ');
    case 'normal':
      // Subtle shadow only
      return `0 2px 4px rgba(0,0,0,0.5)`;
    case 'whisper':
      return undefined;
  }
}

function resolveFontFamily(fontRole: FontRole, fonts: CinematicFonts): string {
  switch (fontRole) {
    case 'bold-sans':
      return fonts.boldSans;
    case 'elegant-cursive':
      return fonts.elegantCursive;
    case 'default':
      return fonts.default;
  }
}

function resolveFontWeight(tier: CinematicTier): number {
  switch (tier) {
    case 'hero':
      return 900;
    case 'accent':
      return 700;
    case 'normal':
      return 500;
    case 'whisper':
      return 400;
  }
}

function resolveColorStyle(
  colorRole: ColorRole,
  colors: CinematicColors,
): React.CSSProperties {
  switch (colorRole) {
    case 'primary':
      return { color: colors.primary };
    case 'accent':
      if (colors.accentGradient) {
        return {
          backgroundImage: colors.accentGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        };
      }
      return { color: colors.accent };
    case 'glow':
      return { color: colors.primary };
  }
}

// --- Component ---

export const CinematicWord: React.FC<CinematicWordProps> = ({
  word,
  directive,
  fonts,
  colors,
  scales,
  baseFontSize,
  canvasWidth,
  defaultAnimation,
  captionStartMs,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Absolute current time in ms (frame is relative to sequence start)
  const currentTimeMs = captionStartMs + (frame / fps) * 1000;

  // Frame-quantize the entry delay
  const delayFrames = Math.round(directive.entryDelayMs / (1000 / fps));
  const delayMs = (delayFrames / fps) * 1000;

  // Visual start time is shifted by entry delay
  const visualStartMs = word.startMs + delayMs;
  const wordDurationMs = Math.max(1, word.endMs - word.startMs - delayMs);

  // Timing state relative to visual start
  const elapsedMs = currentTimeMs - visualStartMs;
  const isActive = currentTimeMs >= visualStartMs && currentTimeMs < word.endMs;
  const hasAppeared = currentTimeMs >= word.endMs;
  const isFuture = currentTimeMs < visualStartMs;

  // Build AnimationConfig from directive
  const animConfig: AnimationConfig = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    in: (directive.animation !== 'none' ? directive.animation : defaultAnimation.in) as any,
    active: defaultAnimation.active,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out: defaultAnimation.out as any,
    easing: defaultAnimation.easing,
  };

  const { style: animStyle } = resolveAnimation(animConfig, {
    elapsedMs: Math.max(0, elapsedMs),
    wordDurationMs,
    isActive,
    hasAppeared,
    isFuture,
  });

  // Responsive font scale
  const responsiveScale = canvasWidth / 1080;

  // Tier scale (scaleOverride takes precedence)
  const tierScale = directive.scaleOverride ?? scales[directive.tier];
  const computedFontSize = tierScale * baseFontSize * responsiveScale;

  // Color / gradient styles
  const colorStyle = resolveColorStyle(directive.colorRole, colors);

  // Text shadow / glow effects
  const textShadow = buildTextShadow(directive.tier, colors.glow);

  // Whisper tier: reduced opacity
  const opacity = directive.tier === 'whisper' ? 0.6 : 1;

  const wordStyle: React.CSSProperties = {
    display: 'inline-block',
    whiteSpace: 'nowrap',
    fontFamily: resolveFontFamily(directive.fontRole, fonts),
    fontSize: computedFontSize,
    fontWeight: resolveFontWeight(directive.tier),
    textTransform: directive.textTransform ?? 'none',
    opacity,
    ...(textShadow ? { textShadow } : {}),
    ...colorStyle,
    WebkitFontSmoothing: 'antialiased',
    ...animStyle,
  };

  return <span style={wordStyle}>{word.text}</span>;
};

export default CinematicWord;
