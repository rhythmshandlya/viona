/**
 * Editor V2 Store Types
 * Pure TypeScript types for the Zustand store - no DesignCombo dependencies
 */

// ============================================
// Timeline Item Types
// ============================================

export type TimelineItemType = 'video' | 'audio' | 'caption' | 'text' | 'image' | 'visual';

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  trackId: string;
  startMs: number;
  endMs: number;
  // Optional trim for media items
  trim?: {
    startMs: number;
    endMs: number;
  };
  // Type-specific data
  data: VideoItemData | AudioItemData | CaptionItemData | TextItemData | ImageItemData | VisualItemData;
}

export interface VideoItemData {
  src: string;
  width: number;
  height: number;
  volume: number;
  playbackRate: number;
  previewUrl?: string;
  muted?: boolean;
  separatedAudioItemId?: string;
}

export interface AudioItemData {
  src: string;
  originalSrc: string;
  enhancedSrc?: string;
  isEnhanced: boolean;
  sourceVideoItemId: string;
  volume: number;
  waveformData?: number[];
  enhancementStatus?: 'idle' | 'processing' | 'complete' | 'error';
  enhancementProgress?: number;
}

export interface CaptionItemData {
  text: string;
  words: CaptionWord[];
  style: CaptionStyle;
  styleOverrides?: Partial<CaptionStyle>;
}

export interface WordStyleOverrides {
  color?: string;
  fontWeight?: number;
  scale?: number;
  emphasisBg?: string;
}

export interface CaptionWord {
  text: string;
  startMs: number; // Relative to caption start
  endMs: number;   // Relative to caption start
  styleOverrides?: WordStyleOverrides;
}

export type CaptionDisplayMode = 'word-by-word' | 'phrase' | 'karaoke';

// Legacy animation type kept for backward compat
export type CaptionAnimationLegacy = 'none' | 'pop' | 'fade' | 'highlight';

// V2 animation types
export type AnimationType =
  | 'none'
  | 'elastic-pop' | 'bounce-up' | 'shake' | 'color-wipe'
  | '3d-flip' | 'punch'
  | 'fade-rise' | 'typewriter' | 'smooth-slide' | 'soft-scale'
  | 'underline-wipe';

export type EasingType = 'linear' | 'ease-out' | 'spring' | 'elastic' | 'bounce';

export interface AnimationConfig {
  in: AnimationType;
  active: AnimationType;
  out: AnimationType;
  easing: EasingType;
}

export interface CaptionStyle {
  // Display mode
  displayMode: CaptionDisplayMode;
  wordsPerPhrase: number;

  // Animation — V2 config or legacy string
  animation: AnimationConfig | CaptionAnimationLegacy;

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

  // Position
  position: 'top' | 'center' | 'bottom';
  offsetY: number;
  textAlign: 'left' | 'center' | 'right';

  // Preset reference
  presetId?: string;
}

export interface TextItemData {
  text: string;
  style: TextStyle;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor?: string;
  textAlign: 'left' | 'center' | 'right';
}

export interface ImageItemData {
  src: string;
  width: number;
  height: number;
  position: { x: number; y: number };
  opacity: number;
}

export interface VisualItemData {
  visualId: string;
  compositionId: string;
  bundleUrl: string;
  videoUrl?: string; // Rendered video URL for playback
  type: string; // 'process' | 'chart' | 'diagram' etc.
  description: string;
  width: number;
  height: number;
  fps: number;
}

// ============================================
// Track Types
// ============================================

export type TrackType = 'video' | 'audio' | 'caption' | 'text' | 'overlay' | 'visual';

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  position: number; // Order in timeline (0 = bottom)
  locked: boolean;
  visible: boolean;
  height: number;   // Track height in pixels
  collapsed: boolean;
}

// ============================================
// Video Settings Types (for 9:16 crop/pan)
// ============================================

export interface VideoSettings {
  canvasWidth: number;   // Output width (1080 for reels)
  canvasHeight: number;  // Output height (1920 for reels)
  cropX: number;         // Horizontal pan: 0-100, 50 = center
  cropY: number;         // Vertical pan: 0-100, 50 = center
  scale: number;         // Zoom: 1.0 = fill frame, 1.5 = 150%
}

// ============================================
// Project Types
// ============================================

