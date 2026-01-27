import type { AnimationConfig } from '@reelify/shared';

export type PresetCategory = 'viral' | 'cinematic' | 'minimal';

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
  // Colors
  color: string;
  activeColor: string;
  backgroundColor: string;
  activeBackgroundColor: string;
  // Effects
  textStroke?: string;
  textShadow?: string;
  // Background box
  backgroundPadding?: { x: number; y: number };
  backgroundRadius?: number;
  // Animation
  animation: AnimationConfig;
  // Display
  displayMode: 'word-by-word' | 'phrase' | 'karaoke';
  position: 'top' | 'center' | 'bottom';
}

export const SUBTITLE_PRESETS: Record<string, SubtitlePreset> = {
  // ============================================
  // Viral Presets
  // ============================================
  'mrbeast-bold': {
    id: 'mrbeast-bold',
    name: 'MrBeast Bold',
    category: 'viral',
    fontFamily: 'Montserrat, system-ui, sans-serif',
    fontSize: 58,
    fontWeight: 900,
    color: '#ffffff',
    activeColor: '#ffff00',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textStroke: '2px #000000',
    textShadow: '3px 3px 6px rgba(0, 0, 0, 0.9)',
    animation: { in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' },
    displayMode: 'phrase',
    position: 'bottom',
  },

  'hormozi': {
    id: 'hormozi',
    name: 'Hormozi',
    category: 'viral',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 56,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#ffffff',
    activeColor: '#ff3333',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
    animation: { in: 'punch', active: 'none', out: 'none', easing: 'spring' },
    displayMode: 'word-by-word',
    position: 'center',
  },

  'tiktok-bounce': {
    id: 'tiktok-bounce',
    name: 'TikTok Bounce',
    category: 'viral',
    fontFamily: 'Poppins, system-ui, sans-serif',
    fontSize: 52,
    fontWeight: 700,
    color: '#ffffff',
    activeColor: '#00e5ff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textShadow: '2px 2px 8px rgba(0, 0, 0, 0.7)',
    animation: { in: 'bounce-up', active: 'bounce-up', out: 'none', easing: 'elastic' },
    displayMode: 'phrase',
    position: 'bottom',
  },

  'glitch-out': {
    id: 'glitch-out',
    name: 'Glitch Out',
    category: 'viral',
    fontFamily: 'Space Grotesk, system-ui, sans-serif',
    fontSize: 54,
    fontWeight: 700,
    color: '#39ff14',
    activeColor: '#ff00ff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textShadow: '2px 0 #ff0000, -2px 0 #00ffff',
    animation: { in: 'shake', active: 'shake', out: 'shake', easing: 'linear' },
    displayMode: 'word-by-word',
    position: 'center',
  },

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
    textShadow: '0 0 10px #00ffff, 0 0 20px #00ffff, 0 0 30px #00ffff',
    animation: { in: 'color-wipe', active: 'color-wipe', out: 'none', easing: 'ease-out' },
    displayMode: 'karaoke',
    position: 'bottom',
  },

  // ============================================
  // Cinematic Presets
  // ============================================
  'cinema-fade': {
    id: 'cinema-fade',
    name: 'Cinema Fade',
    category: 'cinematic',
    fontFamily: 'Playfair Display, serif',
    fontSize: 48,
    fontWeight: 600,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textShadow: '1px 1px 3px rgba(0, 0, 0, 0.6)',
    animation: { in: 'fade-rise', active: 'none', out: 'fade-rise', easing: 'ease-out' },
    displayMode: 'phrase',
    position: 'bottom',
  },

  'documentary': {
    id: 'documentary',
    name: 'Documentary',
    category: 'cinematic',
    fontFamily: 'Source Sans 3, system-ui, sans-serif',
    fontSize: 42,
    fontWeight: 400,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textStroke: '1px rgba(0,0,0,0.5)',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
    animation: { in: 'soft-scale', active: 'none', out: 'soft-scale', easing: 'ease-out' },
    displayMode: 'phrase',
    position: 'bottom',
  },

  'keynote': {
    id: 'keynote',
    name: 'Keynote',
    category: 'cinematic',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 46,
    fontWeight: 500,
    color: '#ffffff',
    activeColor: '#3b82f6',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
    animation: { in: 'smooth-slide', active: 'none', out: 'smooth-slide', easing: 'ease-out' },
    displayMode: 'phrase',
    position: 'bottom',
  },

  'typewriter': {
    id: 'typewriter',
    name: 'Typewriter',
    category: 'cinematic',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 40,
    fontWeight: 400,
    color: '#00ff00',
    activeColor: '#00ff00',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    activeBackgroundColor: 'rgba(0, 0, 0, 0.85)',
    backgroundPadding: { x: 16, y: 8 },
    backgroundRadius: 4,
    animation: { in: 'typewriter', active: 'typewriter', out: 'none', easing: 'linear' },
    displayMode: 'karaoke',
    position: 'bottom',
  },

  // ============================================
  // Minimal Presets
  // ============================================
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
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
    animation: { in: 'fade-rise', active: 'none', out: 'fade-rise', easing: 'ease-out' },
    displayMode: 'phrase',
    position: 'bottom',
  },

  'box-highlight': {
    id: 'box-highlight',
    name: 'Box Highlight',
    category: 'minimal',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 48,
    fontWeight: 700,
    color: '#ffffff',
    activeColor: '#000000',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    activeBackgroundColor: '#ffff00',
    backgroundPadding: { x: 12, y: 4 },
    backgroundRadius: 8,
    animation: { in: 'soft-scale', active: 'none', out: 'none', easing: 'ease-out' },
    displayMode: 'phrase',
    position: 'bottom',
  },

  'classic-sub': {
    id: 'classic-sub',
    name: 'Classic Sub',
    category: 'minimal',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 40,
    fontWeight: 600,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textStroke: '1px #000000',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
    animation: { in: 'none', active: 'none', out: 'none', easing: 'linear' },
    displayMode: 'phrase',
    position: 'bottom',
  },
};

export const PRESET_ORDER = [
  // Viral
  'mrbeast-bold', 'hormozi', 'tiktok-bounce', 'glitch-out', 'neon-karaoke',
  // Cinematic
  'cinema-fade', 'documentary', 'keynote', 'typewriter',
  // Minimal
  'minimal', 'box-highlight', 'classic-sub',
] as const;

export const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: 'viral', label: 'Viral' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'minimal', label: 'Minimal' },
];

export const DEFAULT_PRESET_ID = 'mrbeast-bold';

export function getPreset(id: string): SubtitlePreset {
  return SUBTITLE_PRESETS[id] || SUBTITLE_PRESETS[DEFAULT_PRESET_ID];
}

export function getPresetsByCategory(category: PresetCategory): SubtitlePreset[] {
  return PRESET_ORDER
    .filter((id) => SUBTITLE_PRESETS[id]?.category === category)
    .map((id) => SUBTITLE_PRESETS[id]);
}
