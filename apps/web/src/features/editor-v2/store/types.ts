/**
 * Editor V2 Store Types
 * Pure TypeScript types for the Zustand store - no DesignCombo dependencies
 */

// ============================================
// Timeline Item Types
// ============================================

export type TimelineItemType = 'video' | 'audio' | 'caption' | 'text' | 'image' | 'visual' | 'broll';

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
  data: VideoItemData | AudioItemData | CaptionItemData | TextItemData | ImageItemData | VisualItemData | BrollItemData;
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
  segmentation?: SegmentationData;  // NEW: speaker segmentation data
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
  aiWordOverrides?: Record<number, WordStyleOverrides>;
}

export interface WordStyleOverrides {
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

// Stroke style for text outline
export interface StrokeStyle {
  width: number;     // 0-10px
  color: string;     // hex color
}

// ============================================
// Effects System (Phase 3)
// ============================================

// Individual shadow definition
export interface ShadowEffect {
  offsetX: number;    // -20 to +20 px
  offsetY: number;    // -20 to +20 px
  blur: number;       // 0 to 30 px
  color: string;      // hex color
  opacity: number;    // 0 to 1
}

// Glow effect (rendered as layered shadows)
export interface GlowEffect {
  enabled: boolean;
  color: string;      // hex color
  intensity: number;  // 0 to 1 (affects opacity)
  size: number;       // 5 to 50 px (blur radius)
}

// Complete effects configuration
export interface CaptionEffects {
  // Primary shadow (most common use case)
  shadow: ShadowEffect | null;

  // Optional secondary shadow (for depth/glitch effects)
  shadowSecondary: ShadowEffect | null;

