import type { AnimationConfig, CaptionPosition, CaptionEffects } from '@viona/shared';

// Define locally to avoid circular deps with store types
export type CaptionDisplayMode = 'word-by-word' | 'phrase' | 'karaoke';

export interface StrokeStyle {
  width: number;
  color: string;
}

// Re-export effects types for convenience
export type { CaptionEffects } from '@viona/shared';

// Legacy position type for backward compatibility
export type PresetPositionLegacy = 'top' | 'center' | 'bottom';

export interface WordRoleStyle {
  color: string;
  activeColor: string;
  fontWeight: number;
  fontFamily: string;
  fontSize: number;
  scale: number;
  letterSpacing: number;
  textTransform: 'none' | 'uppercase' | 'lowercase';
  emphasisBg: string;
}

export interface SubtitlePreset {
  id: string;
  name: string;
  // Typography
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  opacity?: number;      // 0-1, default 1
  lineHeight?: number;   // 1.0-2.5, default 1.4
  // Colors
  color: string;
  activeColor: string;
  backgroundColor: string;
  activeBackgroundColor: string;
  // Effects
  stroke?: StrokeStyle | null;  // Text outline
  textStroke?: string;          // @deprecated - use stroke instead
  textShadow?: string;          // @deprecated - use effects instead
  effects?: CaptionEffects;     // V3: Full effects system
  // Background box
  backgroundPadding?: { x: number; y: number };
  backgroundRadius?: number;
  // Animation
  animation: AnimationConfig;
  // Display
  displayMode: CaptionDisplayMode;
  wordsPerPhrase?: number; // How many words visible at once in phrase/karaoke mode (default 5)
  // Position - supports both legacy string and V2 CaptionPosition object
  position: CaptionPosition | PresetPositionLegacy;
  // Supported display modes (first is default)
  supportedModes: CaptionDisplayMode[];
  // Word emphasis configuration
  wordEmphasis?: {
    enabled: boolean;
    roles: Record<string, Partial<WordRoleStyle>>;
  };
  // Dual typography — power/strong words use display font, medium/filler use body font
  typographyPairingId?: string;
  // Cinematic renderer
  useCinematicRenderer?: boolean;
  cinematicFonts?: {
    boldSans: string;
    elegantCursive: string;
    default: string;
  };
  cinematicColors?: {
    primary: string;
    accent: string;
    accentGradient?: string;
    glow: string;
  };
  cinematicScales?: {
    hero: number;
    accent: number;
    normal: number;
    whisper: number;
  };
}

