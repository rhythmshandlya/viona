import { Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { nanoid } from 'nanoid';
import { mkdir, unlink, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { logger } from '../logger.js';
import { uploadFile } from '../services/minio.js';

const execFileAsync = promisify(execFile);

// yt-dlp 2026.03+ requires a JS runtime + challenge solver for YouTube extraction.
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

export interface YouTubeClipJobData {
  jobId: string;
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
// Processor
// ============================================

/**
 * Format seconds to HH:MM:SS for yt-dlp
 */
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Get video info from YouTube
 */
async function getVideoInfo(url: string): Promise<{ title: string; thumbnail: string }> {
  try {
    const { stdout } = await execFileAsync('yt-dlp', [...YTDLP_BASE_ARGS, '-j', '--no-download', url], {
      maxBuffer: 10 * 1024 * 1024,
    });
    const info = JSON.parse(stdout);
    return {
      title: info.title || 'YouTube Clip',
      thumbnail: info.thumbnail || '',
    };
  } catch (err) {
    logger.warn({ err, url }, 'Failed to get video info, using defaults');
    return { title: 'YouTube Clip', thumbnail: '' };
  }
}

/**
 * Process YouTube clip extraction job
 */
export async function processYouTubeClipJob(job: Job<YouTubeClipJobData>): Promise<ClipResult> {
  const { url, startSeconds, endSeconds, quality } = job.data;

  // Validate URL to prevent injection attacks
  if (!validateYouTubeUrl(url)) {
    throw new Error('Invalid YouTube URL format');
  }

  logger.info({
    jobId: job.id,
    url,
    startSeconds,
    endSeconds,
    quality,
  }, 'Starting YouTube clip extraction');

  const clipId = nanoid();
  const tempDir = join(tmpdir(), 'youtube-clips');
  await mkdir(tempDir, { recursive: true });

  const outputPath = join(tempDir, `${clipId}.mp4`);

  // Validate output path is within temp directory (prevent path traversal)
  if (!resolve(outputPath).startsWith(resolve(tempDir))) {
    throw new Error('Invalid output path');
  }

  try {
    // Update progress
    await job.updateProgress(10);

    // Get video info
    const info = await getVideoInfo(url);
    await job.updateProgress(20);

    // Format timestamps for yt-dlp
    const timeRange = `*${formatTimestamp(startSeconds)}-${formatTimestamp(endSeconds)}`;

    // Build format selector
    const formatSelector = quality
      ? `bestvideo[height<=${quality.replace('p', '')}]+bestaudio/best[height<=${quality.replace('p', '')}][acodec!=none]/best[height<=${quality.replace('p', '')}]`
      : 'bestvideo+bestaudio/best';

    // Download only the specified section using execFile with argument array (prevents injection)
    const args = [
      ...YTDLP_BASE_ARGS,
      '-f', formatSelector,
      '--merge-output-format', 'mp4',
      '--download-sections', timeRange,
      '--force-keyframes-at-cuts',
      '-o', outputPath,
      url,
    ];

    logger.info({ args }, 'Executing yt-dlp command');

    await execFileAsync('yt-dlp', args, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 5 * 60 * 1000, // 5 minute timeout
    });

    await job.updateProgress(70);

    // Verify file was created
    const stats = await stat(outputPath);
    const fileSize = stats.size;

    if (fileSize === 0) {
      throw new Error('Downloaded file is empty');
    }

    logger.info({ fileSize, outputPath }, 'Clip downloaded successfully');

    await job.updateProgress(80);

    // Upload to storage
    const clipKey = `clips/${clipId}.mp4`;
    await uploadFile('outputs', clipKey, outputPath);

    await job.updateProgress(95);

    // Cleanup temp file
    try {
      await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }

    await job.updateProgress(100);

    const result: ClipResult = {
      clipId,
      clipUrl: clipKey,
      duration: endSeconds - startSeconds,
      fileSize,
      thumbnail: info.thumbnail,
      sourceUrl: url,
      sourceTitle: info.title,
      startSeconds,
      endSeconds,
    };

    logger.info({ clipId, duration: result.duration }, 'YouTube clip extraction completed');

    return result;
  } catch (err: any) {
    // Cleanup on error
    try {
      await unlink(outputPath);
    } catch {
      // Ignore
    }

    logger.error({ err, url, startSeconds, endSeconds }, 'YouTube clip extraction failed');
    throw err;
  }
}