  // Glow effect (renders as multiple blurred shadows)
  glow: GlowEffect | null;
}

export const DEFAULT_SHADOW: ShadowEffect = {
  offsetX: 2,
  offsetY: 2,
  blur: 4,
  color: '#000000',
  opacity: 0.8,
};

export const DEFAULT_GLOW: GlowEffect = {
  enabled: false,
  color: '#00ffff',
  intensity: 0.7,
  size: 20,
};

export const DEFAULT_CAPTION_EFFECTS: CaptionEffects = {
  shadow: DEFAULT_SHADOW,
  shadowSecondary: null,
  glow: null,
};

// Migration function for legacy textShadow string
export function migrateTextShadow(legacy: string | undefined): CaptionEffects {
  if (!legacy) {
    return { shadow: null, shadowSecondary: null, glow: null };
  }

  // Parse "2px 2px 4px rgba(0, 0, 0, 0.8)" format
  const match = legacy.match(
    /(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
  );

  if (!match) {
    // Fallback for other formats
    return {
      shadow: { ...DEFAULT_SHADOW },
      shadowSecondary: null,
      glow: null,
    };
  }

  const [, x, y, blur, r, g, b, a] = match;
  const color = `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`;

  return {
    shadow: {
      offsetX: parseInt(x),
      offsetY: parseInt(y),
      blur: parseInt(blur),
      color,
      opacity: a ? parseFloat(a) : 1,
    },
    shadowSecondary: null,
    glow: null,
  };
}

export interface CaptionWord {
  text: string;
  startMs: number; // Relative to caption start
  endMs: number;   // Relative to caption start
  styleOverrides?: WordStyleOverrides;
}

export type CaptionDisplayMode = 'word-by-word' | 'phrase' | 'karaoke';

// Legacy position type (for backward compatibility)
export type CaptionPositionLegacy = 'top' | 'center' | 'bottom';

// V2/V3 Position System
export interface CaptionPosition {
  // Anchor point (where the caption "attaches")
  anchor: 'top' | 'center' | 'bottom';

  // Offset from anchor (percentage of canvas)
  // X: -50 to +50 (0 = centered)
  // Y: -50 to +50 (0 = at anchor)
  offsetX: number;
  offsetY: number;

  // Rotation in degrees (-180 to +180)
  rotation: number;

  // Text alignment within caption box
  textAlign: 'left' | 'center' | 'right';

  // V3 additions (all optional — existing data works unchanged)
  mode?: 'anchor' | 'free';  // undefined = 'anchor' (legacy)
  x?: number;     // 0-100% of canvas (center of caption box)
  y?: number;     // 0-100% of canvas (center of caption box)
  width?: number;  // 20-100% of canvas (default 90)
}

// Safe zone definitions for different platforms
export interface SafeZone {
  top: number;      // % from top to avoid
  bottom: number;   // % from bottom to avoid
  left: number;     // % from left to avoid
  right: number;    // % from right to avoid
}

export const PLATFORM_SAFE_ZONES: Record<string, SafeZone> = {
  'tiktok': { top: 15, bottom: 25, left: 5, right: 5 },
  'instagram-reels': { top: 12, bottom: 20, left: 5, right: 5 },
  'youtube-shorts': { top: 10, bottom: 18, left: 5, right: 5 },
  'universal': { top: 10, bottom: 15, left: 5, right: 5 },
  'none': { top: 0, bottom: 0, left: 0, right: 0 },
};

export const DEFAULT_CAPTION_POSITION: CaptionPosition = {
  anchor: 'bottom',
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  textAlign: 'center',
};

// Convert anchor-mode position to free x,y coordinates
export function anchorToFreeCoords(pos: CaptionPosition): { x: number; y: number } {
  let x = 50 + (pos.offsetX || 0);
  let y: number;

  switch (pos.anchor) {
    case 'top':
      y = 10 + (pos.offsetY || 0);
      break;
    case 'center':
      y = 50 + (pos.offsetY || 0);
      break;
    case 'bottom':
    default:
      y = 85 + (pos.offsetY || 0);
      break;
  }

  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

// Migration function for legacy position format
export function migratePosition(style: { position?: CaptionPosition | CaptionPositionLegacy; offsetY?: number; textAlign?: 'left' | 'center' | 'right' }): CaptionPosition {
  // If already new format (object with anchor)
  if (style.position && typeof style.position === 'object' && 'anchor' in style.position) {
    return style.position;
  }

  // Migrate from old format
  return {
    anchor: (typeof style.position === 'string' ? style.position : 'bottom') as 'top' | 'center' | 'bottom',
    offsetX: 0,
    offsetY: style.offsetY || 0,
    rotation: 0,
    textAlign: style.textAlign || 'center',
  };
}

// Legacy animation type kept for backward compat
export type CaptionAnimationLegacy = 'none' | 'pop' | 'fade' | 'highlight';

// V2 animation types
export type AnimationType =
  | 'none'
  // Viral
  | 'elastic-pop' | 'bounce-up' | 'shake' | 'color-wipe'
  | '3d-flip' | 'punch' | 'scale-bounce' | 'slide-up' | 'weight-shift' | 'float'
  | 'rotate-bounce' | 'constant-wiggle' | 'slam-down' | 'shake-entry'
  | 'bubble-pop' | 'wiggle'
  // Cinematic
  | 'fade' | 'fade-rise' | 'typewriter' | 'smooth-slide' | 'soft-scale'
  | 'underline-wipe' | 'scan-line' | 'hand-draw' | 'underline-sweep'
  // Ad / Premium
  | 'apple-fade' | 'google-slide' | 'clean-scale' | 'letter-cascade' | 'smooth-reveal'
  | 'slide-left'
  // Motion (AutoAE-inspired)
  | 'spotlight-reveal' | 'film-burn' | 'glitch' | 'spin-reveal'
  | 'drop-slam' | 'wave' | 'blur-zoom' | 'chromatic-split'
  | 'elastic-horizontal' | 'speed-blur' | 'particle-explode' | 'gather'
  | 'blob-morph' | 'newspaper-rotate' | 'chrome-reflect' | 'brutal-slam'
  | 'neon-buzz' | 'flicker';

export type EasingType = 'linear' | 'ease-out' | 'ease-in-out' | 'spring' | 'elastic' | 'bounce';

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
  opacity?: number;       // 0-1, default 1
  lineHeight?: number;    // 1.0-2.5, default 1.4

  // Colors
  color: string;
  activeColor: string;
  backgroundColor: string;
  activeBackgroundColor: string;

  // Effects
  stroke?: StrokeStyle | null;  // Text outline (replaces textStroke)
  textStroke?: string;          // @deprecated - use stroke instead
  textShadow?: string;          // @deprecated - use effects instead
  effects?: CaptionEffects;     // V3: Full effects system

  // Background box
  backgroundPadding?: { x: number; y: number };
  backgroundRadius?: number;

  // Position - V2: CaptionPosition object, V1: string (migrated at load)
  position: CaptionPosition | CaptionPositionLegacy;

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

export type VisualDisplayMode = 'default' | 'fullscreen' | 'overlay';

export type OverlayZone = 'behind' | 'lower-third' | 'top' | 'frame' | 'background' | 'none';

export interface FaceBbox {
  frame: number;
  x: number;      // 0-1 normalized (left edge)
  y: number;      // 0-1 normalized (top edge)
  width: number;  // 0-1 normalized
  height: number; // 0-1 normalized
  confidence: number;
}

export interface SegmentationData {
  status: 'pending' | 'processing' | 'ready' | 'failed';
  progress?: number;
  maskPath?: string;           // Path to mask images (e.g., /videos/{id}/masks/)
  maskFps?: number;            // Frame rate of masks (e.g., 10)
  faceBboxTimeline?: FaceBbox[];
  error?: string;
}

export interface VisualItemData {
  visualId: string;
  compositionId: string;
  bundleUrl: string;
  videoUrl?: string; // Stream URL for preview (e.g., /api/youtube/proxy/{tokenId})
  sourceVideoUrl?: string; // Original YouTube URL for export download
  type: string; // 'process' | 'chart' | 'diagram' etc.
  description: string;
  width: number;
  height: number;
  fps: number;
  /** Original 1-indexed scene file ID (scenes/SceneN.tsx). Survives timeline splits. */
  sourceSceneId?: number;
  /** Effective viewport width for this scene (may differ from width for pip-in-split) */
  effectiveWidth?: number;
  /** Effective viewport height for this scene (may differ from height for pip-in-split) */
  effectiveHeight?: number;
  /** How this visual composites with speaker video. Defaults to 'default' for standard layout behavior. */
  displayMode?: VisualDisplayMode;
  /** Zone-based positioning for overlay compositing */
  overlayZone?: OverlayZone;
  /** Enter/exit transitions at segment boundaries */
  transition?: {
    enter: { type: 'cut' | 'fade' | 'zoom-in' | 'zoom-out'; durationMs: number };
    exit: { type: 'cut' | 'fade' | 'zoom-in' | 'zoom-out'; durationMs: number };
  };
  /** Speaker face bounding box for overlay masking (0-1 fractions of canvas). */
  speakerBbox?: { x: number; y: number; w: number; h: number };

  // Template-based visual support (alternative to bundleUrl for registered templates)
  /** Template slug from packages/templates registry (e.g., 'youtube-clip', 'watercolor-map') */
  templateId?: string;
  /** Props for the template component, validated against template schema */
  templateProps?: Record<string, unknown>;
  /** Whether this visual has an associated video clip (youtube-clip scenes) */
  hasVideo?: boolean;
}

export interface BrollItemData {
  sourceType: 'upload' | 'pexels';
  src: string;
  filename?: string;
  photographer?: string;
  previewUrl?: string;
  volume: number;
  fileSize?: number;
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
  title: string | null;
  status: string;
  projectType?: 'video' | 'audio';
  videoKey: string | null;
  audioKey?: string | null;
  videoUrl: string | null;
  audioUrl?: string | null;
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
  isDirty: boolean;

  // Caption style toggle
  applyStyleToAll: boolean;

  // Caption visibility in player
  showCaptions: boolean;

  // Clipboard and split mode
  clipboard: TimelineItem[] | null;
  splitMode: boolean;

  // Layout settings (video + visuals arrangement)
  layoutSettings: LayoutSettings;
  layoutPresetId: LayoutPresetId;

  // Scene selection for AI editing
  selectedSceneId: number | null;
  selectedTimeRange: { startMs: number; endMs: number } | null;
  selectedElement: SelectedElement | null;

  // Element picker mode
  elementPickerEnabled: boolean;

  // Element inspect mode (hover/click on canvas to select elements)
  inspectModeEnabled: boolean;

  // AI edit request (set when user triggers "Edit with AI" from context menu)
  aiEditRequested: boolean;

  // Pending AI message (auto-sent by AI panel, e.g. from "Change & AI Adapt")
  pendingAIMessage: string | null;

  // Transition picker (set when user triggers "Change Transition" from context menu)
  transitionPickerItemId: string | null;

  // Safe zone settings
  safeZonePlatform: string;  // 'tiktok' | 'instagram-reels' | etc.
  showSafeZone: boolean;

  // Visual scene regeneration tracking (not persisted to DB)
  regeneratingVisualItemIds: Set<string>;
  splitJobToItems: Record<string, [string, string]>;  // jobId -> [leftId, rightId]
}

// ============================================
// Store Actions Types
// ============================================

export interface EditorActions {
  // Project actions
  loadProject: (projectId: string) => Promise<void>;
  reloadVisuals: (projectId: string) => Promise<void>;
  refreshMediaUrls: (projectId: string) => Promise<void>;
  saveProject: () => Promise<void>;
  setProject: (project: Project) => void;

  // Video settings actions
  updateVideoSettings: (settings: Partial<VideoSettings>) => void;

  // Caption style actions
  updateAllCaptionStyles: (style: Partial<CaptionStyle>) => void;
  updateSelectedCaptionStyles: (ids: string[], style: Partial<CaptionStyle>) => void;
  updateWordStyleOverrides: (captionId: string, wordIndex: number, overrides: Partial<WordStyleOverrides> | null) => void;
  setApplyStyleToAll: (value: boolean) => void;
  setShowCaptions: (value: boolean) => void;
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
  splitAllAtPlayhead: () => void;
  setSplitMode: (active: boolean) => void;

  // Range delete
  deleteTimeRange: (startMs: number, endMs: number, ripple?: boolean) => Promise<void>;

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
  updatePiPCrop: (crop: Partial<PiPCrop>) => void;
  updateSplitSettings: (settings: Partial<SplitSettings>) => void;
  setLayoutPreset: (presetId: LayoutPresetId) => void;
  setLayoutMode: (mode: LayoutMode) => void;

  // Scene selection for AI editing
  setSelectedScene: (sceneId: number | null) => void;
  setSelectedTimeRange: (range: { startMs: number; endMs: number } | null) => void;
  setSelectedElement: (element: SelectedElement | null) => void;

  // Element picker mode
  setElementPickerEnabled: (enabled: boolean) => void;

  // Element inspect mode
  setInspectModeEnabled: (enabled: boolean) => void;

  // AI edit request
  requestAIEdit: (item: TimelineItem) => void;

  // Pending AI message
  setPendingAIMessage: (message: string | null) => void;
  changeDisplayModeWithAI: (itemId: string, newDisplayMode: VisualDisplayMode) => void;

  // Visual display mode
  updateVisualDisplayMode: (itemId: string, displayMode: VisualDisplayMode) => void;
  updateVisualTransition: (itemId: string, transition: VisualItemData['transition']) => void;

  // Transition picker
  openTransitionPicker: (itemId: string) => void;
  closeTransitionPicker: () => void;

  // Safe zone actions
  setSafeZonePlatform: (platform: string) => void;
  setShowSafeZone: (show: boolean) => void;

  // Scene split regeneration
  clearRegeneratingItems: (itemIds: string[]) => void;
  removeSplitJob: (jobId: string) => void;
  // Overlay zone actions
  updateVisualOverlayZone: (itemId: string, zone: OverlayZone) => void;
  getVideoSegmentation: (videoItemId: string) => SegmentationData | undefined;
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
  opacity: 1,
  lineHeight: 1.4,

  color: '#ffffff',
  activeColor: '#ffff00',
  backgroundColor: 'transparent',
  activeBackgroundColor: 'transparent',

  stroke: null,
  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',  // Legacy fallback
  effects: DEFAULT_CAPTION_EFFECTS,

  backgroundPadding: { x: 4, y: 2 },
  backgroundRadius: 8,

  position: DEFAULT_CAPTION_POSITION,

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
export type LayoutMode = 'pip' | 'stacked';

// Normalize legacy layout mode values from saved projects
export function normalizeLayoutMode(mode: string): LayoutMode {
  if (mode === 'split-horizontal' || mode === 'split-vertical') return 'stacked';
  if (mode === 'pip' || mode === 'stacked') return mode;
  return 'stacked'; // default
}

// Normalize legacy per-scene display mode values
export function normalizeDisplayMode(dm: string | undefined): VisualDisplayMode {
  if (dm === 'pip') return 'default';
  if (dm === 'default' || dm === 'fullscreen' || dm === 'overlay') return dm;
  return 'default'; // default
}

// Split position (which content is on top/left)
export type SplitPosition = 'visuals-first' | 'video-first';

// PiP position options
export type PiPPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type PiPSize = 'small' | 'medium' | 'large' | 'custom';
export type PiPShape = 'square' | 'circle' | 'rounded';

export interface PiPCrop {
  cropX: number;  // 0-100, horizontal pan (50 = center)
  cropY: number;  // 0-100, vertical pan (50 = center)
  zoom: number;   // 1.0 = fill frame (cover), up to 3.0
}

export const DEFAULT_PIP_CROP: PiPCrop = {
  cropX: 50,
  cropY: 50,
  zoom: 1.0,
};

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

  // Transform
  rotation: number; // degrees, -180 to 180

  // Styling
  borderWidth: number;
  borderColor: string;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  opacity: number;

  // Video framing inside the PiP bubble
  crop: PiPCrop;
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
export type LayoutPresetId = 'pip-tutorial' | 'pip-podcast' | 'pip-minimal' | 'pip-gaming' | 'stacked-equal' | 'stacked-visuals-large' | 'stacked-video-large' | 'custom';

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
  borderRadius: 20,
  rotation: 0,
  borderWidth: 2,
  borderColor: 'rgba(255, 255, 255, 0.2)',
  shadowEnabled: true,
  shadowColor: 'rgba(0, 0, 0, 0.5)',
  shadowBlur: 20,
  opacity: 1,
  crop: DEFAULT_PIP_CROP,
};

export const DEFAULT_SPLIT_SETTINGS: SplitSettings = {
  position: 'visuals-first',
  ratio: 50,
  gap: 0,
};

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  mode: 'stacked',
  pip: DEFAULT_PIP_SETTINGS,
  split: DEFAULT_SPLIT_SETTINGS,
};

export const LAYOUT_PRESETS: LayoutPreset[] = [
  // Stacked presets
  {
    id: 'stacked-equal',
    name: '50/50 Stacked',
    description: 'Equal split between visuals and video',
    settings: {
      mode: 'stacked',
      pip: DEFAULT_PIP_SETTINGS,
      split: { position: 'visuals-first', ratio: 50, gap: 0 },
    },
  },
  {
    id: 'stacked-visuals-large',
    name: '70/30 Visuals',
    description: 'Visuals dominant, small video',
    settings: {
      mode: 'stacked',
      pip: DEFAULT_PIP_SETTINGS,
      split: { position: 'visuals-first', ratio: 70, gap: 0 },
    },
  },
  {
    id: 'stacked-video-large',
    name: '30/70 Video',
    description: 'Video dominant, small visuals',
    settings: {
      mode: 'stacked',
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
        borderRadius: 20,
        rotation: 0,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowEnabled: true,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        shadowBlur: 20,
        opacity: 1,
        crop: DEFAULT_PIP_CROP,
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
        rotation: 0,
        borderWidth: 4,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        shadowEnabled: true,
        shadowColor: 'rgba(0, 0, 0, 0.6)',
        shadowBlur: 30,
        opacity: 1,
        crop: DEFAULT_PIP_CROP,
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
        rotation: 0,
        borderWidth: 0,
        borderColor: 'transparent',
        shadowEnabled: true,
        shadowColor: 'rgba(0, 0, 0, 0.3)',
        shadowBlur: 10,
        opacity: 0.95,
        crop: DEFAULT_PIP_CROP,
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
        rotation: 0,
        borderWidth: 3,
        borderColor: '#a855f7',
        shadowEnabled: true,
        shadowColor: 'rgba(168, 85, 247, 0.4)',
        shadowBlur: 15,
        opacity: 1,
        crop: DEFAULT_PIP_CROP,
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

// ============================================
// Element Selection (for AI editing)
// ============================================

export interface SelectedElement {
  name: string;
  type: string;
  sceneId: number;
  description?: string;
  position?: { x: string; y: string };
  size?: { width: string; height: string };
}

// ============================================
// AI Editing Context (for AI Assistant Panel)
// ============================================

export interface AIEditingContext {
  type: 'element' | 'item' | 'scene' | 'composition';
  element?: SelectedElement;
  item?: {
    id: string;
    type: TimelineItemType;
    name: string;
    description?: string;
  };
  sceneId?: number;
  displayName: string;
  displayDescription?: string;
}
