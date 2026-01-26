export interface SubtitlePreset {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  activeColor: string;
  backgroundColor: string;
  activeBackgroundColor: string;
  textStroke?: string;
  textShadow?: string;
  position: 'top' | 'center' | 'bottom';
  animation: 'none' | 'pop' | 'fade' | 'highlight' | 'karaoke';
}

export const SUBTITLE_PRESETS: Record<string, SubtitlePreset> = {
  'bold-pop': {
    id: 'bold-pop',
    name: 'Bold Pop',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 56,
    fontWeight: 800,
    color: '#ffffff',
    activeColor: '#ffff00',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textStroke: '2px #000000',
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
    position: 'bottom',
    animation: 'pop',
  },

  'minimal-clean': {
    id: 'minimal-clean',
    name: 'Minimal Clean',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 44,
    fontWeight: 600,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
    position: 'bottom',
    animation: 'fade',
  },

  'neon-glow': {
    id: 'neon-glow',
    name: 'Neon Glow',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 52,
    fontWeight: 700,
    color: '#00ffff',
    activeColor: '#ff00ff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textShadow: '0 0 10px #00ffff, 0 0 20px #00ffff, 0 0 30px #00ffff',
    position: 'bottom',
    animation: 'karaoke',
  },

  'box-highlight': {
    id: 'box-highlight',
    name: 'Box Highlight',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 48,
    fontWeight: 700,
    color: '#ffffff',
    activeColor: '#000000',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    activeBackgroundColor: '#ffff00',
    position: 'bottom',
    animation: 'highlight',
  },

  'centered-drama': {
    id: 'centered-drama',
    name: 'Centered Drama',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 64,
    fontWeight: 800,
    color: '#ffffff',
    activeColor: '#ff3333',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textShadow: '3px 3px 6px rgba(0, 0, 0, 0.9)',
    position: 'center',
    animation: 'pop',
  },

  'subtitle-classic': {
    id: 'subtitle-classic',
    name: 'Subtitle Classic',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 40,
    fontWeight: 600,
    color: '#ffffff',
    activeColor: '#ffffff',
    backgroundColor: 'transparent',
    activeBackgroundColor: 'transparent',
    textStroke: '1px #000000',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
    position: 'bottom',
    animation: 'fade',
  },
};

export const PRESET_ORDER = [
  'bold-pop',
  'minimal-clean',
  'neon-glow',
  'box-highlight',
  'centered-drama',
  'subtitle-classic',
] as const;

export const DEFAULT_PRESET_ID = 'bold-pop';

export function getPreset(id: string): SubtitlePreset {
  return SUBTITLE_PRESETS[id] || SUBTITLE_PRESETS[DEFAULT_PRESET_ID];
}

export function presetToStyle(preset: SubtitlePreset) {
  return {
    fontFamily: preset.fontFamily,
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    color: preset.color,
    activeColor: preset.activeColor,
    backgroundColor: preset.backgroundColor,
    activeBackgroundColor: preset.activeBackgroundColor,
    position: preset.position,
    animation: preset.animation,
  };
}
