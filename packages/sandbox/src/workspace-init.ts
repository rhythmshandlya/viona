import { mkdir, writeFile, readFile, cp, access, symlink, readlink, copyFile, rm, readdir } from 'fs/promises';
import { createWriteStream, cpSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Client as MinioClient } from 'minio';
import pino from 'pino';
import { syncAssets } from './asset-sync.js';
import { initGitRepo } from './checkpoint.js';

const execFileAsync = promisify(execFile);

const logger = pino({ name: 'workspace-init' });

const WORKSPACE = '/workspace';
const STAGING = join(WORKSPACE, '.staging');
const TEMPLATE = '/app/template';
// Workspace node_modules points to template deps (react 19, zod 3.22.3 for Remotion),
// NOT /app/node_modules (sandbox deps: react 18, zod 4.x for claude-agent-sdk).
const NODE_MODULES_SRC = '/app/template/node_modules';

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
    video?: { fps?: number; width?: number; height?: number; duration_ms?: number; total_frames?: number };
    settings?: { sample_interval?: number; samples_count?: number };
    metadata?: { detection_rate?: number; frames_processed?: number; frames_with_face?: number };
    frames: Array<{
      frame: number;
      timestamp_ms: number;
      face?: {
        bbox: { x: number; y: number; width: number; height: number };
        landmarks?: Record<string, { x: number; y: number }>;
      };
      body?: {
        left_shoulder?: { x: number; y: number; visible?: boolean };
        right_shoulder?: { x: number; y: number; visible?: boolean };
        left_hand?: { x: number; y: number; visible?: boolean };
        right_hand?: { x: number; y: number; visible?: boolean };
      };
      confidence?: number;
      detection_failed?: boolean;
    }>;
    shots?: Array<{
      frame: number;
      timestamp_ms: number;
      score: number;
      signals: string[];
    }>;
  };
  projectMeta?: {
    width: number;
    height: number;
    fps: number;
    durationMs: number;
  };
  theme?: string;  // Active theme preset slug (e.g. 'blackboard', 'magazine')
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
 * Probe width and height of a video or image file using ffprobe.
 * Returns { width, height } or null on failure.
 */
async function probeDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',
      filePath,
    ]);
    const info = JSON.parse(stdout);
    const stream = info.streams?.[0];
    if (stream?.width && stream?.height) {
      return { width: stream.width, height: stream.height };
    }
    return null;
  } catch {
    return null;
  }
}