export interface Project {
  id: string;
  status: string;
  videoKey: string | null;
  videoUrl: string | null;
  outputKey: string | null;
  durationMs: number;
  fps: number;

  // Source video dimensions
  sourceWidth: number;
  sourceHeight: number;

  // Output settings
  videoSettings: VideoSettings;
}

// ============================================
// Selection Types
// ============================================

export type SelectionMode = 'replace' | 'add' | 'toggle';

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// ============================================
// Viewport Types
// ============================================

export interface Viewport {
  zoom: number;       // pixels per millisecond
  scrollX: number;    // horizontal scroll in pixels
  scrollY: number;    // vertical scroll in pixels
}

// ============================================
// Drag State Types
// ============================================

export type DragType = 'move' | 'resize-left' | 'resize-right' | 'select-box' | 'scrub';

export interface DragState {
  type: DragType;
  itemId?: string;
  trackId?: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  originalStartMs?: number;
  originalEndMs?: number;
  originalTrackId?: string;
}

// ============================================
// Snap Types
// ============================================

export interface SnapTarget {
  position: number; // in milliseconds
  type: 'playhead' | 'item-start' | 'item-end' | 'marker';
  itemId?: string;
}

// ============================================
// History Types (for undo/redo)
// ============================================

export interface HistoryEntry {
  tracks: Track[];
  items: Record<string, TimelineItem>;
  itemIds: string[];
  selectedIds: string[];
}

// ============================================
// Store State Types
// ============================================

export interface EditorState {
  // Project
  project: Project | null;
  isLoading: boolean;
  error: string | null;

  // Timeline data
  tracks: Track[];
  items: Record<string, TimelineItem>;
  itemIds: string[];
  duration: number;  // Total duration in ms
  fps: number;

  // Selection
  selectedIds: string[];
  lastSelectedId: string | null;
  selectionBox: SelectionBox | null;

  // Playback
  currentTimeMs: number;
  isPlaying: boolean;

  // Viewport
  viewport: Viewport;

  // Drag state
  dragState: DragState | null;

  // History
  history: HistoryEntry[];
  historyIndex: number;

  // UI state
  isSaving: boolean;

  // Caption style toggle
  applyStyleToAll: boolean;

  // Clipboard and split mode
  clipboard: TimelineItem[] | null;
  splitMode: boolean;

  // Layout settings (video + visuals arrangement)
  layoutSettings: LayoutSettings;
  layoutPresetId: LayoutPresetId;
}

// ============================================
// Store Actions Types
// ============================================

export interface EditorActions {
  // Project actions
  loadProject: (projectId: string) => Promise<void>;
  saveProject: () => Promise<void>;
  setProject: (project: Project) => void;

  // Video settings actions
  updateVideoSettings: (settings: Partial<VideoSettings>) => void;

  // Caption style actions
  updateAllCaptionStyles: (style: Partial<CaptionStyle>) => void;
  updateSelectedCaptionStyles: (ids: string[], style: Partial<CaptionStyle>) => void;
  updateWordStyleOverrides: (captionId: string, wordIndex: number, overrides: Partial<WordStyleOverrides> | null) => void;
  setApplyStyleToAll: (value: boolean) => void;
  selectAllCaptionsOnTrack: (trackId: string) => void;

  // Item actions
  addItem: (trackId: string, item: Partial<TimelineItem>) => string;
  updateItem: (id: string, updates: Partial<TimelineItem>) => void;
  updateItemData: <T extends TimelineItem['data']>(id: string, dataUpdates: Partial<T>) => void;
  deleteItems: (ids: string[]) => Promise<void>;
  moveItem: (id: string, trackId: string, startMs: number) => void;
  resizeItem: (id: string, startMs: number, endMs: number) => void;

