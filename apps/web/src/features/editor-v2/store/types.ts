/**
 * Editor V2 Store Types
 * Pure TypeScript types for the Zustand store - no DesignCombo dependencies
 */

// ============================================
// Timeline Item Types
// ============================================

export type TimelineItemType = 'video' | 'audio' | 'caption' | 'text' | 'image';

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
  data: VideoItemData | AudioItemData | CaptionItemData | TextItemData | ImageItemData;
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

// ============================================
// Track Types
// ============================================

export type TrackType = 'video' | 'audio' | 'caption' | 'text' | 'overlay';

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
  deleteItems: (ids: string[]) => void;
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
