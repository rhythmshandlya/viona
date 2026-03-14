/**
 * Types and interfaces for visual generation processor
 */

export type {
  VisualsLayoutMode,
  VisualsDimensions,
  VideoSelection,
  GenerateVisualsJobData,
} from '@viona/shared';

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

// VisualsLayoutMode, VisualsDimensions, VideoSelection, GenerateVisualsJobData
// are imported and re-exported from @viona/shared above

export interface SegmentMetadata {
  id: number;
  layout: string;  // 'stacked' | 'fullscreen' | 'overlay'
  layoutProps: Record<string, unknown>;
  startMs: number;
  endMs: number;
  beatCount: number;
  description: string;
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
  segments?: SegmentMetadata[];
  version?: number;
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
