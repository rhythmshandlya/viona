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
  styleOverrides?: Record<string, unknown>;
}

export interface SubtitleItemData {
  startMs: number;
  endMs: number;
  words: SubtitleWordData[];
  style?: Record<string, unknown>;
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
  defaultSubtitleStyle?: Record<string, unknown>;
}
