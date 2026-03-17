export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SubtitleWordData {
  text: string;
  startMs: number;
  endMs: number;
  styleOverrides?: SubtitleWordStyleOverrides;
}

export interface SubtitleWordStyleOverrides {
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

export interface StrokeStyle {
  width: number;
  color: string;
}

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

export interface SubtitlePosition {
  anchor: 'top' | 'center' | 'bottom';
  offsetX: number;
  offsetY: number;
  rotation: number;
  textAlign: 'left' | 'center' | 'right';
}

export interface SubtitleStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  activeColor?: string;
  backgroundColor?: string;
  activeBackgroundColor?: string;
  position?: SubtitlePosition | 'top' | 'center' | 'bottom';
  animation?: string | { type: string; [key: string]: unknown };
  textShadow?: string;
  effects?: CaptionEffects;
  opacity?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  stroke?: StrokeStyle | null;
  displayMode?: 'word-by-word' | 'phrase' | 'karaoke';
  wordsPerPhrase?: number;
  presetId?: string;
  backgroundPadding?: { x: number; y: number };
  backgroundRadius?: number;
}

export interface SubtitleItemData {
  startMs: number;
  endMs: number;
  words: SubtitleWordData[];
  style?: SubtitleStyle;
}

// ---- Scene transition types ----

export type TransitionType = 'cut' | 'crossfade' | 'slide-left' | 'slide-up' | 'zoom' | 'morph' | 'fade';

export interface SceneTransition {
  type: TransitionType;
  durationMs: number;
}
