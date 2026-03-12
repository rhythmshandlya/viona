// YouTube URL validation patterns
export const YOUTUBE_URL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/,
  /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]{11}/,
  /^https?:\/\/(www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]{11}/,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[a-zA-Z0-9_-]{11}/,
];

export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_PATTERNS.some(pattern => pattern.test(url));
}

export const PIP_SIZE_MAP: Record<string, number> = {
  small: 18,
  medium: 25,
  large: 35,
  custom: 25,
};

// Zone types for overlay system
export type OverlayZone = 'behind' | 'lower-third' | 'top' | 'frame' | 'background' | 'none';

// ---------------------------------------------------------------------------
// Video clip download for render phase
// NOTE: These interfaces duplicate packages/api/src/types/video.ts - keep in sync!
// Worker can't import from API package due to build isolation.
// ---------------------------------------------------------------------------

export interface VideoAssetEntry {
  sceneId: string;
  keyword: string;
  videoId: string;
  sourceUrl: string;
  title: string;
  thumbnailUrl: string;
  trimStart: number;
  trimEnd: number;
}

export interface VideoManifest {
  videos: VideoAssetEntry[];
}

/** Video clip trim override data from editor */
export interface VideoClipOverride {
  sourceSceneId: number;
  sourceVideoUrl: string;
  trimStartSeconds: number;
  trimEndSeconds: number;
}

export interface LayoutSettings {
  mode: 'pip' | 'stacked';
  pip: {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    offsetX: number;
    offsetY: number;
    size: 'small' | 'medium' | 'large' | 'custom';
    customSize: number;
    shape: 'square' | 'circle' | 'rounded';
    borderRadius: number;
    borderWidth: number;
    borderColor: string;
    shadowEnabled: boolean;
    shadowColor: string;
    shadowBlur: number;
    opacity: number;
    rotation: number;
  };
  split: {
    position: 'visuals-first' | 'video-first';
    ratio: number;
    gap: number;
  };
}

export interface FullscreenSegment {
  startMs: number;
  endMs: number;
}

/** Video crop/pan/scale settings from the editor's videoSettings */
export interface VideoCropSettings {
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;    // 0-100, 50=center
  cropY: number;    // 0-100, 50=center
  scale: number;    // 1.0=fill, >1 zoom
}

export interface DisplayModeSegment {
  startMs: number;
  endMs: number;
  enterDurationMs?: number; // transition duration when entering (0 = cut)
  exitDurationMs?: number;  // transition duration when exiting (0 = cut)
}

/** Unified layout segment for Remotion full composition (frame-based) */
export interface LayoutSegment {
  startFrame: number;
  endFrame: number;
  displayMode: 'default' | 'fullscreen' | 'overlay';
}

export interface SegmentationData {
  status: 'pending' | 'processing' | 'ready' | 'failed';
  maskPath?: string;
  maskFps?: number;
}

export interface RenderJobData {
  projectId: string;
  jobId: string;
  projectType?: string;
  layoutSettings?: LayoutSettings;
  fullscreenSegments?: FullscreenSegment[];
  visualDisplayData?: Array<{
    startMs: number;
    endMs: number;
    displayMode?: string;
    transition?: {
      enter: { type: string; durationMs: number };
      exit: { type: string; durationMs: number };
    };
  }>;
  // Video clip trim data from user-edited templateProps
  videoClipData?: Array<{
    sourceSceneId: number;
    sourceVideoUrl: string;
    trimStartSeconds: number;
    trimEndSeconds: number;
  }>;
  /** Workspace manifest snapshot — when present, workspace render path is used */
  manifest?: unknown;
}

export interface RenderRemotionOptions {
  bundlePath: string;
  compositionId: string;
  outputPath: string;
  propsPath?: string;  // Path to JSON file with composition inputProps
  onProgress?: (progress: number) => void;
}

/**
 * Escape a filesystem path for use inside FFmpeg filter option values
 * (e.g. the `fontsdir` option in the `subtitles` filter).
 *
 * FFmpeg's filtergraph parser treats `:` as an option separator, so Windows
 * paths like `C:\Users\...` break filters that take path arguments. The fix
 * requires TWO levels of escaping:
 *   1. Backslash-escape the colon: `C:` → `C\:`  (tells the parser it's literal)
 *   2. Wrap in single quotes: `'C\:/...'`  (protects from further splitting)
 *
 * Verified working with FFmpeg 8.x on Windows. On Linux/macOS (no colons in
 * paths), the function is effectively a no-op.
 */
export function escapePathForFilter(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  // Windows paths contain drive letter colons (C:) which FFmpeg misparses
  if (normalized.includes(':')) {
    // Escape single quotes already in the path, then escape colons, then wrap
    const escaped = normalized
      .replace(/'/g, "'\\''")
      .replace(/:/g, '\\:');
    return "'" + escaped + "'";
  }
  return normalized;
}