  // Selection actions
  select: (ids: string[], mode?: SelectionMode) => void;
  selectRange: (anchorId: string, targetId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setSelectionBox: (box: SelectionBox | null) => void;

  // Playback actions
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  seek: (timeMs: number) => void;
  setCurrentTime: (timeMs: number) => void;

  // Viewport actions
  setZoom: (zoom: number) => void;
  setScrollX: (scrollX: number) => void;
  setScrollY: (scrollY: number) => void;
  zoomToFit: () => void;

  // Drag actions
  startDrag: (dragState: DragState) => void;
  updateDrag: (x: number, y: number) => void;
  endDrag: () => void;

  // History actions
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Track actions
  addTrack: (track: Partial<Track>) => string;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  reorderTracks: (trackIds: string[]) => void;

  // Audio separation actions
  separateAudio: (videoItemId: string) => Promise<void>;
  toggleEnhancement: (audioItemId: string) => void;
  updateEnhancementStatus: (audioItemId: string, status: AudioItemData['enhancementStatus'], progress?: number, enhancedSrc?: string) => void;

  // Split
  splitItem: (itemId: string, atMs: number) => void;
  setSplitMode: (active: boolean) => void;

  // Clipboard
  copyItems: (ids: string[]) => void;
  pasteItems: (atMs: number) => void;
  duplicateItems: (ids: string[]) => void;

  // Nudge & Trim
  nudgeItems: (ids: string[], deltaMs: number) => void;
  trimItems: (ids: string[], edge: 'start' | 'end', deltaMs: number) => void;

  // Subtitle-specific
  splitCaption: (captionId: string, wordIndex: number) => void;
  mergeCaptions: (captionId1: string, captionId2: string) => void;
  updateCaptionText: (captionId: string, newText: string) => void;

  // Layout actions
  updateLayoutSettings: (settings: Partial<LayoutSettings>) => void;
  updatePiPSettings: (settings: Partial<PiPSettings>) => void;
  updateSplitSettings: (settings: Partial<SplitSettings>) => void;
  setLayoutPreset: (presetId: LayoutPresetId) => void;
  setLayoutMode: (mode: LayoutMode) => void;
}

export type EditorStore = EditorState & EditorActions;

// ============================================
// Default Values
// ============================================

export const DEFAULT_TRACK_HEIGHT = 48;
export const DEFAULT_ZOOM = 0.1; // 0.1 pixels per millisecond = 100px per second
export const DEFAULT_FPS = 30;

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  canvasWidth: 1080,
  canvasHeight: 1920,
  cropX: 50,
  cropY: 50,
  scale: 1.0,
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
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

  color: '#ffffff',
  activeColor: '#ffff00',
  backgroundColor: 'transparent',
  activeBackgroundColor: 'transparent',

  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',

  backgroundPadding: { x: 4, y: 2 },
  backgroundRadius: 8,

  position: 'bottom',
  offsetY: 0,
  textAlign: 'center',

  presetId: 'mrbeast-bold',
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 48,
  fontWeight: 600,
  color: '#ffffff',
  backgroundColor: undefined,
  textAlign: 'center',
};

// ============================================
// Layout Settings Types (Video + Visuals arrangement)
// ============================================

// Layout modes for arranging video and visuals
export type LayoutMode = 'pip' | 'split-horizontal' | 'split-vertical';

// Split position (which content is on top/left)
export type SplitPosition = 'visuals-first' | 'video-first';

// PiP position options
export type PiPPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type PiPSize = 'small' | 'medium' | 'large' | 'custom';
export type PiPShape = 'square' | 'circle' | 'rounded';

export interface PiPSettings {
  // Position
  position: PiPPosition;
  offsetX: number;
  offsetY: number;

  // Size
  size: PiPSize;
  customSize: number;  // Percentage of canvas width (5-50%)

  // Shape
  shape: PiPShape;
  borderRadius: number;

  // Styling
  borderWidth: number;
  borderColor: string;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  opacity: number;
}

export interface SplitSettings {
  // Which content appears first (top for horizontal, left for vertical)
  position: SplitPosition;
  // Ratio: percentage for visuals (0-100), video gets the rest
  ratio: number;
  // Gap between sections
  gap: number;
}

export interface LayoutSettings {
  // Current layout mode
  mode: LayoutMode;
  // PiP-specific settings (used when mode === 'pip')
  pip: PiPSettings;
  // Split-specific settings (used when mode === 'split-*')
  split: SplitSettings;
}

// Pre-designed layout presets
export type LayoutPresetId = 'pip-tutorial' | 'pip-podcast' | 'pip-minimal' | 'pip-gaming' | 'split-equal' | 'split-visuals-large' | 'split-video-large' | 'custom';

export interface LayoutPreset {
  id: LayoutPresetId;
  name: string;
  description: string;
  settings: LayoutSettings;
}

