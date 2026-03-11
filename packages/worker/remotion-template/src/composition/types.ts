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
  overlayOpacity?: number;
}

export interface SplitSettings {
  position: 'visuals-first' | 'video-first';
  ratio: number;
  gap: number;
}

export interface VideoCropSettings {
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;
  cropY: number;
  scale: number;
}

export interface FullCompositionProps {
  splitSettings: SplitSettings;
  layoutSegments: LayoutSegment[];
  videoCropSettings: VideoCropSettings;
  sourceVideoFile: string;
}