export const SUBTITLE_PRESETS: Record<string, SubtitlePreset> = {
  // ============================================
  // DEFAULT PRESET - Clean, universal starting point
  // ============================================

  'default': {
    id: 'default',
    name: 'Default',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 48,
    fontWeight: 600,
    textTransform: 'none',
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 1, offsetY: 1, blur: 4, color: '#000000', opacity: 0.7 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'fade-rise', active: 'none', out: 'none', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'bottom',
      offsetX: 0,
      offsetY: 5,
      rotation: 0,
      textAlign: 'center',
    },
    supportedModes: ['word-by-word', 'phrase', 'karaoke'],
  },

  // ============================================
  // VIRAL PRESETS
  // ============================================

  // Alex Hormozi Style - Anton font, yellow/green highlights, pop-in from bottom
  // Source: https://www.submagic.co/blog/how-to-make-alex-hormozi-captions
  // Colors: Yellow (#f7c204), White, Green (#02fb23), uppercase, yellow stroke, pop-in effect
  'hormozi': {
    id: 'hormozi',
    name: 'Hormozi',
    fontFamily: 'Anton, Impact, system-ui, sans-serif',
    fontSize: 60,
    fontWeight: 400,  // Anton is already bold, no extra weight needed
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#ffffff',
    activeColor: '#f7c204',  // Yellow highlight
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 3, color: '#f7c204' },  // Yellow stroke
    effects: {
      shadow: { offsetX: 2, offsetY: 4, blur: 8, color: '#000000', opacity: 0.7 },  // Light shadow
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'slide-up', active: 'none', out: 'none', easing: 'ease-out' },  // Pop-in from bottom
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
    supportedModes: ['word-by-word', 'phrase', 'karaoke'],
  },

  // Ali Abdaal Style - TT Fors font, word-by-word with fade to gray after spoken
  // Source: https://www.submagic.co/blog/make-captions-like-ali-abdaal
  // Colors: Background #ebe9ec, text #292629, active word at full opacity, fades to 50% after spoken
  'ali-abdaal': {
    id: 'ali-abdaal',
    name: 'Ali Abdaal',
    fontFamily: 'TT Fors, Inter, system-ui, sans-serif',
    fontSize: 52,
    fontWeight: 600,
    textTransform: 'none',
    color: '#292629',  // Dark gray for spoken words
    activeColor: '#292629',  // Same color but full opacity for active
    backgroundColor: '#ebe9ec',  // Light pinkish-gray background
    activeBackgroundColor: '#ebe9ec',
    backgroundPadding: { x: 16, y: 8 },
    backgroundRadius: 8,
    opacity: 0.5,  // Faded for past words (active word overrides to 1)
    effects: {
      shadow: null,
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'fade', active: 'none', out: 'none', easing: 'ease-out' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'bottom',
      offsetX: 0,
      offsetY: 8,
      rotation: 0,
      textAlign: 'center',
    },
    supportedModes: ['word-by-word', 'phrase', 'karaoke'],
  },

  // Nas Daily Style - Clean top-corner with timer aesthetic
  // Source: Nas Daily's documentary-style short videos
  'nas-daily': {
    id: 'nas-daily',
    name: 'Nas Daily',
    fontFamily: 'Helvetica Neue, Arial, system-ui, sans-serif',
    fontSize: 40,
    fontWeight: 700,
    textTransform: 'none',
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    activeBackgroundColor: 'rgba(0, 0, 0, 0.85)',
    backgroundPadding: { x: 14, y: 8 },
    backgroundRadius: 6,
    effects: {
      shadow: { offsetX: 0, offsetY: 2, blur: 8, color: '#000000', opacity: 0.5 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'fade', active: 'none', out: 'fade', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'top',
      offsetX: -35,  // Left-aligned at top
      offsetY: 5,
      rotation: 0,
      textAlign: 'left',
    },
    supportedModes: ['word-by-word', 'phrase'],
  },

  // ============================================
  // CINEMATIC PRESETS
  // ============================================

  // Netflix Style - Netflix Sans (Arial/Helvetica), white with black drop shadow
  // Source: https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide
  // Professional, readable, white font with subtle black drop shadow
  'netflix': {
    id: 'netflix',
    name: 'Netflix',
    fontFamily: 'Helvetica Neue, Arial, system-ui, sans-serif',
    fontSize: 42,
    fontWeight: 400,
    textTransform: 'none',
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 1, offsetY: 1, blur: 3, color: '#000000', opacity: 0.9 },  // Subtle drop shadow
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'fade', active: 'none', out: 'fade', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'bottom',
      offsetX: 0,
      offsetY: 5,
      rotation: 0,
      textAlign: 'center',
    },
    supportedModes: ['phrase', 'karaoke'],
  },

  // Retro VHS - Chromatic aberration, tracking lines, VHS aesthetic
  'retro-vhs': {
    id: 'retro-vhs',
    name: 'Retro VHS',
    fontFamily: 'JetBrains Mono, Consolas, monospace',
    fontSize: 44,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 3,
    color: '#ffffff',
    activeColor: '#ff6b6b',  // Red/warm for VHS look
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    activeBackgroundColor: 'rgba(0, 0, 0, 0.7)',
    backgroundPadding: { x: 12, y: 6 },
    backgroundRadius: 2,
    effects: {
      shadow: { offsetX: 2, offsetY: 0, blur: 0, color: '#ff0000', opacity: 0.7 },
      shadowSecondary: { offsetX: -2, offsetY: 0, blur: 0, color: '#00ffff', opacity: 0.5 },
      glow: null,
    },
    animation: { in: 'smooth-slide', active: 'none', out: 'none', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'bottom',
      offsetX: 0,
      offsetY: 10,
      rotation: 0,
      textAlign: 'center',
    },
    supportedModes: ['word-by-word', 'phrase'],
  },

  // Cottagecore Handwritten - Cursive, organic, lifestyle aesthetic
  // Source: Cottagecore aesthetic trend
  'cottagecore': {
    id: 'cottagecore',
    name: 'Cottagecore',
    fontFamily: 'Dancing Script, Pacifico, cursive',
    fontSize: 48,
    fontWeight: 400,
    textTransform: 'none',
    letterSpacing: 1,
    color: '#f5e6d0',  // Warm cream
    activeColor: '#d4a574',  // Soft brown
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 1, offsetY: 2, blur: 6, color: '#5a4a3a', opacity: 0.5 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'hand-draw', active: 'none', out: 'fade', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'bottom',
      offsetX: 0,
      offsetY: 10,
      rotation: -2,  // Slight handwritten rotation
      textAlign: 'center',
    },
    supportedModes: ['word-by-word', 'phrase', 'karaoke'],
  },

  // ============================================
  // AD PRESETS - Apple/Google-style clean ad typography
  // ============================================

  // Apple Clean - SF Pro Display, minimal, fade+blur
  'apple-clean': {
    id: 'apple-clean',
    name: 'Apple',
    fontFamily: 'SF Pro Display, -apple-system, system-ui, sans-serif',
    fontSize: 48,
    fontWeight: 600,
    letterSpacing: -0.5,
    textTransform: 'none',
    lineHeight: 1.1,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: null,
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'apple-fade', active: 'none', out: 'apple-fade', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
    supportedModes: ['phrase', 'karaoke'],
  },

  // Google Material - Clean slide-up with card
  'google-material': {
    id: 'google-material',
    name: 'Google',
    fontFamily: 'Google Sans, Roboto, system-ui, sans-serif',
    fontSize: 44,
    fontWeight: 500,
    textTransform: 'none',
    lineHeight: 1.3,
    color: '#202124',
    activeColor: '#202124',
    backgroundColor: '#ffffff',
    activeBackgroundColor: '#ffffff',
    backgroundPadding: { x: 20, y: 12 },
    backgroundRadius: 12,
    effects: {
      shadow: { offsetX: 0, offsetY: 2, blur: 8, color: '#000000', opacity: 0.15 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'google-slide', active: 'none', out: 'google-slide', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
    supportedModes: ['word-by-word', 'phrase'],
  },

  'cinematic-luxe': {
    id: 'cinematic-luxe',
    name: 'Cinematic Luxe',
    fontFamily: 'Montserrat, system-ui, sans-serif',
    fontSize: 55,
    fontWeight: 800,
    letterSpacing: 0,
    lineHeight: 1.3,
    color: '#FFFFFF',
    activeColor: '#FFD700',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 0, offsetY: 2, blur: 12, color: '#000000', opacity: 0.9 },
      shadowSecondary: null,
      glow: { enabled: true, color: '#FFA500', intensity: 0.35, size: 20 },
    },
    animation: { in: 'fade-rise', active: 'none', out: 'fade', easing: 'ease-out' },
    displayMode: 'phrase',
    wordsPerPhrase: 7,
    position: { anchor: 'bottom', offsetX: 0, offsetY: 5, rotation: 0, textAlign: 'center' },
    supportedModes: ['phrase'],
    typographyPairingId: 'montserrat-inter',
  },

};

export const PRESET_ORDER = [
  'default',
  'hormozi',
  'ali-abdaal',
  'nas-daily',
  'netflix',
  'retro-vhs',
  'cottagecore',
  'apple-clean',
  'google-material',
  'cinematic-luxe',
] as const;

export const DEFAULT_PRESET_ID = 'default';

export function getPreset(id: string): SubtitlePreset {
  return SUBTITLE_PRESETS[id] || SUBTITLE_PRESETS[DEFAULT_PRESET_ID];
}