export const DEFAULT_PIP_SETTINGS: PiPSettings = {
  position: 'bottom-right',
  offsetX: 16,
  offsetY: 16,
  size: 'medium',
  customSize: 25,
  shape: 'rounded',
  borderRadius: 12,
  borderWidth: 2,
  borderColor: 'rgba(255, 255, 255, 0.2)',
  shadowEnabled: true,
  shadowColor: 'rgba(0, 0, 0, 0.5)',
  shadowBlur: 20,
  opacity: 1,
};

export const DEFAULT_SPLIT_SETTINGS: SplitSettings = {
  position: 'visuals-first',
  ratio: 50,
  gap: 0,
};

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  mode: 'pip',
  pip: DEFAULT_PIP_SETTINGS,
  split: DEFAULT_SPLIT_SETTINGS,
};

export const LAYOUT_PRESETS: LayoutPreset[] = [
  // Split presets
  {
    id: 'split-equal',
    name: '50/50 Split',
    description: 'Equal split between visuals and video',
    settings: {
      mode: 'split-horizontal',
      pip: DEFAULT_PIP_SETTINGS,
      split: { position: 'visuals-first', ratio: 50, gap: 0 },
    },
  },
  {
    id: 'split-visuals-large',
    name: '70/30 Visuals',
    description: 'Visuals dominant, small video',
    settings: {
      mode: 'split-horizontal',
      pip: DEFAULT_PIP_SETTINGS,
      split: { position: 'visuals-first', ratio: 70, gap: 0 },
    },
  },
  {
    id: 'split-video-large',
    name: '30/70 Video',
    description: 'Video dominant, small visuals',
    settings: {
      mode: 'split-horizontal',
      pip: DEFAULT_PIP_SETTINGS,
      split: { position: 'video-first', ratio: 30, gap: 0 },
    },
  },
  // PiP presets
  {
    id: 'pip-tutorial',
    name: 'PiP Tutorial',
    description: 'Medium rounded PiP, bottom-right',
    settings: {
      mode: 'pip',
      pip: {
        position: 'bottom-right',
        offsetX: 16,
        offsetY: 16,
        size: 'medium',
        customSize: 25,
        shape: 'rounded',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowEnabled: true,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        shadowBlur: 20,
        opacity: 1,
      },
      split: DEFAULT_SPLIT_SETTINGS,
    },
  },
  {
    id: 'pip-podcast',
    name: 'PiP Podcast',
    description: 'Large circular talking head',
    settings: {
      mode: 'pip',
      pip: {
        position: 'bottom-right',
        offsetX: 24,
        offsetY: 24,
        size: 'large',
        customSize: 35,
        shape: 'circle',
        borderRadius: 9999,
        borderWidth: 4,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        shadowEnabled: true,
        shadowColor: 'rgba(0, 0, 0, 0.6)',
        shadowBlur: 30,
        opacity: 1,
      },
      split: DEFAULT_SPLIT_SETTINGS,
    },
  },
  {
    id: 'pip-minimal',
    name: 'PiP Minimal',
    description: 'Small subtle circular PiP',
    settings: {
      mode: 'pip',
      pip: {
        position: 'bottom-right',
        offsetX: 12,
        offsetY: 12,
        size: 'small',
        customSize: 18,
        shape: 'circle',
        borderRadius: 9999,
        borderWidth: 0,
        borderColor: 'transparent',
        shadowEnabled: true,
        shadowColor: 'rgba(0, 0, 0, 0.3)',
        shadowBlur: 10,
        opacity: 0.95,
      },
      split: DEFAULT_SPLIT_SETTINGS,
    },
  },
  {
    id: 'pip-gaming',
    name: 'PiP Gaming',
    description: 'Top-left with bold purple border',
    settings: {
      mode: 'pip',
      pip: {
        position: 'top-left',
        offsetX: 16,
        offsetY: 16,
        size: 'medium',
        customSize: 22,
        shape: 'rounded',
        borderRadius: 8,
        borderWidth: 3,
        borderColor: '#a855f7',
        shadowEnabled: true,
        shadowColor: 'rgba(168, 85, 247, 0.4)',
        shadowBlur: 15,
        opacity: 1,
      },
      split: DEFAULT_SPLIT_SETTINGS,
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Your custom settings',
    settings: DEFAULT_LAYOUT_SETTINGS,
  },
];

// Size mapping (percentage of canvas width)
export const PIP_SIZE_MAP: Record<PiPSize, number> = {
  small: 18,
  medium: 25,
  large: 35,
  custom: 25,
};
