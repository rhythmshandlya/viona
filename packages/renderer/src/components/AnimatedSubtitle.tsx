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
  displayMode?: 'word-by-word' | 'phrase' | 'karaoke' | 'poster-staircase';
  wordsPerPhrase?: number;
  // Word emphasis overrides per role (from captionPreset.wordEmphasis)
  wordEmphasis?: {
    enabled: boolean;
    roles: Record<string, Partial<WordStyleOverrides>>;
  };
  // Preset reference
  presetId?: string;
  // Background box styling
  backgroundPadding?: { x: number; y: number };
  backgroundRadius?: number;
}

export interface AnimatedSubtitleProps {
  words: SubtitleWord[];
  startMs: number;
  endMs: number;
  style?: SubtitleStyle;
}

// Word classification sets — used by classifyWordTier() runtime fallback
const POWER_WORD_SET = new Set([
  'love', 'hate', 'fear', 'die', 'dead', 'death', 'kill', 'destroy', 'dream',
  'obsessed', 'insane', 'crazy', 'incredible', 'amazing', 'unbelievable',
  'shocking', 'terrifying', 'brilliant', 'genius', 'perfect', 'worst',
  'best', 'greatest', 'legendary', 'epic', 'massive', 'huge', 'evil',
  'now', 'stop', 'wait', 'listen', 'watch', 'look', 'never', 'always',
  'forever', 'immediately', 'urgent', 'warning', 'danger', 'critical',
  'important', 'breaking', 'exclusive', 'secret', 'finally', 'today',
  'million', 'billion', 'thousand', 'money', 'rich', 'free', 'paid',
  'expensive', 'cheap', 'profit', 'cash', 'dollar', 'dollars', 'price',
  'worth', 'cost', 'zero', 'double', 'triple', '100%', '1000',
  'but', 'however', 'actually', 'wrong', 'right', 'truth', 'lie', 'real',
  'fake', 'only', 'everything', 'nothing', 'impossible', 'possible',
  'everyone', 'nobody', 'first', 'last', 'biggest', 'smallest',
  'win', 'won', 'lose', 'lost', 'fight', 'broke', 'crushed', 'dominated',
  'exploded', 'changed', 'saved', 'failed', 'success', 'discovered',
]);

const FILLER_WORD_SET = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'for', 'on', 'at', 'by', 'with', 'from', 'as',
  'and', 'or', 'if', 'it', 'its', 'that', 'this', 'than', 'then',
  'so', 'up', 'do', 'did', 'has', 'had', 'have', 'will', 'would',
  'could', 'should', 'can', 'may', 'might', 'shall', 'just', 'very',
  'also', 'about', 'into', 'not', 'no', 'yes', 'some', 'my', 'your',
  'we', 'they', 'he', 'she', 'i', 'me', 'us', 'them', 'our', 'their',
]);

