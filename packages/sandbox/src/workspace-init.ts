import { mkdir, writeFile, cp, access, symlink, readlink, copyFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Client as MinioClient } from 'minio';
import pino from 'pino';
import { syncAssets } from './asset-sync.js';

const execFileAsync = promisify(execFile);

const logger = pino({ name: 'workspace-init' });

const WORKSPACE = '/workspace';
const TEMPLATE = '/app/template';
const NODE_MODULES_SRC = '/app/node_modules';

export interface InitPayload {
  videoUrl: string;      // MinIO key for source video
  audioUrl?: string;     // MinIO key for separate audio (optional)
  manifest: object;      // Initial manifest from DB
  // New fields (all optional for backward compat)
  transcript?: {
    words: Array<{ text: string; startMs: number; endMs: number; confidence: number }>;
    segments: Array<{ text: string; startMs: number; endMs: number }>;
    language: string;
  };
  userBrief?: string;
  headTracking?: {
    speakerGrid: number[][];
    safePlacement: Array<{ x: number; y: number; width: number; height: number }>;
  };
  projectMeta?: {
    width: number;
    height: number;
    fps: number;
    durationMs: number;
  };
}

function getMinioClient(): MinioClient {
  return new MinioClient({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
  });
}

/**
 * Detect video duration in milliseconds using ffprobe.
 */
async function probeVideoDurationMs(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath,
    ]);
    const info = JSON.parse(stdout);
    const seconds = parseFloat(info.format?.duration || '0');
    return Math.round(seconds * 1000);
  } catch (err) {
    logger.warn({ err }, 'ffprobe failed, duration will be 0');
    return 0;
  }
}

/**
 * Check if workspace is already initialized (volume was restored from backup).
 */
