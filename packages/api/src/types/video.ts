/**
 * Shared video types for YouTube clip embedding feature.
 */

export interface VideoSelection {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  duration?: string;
  url: string;
}

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
