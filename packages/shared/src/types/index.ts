// ============================================
// Core Types - Extensible for Phase 2+
// ============================================

// Timeline Item Types
export type TimelineItemType = 'subtitle' | 'visual' | 'audio' | 'effect';

export type VisualType = 'chart' | 'flowchart' | 'list' | 'comparison' | 'framework' | 'stat';

export type SubtitleDisplayMode = 'word-by-word' | 'phrase' | 'karaoke';
export type SubtitlePosition = 'top' | 'center' | 'bottom';

// Legacy animation type (for backward compatibility)
export type SubtitleAnimationLegacy = 'none' | 'pop' | 'fade' | 'highlight';

// V2 Animation System
export type AnimationType =
  | 'none'
  // Viral
  | 'elastic-pop'
  | 'bounce-up'
  | 'shake'
  | 'color-wipe'
  | '3d-flip'
  | 'punch'
  // Cinematic
  | 'fade-rise'
  | 'typewriter'
  | 'smooth-slide'
  | 'soft-scale'
  | 'underline-wipe';

export type EasingType = 'linear' | 'ease-out' | 'spring' | 'elastic' | 'bounce';

export interface AnimationConfig {
  in: AnimationType;
  active: AnimationType;
  out: AnimationType;
  easing: EasingType;
}

// ============================================
// Video Settings (for 9:16 crop/pan)
// ============================================

export interface VideoSettings {
  canvasWidth: number;   // Output width (1080 for reels)
  canvasHeight: number;  // Output height (1920 for reels)
  cropX: number;         // Horizontal pan: 0-100, 50 = center
  cropY: number;         // Vertical pan: 0-100, 50 = center
  scale: number;         // Zoom: 1.0 = fill frame, 1.5 = 150%
}

// ============================================
// Subtitle Types
// ============================================

export interface WordStyleOverrides {
  color?: string;
  fontWeight?: number;
  scale?: number;        // 1.0 = normal, 1.2 = 20% bigger
  emphasisBg?: string;   // highlight background color
}

export interface SubtitleWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
  styleOverrides?: WordStyleOverrides;
}

export interface SubtitleStyle {
  // Display mode
  displayMode: SubtitleDisplayMode;
  wordsPerPhrase: number;

  // Animation — V2: AnimationConfig object, V1: string (migrated at load)
  animation: AnimationConfig | SubtitleAnimationLegacy;

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
  position: SubtitlePosition;
  offsetY: number;

  // Preset reference
  presetId?: string;
}

export interface SubtitleData {
  text: string;
  words: SubtitleWord[];
  style: SubtitleStyle;
  styleOverrides?: Partial<SubtitleStyle>;
}

// ============================================
// Visual Types (Phase 2 - defined now for extensibility)
// ============================================

export interface VisualStyle {
  theme: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic';
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor?: string;
}

export interface VisualData {
  visualType: VisualType;
  props: Record<string, unknown>;
  style: VisualStyle;
}

// ============================================
// Audio Types (Future)
// ============================================

export interface AudioData {
  src: string;              // current playback URL (original or enhanced)
  originalSrc: string;      // always points to original audio file
  enhancedSrc?: string;     // points to enhanced audio file (once processed)
  isEnhanced: boolean;      // toggle state
  sourceVideoItemId: string; // links back to the parent video item
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
}

// ============================================
// Effect Types (Future)
// ============================================

export interface EffectData {
  effectType: string;
  params: Record<string, unknown>;
}

// ============================================
// Timeline Item (Generic)
// ============================================

export type TimelineItemData = SubtitleData | VisualData | AudioData | EffectData;

export interface TimelineItem<T extends TimelineItemData = TimelineItemData> {
  id: string;
  type: TimelineItemType;
  trackId: string;
  startMs: number;
  endMs: number;
  data: T;
  createdAt: Date;
  updatedAt: Date;
}

export type SubtitleItem = TimelineItem<SubtitleData>;
export type VisualItem = TimelineItem<VisualData>;

// ============================================
// Track Types
// ============================================

export type TrackType = 'video' | 'subtitle' | 'visual' | 'audio';

export interface Track {
  id: string;
  projectId: string;
  type: TrackType;
  name: string;
  position: number;
  locked: boolean;
  visible: boolean;
}

// ============================================
// Project Types
// ============================================

export type ProjectStatus =
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'rendering'
  | 'complete'
  | 'failed';

export interface Project {
  id: string;
  userId?: string;
  status: ProjectStatus;
  videoKey: string;
  outputKey?: string;
  durationMs: number;
  fps: number;

  // Source video dimensions
  sourceWidth: number;
  sourceHeight: number;

  // Output settings (9:16 crop/pan)
  videoSettings: VideoSettings;

  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectWithTracks extends Project {
  tracks: Track[];
}

export interface ProjectFull extends ProjectWithTracks {
  items: TimelineItem[];
  transcript?: Transcript;
}

// ============================================
// Transcript Types
// ============================================

export interface TranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface Transcript {
  id: string;
  projectId: string;
  words: TranscriptWord[];
  rawOutput: Record<string, unknown>;
  createdAt: Date;
}

// ============================================
// Job Types
// ============================================

export type JobType = 'transcribe' | 'analyze' | 'generate-visual' | 'render' | 'enhance-audio';

export type JobStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface Job {
  id: string;
  projectId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// ============================================
// API Types
// ============================================

export interface CreateProjectResponse {
  projectId: string;
  uploadUrl: string;
}

export interface ProcessProjectResponse {
  jobId: string;
}

export interface RenderProjectResponse {
  jobId: string;
}

export interface DownloadResponse {
  url: string;
  expiresAt: Date;
}

// ============================================
// WebSocket Types
// ============================================

export type WSMessageType =
  | 'job:progress'
  | 'job:complete'
  | 'job:error'
  | 'project:updated';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
}

export interface JobProgressPayload {
  jobId: string;
  progress: number;
  message?: string;
}

export interface JobCompletePayload {
  jobId: string;
  projectId: string;
}

export interface JobErrorPayload {
  jobId: string;
  error: string;
}

// ============================================
// Default Values
// ============================================

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  canvasWidth: 1080,
  canvasHeight: 1920,
  cropX: 50,
  cropY: 50,
  scale: 1.0,
};

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
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

  presetId: 'mrbeast-bold',
};

export const DEFAULT_FPS = 30;

// Canvas dimensions for reels/shorts (9:16)
export const DEFAULT_CANVAS_WIDTH = 1080;
export const DEFAULT_CANVAS_HEIGHT = 1920;
