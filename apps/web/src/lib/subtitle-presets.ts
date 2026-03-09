import type { AnimationConfig, CaptionPosition, CaptionEffects } from '@viona/shared';

export type PresetCategory = 'viral' | 'cinematic' | 'minimal' | 'ad' | 'motion';

export interface StrokeStyle {
  width: number;
  color: string;
}

// Re-export effects types for convenience
export type { CaptionEffects } from '@viona/shared';

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
  wordsPerPhrase?: number; // How many words visible at once in phrase/karaoke mode (default 5)
  // Position - supports both legacy string and V2 CaptionPosition object
  position: CaptionPosition | PresetPositionLegacy;
}

export const SUBTITLE_PRESETS: Record<string, SubtitlePreset> = {
  // ============================================
  // DEFAULT PRESET - Clean, universal starting point
  // ============================================

  'default': {
    id: 'default',
    name: 'Default',
    category: 'minimal',
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
  },

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

  // Kalice Glow - Pastel glow aesthetic, soft purple/pink glow halo
  'kalice-glow': {
    id: 'kalice-glow',
    name: 'Kalice Glow',
    category: 'viral',
    fontFamily: 'Poppins, system-ui, sans-serif',
    fontSize: 52,
    fontWeight: 700,
    textTransform: 'none',
    color: '#ffffff',
    activeColor: '#f0abfc',  // Soft pink/fuchsia
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 1, color: 'rgba(0,0,0,0.3)' },
    effects: {
      shadow: { offsetX: 0, offsetY: 0, blur: 4, color: '#000000', opacity: 0.5 },
      shadowSecondary: null,
      glow: { enabled: true, color: '#c084fc', intensity: 0.7, size: 30 },
    },
    animation: { in: 'soft-scale', active: 'none', out: 'none', easing: 'ease-out' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Sara Dietschy Style - Bold, warm, punchy with black stroke
  'sara': {
    id: 'sara',
    name: 'Sara',
    category: 'viral',
    fontFamily: 'Nunito, system-ui, sans-serif',
    fontSize: 50,
    fontWeight: 800,
    textTransform: 'none',
    color: '#ffffff',
    activeColor: '#fbbf24',  // Warm amber/yellow
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 3, color: '#000000' },
    effects: {
      shadow: { offsetX: 2, offsetY: 2, blur: 0, color: '#000000', opacity: 0.9 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Ryan Trahan Style - Rotated text with constant bounce, extremely viral
  // Source: Popular YouTube creator style, energetic and dynamic
  'ryan-trahan': {
    id: 'ryan-trahan',
    name: 'Ryan Trahan',
    category: 'viral',
    fontFamily: 'Futura, Impact, system-ui, sans-serif',
    fontSize: 58,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: '#ffffff',
    activeColor: '#ffff00',  // Bright yellow
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 4, color: '#000000' },
    effects: {
      shadow: { offsetX: 3, offsetY: 3, blur: 0, color: '#000000', opacity: 1 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'rotate-bounce', active: 'constant-wiggle', out: 'none', easing: 'spring' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: -6,  // Signature rotated look
      textAlign: 'center',
    },
  },

  // Gary Vee Style - Aggressive, harsh shadow, rotated, urgent
  // Source: Gary Vaynerchuk's business/motivation content style
  'gary-vee': {
    id: 'gary-vee',
    name: 'Gary Vee',
    category: 'viral',
    fontFamily: 'Impact, Franklin Gothic Heavy, Arial Black, sans-serif',
    fontSize: 56,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#ffffff',
    activeColor: '#ff0000',  // Aggressive red
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 3, color: '#000000' },
    effects: {
      shadow: { offsetX: 4, offsetY: 4, blur: 0, color: '#000000', opacity: 1 },  // Harsh shadow
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'slam-down', active: 'none', out: 'none', easing: 'ease-out' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: -3,  // Slightly rotated for urgency
      textAlign: 'center',
    },
  },

  // Nas Daily Style - Clean top-corner with timer aesthetic
  // Source: Nas Daily's documentary-style short videos
  'nas-daily': {
    id: 'nas-daily',
    name: 'Nas Daily',
    category: 'viral',
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
  },

  // Gradient Gen Z - Rose-violet gradient, Gen Z aesthetic
  // Source: Checksub Original style, trending on TikTok/Reels
  'gradient-genz': {
    id: 'gradient-genz',
    name: 'Gradient Gen Z',
    category: 'viral',
    fontFamily: 'Arial, Helvetica, system-ui, sans-serif',
    fontSize: 54,
    fontWeight: 700,
    textTransform: 'none',
    color: '#ff6b9d',  // Rose-pink (gradient start)
    activeColor: '#a855f7',  // Purple (gradient end)
    backgroundColor: 'radial-gradient(circle, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%)',
    activeBackgroundColor: 'radial-gradient(circle, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%)',
    backgroundPadding: { x: 18, y: 10 },
    backgroundRadius: 12,
    effects: {
      shadow: { offsetX: 0, offsetY: 3, blur: 12, color: '#000000', opacity: 0.7 },
      shadowSecondary: null,
      glow: { enabled: true, color: '#a855f7', intensity: 0.6, size: 25 },
    },
    animation: { in: 'soft-scale', active: 'none', out: 'soft-scale', easing: 'ease-out' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Pastel Bubble - Thick pastel outline, Gen Z favorite
  // Source: Trending on Instagram Reels and TikTok
  'pastel-bubble': {
    id: 'pastel-bubble',
    name: 'Pastel Bubble',
    category: 'viral',
    fontFamily: 'Poppins, Nunito, system-ui, sans-serif',
    fontSize: 56,
    fontWeight: 700,
    textTransform: 'none',
    color: '#ffffff',  // Light fill
    activeColor: '#fff4b3',  // Pastel yellow
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 6, color: '#ffb3d9' },  // Thick pastel pink outline
    effects: {
      shadow: { offsetX: 0, offsetY: 3, blur: 8, color: '#000000', opacity: 0.4 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'bubble-pop', active: 'none', out: 'none', easing: 'spring' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Wiggle Shake - Rapid shake/wiggle on keywords, high engagement
  // Source: Trending animation effect on social media
  'wiggle-shake': {
    id: 'wiggle-shake',
    name: 'Wiggle Shake',
    category: 'viral',
    fontFamily: 'Montserrat, system-ui, sans-serif',
    fontSize: 54,
    fontWeight: 800,
    textTransform: 'uppercase',
    color: '#ffffff',
    activeColor: '#00d9ff',  // Bright cyan
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 3, color: '#000000' },
    effects: {
      shadow: { offsetX: 2, offsetY: 2, blur: 6, color: '#000000', opacity: 0.8 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'shake-entry', active: 'wiggle', out: 'none', easing: 'linear' },  // Constant wiggle
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
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

  // Cinematic - Elegant serif, warm tones, film-like feel
  'cinematic': {
    id: 'cinematic',
    name: 'Cinematic',
    category: 'cinematic',
    fontFamily: 'Playfair Display, serif',
    fontSize: 46,
    fontWeight: 700,
    textTransform: 'none',
    letterSpacing: 1,
    lineHeight: 1.3,
    color: '#ffffff',
    activeColor: '#e0d5c1',  // Warm cream/gold
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 0, offsetY: 2, blur: 8, color: '#000000', opacity: 0.8 },
      shadowSecondary: { offsetX: 0, offsetY: 0, blur: 20, color: '#000000', opacity: 0.4 },
      glow: null,
    },
    animation: { in: 'apple-fade', active: 'none', out: 'apple-fade', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'bottom',
      offsetX: 0,
      offsetY: 8,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Behind Person - Large semi-transparent text, appears behind the subject
  'behind-person': {
    id: 'behind-person',
    name: 'Behind Person',
    category: 'cinematic',
    fontFamily: 'Montserrat, system-ui, sans-serif',
    fontSize: 72,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 2,
    opacity: 0.35,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: null,
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'smooth-reveal', active: 'none', out: 'smooth-reveal', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Retro VHS - Chromatic aberration, tracking lines, VHS aesthetic
  'retro-vhs': {
    id: 'retro-vhs',
    name: 'Retro VHS',
    category: 'cinematic',
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
  },

  // Casey Neistat Documentary - Lowercase, top-left minimal
  // Source: Casey Neistat's vlog/documentary style
  'casey-neistat': {
    id: 'casey-neistat',
    name: 'Casey Neistat',
    category: 'cinematic',
    fontFamily: 'Helvetica Neue, Arial, system-ui, sans-serif',
    fontSize: 38,
    fontWeight: 300,  // Light weight
    textTransform: 'lowercase',
    letterSpacing: 0,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 1, offsetY: 1, blur: 4, color: '#000000', opacity: 0.7 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'fade', active: 'none', out: 'fade', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'top',
      offsetX: -35,  // Top-left corner
      offsetY: 5,
      rotation: 0,
      textAlign: 'left',
    },
  },

  // Vaporwave - Pink/cyan gradients, retro 80s/90s aesthetic
  // Source: Vaporwave aesthetic trend
  'vaporwave': {
    id: 'vaporwave',
    name: 'Vaporwave',
    category: 'cinematic',
    fontFamily: 'Courier New, Courier, monospace',
    fontSize: 46,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 4,
    color: '#ff71ce',  // Hot pink
    activeColor: '#01cdfe',  // Cyan
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 3, offsetY: 0, blur: 0, color: '#01cdfe', opacity: 0.6 },
      shadowSecondary: { offsetX: -3, offsetY: 0, blur: 0, color: '#ff71ce', opacity: 0.6 },
      glow: { enabled: true, color: '#ff71ce', intensity: 0.5, size: 20 },
    },
    animation: { in: 'scan-line', active: 'none', out: 'scan-line', easing: 'linear' },
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Cottagecore Handwritten - Cursive, organic, lifestyle aesthetic
  // Source: Cottagecore aesthetic trend
  'cottagecore': {
    id: 'cottagecore',
    name: 'Cottagecore',
    category: 'cinematic',
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

  // ============================================
  // AD PRESETS - Apple/Google-style clean ad typography
  // ============================================

  // Apple Clean - SF Pro Display, minimal, fade+blur
  'apple-clean': {
    id: 'apple-clean',
    name: 'Apple',
    category: 'ad',
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
  },

  // Google Material - Clean slide-up with card
  'google-material': {
    id: 'google-material',
    name: 'Google',
    category: 'ad',
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
  },

  // Ad Headline - Bold, clean, center-positioned
  'ad-headline': {
    id: 'ad-headline',
    name: 'Ad Headline',
    category: 'ad',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 56,
    fontWeight: 700,
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
    animation: { in: 'smooth-reveal', active: 'none', out: 'smooth-reveal', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // MKBHD Tech Clean - Left-aligned tech card style
  // Source: MKBHD (Marques Brownlee) tech review aesthetic
  'mkbhd-tech': {
    id: 'mkbhd-tech',
    name: 'MKBHD Tech',
    category: 'ad',
    fontFamily: 'Roboto, Product Sans, system-ui, sans-serif',
    fontSize: 42,
    fontWeight: 500,
    textTransform: 'none',
    letterSpacing: 0,
    lineHeight: 1.4,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'rgba(26, 26, 26, 0.85)',  // Dark tech card
    activeBackgroundColor: 'rgba(26, 26, 26, 0.85)',
    backgroundPadding: { x: 16, y: 10 },
    backgroundRadius: 8,
    effects: {
      shadow: { offsetX: 0, offsetY: 2, blur: 10, color: '#000000', opacity: 0.3 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'slide-left', active: 'none', out: 'slide-left', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'bottom',
      offsetX: -30,  // Left-aligned
      offsetY: 8,
      rotation: 0,
      textAlign: 'left',
    },
  },

  // ============================================
  // MOTION PRESETS - AutoAE-inspired animation templates
  // ============================================

  // Spotlight — cinematic light sweep with warm gold
  'spotlight': {
    id: 'spotlight',
    name: 'Spotlight',
    category: 'motion',
    fontFamily: 'Playfair Display, serif',
    fontSize: 52,
    fontWeight: 700,
    textTransform: 'none',
    letterSpacing: 1,
    color: '#ffffff',
    activeColor: '#fbbf24',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 0, offsetY: 2, blur: 12, color: '#000000', opacity: 0.8 },
      shadowSecondary: null,
      glow: { enabled: true, color: '#fbbf24', intensity: 0.4, size: 20 },
    },
    animation: { in: 'spotlight-reveal', active: 'spotlight-reveal', out: 'fade', easing: 'ease-in-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Film Grain — retro film aesthetic with warm tones
  'film-grain': {
    id: 'film-grain',
    name: 'Film Grain',
    category: 'motion',
    fontFamily: 'Georgia, Times New Roman, serif',
    fontSize: 46,
    fontWeight: 400,
    textTransform: 'none',
    letterSpacing: 0.5,
    color: '#f5e6d0',
    activeColor: '#ff9f43',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 1, offsetY: 1, blur: 6, color: '#000000', opacity: 0.7 },
      shadowSecondary: null,
      glow: { enabled: true, color: '#ff9f43', intensity: 0.3, size: 15 },
    },
    animation: { in: 'film-burn', active: 'none', out: 'film-burn', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'bottom',
      offsetX: 0,
      offsetY: 8,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Glitch Text — digital/cyberpunk with cyan/magenta
  'glitch-text': {
    id: 'glitch-text',
    name: 'Glitch',
    category: 'motion',
    fontFamily: 'JetBrains Mono, Consolas, monospace',
    fontSize: 50,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#ffffff',
    activeColor: '#00ffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 2, offsetY: 0, blur: 0, color: '#ff00ff', opacity: 0.8 },
      shadowSecondary: { offsetX: -2, offsetY: 0, blur: 0, color: '#00ffff', opacity: 0.8 },
      glow: null,
    },
    animation: { in: 'glitch', active: 'glitch', out: 'glitch', easing: 'linear' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Slam — heavy impact, bold uppercase
  'slam': {
    id: 'slam',
    name: 'Slam',
    category: 'motion',
    fontFamily: 'Impact, Arial Black, sans-serif',
    fontSize: 62,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: '#ffffff',
    activeColor: '#ef4444',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 3, color: '#000000' },
    effects: {
      shadow: { offsetX: 3, offsetY: 3, blur: 0, color: '#000000', opacity: 1 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'drop-slam', active: 'none', out: 'none', easing: 'bounce' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Wave Bounce — playful bouncing wave
  'wave-bounce': {
    id: 'wave-bounce',
    name: 'Wave',
    category: 'motion',
    fontFamily: 'Nunito, system-ui, sans-serif',
    fontSize: 50,
    fontWeight: 700,
    textTransform: 'none',
    color: '#ffffff',
    activeColor: '#a78bfa',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 0, offsetY: 2, blur: 6, color: '#000000', opacity: 0.6 },
      shadowSecondary: null,
      glow: { enabled: true, color: '#a78bfa', intensity: 0.5, size: 18 },
    },
    animation: { in: 'bounce-up', active: 'wave', out: 'none', easing: 'spring' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Versus — high contrast VS style with chromatic split
  'versus': {
    id: 'versus',
    name: 'Versus',
    category: 'motion',
    fontFamily: 'Anton, Impact, sans-serif',
    fontSize: 60,
    fontWeight: 400,
    textTransform: 'uppercase',
    letterSpacing: 3,
    color: '#ffffff',
    activeColor: '#ff4444',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 2, color: '#000000' },
    effects: {
      shadow: { offsetX: 3, offsetY: 0, blur: 0, color: '#ff0000', opacity: 0.6 },
      shadowSecondary: { offsetX: -3, offsetY: 0, blur: 0, color: '#0088ff', opacity: 0.6 },
      glow: null,
    },
    animation: { in: 'chromatic-split', active: 'chromatic-split', out: 'chromatic-split', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Spin Entry — dynamic rotating entry
  'spin-entry': {
    id: 'spin-entry',
    name: 'Spin Entry',
    category: 'motion',
    fontFamily: 'Poppins, system-ui, sans-serif',
    fontSize: 52,
    fontWeight: 700,
    textTransform: 'none',
    color: '#ffffff',
    activeColor: '#22d3ee',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 0, offsetY: 2, blur: 8, color: '#000000', opacity: 0.7 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'spin-reveal', active: 'none', out: 'spin-reveal', easing: 'spring' },
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Zoom Focus — cinematic focus pull
  'zoom-focus': {
    id: 'zoom-focus',
    name: 'Zoom Focus',
    category: 'motion',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 50,
    fontWeight: 600,
    textTransform: 'none',
    letterSpacing: -0.5,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 0, offsetY: 0, blur: 12, color: '#000000', opacity: 0.6 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'blur-zoom', active: 'none', out: 'blur-zoom', easing: 'ease-in-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // 3D Perspective Tilt - 3D rotation entrance effect
  // Source: Trending 3D CSS transform animations
  'perspective-3d': {
    id: 'perspective-3d',
    name: '3D Perspective',
    category: 'motion',
    fontFamily: 'Montserrat, Futura, system-ui, sans-serif',
    fontSize: 54,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#ffffff',
    activeColor: '#00d4ff',  // Bright cyan
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 2, color: '#000000' },
    effects: {
      shadow: { offsetX: 0, offsetY: 8, blur: 16, color: '#000000', opacity: 0.6 },
      shadowSecondary: null,
      glow: { enabled: true, color: '#00d4ff', intensity: 0.4, size: 15 },
    },
    animation: { in: '3d-flip', active: 'none', out: '3d-flip', easing: 'ease-out' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Elastic Stretch - Horizontal scale overshoot on entry
  // Source: Elastic animation trend
  'elastic-stretch': {
    id: 'elastic-stretch',
    name: 'Elastic Stretch',
    category: 'motion',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 52,
    fontWeight: 700,
    textTransform: 'none',
    color: '#ffffff',
    activeColor: '#fbbf24',  // Amber
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 0, offsetY: 2, blur: 8, color: '#000000', opacity: 0.6 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'elastic-horizontal', active: 'none', out: 'none', easing: 'elastic' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Speed Lines - Manga-style motion blur trails
  // Source: Anime/manga motion effects
  'speed-lines': {
    id: 'speed-lines',
    name: 'Speed Lines',
    category: 'motion',
    fontFamily: 'Impact, Arial Black, sans-serif',
    fontSize: 58,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#ffffff',
    activeColor: '#ff4444',  // Bright red
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 3, color: '#000000' },
    effects: {
      shadow: { offsetX: 0, offsetY: 0, blur: 20, color: '#ffffff', opacity: 0.4 },  // Motion blur
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'speed-blur', active: 'none', out: 'speed-blur', easing: 'ease-out' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Particle Explosion - Words explode into particles
  // Source: Particle system animation trend
  'particle-burst': {
    id: 'particle-burst',
    name: 'Particle Burst',
    category: 'motion',
    fontFamily: 'Poppins, system-ui, sans-serif',
    fontSize: 54,
    fontWeight: 700,
    textTransform: 'none',
    color: '#ffffff',
    activeColor: '#a855f7',  // Purple
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 0, offsetY: 2, blur: 10, color: '#000000', opacity: 0.5 },
      shadowSecondary: null,
      glow: { enabled: true, color: '#a855f7', intensity: 0.6, size: 20 },
    },
    animation: { in: 'gather', active: 'none', out: 'particle-explode', easing: 'ease-out' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Liquid Morph - Blob morphing transitions
  // Source: Liquid/morphing animation trend
  'liquid-morph': {
    id: 'liquid-morph',
    name: 'Liquid Morph',
    category: 'motion',
    fontFamily: 'Nunito, Quicksand, system-ui, sans-serif',
    fontSize: 52,
    fontWeight: 700,
    textTransform: 'none',
    color: '#00d9ff',  // Cyan
    activeColor: '#ff00ff',  // Magenta
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 0, offsetY: 3, blur: 15, color: '#000000', opacity: 0.4 },
      shadowSecondary: null,
      glow: { enabled: true, color: '#00d9ff', intensity: 0.5, size: 25 },
    },
    animation: { in: 'blob-morph', active: 'blob-morph', out: 'blob-morph', easing: 'ease-in-out' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Newspaper Spin - Rotational entrance like newspaper headline
  // Source: Classic newspaper headline animation
  'newspaper-spin': {
    id: 'newspaper-spin',
    name: 'Newspaper',
    category: 'motion',
    fontFamily: 'Times New Roman, Georgia, serif',
    fontSize: 56,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#000000',
    activeColor: '#000000',
    backgroundColor: '#f5f5dc',  // Newspaper beige
    activeBackgroundColor: '#f5f5dc',
    backgroundPadding: { x: 16, y: 8 },
    backgroundRadius: 0,
    effects: {
      shadow: { offsetX: 3, offsetY: 3, blur: 0, color: '#000000', opacity: 0.3 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'newspaper-rotate', active: 'none', out: 'newspaper-rotate', easing: 'ease-out' },
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Underline Wipe - Animated underline sweep
  // Source: Trending underline animation on social media
  'underline-wipe': {
    id: 'underline-wipe',
    name: 'Underline Wipe',
    category: 'motion',
    fontFamily: 'Inter, Roboto, system-ui, sans-serif',
    fontSize: 50,
    fontWeight: 600,
    textTransform: 'none',
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: { offsetX: 1, offsetY: 1, blur: 4, color: '#000000', opacity: 0.6 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'underline-sweep', active: 'underline-sweep', out: 'none', easing: 'ease-out' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Y2K Chrome - 2000s metallic aesthetic comeback
  // Source: Y2K aesthetic revival trend
  'y2k-chrome': {
    id: 'y2k-chrome',
    name: 'Y2K Chrome',
    category: 'motion',
    fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, sans-serif',
    fontSize: 54,
    fontWeight: 700,
    textTransform: 'none',
    letterSpacing: 1,
    color: '#c0c0c0',  // Chrome silver
    activeColor: '#00ffff',  // Cyan
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 2, color: '#ffffff' },
    effects: {
      shadow: { offsetX: 2, offsetY: 2, blur: 0, color: '#ff00ff', opacity: 0.6 },
      shadowSecondary: { offsetX: -2, offsetY: -2, blur: 0, color: '#00ffff', opacity: 0.6 },
      glow: { enabled: true, color: '#00ffff', intensity: 0.7, size: 20 },
    },
    animation: { in: 'chrome-reflect', active: 'none', out: 'chrome-reflect', easing: 'ease-out' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Brutalist - Intentionally raw/harsh design trend
  // Source: Brutalist design aesthetic
  'brutalist': {
    id: 'brutalist',
    name: 'Brutalist',
    category: 'motion',
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: 60,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: -1,
    color: '#000000',
    activeColor: '#ff0000',  // Harsh red
    backgroundColor: '#ffffff',
    activeBackgroundColor: '#ffffff',
    backgroundPadding: { x: 8, y: 4 },
    backgroundRadius: 0,  // No rounding, harsh edges
    effects: {
      shadow: { offsetX: 8, offsetY: 8, blur: 0, color: '#000000', opacity: 1 },  // Hard shadow
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'brutal-slam', active: 'none', out: 'none', easing: 'linear' },
    displayMode: 'phrase',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: -8,  // Harsh rotation
      textAlign: 'center',
    },
  },

  // Dynamic Hierarchy — Non-generic system with power/medium/filler word sizing
  // Power words 2-2.5x larger, filler words 0.65x, varying layouts and entrances
  // Emotional line breaking, typography hierarchy, impact-first design
  'dynamic-hierarchy': {
    id: 'dynamic-hierarchy',
    name: 'Dynamic',
    category: 'viral',
    fontFamily: 'Anton, system-ui, sans-serif',
    fontSize: 52,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    lineHeight: 0.9,
    color: '#ffffff',
    activeColor: '#FFD400',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    stroke: { width: 4, color: '#000000' },
    effects: {
      shadow: { offsetX: 0, offsetY: 4, blur: 8, color: '#000000', opacity: 0.4 },
      shadowSecondary: null,
      glow: null,
    },
    animation: { in: 'elastic-pop', active: 'none', out: 'fade', easing: 'spring' },
    displayMode: 'phrase',
    wordsPerPhrase: 5,
    position: {
      anchor: 'bottom',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },

  // Neon Flicker - Broken neon sign effect
  // Source: Neon sign aesthetic trend
  'neon-flicker': {
    id: 'neon-flicker',
    name: 'Neon Flicker',
    category: 'motion',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 52,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 3,
    color: '#00ffff',  // Cyan neon
    activeColor: '#ff00ff',  // Magenta neon
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    effects: {
      shadow: null,
      shadowSecondary: null,
      glow: { enabled: true, color: '#00ffff', intensity: 1, size: 35 },  // Strong glow
    },
    animation: { in: 'neon-buzz', active: 'flicker', out: 'neon-buzz', easing: 'linear' },
    displayMode: 'word-by-word',
    position: {
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      textAlign: 'center',
    },
  },
};

export const PRESET_ORDER = [
  // Viral - Creator styles
  'mrbeast', 'hormozi', 'ali-abdaal', 'iman-gadzhi', 'devin-jatho', 'neon-karaoke', 'kalice-glow', 'sara',
  'ryan-trahan', 'gary-vee', 'nas-daily', 'gradient-genz', 'pastel-bubble', 'wiggle-shake',
  'dynamic-hierarchy',
  // Cinematic
  'netflix', 'cinematic', 'documentary', 'behind-person', 'typewriter', 'retro-vhs',
  'casey-neistat', 'vaporwave', 'cottagecore',
  // Minimal
  'default', 'minimal', 'box-highlight', 'classic',
  // Ad
  'apple-clean', 'google-material', 'ad-headline', 'mkbhd-tech',
  // Motion (AutoAE-inspired + New)
  'spotlight', 'film-grain', 'glitch-text', 'slam', 'wave-bounce', 'versus', 'spin-entry', 'zoom-focus',
  'perspective-3d', 'elastic-stretch', 'speed-lines', 'particle-burst', 'liquid-morph', 'newspaper-spin',
  'underline-wipe', 'y2k-chrome', 'brutalist', 'neon-flicker',
] as const;

export const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: 'viral', label: 'Viral' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'ad', label: 'Ad' },
  { id: 'motion', label: 'Motion' },
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
