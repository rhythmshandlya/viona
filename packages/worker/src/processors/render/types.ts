import type { Manifest } from '@viona/shared';

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

/** Video crop/pan/scale settings from the editor's videoSettings */
export interface VideoCropSettings {
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;    // 0-100, 50=center
  cropY: number;    // 0-100, 50=center
  scale: number;    // 1.0=fill, >1 zoom
}

/** Unified layout segment for Remotion full composition (frame-based) */
export interface LayoutSegment {
  startFrame: number;
  endFrame: number;
  displayMode: 'default' | 'fullscreen' | 'overlay';
}

export interface RenderJobData {
  projectId: string;
  jobId: string;
  projectType?: string;
  // Video clip trim data from user-edited templateProps
  videoClipData?: Array<{
    sourceSceneId: number;
    sourceVideoUrl: string;
    trimStartSeconds: number;
    trimEndSeconds: number;
  }>;
  /** Workspace manifest snapshot — when present, workspace render path is used */
  manifest?: Manifest;
  /** Path to workspace Remotion bundle directory */
  workspaceBundlePath?: string;
}

export interface RenderRemotionOptions {
  bundlePath: string;
  compositionId: string;
  outputPath: string;
  propsPath?: string;  // Path to JSON file with composition inputProps
  onProgress?: (progress: number) => void;
  /** Files to copy into the bundle's public/ dir after any rebuild (filename → source path) */
  publicAssets?: Record<string, string>;
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