export async function isInitialized(): Promise<boolean> {
  try {
    await access(join(WORKSPACE, 'manifest.json'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize workspace on first boot.
 * Downloads video, writes manifest, copies template files.
 */
export async function initWorkspace(payload: InitPayload): Promise<void> {
  logger.info('Initializing workspace (first boot)');

  // Create directory structure
  await mkdir(join(WORKSPACE, 'src', 'segments'), { recursive: true });
  await mkdir(join(WORKSPACE, 'src', 'components'), { recursive: true });
  await mkdir(join(WORKSPACE, 'src', 'scenes'), { recursive: true });
  await mkdir(join(WORKSPACE, 'public'), { recursive: true });
  await mkdir(join(WORKSPACE, '.build'), { recursive: true });
  await mkdir(join(WORKSPACE, '.claude'), { recursive: true });
  await mkdir(join(WORKSPACE, 'docs'), { recursive: true });

  // Create empty scene-registry.ts stub (PlayerComposition imports it statically)
  await writeFile(join(WORKSPACE, 'src', 'scene-registry.ts'),
    `// AUTO-GENERATED — do not edit\nimport React from 'react';\nexport const sceneRegistry: Record<string, React.ComponentType<any>> = {};\n`);

  // Download video from MinIO
  const minio = getMinioClient();
  const bucket = process.env.MINIO_BUCKET || 'viona';

  const videoPath = join(WORKSPACE, 'public', 'source.mp4');

  logger.info({ key: payload.videoUrl }, 'Downloading source video');
  const videoStream = await minio.getObject(bucket, payload.videoUrl);
  await pipeline(videoStream, createWriteStream(videoPath));
  logger.info('Video downloaded');

  // Detect video duration with ffprobe
  const durationMs = await probeVideoDurationMs(videoPath);
  logger.info({ durationMs }, 'Video duration detected');

  // Extract audio track from video for independent playback
  const audioPath = join(WORKSPACE, 'public', 'audio.aac');
  try {
    await execFileAsync('ffmpeg', [
      '-i', videoPath,
      '-vn',           // no video
      '-acodec', 'copy', // copy audio codec (no re-encode)
      '-y',            // overwrite
      audioPath,
    ]);
    logger.info('Audio extracted from video');
  } catch (err) {
    logger.warn({ err }, 'ffmpeg audio extraction failed — falling back to video audio');
  }

  // Download separate audio if provided (overrides extracted)
  if (payload.audioUrl) {
    logger.info({ key: payload.audioUrl }, 'Downloading separate audio (overrides extracted)');
    const audioStream = await minio.getObject(bucket, payload.audioUrl);
    await pipeline(audioStream, createWriteStream(audioPath));
  }

  // Patch manifest with detected duration and fix video item endMs
  const manifest = payload.manifest as Record<string, any>;
  if (durationMs > 0) {
    manifest.durationMs = durationMs;
    // Fix any video/audio items with endMs: 0
    if (Array.isArray(manifest.items)) {
      for (const item of manifest.items) {
        if (item.endMs === 0 || item.endMs <= item.startMs) {
          item.endMs = durationMs;
        }
      }
    }
  }

  // Ensure v2 manifest fields
  if (!manifest.version) manifest.version = 2;
  if (!manifest.assets) manifest.assets = {};

  // Write manifest
  await writeFile(
    join(WORKSPACE, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  // Symlink manifest into public/ so Remotion's staticFile() can read it
  // (calculateMetadata runs in browser context where fs is unavailable)
  try {
    await symlink(
      join(WORKSPACE, 'manifest.json'),
      join(WORKSPACE, 'public', 'manifest.json'),
    );
  } catch (err: any) {
    if (err.code !== 'EEXIST') throw err;
  }

  // Copy template files (composition infra, .claude/, configs)
  await cp(TEMPLATE, WORKSPACE, {
    recursive: true,
    force: false,  // Don't overwrite existing files
  });

  // Copy shared prompt modules into workspace for orchestrator access
  const sharedSrc = join('/app', 'prompts', 'shared');
  const sharedDst = join(WORKSPACE, 'docs', 'shared');
  await mkdir(sharedDst, { recursive: true });
  for (const file of ['technical-rules.md', 'motion-design-principles.md', 'vocabulary.md', 'quality-checklist.md']) {
    try {
      await copyFile(join(sharedSrc, file), join(sharedDst, file));
    } catch {
      logger.warn(`Shared module ${file} not found — skipping`);
    }
  }

  // Copy theme design system files into workspace for Planner/Animator access
  const themesSrc = join('/app', 'prompts', 'themes');
  const themesDst = join(WORKSPACE, 'docs', 'themes');
  try {
    await cp(themesSrc, themesDst, { recursive: true, force: false });
  } catch {
    logger.warn('Theme files not found — skipping');
  }

  // Write transcript if provided
  if (payload.transcript) {
    await writeFile(
      join(WORKSPACE, 'docs', 'transcript.json'),
      JSON.stringify(payload.transcript, null, 2),
    );
  }

  // Write user brief if provided
  if (payload.userBrief) {
    await writeFile(
      join(WORKSPACE, 'docs', 'user-brief.md'),
      payload.userBrief,
    );
  }

  // Write head-tracking data if provided
  if (payload.headTracking) {
    await writeFile(
      join(WORKSPACE, 'docs', 'speaker-grid.json'),
      JSON.stringify(payload.headTracking, null, 2),
    );
  }

  // Initialize generation progress file
  await writeFile(
    join(WORKSPACE, 'generation-progress.json'),
    JSON.stringify({
      phase: 'initialized',
      planApproved: false,
      totalScenes: 0,
      completedScenes: [],
      failedScenes: [],
      currentScene: null,
      tsVerified: false,
      lastError: null,
      updatedAt: new Date().toISOString(),
    }, null, 2),
  );

  // Initial asset sync — generate presigned URLs for downloaded media
  await syncAssets();

  logger.info('Workspace initialized');
}

/**
 * Ensure node_modules symlink exists. Runs on every boot (first boot + resume).
 */
export async function ensureNodeModulesSymlink(): Promise<void> {
  const target = join(WORKSPACE, 'node_modules');

  try {
    const existing = await readlink(target);
    if (existing === NODE_MODULES_SRC) return; // Already correct
  } catch {
    // Doesn't exist or not a symlink — create it
  }

  try {
    await symlink(NODE_MODULES_SRC, target);
    logger.info('node_modules symlinked');
  } catch (err: any) {
    if (err.code !== 'EEXIST') throw err;
  }
}