// Runtime fallback word classification (used when word.role is not set)
function classifyWordTier(text: string): 'power' | 'medium' | 'filler' {
  const clean = text.replace(/[^a-zA-Z0-9%]/g, '').toLowerCase();
  if (/^\$?\d/.test(clean) || /\d{4,}/.test(clean) || clean.endsWith('%')) return 'power';
  if (POWER_WORD_SET.has(clean)) return 'power';
  if (FILLER_WORD_SET.has(clean)) return 'filler';
  return 'medium';
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
  const { fps, width: canvasWidth } = useVideoConfig();
  const style = { ...defaultStyle, ...customStyle };

  // Responsive font scale: preset font sizes are authored for 1080px wide canvas.
  // Scale proportionally to match the preview (Composition.tsx CaptionRenderer).
  const fontScale = canvasWidth / 1080;

  // Words from the DB have absolute timing (relative to video start).
  // Inside a Remotion Sequence, useCurrentFrame() is relative to the Sequence start.
  // Add startMs to convert back to absolute time so word active checks match.
  const currentTimeMs = startMs + (frame / fps) * 1000;

  // Position styles - use new position system
  const position = resolvePosition(style.position);
  const positionStyles = calculatePositionStyles(position, style.lineHeight ?? 1.4);

  const displayMode = style.displayMode || 'phrase';
  const wordsPerPhrase = style.wordsPerPhrase || 7;

  // Find active word index
  const activeWordIndex = words.findIndex(
    (word) => currentTimeMs >= word.startMs && currentTimeMs < word.endMs
  );

  // For phrase windowing: find the last word whose startMs we've reached
  // (avoids jitter when activeWordIndex is -1 in gaps between words)
  let lastAppearedIdx = -1;
  for (let i = words.length - 1; i >= 0; i--) {
    if (currentTimeMs >= words[i].startMs) {
      lastAppearedIdx = i;
      break;
    }
  }

  // Compute which window group the current word belongs to
  const currentGroupIdx = lastAppearedIdx >= 0
    ? Math.floor(lastAppearedIdx / wordsPerPhrase)
    : 0;
  const groupStart = currentGroupIdx * wordsPerPhrase;
  const groupEnd = Math.min(groupStart + wordsPerPhrase, words.length);
  const visibleWords = words.slice(groupStart, groupEnd);

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
            fontSize: (overrides?.scale || 1) * (overrides?.fontSize || (style.fontSize || 56) * fontScale),
            fontWeight: overrides?.fontWeight || style.fontWeight,
            color: overrides?.activeColor || overrides?.color || style.activeColor,
            backgroundColor: overrides?.emphasisBg || style.activeBackgroundColor || 'transparent',
            padding: style.backgroundPadding
              ? `${style.backgroundPadding.y}px ${style.backgroundPadding.x}px`
              : '4px 12px',
            borderRadius: style.backgroundRadius != null ? `${style.backgroundRadius}px` : '8px',
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

  // ── Poster Staircase mode ──
  // Layout: find the single strongest/most-central word as the pivot; words before
  // it form line 1 (small white uppercase), pivot word is line 2 (large gold italic),
  // words after form line 3 (small white uppercase). All lines appear together.
  if (displayMode === 'poster-staircase') {
    if (lastAppearedIdx < 0) return null;

    const POWER_SET = new Set([
      'love','hate','fear','die','dead','death','kill','destroy','dream',
      'obsessed','insane','crazy','incredible','amazing','unbelievable',
      'shocking','terrifying','brilliant','genius','perfect','worst',
      'best','greatest','legendary','epic','massive','huge','evil',
      'now','stop','wait','listen','watch','look','never','always',
      'forever','immediately','urgent','warning','danger','critical',
      'important','breaking','exclusive','secret','finally','today',
      'million','billion','thousand','money','rich','free','paid',
      'but','however','actually','wrong','right','truth','lie','real',
      'fake','only','everything','nothing','impossible','possible',
      'everyone','nobody','first','last','biggest','smallest',
      'win','won','lose','lost','fight','broke','crushed','dominated',
      'exploded','changed','saved','failed','success','discovered',
    ]);
    const FILLER_SET = new Set([
      'the','a','an','is','are','was','were','be','been','being',
      'to','of','in','for','on','at','by','with','from','as',
      'and','or','if','it','its','that','this','than','then',
      'so','up','do','did','has','had','have','will','would',
      'could','should','can','may','might','shall','just','very',
      'also','about','into','not','no','yes','some','my','your',
      'we','they','he','she','i','me','us','them','our','their',
    ]);
    const wordScore = (text: string): number => {
      const c = text.replace(/[^a-zA-Z0-9%]/g, '').toLowerCase();
      if (/^\$?\d/.test(c) || /\d{4,}/.test(c) || c.endsWith('%')) return 4;
      if (POWER_SET.has(c)) return 4;
      if (FILLER_SET.has(c)) return 1;
      if (c.length >= 7) return 3;
      return 2;
    };

    // Find single pivot: highest-scoring word closest to phrase center
    const scores = visibleWords.map((w) => wordScore(w.text));
    const maxScore = Math.max(...scores);
    const phraseCenter = (visibleWords.length - 1) / 2;
    let pivotIdx = -1;
    if (maxScore >= 3) {
      let bestDist = Infinity;
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] === maxScore) {
          const dist = Math.abs(i - phraseCenter);
          if (dist < bestDist) { bestDist = dist; pivotIdx = i; }
        }
      }
    }

    const emphasisFont = (style as any).displayFontFamily || 'Dancing Script';
    const bodyFont = (style as any).bodyFontFamily || 'Montserrat';
    const baseFontSize = (style.fontSize || 55) * fontScale;
    const alignment = (style as any).staircaseAlignment || 'center';

    const pos = resolvePosition(style.position);
    const outerStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: `${pos.offsetY}%`,
      left: '50%',
      transform: `translateX(calc(-50% + ${pos.offsetX}%))`,
      width: '88%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: alignment === 'left' ? 'flex-start' : 'center',
      gap: '4px',
    };
    if (pos.anchor === 'top') { outerStyle.bottom = undefined; outerStyle.top = `${10 + pos.offsetY}%`; }
    else if (pos.anchor === 'center') { outerStyle.bottom = undefined; outerStyle.top = '50%'; outerStyle.transform = 'translate(-50%, -50%)'; }

    const bodyStyle = (indent: string): React.CSSProperties => ({
      fontFamily: `'${bodyFont}', Montserrat, sans-serif`,
      fontSize: baseFontSize * 0.72,
      fontWeight: 500,
      color: '#FFFFFF',
      lineHeight: 1.2,
      textAlign: alignment === 'left' ? 'left' : 'center',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      textShadow: '0 1px 8px rgba(0,0,0,0.9)',
      opacity: 0.9,
      marginLeft: indent,
      WebkitFontSmoothing: 'antialiased',
    });

    const emphasisStyle: React.CSSProperties = {
      fontFamily: `'${emphasisFont}', 'Dancing Script', cursive`,
      fontSize: baseFontSize * 1.9,
      fontWeight: 700,
      fontStyle: 'italic',
      color: '#FFD700',
      lineHeight: 1.05,
      textAlign: alignment === 'left' ? 'left' : 'center',
      letterSpacing: '-0.5px',
      textShadow: '0 0 20px rgba(255,180,0,0.7), 0 2px 12px rgba(0,0,0,0.9)',
      marginLeft: alignment === 'stagger' ? '8%' : '0%',
      WebkitFontSmoothing: 'antialiased',
    };

    if (pivotIdx === -1) {
      // No strong/power word — single body line
      return (
        <div style={outerStyle}>
          <div style={bodyStyle('0%')}>{visibleWords.map((w) => w.text).join(' ')}</div>
        </div>
      );
    }

    const beforeText = visibleWords.slice(0, pivotIdx).map((w) => w.text).join(' ');
    const pivotText = visibleWords[pivotIdx].text;
    const afterText = visibleWords.slice(pivotIdx + 1).map((w) => w.text).join(' ');

    return (
      <div style={outerStyle}>
        {beforeText ? <div style={bodyStyle('0%')}>{beforeText}</div> : null}
        <div style={emphasisStyle}>{pivotText}</div>
        {afterText ? <div style={bodyStyle(alignment === 'stagger' ? '16%' : '0%')}>{afterText}</div> : null}
      </div>
    );
  }

  // ── Karaoke mode: progressive color fill (windowed) ──
  if (displayMode === 'karaoke') {
    return (
      <div style={positionStyles}>
        {visibleWords.map((word, index) => {
          const globalIndex = groupStart + index;
          const isActive = globalIndex === activeWordIndex;
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
              key={globalIndex}
              style={{
                fontFamily: overrides?.fontFamily || style.fontFamily,
                fontSize: (overrides?.scale || 1) * (overrides?.fontSize || (style.fontSize || 56) * fontScale),
                fontWeight: overrides?.fontWeight || style.fontWeight,
                padding: style.backgroundPadding
                  ? `${style.backgroundPadding.y}px ${style.backgroundPadding.x}px`
                  : '4px 12px',
                borderRadius: style.backgroundRadius != null ? `${style.backgroundRadius}px` : '8px',
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

  // ── Default phrase mode: show windowed words, highlight active ──
  return (
    <div style={positionStyles}>
      {visibleWords.map((word, index) => {
        const globalIndex = groupStart + index;
        return (
          <Word
            key={globalIndex}
            word={word}
            style={style}
            currentTimeMs={currentTimeMs}
          />
        );
      })}
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
  const { width: wordCanvasWidth } = useVideoConfig();
  const fontScale = wordCanvasWidth / 1080;

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
  const baseFontSize = overrides?.fontSize ?? ((style.fontSize || 56) * fontScale);
  const wordCss: React.CSSProperties = {
    fontFamily: overrides?.fontFamily ?? style.fontFamily,
    fontSize: (overrides?.scale || 1) * baseFontSize,
    fontWeight: overrides?.fontWeight ?? style.fontWeight,
    color: isActive
      ? (overrides?.activeColor ?? overrides?.color ?? style.activeColor)
      : (overrides?.color ?? style.color),
    backgroundColor: overrides?.emphasisBg
      || (isActive ? style.activeBackgroundColor : style.backgroundColor),
    padding: style.backgroundPadding
      ? `${style.backgroundPadding.y}px ${style.backgroundPadding.x}px`
      : '4px 12px',
    borderRadius: style.backgroundRadius != null ? `${style.backgroundRadius}px` : '8px',
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
