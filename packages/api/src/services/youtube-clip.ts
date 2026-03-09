import { execFile } from 'child_process';
import { promisify } from 'util';
import { nanoid } from 'nanoid';
import { createWriteStream } from 'fs';
import { mkdir, unlink, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { uploadStream } from './minio.js';

const execFileAsync = promisify(execFile);

// yt-dlp 2026.03+ requires a JS runtime + challenge solver for YouTube extraction.
// Without these flags, yt-dlp fails with "This video is not available" or missing formats.
const YTDLP_BASE_ARGS = ['--js-runtimes', 'node', '--remote-components', 'ejs:github'];

// Strict YouTube URL validation to prevent injection attacks
const YOUTUBE_URL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}(&.*)?$/,
  /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]{11}(\?.*)?$/,
  /^https?:\/\/(www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]{11}(\?.*)?$/,
  /^https?:\/\/(www\.)?youtube\.com\/v\/[a-zA-Z0-9_-]{11}(\?.*)?$/,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[a-zA-Z0-9_-]{11}(\?.*)?$/,
];

function validateYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_PATTERNS.some(pattern => pattern.test(url));
}

// ============================================
// Types
// ============================================

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  duration: number;
  thumbnail: string;
  channel: string;
  uploadDate: string;
  formats: VideoFormat[];
}

export interface VideoFormat {
  quality: string;
  formatId: string;
  filesize?: number;
  hasAudio: boolean;
}

export interface StreamToken {
  tokenId: string;
  videoId: string;
  directUrl: string;
  audioUrl?: string;
  expiresAt: number;
  format: string;
}

export interface ClipRequest {
  url: string;
  startSeconds: number;
  endSeconds: number;
  quality?: string;
  projectId?: string;
}

export interface ClipResult {
  clipId: string;
  clipUrl: string;
  duration: number;
  fileSize: number;
  thumbnail: string;
  sourceUrl: string;
  sourceTitle: string;
  startSeconds: number;
  endSeconds: number;
}

// ============================================
// YouTube Clip Service
// ============================================

class YouTubeClipService {
  private streamTokens: Map<string, StreamToken> = new Map();
  private readonly TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour (for editing sessions)
  private readonly MAX_TOKENS = 10_000;

