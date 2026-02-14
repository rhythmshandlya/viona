import type { AnimationConfig, CaptionPosition, CaptionEffects } from '@reelify/shared';

export type PresetCategory = 'viral' | 'cinematic' | 'minimal';

export interface StrokeStyle {
  width: number;
  color: string;
}

// Re-export effects types for convenience
export type { CaptionEffects } from '@reelify/shared';

// Legacy position type for backward compatibility
export type PresetPositionLegacy = 'top' | 'center' | 'bottom';

export interface SubtitlePreset {
  id: string;
  name: string;
  category: PresetCategory;
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
  displayMode: 'word-by-word' | 'phrase' | 'karaoke';
  // Position - supports both legacy string and V2 CaptionPosition object
  position: CaptionPosition | PresetPositionLegacy;
}

export const SUBTITLE_PRESETS: Record<string, SubtitlePreset> = {
  // ============================================
  // VIRAL PRESETS - Bold, attention-grabbing styles
  // ============================================

  // MrBeast Style - Komika Axis font, green keyword highlight, black stroke
  // Source: https://www.submagic.co/blog/how-to-make-captions-like-mrbeast
  // Font: Komika Axis (or CCSignLanguage), uppercase, 2 words per line, green highlight on keywords
  'mrbeast': {
    id: 'mrbeast',
    name: 'MrBeast',
    category: 'viral',
    fontFamily: 'Komika Axis, Impact, system-ui, sans-serif',
    fontSize: 64,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: '#ffffff',
    activeColor: '#00ff00',  // Green for keywords
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 4, color: '#000000' },  // High black stroke for visibility
    effects: {
      shadow: { offsetX: 3, offsetY: 3, blur: 0, color: '#000000', opacity: 1 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'scale-bounce', active: 'none', out: 'none', easing: 'spring' },  // Scale 70→120→100
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Alex Hormozi Style - Anton font, yellow/green highlights, pop-in from bottom
  // Source: https://www.submagic.co/blog/how-to-make-alex-hormozi-captions
  // Colors: Yellow (#f7c204), White, Green (#02fb23), uppercase, yellow stroke, pop-in effect
  'hormozi': {
    id: 'hormozi',
    name: 'Hormozi',
    category: 'viral',
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
  },

  // Ali Abdaal Style - TT Fors font, word-by-word with fade to gray after spoken
  // Source: https://www.submagic.co/blog/make-captions-like-ali-abdaal
  // Colors: Background #ebe9ec, text #292629, active word at full opacity, fades to 50% after spoken
  'ali-abdaal': {
    id: 'ali-abdaal',
    name: 'Ali Abdaal',
    category: 'viral',
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
  },

  // Iman Gadzhi Style - Montserrat, lowercase, white only, light-to-bold transition
  // Source: https://www.submagic.co/blog/how-to-make-captions-like-iman-gadzhi
  // Unique: Lowercase text, white only (no colors), Montserrat Light→Bold weight transition
  'iman-gadzhi': {
    id: 'iman-gadzhi',
    name: 'Iman Gadzhi',
    category: 'viral',
    fontFamily: 'Montserrat, system-ui, sans-serif',
    fontSize: 54,
    fontWeight: 300,  // Light weight for inactive words
    textTransform: 'lowercase',  // Signature lowercase for premium luxury feel
    color: '#ffffff',  // White only - no colorful keywords
    activeColor: '#ffffff',  // Same white, but font weight changes to bold
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 2, color: '#000000' },
    effects: {
      shadow: { offsetX: 2, offsetY: 2, blur: 6, color: '#000000', opacity: 0.8 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'weight-shift', active: 'none', out: 'none', easing: 'ease-out' },  // Light to bold
    displayMode: 'word-by-word',
    position: {
      anchor: 'bottom',
      offsetX: 0,
      offsetY: 12,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Devin Jatho Style - Montserrat Extra Bold, uppercase, 3 light colors, glow, float effect
  // Source: https://www.submagic.co/blog/how-to-make-subtitles-like-devin-jatho-in-3-clicks
  // Fluorescent colors with luminous glow halo, floating movement animation
  'devin-jatho': {
    id: 'devin-jatho',
    name: 'Devin Jatho',
    category: 'viral',
    fontFamily: 'Montserrat, system-ui, sans-serif',
    fontSize: 58,
    fontWeight: 800,  // Extra Bold
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: '#ffffff',
    activeColor: '#00e5ff',  // Light cyan/turquoise
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 2, color: '#000000' },
    effects: {
      shadow: { offsetX: 0, offsetY: 2, blur: 4, color: '#000000', opacity: 0.6 },
      shadowSecondary: null,
      glow: { enabled: true, color: '#00e5ff', intensity: 0.8, size: 25 },  // Luminous glow halo
    },
    animation: { in: 'float', active: 'float', out: 'none', easing: 'ease-in-out' },  // Floating movement
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Karaoke Neon - Progressive fill with neon glow
  'neon-karaoke': {
    id: 'neon-karaoke',
    name: 'Neon Karaoke',
    category: 'viral',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 52,
    fontWeight: 700,
    color: '#00ffff',
    activeColor: '#ff00ff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: null,
      shadowSecondary: null,
      glow: { enabled: true, color: '#00ffff', intensity: 0.9, size: 30 },
    },
    animation: { in: 'color-wipe', active: 'color-wipe', out: 'none', easing: 'ease-out' },
    displayMode: 'karaoke',
    position: 'bottom',
  },

  // ============================================
  // CINEMATIC PRESETS - Professional, documentary-style
  // ============================================

  // Netflix Style - Netflix Sans (Arial/Helvetica), white with black drop shadow
  // Source: https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide
  // Professional, readable, white font with subtle black drop shadow
  'netflix': {
    id: 'netflix',
    name: 'Netflix',
    category: 'cinematic',
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
  },

  // Documentary - Elegant serif for premium content
  // Source: https://www.rev.com/blog/7-best-fonts-for-subtitles-and-captions-in-videos
  'documentary': {
    id: 'documentary',
    name: 'Documentary',
    category: 'cinematic',
    fontFamily: 'Georgia, Times New Roman, serif',
    fontSize: 42,
    fontWeight: 400,
    opacity: 0.95,
    lineHeight: 1.5,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 1, color: 'rgba(0,0,0,0.5)' },
    effects: {
      shadow: { offsetX: 1, offsetY: 1, blur: 3, color: '#000000', opacity: 0.7 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'fade-rise', active: 'none', out: 'fade-rise', easing: 'ease-out' },
    displayMode: 'phrase',
    position: 'bottom',
  },

  // Typewriter - Terminal/hacker aesthetic
  'typewriter': {
    id: 'typewriter',
    name: 'Typewriter',
    category: 'cinematic',
    fontFamily: 'JetBrains Mono, Consolas, monospace',
    fontSize: 40,
    fontWeight: 400,
    color: '#00ff00',
    activeColor: '#00ff00',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    activeBackgroundColor: 'rgba(0, 0, 0, 0.85)',
    backgroundPadding: { x: 16, y: 8 },
    backgroundRadius: 4,
    effects: {
      shadow: null,
      shadowSecondary: null,
      glow: { enabled: true, color: '#00ff00', intensity: 0.3, size: 10 },
    },
    animation: { in: 'typewriter', active: 'typewriter', out: 'none', easing: 'linear' },
    displayMode: 'karaoke',
    position: 'bottom',
  },

  // ============================================
  // MINIMAL PRESETS - Clean, simple styles
  // ============================================

  // Clean Minimal - Simple white text with shadow
  'minimal': {
    id: 'minimal',
    name: 'Minimal',
    category: 'minimal',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 44,
    fontWeight: 500,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 1, offsetY: 1, blur: 3, color: '#000000', opacity: 0.6 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'fade-rise', active: 'none', out: 'fade-rise', easing: 'ease-out' },
    displayMode: 'phrase',
    position: 'bottom',
  },

  // Box Highlight - Word-by-word with background highlight
  'box-highlight': {
    id: 'box-highlight',
    name: 'Box Highlight',
    category: 'minimal',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 48,
    fontWeight: 700,
    color: '#ffffff',
    activeColor: '#000000',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    activeBackgroundColor: '#ffff00',
    backgroundPadding: { x: 10, y: 4 },
    backgroundRadius: 6,
    effects: {
      shadow: null,
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'soft-scale', active: 'none', out: 'none', easing: 'ease-out' },
    displayMode: 'word-by-word',
    position: 'bottom',
  },

  // Classic Subtitles - Traditional, no frills
  'classic': {
    id: 'classic',
    name: 'Classic',
    category: 'minimal',
    fontFamily: 'Arial, Helvetica, system-ui, sans-serif',
    fontSize: 40,
    fontWeight: 400,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 1, color: '#000000' },
    effects: {
      shadow: { offsetX: 1, offsetY: 1, blur: 2, color: '#000000', opacity: 0.8 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'none', active: 'none', out: 'none', easing: 'linear' },
    displayMode: 'phrase',
    position: 'bottom',
  },
};

export const PRESET_ORDER = [
  // Viral - Creator styles
  'mrbeast', 'hormozi', 'ali-abdaal', 'iman-gadzhi', 'devin-jatho', 'neon-karaoke',
  // Cinematic
  'netflix', 'documentary', 'typewriter',
  // Minimal
  'minimal', 'box-highlight', 'classic',
] as const;

export const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: 'viral', label: 'Viral' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'minimal', label: 'Minimal' },
];

export const DEFAULT_PRESET_ID = 'mrbeast';

export function getPreset(id: string): SubtitlePreset {
  return SUBTITLE_PRESETS[id] || SUBTITLE_PRESETS[DEFAULT_PRESET_ID];
}

export function getPresetsByCategory(category: PresetCategory): SubtitlePreset[] {
  return PRESET_ORDER
    .filter((id) => SUBTITLE_PRESETS[id]?.category === category)
    .map((id) => SUBTITLE_PRESETS[id]);
}
