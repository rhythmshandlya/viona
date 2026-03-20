// ============================================
// Core Types - Extensible for Phase 2+
// ============================================

export type SubtitleDisplayMode = 'word-by-word' | 'phrase' | 'karaoke' | 'dynamic-hierarchy';

// Legacy position type (for backward compatibility)
export type SubtitlePositionLegacy = 'top' | 'center' | 'bottom';

// V2 Position System
export interface CaptionPosition {
  // Anchor point (where the caption "attaches")
  anchor: 'top' | 'center' | 'bottom';

  // Offset from anchor (percentage of canvas)
  // X: -50 to +50 (0 = centered)
  // Y: -50 to +50 (0 = at anchor)
  offsetX: number;
  offsetY: number;

  // Rotation in degrees (-180 to +180)
  rotation: number;

  // Text alignment within caption box
  textAlign: 'left' | 'center' | 'right';
}

// Safe zone definitions for different platforms
export interface SafeZone {
  top: number;      // % from top to avoid
  bottom: number;   // % from bottom to avoid
  left: number;     // % from left to avoid
  right: number;    // % from right to avoid
}

export const PLATFORM_SAFE_ZONES: Record<string, SafeZone> = {
  'tiktok': { top: 15, bottom: 25, left: 5, right: 5 },
  'instagram-reels': { top: 12, bottom: 20, left: 5, right: 5 },
  'youtube-shorts': { top: 10, bottom: 18, left: 5, right: 5 },
  'universal': { top: 10, bottom: 15, left: 5, right: 5 },
  'none': { top: 0, bottom: 0, left: 0, right: 0 },
};

export const DEFAULT_CAPTION_POSITION: CaptionPosition = {
  anchor: 'bottom',
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  textAlign: 'center',
};

// Migration function for legacy position format
export function migratePosition(style: { position?: CaptionPosition | SubtitlePositionLegacy; offsetY?: number; textAlign?: 'left' | 'center' | 'right' }): CaptionPosition {
  // If already new format (object with anchor)
  if (style.position && typeof style.position === 'object' && 'anchor' in style.position) {
    return style.position;
  }

  // Migrate from old format
  return {
    anchor: (typeof style.position === 'string' ? style.position : 'bottom') as 'top' | 'center' | 'bottom',
    offsetX: 0,
    offsetY: style.offsetY || 0,
    rotation: 0,
    textAlign: style.textAlign || 'center',
  };
}

// Legacy animation type (for backward compatibility)
export type SubtitleAnimationLegacy = 'none' | 'pop' | 'fade' | 'highlight';

// V2 Animation System
export type AnimationType =
  | 'none'
  // Viral
  | 'elastic-pop'
  | 'bounce-up'
  | 'shake'
  | 'color-wipe'
  | '3d-flip'
  | 'punch'
  | 'scale-bounce'
  | 'slide-up'
  | 'weight-shift'
  | 'float'
  | 'rotate-bounce'
  | 'constant-wiggle'
  | 'slam-down'
  | 'shake-entry'
  | 'bubble-pop'
  | 'wiggle'
  // Cinematic
  | 'fade'
  | 'fade-rise'
  | 'typewriter'
  | 'smooth-slide'
  | 'soft-scale'
  | 'underline-wipe'
  | 'scan-line'
  | 'hand-draw'
  | 'underline-sweep'
  // Ad / Premium
  | 'apple-fade' | 'google-slide' | 'clean-scale' | 'letter-cascade' | 'smooth-reveal'
  | 'slide-left'
  // Motion (AutoAE-inspired)
  | 'spotlight-reveal' | 'film-burn' | 'glitch' | 'spin-reveal'
  | 'drop-slam' | 'wave' | 'blur-zoom' | 'chromatic-split'
  | 'elastic-horizontal' | 'speed-blur' | 'particle-explode' | 'gather'
  | 'blob-morph' | 'newspaper-rotate' | 'chrome-reflect' | 'brutal-slam'
  | 'neon-buzz' | 'flicker';

export type EasingType = 'linear' | 'ease-out' | 'ease-in-out' | 'spring' | 'elastic' | 'bounce';

export interface AnimationConfig {
  in: AnimationType;
  active: AnimationType;
  out: AnimationType;
  easing: EasingType;
}

// ============================================
// Video Settings (for 9:16 crop/pan)
// ============================================

export interface VideoSettings {
  canvasWidth: number;   // Output width (1080 for reels)
  canvasHeight: number;  // Output height (1920 for reels)
  cropX: number;         // Horizontal pan: 0-100, 50 = center
  cropY: number;         // Vertical pan: 0-100, 50 = center
  scale: number;         // Zoom: 1.0 = fill frame, 1.5 = 150%
}

// ============================================
// Subtitle Types
// ============================================

// Stroke style for text outline
export interface StrokeStyle {
  width: number;     // 0-10px
  color: string;     // hex color
}

// ============================================
// Effects System (Phase 3)
// ============================================

// Individual shadow definition
export interface ShadowEffect {
  offsetX: number;    // -20 to +20 px
  offsetY: number;    // -20 to +20 px
  blur: number;       // 0 to 30 px
  color: string;      // hex color
  opacity: number;    // 0 to 1
}

// Glow effect (rendered as layered shadows)
export interface GlowEffect {
  enabled: boolean;
  color: string;      // hex color
  intensity: number;  // 0 to 1 (affects opacity)
  size: number;       // 5 to 50 px (blur radius)
}

// Complete effects configuration
export interface CaptionEffects {
  // Primary shadow (most common use case)
  shadow: ShadowEffect | null;

  // Optional secondary shadow (for depth/glitch effects)
  shadowSecondary: ShadowEffect | null;

  // Glow effect (renders as multiple blurred shadows)
  glow: GlowEffect | null;
}

