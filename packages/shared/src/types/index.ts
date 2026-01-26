// ============================================
// Core Types - Extensible for Phase 2+
// ============================================

// Timeline Item Types
export type TimelineItemType = 'subtitle' | 'visual' | 'audio' | 'effect';

export type VisualType = 'chart' | 'flowchart' | 'list' | 'comparison' | 'framework' | 'stat';

export type SubtitleAnimation = 'none' | 'pop' | 'fade' | 'typewriter' | 'highlight-word';

export type SubtitlePosition = 'top' | 'center' | 'bottom';

// ============================================
// Subtitle Types
// ============================================

export interface SubtitleWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  backgroundColor?: string;
  position: SubtitlePosition;
  animation: SubtitleAnimation;
  highlightColor?: string;
}

export interface SubtitleData {
  text: string;
  words: SubtitleWord[];
  style: SubtitleStyle;
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
  audioKey: string;
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
  width: number;
  height: number;
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

export type JobType = 'transcribe' | 'analyze' | 'generate-visual' | 'render';

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

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'Inter',
  fontSize: 48,
  fontWeight: 600,
  color: '#FFFFFF',
  backgroundColor: undefined,
  position: 'bottom',
  animation: 'highlight-word',
  highlightColor: '#FFD700',
};

export const DEFAULT_FPS = 30;
export const DEFAULT_WIDTH = 1920;
export const DEFAULT_HEIGHT = 1080;