const VIDEO_EXTS = new Set(['.mp4', '.webm']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const AUDIO_EXTS = new Set(['.aac', '.mp3', '.wav', '.m4a']);

const PROXY_SUFFIXES: Record<string, string> = {
  '.mp4': '-proxy.mp4',  '.webm': '-proxy.mp4',
  '.png': '-proxy.webp', '.jpg': '-proxy.webp', '.jpeg': '-proxy.webp', '.webp': '-proxy.webp',
  '.aac': '-proxy.aac',  '.mp3': '-proxy.aac',  '.wav': '-proxy.aac',  '.m4a': '-proxy.aac',
};

/**
 * Generate low-res proxy files for all media in the public directory.
 * Video → 480p, Image → 960px wide WebP, Audio → 64kbps mono AAC.
 * Skips files already below threshold or that already have a proxy.
 * Failures are logged and silently skipped — editor falls back to originals.
 */
async function generateProxies(publicDir: string): Promise<void> {
  const entries = await readdir(publicDir, { withFileTypes: true });
  const files = entries.filter(e => e.isFile()).map(e => e.name);

  for (const file of files) {
    if (file.includes('-proxy.')) continue;

    const ext = file.match(/\.\w+$/)?.[0]?.toLowerCase() || '';
    const suffix = PROXY_SUFFIXES[ext];
    if (!suffix) continue;

    const base = file.replace(/\.\w+$/, '');
    const input = join(publicDir, file);
    const output = join(publicDir, `${base}${suffix}`);

    try {
      if (VIDEO_EXTS.has(ext)) {
        const dims = await probeDimensions(input);
        if (dims && dims.height <= 480) {
          logger.info({ file }, 'Skipping proxy — already ≤480p');
          continue;
        }
        await execFileAsync('ffmpeg', [
          '-i', input,
          '-vf', 'scale=-2:480',
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
          '-c:a', 'aac', '-b:a', '128k',
          '-y', output,
        ], { timeout: 120_000 });
        logger.info({ file, output: `${base}${suffix}` }, 'Video proxy generated');

      } else if (IMAGE_EXTS.has(ext)) {
        const dims = await probeDimensions(input);
        if (dims && dims.width <= 960) {
          logger.info({ file }, 'Skipping proxy — already ≤960px wide');
          continue;
        }
        await execFileAsync('ffmpeg', [
          '-i', input,
          '-vf', "scale='min(960,iw)':-2",
          '-q:v', '70',
          '-y', output,
        ], { timeout: 30_000 });
        logger.info({ file, output: `${base}${suffix}` }, 'Image proxy generated');

      } else if (AUDIO_EXTS.has(ext)) {
        await execFileAsync('ffmpeg', [
          '-i', input,
          '-c:a', 'aac', '-ac', '1', '-b:a', '64k',
          '-y', output,
        ], { timeout: 60_000 });
        logger.info({ file, output: `${base}${suffix}` }, 'Audio proxy generated');
      }
    } catch (err) {
      logger.warn({ err, file }, 'Proxy generation failed — will use original');
    }
  }
}

/**
 * Check if workspace is already initialized (volume was restored from backup).
 * Verifies both manifest AND media files exist — git bundle restores exclude
 * gitignored media (source.mp4, audio.aac), so manifest alone is insufficient.
 */
export async function isInitialized(): Promise<boolean> {
  try {
    await access(join(WORKSPACE, 'manifest.json'));
    // Also verify at least the source video exists — git bundle restores
    // don't include gitignored media files, leaving a "half-initialized" state
    await access(join(WORKSPACE, 'public', 'source.mp4'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Write all init-generated files into `baseDir`.
 * This is the inner implementation — does NOT touch syncAssets or symlink recreation.
 * All file paths for CREATED content use `baseDir`; paths to pre-existing
 * Docker image files (e.g. /app/template, /app/prompts) stay absolute.
 */
interface ShotBoundary {
  timestamp_ms: number;
  frame: number;
  score: number;
  signals: string[];
  aligned: boolean;
  snappedTo_ms?: number;
  segmentBefore?: string;
  segmentAfter?: string;
}

interface ShotBoundariesFile {
  shots: ShotBoundary[];
  summary: {
    totalShots: number;
    averageShotDurationMs: number;
    alignedCount: number;
    isMultiCam: boolean;
  };
}

function alignShotsWithTranscript(
  shots: NonNullable<InitPayload['headTracking']>['shots'],
  transcript: NonNullable<InitPayload['transcript']>,
  videoDurationMs: number,
): ShotBoundariesFile {
  if (!shots || shots.length === 0) {
    return {
      shots: [],
      summary: { totalShots: 0, averageShotDurationMs: 0, alignedCount: 0, isMultiCam: false },
    };
  }

  const segments = transcript.segments;
  const boundaries: Array<{ ms: number; type: 'start' | 'end'; segIdx: number }> = [];
  for (let i = 0; i < segments.length; i++) {
    boundaries.push({ ms: segments[i].startMs, type: 'start', segIdx: i });
    boundaries.push({ ms: segments[i].endMs, type: 'end', segIdx: i });
  }
  boundaries.sort((a, b) => a.ms - b.ms);

  const SNAP_WINDOW_MS = 500;
  let alignedCount = 0;

  const alignedShots: ShotBoundary[] = shots.map((shot) => {
    let nearest: typeof boundaries[0] | null = null;
    let nearestDist = Infinity;
    for (const b of boundaries) {
      const dist = Math.abs(b.ms - shot.timestamp_ms);
      if (dist < nearestDist && dist <= SNAP_WINDOW_MS) {
        nearestDist = dist;
        nearest = b;
      } else if (dist === nearestDist && nearest && b.type === 'end') {
        nearest = b;
      }
    }

    let segmentBefore: string | undefined;
    let segmentAfter: string | undefined;
    const ts = nearest ? nearest.ms : shot.timestamp_ms;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].endMs <= ts + 100) segmentBefore = segments[i].text;
      if (segments[i].startMs >= ts - 100 && !segmentAfter) segmentAfter = segments[i].text;
    }

    if (nearest) {
      alignedCount++;
      return {
        timestamp_ms: shot.timestamp_ms,
        frame: shot.frame,
        score: shot.score,
        signals: shot.signals,
        aligned: true,
        snappedTo_ms: nearest.ms,
        segmentBefore,
        segmentAfter,
      };
    }

    return {
      timestamp_ms: shot.timestamp_ms,
      frame: shot.frame,
      score: shot.score,
      signals: shot.signals,
      aligned: false,
      segmentBefore,
      segmentAfter,
    };
  });

  const totalShots = alignedShots.length;
  const averageShotDurationMs = videoDurationMs > 0 ? Math.round(videoDurationMs / (totalShots + 1)) : 0;
  const shotsPerMinute = videoDurationMs > 0 ? totalShots / (videoDurationMs / 60000) : 0;
  const isMultiCam = totalShots > 2 && shotsPerMinute > 1.0;

  return {
    shots: alignedShots,
    summary: { totalShots, averageShotDurationMs, alignedCount, isMultiCam },
  };
}

async function initWorkspaceInDir(payload: InitPayload, baseDir: string): Promise<void> {
  // Create directory structure
  await mkdir(join(baseDir, 'src', 'segments'), { recursive: true });
  await mkdir(join(baseDir, 'src', 'components'), { recursive: true });
  await mkdir(join(baseDir, 'src', 'scenes'), { recursive: true });
  await mkdir(join(baseDir, 'public'), { recursive: true });
  await mkdir(join(baseDir, 'public', 'matte'), { recursive: true });
  await mkdir(join(baseDir, '.build'), { recursive: true });
  await mkdir(join(baseDir, '.claude'), { recursive: true });
  await mkdir(join(baseDir, 'docs'), { recursive: true });

  // Create empty scene-registry.ts stub (PlayerComposition imports it statically)
  await writeFile(join(baseDir, 'src', 'scene-registry.ts'),
    `// AUTO-GENERATED — do not edit\nimport React from 'react';\nexport const sceneRegistry: Record<string, React.ComponentType<any>> = {};\n`);

  // Download video from MinIO
  const minio = getMinioClient();
  const bucket = process.env.MINIO_BUCKET || 'viona';

  const videoPath = join(baseDir, 'public', 'source.mp4');

  logger.info({ key: payload.videoUrl }, 'Downloading source video');
  const videoStream = await minio.getObject(bucket, payload.videoUrl);
  await pipeline(videoStream, createWriteStream(videoPath));
  logger.info('Video downloaded');

  // Detect video duration with ffprobe
  const durationMs = await probeVideoDurationMs(videoPath);
  logger.info({ durationMs }, 'Video duration detected');

  // Extract audio track from video for independent playback
  const audioPath = join(baseDir, 'public', 'audio.aac');
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

  // Generate low-res proxy files for preview performance
  await generateProxies(join(baseDir, 'public'));

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

  // Write manifest + backup for reset
  const manifestStr = JSON.stringify(manifest, null, 2);
  await writeFile(join(baseDir, 'manifest.json'), manifestStr);
  await writeFile(join(baseDir, 'manifest-original.json'), manifestStr);

  // Note: manifest symlink (public/manifest.json → manifest.json) is NOT created here.
  // It's created after staging promotion in initWorkspace() to avoid EEXIST errors
  // when cpSync copies a symlink over an existing file (e.g., from git bundle restore).

  // Copy template files (composition infra, .claude/, configs).
  // Exclude node_modules — the workspace uses a symlink to /app/template/node_modules instead.
  await cp(TEMPLATE, baseDir, {
    recursive: true,
    force: false,  // Don't overwrite existing files
    filter: (src) => !src.includes('node_modules'),
  });

  // Copy shared prompt modules into workspace for orchestrator access
  const sharedSrc = join('/app', 'dist', 'prompts', 'shared');
  const sharedDst = join(baseDir, 'docs', 'shared');
  await mkdir(sharedDst, { recursive: true });
  for (const file of ['identity.xml', 'tool-usage.xml', 'manifest-tools.xml', 'quality-rules.xml', 'motion-design.xml']) {
    try {
      await copyFile(join(sharedSrc, file), join(sharedDst, file));
    } catch {
      logger.warn(`Shared module ${file} not found — skipping`);
    }
  }

  // Copy theme design system files into workspace for Planner/Animator access
  const themesSrc = join('/app', 'prompts', 'themes');
  const themesDst = join(baseDir, 'docs', 'themes');
  try {
    await cp(themesSrc, themesDst, { recursive: true, force: false });
  } catch {
    logger.warn('Theme files not found — skipping');
  }

  // Pre-generate filled design-system.md for ALL themes so the orchestrator
  // can switch themes at runtime with a simple file copy (no placeholder logic needed).
  const guidelinesDir = join(baseDir, 'docs', 'guidelines');
  await mkdir(guidelinesDir, { recursive: true });
  const activeTheme = payload.theme || 'blackboard';
  try {
    const manifest = JSON.parse(await readFile(join(themesDst, 'themes.json'), 'utf-8'));
    for (const [themeSlug, themeConfig] of Object.entries(manifest.themes || {})) {
      const config = themeConfig as { family: string; label: string; colors: Record<string, string> };
      const designSystemPath = join(themesDst, config.family, 'design-system.md');
      try {
        let designSystem = await readFile(designSystemPath, 'utf-8');
        const replacements: Record<string, string> = {
          ...config.colors,
          family: config.family,
          label: config.label,
        };
        for (const [key, value] of Object.entries(replacements)) {
          designSystem = designSystem.replaceAll(`{${key}}`, value);
        }
        // Write filled design system to docs/themes/{slug}-filled.md (ready to copy)
        await writeFile(join(themesDst, `${themeSlug}-filled.md`), designSystem);
        // Write the active theme as the default guidelines/theme.md
        if (themeSlug === activeTheme) {
          await writeFile(join(guidelinesDir, 'theme.md'), designSystem);
        }
      } catch {
        logger.warn({ themeSlug }, 'Design system file not found for theme — skipping');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to write theme design systems — skipping');
  }

  // Write transcript if provided
  if (payload.transcript) {
    const transcriptStr = JSON.stringify(payload.transcript, null, 2);
    await writeFile(
      join(baseDir, 'docs', 'transcript.json'),
      transcriptStr,
    );
    // Preserve original transcript — never modified, used by sync_transcript
    await writeFile(
      join(baseDir, 'docs', 'transcript-original.json'),
      transcriptStr,
    );
  }

  // Write user brief if provided
  if (payload.userBrief) {
    await writeFile(
      join(baseDir, 'docs', 'user-brief.md'),
      payload.userBrief,
    );
  }

  // Write shot boundaries (aligned with transcript) if shots data exists
  if (payload.headTracking?.shots && payload.headTracking.shots.length > 0 && payload.transcript) {
    const videoDurationMs = payload.headTracking.video?.duration_ms
      || payload.projectMeta?.durationMs
      || 0;
    const shotBoundaries = alignShotsWithTranscript(
      payload.headTracking.shots,
      payload.transcript,
      videoDurationMs,
    );
    await writeFile(
      join(baseDir, 'docs', 'shot-boundaries.json'),
      JSON.stringify(shotBoundaries, null, 2),
    );
    logger.info({ totalShots: shotBoundaries.summary.totalShots, isMultiCam: shotBoundaries.summary.isMultiCam }, 'Shot boundaries written');
  } else {
    // Write empty fallback so downstream tools always have a file to read
    await writeFile(
      join(baseDir, 'docs', 'shot-boundaries.json'),
      JSON.stringify({
        shots: [],
        summary: { totalShots: 0, averageShotDurationMs: 0, alignedCount: 0, isMultiCam: false },
      }, null, 2),
    );
  }
}

/**
 * Initialize workspace on first boot using atomic staging pattern.
 * Writes all files to /workspace/.staging first, then promotes to /workspace
 * on success. If init fails mid-way, the staging dir is cleaned up and the
 * workspace is left untouched.
 */
export async function initWorkspace(payload: InitPayload): Promise<void> {
  logger.info('Initializing workspace (first boot) — using staging directory');

  // Clean any previous failed staging attempt
  rmSync(STAGING, { recursive: true, force: true });

  // Create fresh staging directory
  mkdirSync(STAGING, { recursive: true });

  try {
    // Write all init files into staging
    await initWorkspaceInDir(payload, STAGING);

    // Promote: copy staging contents into workspace root
    // Using cpSync (not rename) because staging and workspace may be on different mount points
    cpSync(STAGING, WORKSPACE, { recursive: true, force: true });

    // Recreate symlink — cpSync turns symlinks into regular file copies
    // Remove the copied regular file first, then create proper symlink
    try {
      await rm(join(WORKSPACE, 'public', 'manifest.json'), { force: true });
      await symlink(
        join(WORKSPACE, 'manifest.json'),
        join(WORKSPACE, 'public', 'manifest.json'),
      );
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Clean up staging directory
    rmSync(STAGING, { recursive: true, force: true });

    // Asset sync runs after promotion — it reads/writes /workspace directly
    await syncAssets();

    // Initialize git repo for checkpoint system
    await initGitRepo();

    logger.info('Workspace initialized');
  } catch (err) {
    // Clean up staging on failure
    logger.error({ err }, 'Workspace init failed — cleaning up staging directory');
    rmSync(STAGING, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Reset workspace to post-init state. Keeps video, audio, transcript, docs.
 * Clears all generated content (scenes, plan) and restores original manifest.
 */
export async function resetWorkspace(): Promise<void> {
  logger.info('Resetting workspace to initial state');

  // Clear generated scene files
  rmSync(join(WORKSPACE, 'src', 'scenes'), { recursive: true, force: true });
  mkdirSync(join(WORKSPACE, 'src', 'scenes'), { recursive: true });

  // Clear generated components (Background.tsx etc.)
  rmSync(join(WORKSPACE, 'src', 'components'), { recursive: true, force: true });
  mkdirSync(join(WORKSPACE, 'src', 'components'), { recursive: true });

  // Reset scene registry to empty
  await writeFile(join(WORKSPACE, 'src', 'scene-registry.ts'),
    `// AUTO-GENERATED — do not edit\nimport React from 'react';\nexport const sceneRegistry: Record<string, React.ComponentType<any>> = {};\n`);

  // Restore original manifest
  try {
    await copyFile(
      join(WORKSPACE, 'manifest-original.json'),
      join(WORKSPACE, 'manifest.json'),
    );
    logger.info('Manifest restored from original');
  } catch {
    logger.warn('No manifest-original.json found — manifest unchanged');
  }

  // Clear plan files from both possible locations (root and docs/)
  await rm(join(WORKSPACE, 'SCENE_PLAN.md'), { force: true });
  await rm(join(WORKSPACE, 'docs', 'SCENE_PLAN.md'), { force: true });

  // Clear .build output
  rmSync(join(WORKSPACE, '.build'), { recursive: true, force: true });
  mkdirSync(join(WORKSPACE, '.build'), { recursive: true });

  logger.info('Workspace reset complete');
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