  /**
   * Extract video ID from various YouTube URL formats
   */
  extractVideoId(url: string): string {
    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtu\.be\/([^?]+)/,
      /youtube\.com\/embed\/([^?]+)/,
      /youtube\.com\/v\/([^?]+)/,
      /youtube\.com\/shorts\/([^?]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    throw new Error('Invalid YouTube URL');
  }

  /**
   * Get video metadata without downloading
   */
  async getVideoInfo(url: string): Promise<YouTubeVideoInfo> {
    if (!validateYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL format');
    }

    const { stdout } = await execFileAsync('yt-dlp', [...YTDLP_BASE_ARGS, '-j', '--no-download', url], {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large metadata
    });

    const info = JSON.parse(stdout);

    return {
      videoId: info.id,
      title: info.title,
      duration: info.duration,
      thumbnail: info.thumbnail,
      channel: info.channel || info.uploader,
      uploadDate: info.upload_date,
      formats: (info.formats || [])
        .filter((f: any) => f.vcodec !== 'none' && f.height)
        .map((f: any) => ({
          quality: f.format_note || `${f.height}p`,
          formatId: f.format_id,
          filesize: f.filesize,
          hasAudio: f.acodec !== 'none',
        }))
        .filter((f: any, i: number, arr: any[]) =>
          // Dedupe by quality
          arr.findIndex(x => x.quality === f.quality) === i
        ),
    };
  }

  /**
   * Get direct stream URL for preview (supports seeking via range requests)
   */
  async getStreamUrl(url: string, quality?: string): Promise<StreamToken> {
    if (!validateYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL format');
    }

    // Build format selector
    // For streaming preview, we need a COMBINED format (video+audio in single file)
    // DASH formats (separate video/audio) don't work for HTML5 <video> playback
    // YouTube itags with combined streams (progressive formats):
    //   22 = 720p MP4 (video+audio) - preferred for quality
    //   18 = 360p MP4 (video+audio) - reliable fallback
    //
    // IMPORTANT: Use 'best' not 'bestvideo+bestaudio' - the latter returns 2 URLs
    // We MUST get a single combined stream for HTML5 video playback
    // The [acodec!=none][vcodec!=none] filter ensures we get a muxed format
    const formatSelector = quality
      ? `22/18/best[height<=${quality.replace('p', '')}][acodec!=none][vcodec!=none]`
      : '22/18/best[acodec!=none][vcodec!=none]/best';

    const { stdout } = await execFileAsync('yt-dlp', [...YTDLP_BASE_ARGS, '-g', '-f', formatSelector, url], {
      maxBuffer: 1024 * 1024,
    });

    const urls = stdout.trim().split('\n');

    // If we got 2 URLs, yt-dlp returned separate video+audio (DASH)
    // This means the combined format wasn't available - fall back to lower quality
    if (urls.length > 1) {
      console.warn('[YouTubeClip] Got separate streams, retrying with progressive format only');
      const { stdout: fallbackStdout } = await execFileAsync('yt-dlp', [
        ...YTDLP_BASE_ARGS, '-g', '-f', '18/best[acodec!=none]', url
      ], {
        maxBuffer: 1024 * 1024,
      });
      urls[0] = fallbackStdout.trim().split('\n')[0];
    }

    const videoUrl = urls[0];

    const tokenId = nanoid();
    const token: StreamToken = {
      tokenId,
      videoId: this.extractVideoId(url),
      directUrl: videoUrl,
      audioUrl: undefined, // We always use combined streams now
      expiresAt: Date.now() + this.TOKEN_EXPIRY_MS,
      format: quality || 'best',
    };

    // Evict oldest token if at capacity to prevent unbounded growth
    if (this.streamTokens.size >= this.MAX_TOKENS) {
      const oldestKey = this.streamTokens.keys().next().value;
      if (oldestKey) this.streamTokens.delete(oldestKey);
    }

    this.streamTokens.set(tokenId, token);

    // Auto-cleanup expired tokens
    setTimeout(() => {
      this.streamTokens.delete(tokenId);
    }, this.TOKEN_EXPIRY_MS);

    return token;
  }

  /**
   * Get stream token by ID
   */
  getStreamToken(tokenId: string): StreamToken | undefined {
    const token = this.streamTokens.get(tokenId);
    if (token && Date.now() > token.expiresAt) {
      this.streamTokens.delete(tokenId);
      return undefined;
    }
    return token;
  }

  /**
   * Format seconds to HH:MM:SS for yt-dlp
   */
  private formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Download specific segment using yt-dlp --download-sections
   */
  async extractClip(
    url: string,
    startSeconds: number,
    endSeconds: number,
    quality?: string,
    onProgress?: (progress: number) => void
  ): Promise<ClipResult> {
    if (!validateYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL format');
    }

    const clipId = nanoid();
    const tempDir = join(tmpdir(), 'youtube-clips');
    await mkdir(tempDir, { recursive: true });

    const outputPath = join(tempDir, `${clipId}.mp4`);
    const thumbnailPath = join(tempDir, `${clipId}.jpg`);

    // Validate output path is within temp directory (prevent path traversal)
    if (!resolve(outputPath).startsWith(resolve(tempDir))) {
      throw new Error('Invalid output path');
    }

    // Format timestamps for yt-dlp
    const timeRange = `*${this.formatTimestamp(startSeconds)}-${this.formatTimestamp(endSeconds)}`;

    // Build format selector - prefer formats with audio
    const formatSelector = quality
      ? `bestvideo[height<=${quality.replace('p', '')}]+bestaudio/best[height<=${quality.replace('p', '')}][acodec!=none]/best[height<=${quality.replace('p', '')}]`
      : 'bestvideo+bestaudio/best';

    onProgress?.(10);

    // Get video info first for metadata
    const info = await this.getVideoInfo(url);

    onProgress?.(20);

    // Download only the specified section using execFile with argument array
    const args = [
      ...YTDLP_BASE_ARGS,
      '-f', formatSelector,
      '--merge-output-format', 'mp4',
      '--download-sections', timeRange,
      '--force-keyframes-at-cuts',
      '-o', outputPath,
      url,
    ];

    console.log(`[YouTubeClip] Extracting clip: ${startSeconds}s - ${endSeconds}s`);
    console.log(`[YouTubeClip] Args: ${args.join(' ')}`);

    await execFileAsync('yt-dlp', args, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 5 * 60 * 1000, // 5 minute timeout
    });

    onProgress?.(70);

    // Get thumbnail
    try {
      await execFileAsync('yt-dlp', [
        ...YTDLP_BASE_ARGS,
        '--write-thumbnail',
        '--skip-download',
        '--convert-thumbnails', 'jpg',
        '-o', thumbnailPath.replace('.jpg', ''),
        url,
      ], {
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      // Thumbnail extraction failed, continue without
      console.warn('[YouTubeClip] Thumbnail extraction failed, using default');
    }

    onProgress?.(80);

    // Get file size
    const stats = await stat(outputPath);
    const fileSize = stats.size;

    // Upload to storage
    const { createReadStream } = await import('fs');
    const clipKey = `clips/${clipId}.mp4`;

    await uploadStream('outputs', clipKey, createReadStream(outputPath), fileSize, 'video/mp4');

    onProgress?.(95);

    // Upload thumbnail if it exists
    let thumbnailUrl = info.thumbnail;
    try {
      const thumbStats = await stat(thumbnailPath);
      if (thumbStats.size > 0) {
        const thumbKey = `clips/${clipId}.jpg`;
        await uploadStream('outputs', thumbKey, createReadStream(thumbnailPath), thumbStats.size, 'image/jpeg');
        // We'll use presigned URL for thumbnail
      }
    } catch {
      // Use original YouTube thumbnail
    }

    // Cleanup temp files
    try {
      await unlink(outputPath);
      await unlink(thumbnailPath);
    } catch {
      // Ignore cleanup errors
    }

    onProgress?.(100);

    return {
      clipId,
      clipUrl: clipKey, // Storage key - will be converted to presigned URL
      duration: endSeconds - startSeconds,
      fileSize,
      thumbnail: thumbnailUrl,
      sourceUrl: url,
      sourceTitle: info.title,
      startSeconds,
      endSeconds,
    };
  }
}

export const youtubeClipService = new YouTubeClipService();
