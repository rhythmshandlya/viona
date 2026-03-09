/**
 * Types and interfaces for visual generation processor
 */

export interface HeadTrackingFrame {
  timestamp_ms: number;
  face?: { bbox?: { x: number; y: number; width: number; height: number } };
}

export interface SpeakerGrid {
  grid: number[][];
  occupancy: string;
  safePlacement: string[];
}

/**
 * Asset type for extracted components
 */
export interface ExtractedAsset {
  id: string;
  name: string;
  type: 'component' | 'element' | 'text' | 'shape' | 'icon' | 'background';
  sceneId: number;
  sceneName: string;
  description: string;
  position?: { x: string; y: string };
  size?: { width: string; height: string };
}

export type VisualsLayoutMode = 'pip' | 'stacked';

export interface VisualsDimensions {
  width: number;
  height: number;
}

/**
 * Video selection data from user's scene plan approval.
 * NOTE: This duplicates packages/api/src/types/video.ts - keep in sync!
 * Worker can't import from API package due to build isolation.
 */
export interface VideoSelection {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  duration?: string;
  url: string;
}

export interface GenerateVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'studio-dark' | 'studio-light';
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
  /** Effective dimensions for default scenes in stacked layout */
  pipEffective?: VisualsDimensions;
  /** User-provided style/layout guidance for the Director agent */
  styleGuide?: string;
  /** Enable verbose logging for debugging */
  verbose?: boolean;
  /** If set, skip Director phase and run Animator only using plan from this job */
  planJobId?: string;
  /** User-selected videos for scenes: sceneIndex → keyword → VideoSelection */
  selectedVideos?: Record<number, Record<string, VideoSelection>>;
}

export interface VisualMetadata {
  compositionId: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  visuals: Array<{
    startMs: number;
    endMs: number;
    type: string;
    description: string;
    displayMode?: 'default' | 'fullscreen' | 'overlay';
    transition?: {
      enter: { type: string; durationMs: number };
      exit: { type: string; durationMs: number };
    };
  }>;
}

export interface JobMetrics {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  llmModel: string;
  filesWritten: number;
  screenshotsTaken: number;
  finalScore?: number;
  totalIterations?: number;
  status?: string;
}

export interface ClaudeCodeResult {
  bundleUrl: string;
  bundlePath: string;
  filesWritten: number;
  durationMs: number;
  status: string;
}

/**
 * Video asset manifest for render phase — maps scene indices to video clips.
 */
export interface VideoAssetEntry {
  sceneId: string;
  keyword: string;
  videoId: string;
  sourceUrl: string;
  proxyUrl?: string;
  title: string;
  thumbnailUrl: string;
  trimStart: number;
  trimEnd: number;
}

export interface VideoManifest {
  videos: VideoAssetEntry[];
}

export interface ClaudeCodeOptions {
  projectId: string;
  jobId: string;
  transcript: string;
  words?: any[];
  durationFrames: number;
  fps: number;
  width: number;
  height: number;
  stylePreset: string;
  layoutMode: string;
  styleGuide?: string;
  /** If set, run only the Animator phase (plan already exists in project dir) */
  planJobId?: string;
  /** Effective pip dimensions for per-scene dimension-aware generation */
  pipWidth?: number;
  pipHeight?: number;
  /** Safe placement zones from head tracking for Director overlay awareness */
  safePlacement?: string[];
  /** Callback to raise heartbeat water mark when Python emits PROGRESS checkpoints */
  onProgress?: (percent: number) => void;
}