export const DEFAULT_SHADOW: ShadowEffect = {
  offsetX: 2,
  offsetY: 2,
  blur: 4,
  color: '#000000',
  opacity: 0.8,
};

export const DEFAULT_GLOW: GlowEffect = {
  enabled: false,
  color: '#00ffff',
  intensity: 0.7,
  size: 20,
};

export const DEFAULT_CAPTION_EFFECTS: CaptionEffects = {
  shadow: DEFAULT_SHADOW,
  shadowSecondary: null,
  glow: null,
};

// Migration function for legacy textShadow string
export function migrateTextShadow(legacy: string | undefined): CaptionEffects {
  if (!legacy) {
    return { shadow: null, shadowSecondary: null, glow: null };
  }

  // Parse "2px 2px 4px rgba(0, 0, 0, 0.8)" format
  const match = legacy.match(
    /(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
  );

  if (!match) {
    // Fallback for other formats
    return {
      shadow: { ...DEFAULT_SHADOW },
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

export interface WordStyleOverrides {
  color?: string;
  fontWeight?: number;
  scale?: number;        // 1.0 = normal, 1.2 = 20% bigger
  emphasisBg?: string;   // highlight background color
}

export interface SubtitleWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
  styleOverrides?: WordStyleOverrides;
}

export interface SubtitleStyle {
  // Display mode
  displayMode: SubtitleDisplayMode;
  wordsPerPhrase: number;

  // Animation — V2: AnimationConfig object, V1: string (migrated at load)
  animation: AnimationConfig | SubtitleAnimationLegacy;

  // Typography
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  opacity?: number;       // 0-1, default 1
  lineHeight?: number;    // 1.0-2.5, default 1.4

  // Colors
  color: string;
  activeColor: string;
  backgroundColor: string;
  activeBackgroundColor: string;

  // Effects
  stroke?: StrokeStyle | null;  // Text outline (replaces textStroke)
  textStroke?: string;          // @deprecated - use stroke instead
  textShadow?: string;          // @deprecated - use effects instead
  effects?: CaptionEffects;     // V3: Full effects system

  // Background box
  backgroundPadding?: { x: number; y: number };
  backgroundRadius?: number;

  // Position - V2: CaptionPosition object, V1: string (migrated at load)
  position: CaptionPosition | SubtitlePositionLegacy;

  // Preset reference
  presetId?: string;
}

export interface SubtitleData {
  text: string;
  words: SubtitleWord[];
  style: SubtitleStyle;
  styleOverrides?: Partial<SubtitleStyle>;
}

// ============================================
// Dynamic Layout Types
// ============================================

/**
 * Calculate what percentage of the source frame is visible when
 * cover-fitting it into the canvas. Used by the Director to decide
 * how aggressively to use speaker-only gaps.
 *
 * Returns a number between 0 and 1:
 *   1.0 = perfect fit (same aspect ratio)
 *   0.31 = 16:9 source on 9:16 canvas (heavy crop)
 */
export function coverageRatio(
  sourceW: number,
  sourceH: number,
  canvasW: number,
  canvasH: number,
): number {
  if (sourceW <= 0 || sourceH <= 0 || canvasW <= 0 || canvasH <= 0) return 1;
  const sourceAR = sourceW / sourceH;
  const canvasAR = canvasW / canvasH;
  return sourceAR > canvasAR
    ? canvasAR / sourceAR
    : sourceAR / canvasAR;
}

export type CoverageTier = 'flexible' | 'moderate' | 'conservative';

export function getCoverageTier(ratio: number): CoverageTier {
  if (ratio > 0.8) return 'flexible';
  if (ratio >= 0.5) return 'moderate';
  return 'conservative';
}

// ============================================
// Project Status
// ============================================

export type ProjectStatus =
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'rendering'
  | 'complete'
  | 'failed';

// ============================================
// Default Values
// ============================================

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  canvasWidth: 1080,
  canvasHeight: 1920,
  cropX: 50,
  cropY: 50,
  scale: 1.0,
};

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  displayMode: 'phrase',
  wordsPerPhrase: 5,

  animation: {
    in: 'elastic-pop',
    active: 'none',
    out: 'none',
    easing: 'spring',
  },

  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 56,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'none',
  opacity: 1,
  lineHeight: 1.4,

  color: '#ffffff',
  activeColor: '#ffff00',
  backgroundColor: 'transparent',
  activeBackgroundColor: 'transparent',

  stroke: null,
  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',  // Legacy fallback
  effects: DEFAULT_CAPTION_EFFECTS,

  backgroundPadding: { x: 4, y: 2 },
  backgroundRadius: 8,

  position: DEFAULT_CAPTION_POSITION,

  presetId: 'default',
};

export const DEFAULT_FPS = 30;

// Canvas dimensions for reels/shorts (9:16)
export const DEFAULT_CANVAS_WIDTH = 1080;
export const DEFAULT_CANVAS_HEIGHT = 1920;

// Canvas format presets for different platforms
export interface CanvasFormat {
  id: string;
  name: string;
  width: number;
  height: number;
  aspectRatio: string;
  description: string;
}

export const CANVAS_FORMATS: CanvasFormat[] = [
  { id: '9:16', name: 'Vertical', width: 1080, height: 1920, aspectRatio: '9:16', description: 'Reels / TikTok / Shorts' },
  { id: '16:9', name: 'Landscape', width: 1920, height: 1080, aspectRatio: '16:9', description: 'YouTube / Ads' },
  { id: '1:1', name: 'Square', width: 1080, height: 1080, aspectRatio: '1:1', description: 'Instagram / Ads' },
  { id: '4:5', name: 'Portrait', width: 1080, height: 1350, aspectRatio: '4:5', description: 'Instagram Portrait' },
];
