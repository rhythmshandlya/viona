import React from 'react';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DisplayMode = 'default' | 'fullscreen' | 'overlay';

// Keep in sync with packages/worker/src/processors/render/types.ts LayoutSegment
export interface LayoutSegment {
  startFrame: number;
  endFrame: number;
  displayMode: DisplayMode;
}

export interface SplitSettings {
  position: 'visuals-first' | 'video-first';
  ratio: number;
  gap: number;
}

export type LayoutMode = 'stacked' | 'pip';

export interface PiPSettings {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  offsetX: number;
  offsetY: number;
  /** Percentage of canvas width (e.g. 25 = 25%) */
  size: number;
  shape: 'square' | 'circle' | 'rounded';
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  opacity: number;
  rotation: number;
}

export interface VideoCropSettings {
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;
  cropY: number;
  scale: number;
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

export interface FullCompositionProps {
  layoutMode: LayoutMode;
  splitSettings: SplitSettings;
  pipSettings?: PiPSettings;
  layoutSegments: LayoutSegment[];
  videoCropSettings: VideoCropSettings;
  sourceVideoFile?: string;
  audioFile?: string;
  backgroundColor?: string;
  subtitles?: SubtitleItemData[];
  defaultSubtitleStyle?: SubtitleStyle;
  /** Visual items with transition config. When provided, FullComposition renders scenes
   *  via SceneTransitionLayer instead of using children through VisualsLayer. */
  sceneItems?: SceneItem[];
  /** Callback to render a scene by sceneFile path. Required when sceneItems is provided. */
  renderScene?: (sceneFile: string, frameOffset: number) => React.ReactNode;
}

// ---- Scene transition types ----

export type TransitionType = 'cut' | 'crossfade' | 'slide-left' | 'slide-up' | 'zoom' | 'morph' | 'fade';

export interface SceneTransition {
  type: TransitionType;
  durationMs: number;
}

/**
 * Visual item metadata for scene transition rendering.
 * Each SceneItem maps to one visual item in the manifest.
 */
export interface SceneItem {
  id: string;
  startFrame: number;
  endFrame: number;
  sceneFile: string;
  displayMode: DisplayMode;
  frameOffset?: number;
  enter?: SceneTransition;
  exit?: SceneTransition;
}
