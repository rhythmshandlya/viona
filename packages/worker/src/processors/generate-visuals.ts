/**
 * Visual Generation Processor
 *
 * Uses Claude Code (Agent SDK) with OAuth authentication from Claude Pro/Max subscription.
 * No API key costs - included in subscription.
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { mkdir, rm, writeFile, readFile, readdir, stat, copyFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { db, projects, tracks, timelineItems, transcripts, jobs, visuals, projectAssets } from '../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError, registerCancelHandler, unregisterCancelHandler, setJobProjectId } from '../services/redis.js';
import { startHeartbeatProgress } from '../utils/heartbeat-progress.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getWorkspacePath, createProjectDir } from '../workspace.js';
import { uploadFile, downloadFile } from '../services/minio.js';
import { buildStudioTemplateCatalog } from '../prompts/studio-templates.js';
import { listTemplates } from '@viona/templates';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Track running processes for cancellation
const runningProcesses = new Map<string, ChildProcess>();

// Find the packages/ root by walking up from __dirname to find the worker's
// package.json, then taking its parent. Works in both local dev and Docker:
//   Local:  src/processors/ → 2 parents to packages/worker
//   Docker: dist/           → 1 parent to packages/worker
function findPackagesRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'package.json'))) {
      return dirname(dir); // parent of packages/worker = packages/
    }
    dir = dirname(dir);
  }
  return resolve(__dirname, '..', '..', '..');
}

// ---------------------------------------------------------------------------
// Recursively copy a directory tree (used for template source files)
// ---------------------------------------------------------------------------
async function copyDirRecursive(src: string, dest: string): Promise<void> {
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDirRecursive(srcPath, destPath);
    } else {
      const content = await readFile(srcPath, 'utf-8');
      await writeFile(destPath, content, 'utf-8');
    }
  }
}

// ---------------------------------------------------------------------------
// Speaker grid computation (mirrors asset-server.js get_speaker_grid logic)
// ---------------------------------------------------------------------------

interface HeadTrackingFrame {
  timestamp_ms: number;
  face?: { bbox?: { x: number; y: number; width: number; height: number } };
}

interface SpeakerGrid {
  grid: number[][];
  occupancy: string;
  safePlacement: string[];
}

/**
 * Compute a 6x6 speaker occupancy grid for a time range from head tracking data.
 * Cells are marked 1 if the speaker's face overlaps them in >30% of frames.
 *
 * videoWidth/videoHeight are the source video pixel dimensions, used to normalize
 * the pixel-coordinate bboxes from detect_head.py into 0-1 fractions.
 */
function computeSpeakerGrid(
  headTrackingData: { frames?: HeadTrackingFrame[]; video?: { width: number; height: number } },
  startMs: number,
  endMs: number,
  rows = 6,
  cols = 6,
): SpeakerGrid {
  const frames = headTrackingData.frames || [];
  const videoW = headTrackingData.video?.width || 1;
  const videoH = headTrackingData.video?.height || 1;

  // Filter frames by time range, only those with a face bbox
  const filtered = frames.filter(
    (f) => f.timestamp_ms >= startMs && f.timestamp_ms <= endMs && f.face?.bbox,
  );

  if (filtered.length === 0) {
    return {
      grid: Array.from({ length: rows }, () => Array(cols).fill(0)),
      occupancy: '0%',
      safePlacement: ['entire frame'],
    };
  }

  // Build grid: project each face bbox onto the grid
  const cellHits = Array.from({ length: rows }, () => Array(cols).fill(0) as number[]);

  for (const frame of filtered) {
    const b = frame.face!.bbox!;
    // Normalize pixel-coordinate bbox to 0-1 fractions
    const bx1 = b.x / videoW;
    const by1 = b.y / videoH;
    const bx2 = (b.x + b.width) / videoW;
    const by2 = (b.y + b.height) / videoH;

    for (let r = 0; r < rows; r++) {
      const cellY1 = r / rows;
      const cellY2 = (r + 1) / rows;
      for (let c = 0; c < cols; c++) {
        const cellX1 = c / cols;
        const cellX2 = (c + 1) / cols;
        if (bx1 < cellX2 && bx2 > cellX1 && by1 < cellY2 && by2 > cellY1) {
          cellHits[r][c]++;
        }
      }
    }
  }

  // Mark cells occupied if speaker present in >30% of filtered frames
  const threshold = filtered.length * 0.3;
  const grid = cellHits.map((row) => row.map((count) => (count >= threshold ? 1 : 0)));

  // Compute occupancy
  const totalCells = rows * cols;
  const occupiedCells = grid.flat().filter((v) => v === 1).length;
  const occupancy = `${Math.round((occupiedCells / totalCells) * 100)}%`;

  // Compute safe placement regions
  const safePlacement: string[] = [];
  const midRow = Math.floor(rows / 2);
  const midCol = Math.floor(cols / 2);

  const regions: Record<string, () => boolean> = {
    'top-left':     () => grid.slice(0, midRow).flatMap((r) => r.slice(0, midCol)).every((v) => v === 0),
    'top-right':    () => grid.slice(0, midRow).flatMap((r) => r.slice(midCol)).every((v) => v === 0),
    'bottom-left':  () => grid.slice(midRow).flatMap((r) => r.slice(0, midCol)).every((v) => v === 0),
    'bottom-right': () => grid.slice(midRow).flatMap((r) => r.slice(midCol)).every((v) => v === 0),
    'top':          () => grid[0].every((v) => v === 0),
    'bottom':       () => grid[rows - 1].every((v) => v === 0),
    'left':         () => grid.every((r) => r[0] === 0),
    'right':        () => grid.every((r) => r[cols - 1] === 0),
  };

  for (const [name, check] of Object.entries(regions)) {
    if (check()) safePlacement.push(name);
  }

  return { grid, occupancy, safePlacement };
}

/**
 * Asset type for extracted components
 */
interface ExtractedAsset {
  id: string;
  name: string;
  type: 'component' | 'element' | 'text' | 'shape' | 'icon' | 'background';
  sceneId: number;
  sceneName: string;
  description: string;
  position?: { x: string; y: string };
  size?: { width: string; height: string };
}

/**
 * Extract assets from the generated composition.
 * Reads scenes.json and parses layout information to create a list of editable assets.
 */
async function extractAssets(projectDir: string): Promise<ExtractedAsset[]> {
  const assets: ExtractedAsset[] = [];

  try {
    // Read scenes.json
    const scenesPath = join(projectDir, 'scenes.json');
    const scenesContent = await readFile(scenesPath, 'utf-8');
    const scenesData = JSON.parse(scenesContent);

    if (!scenesData.scenes || !Array.isArray(scenesData.scenes)) {
      logger.warn({ projectDir }, 'No scenes found in scenes.json');
      return assets;
    }

    // Extract assets from each scene's layout
    for (const scene of scenesData.scenes) {
      const sceneId = scene.id;
      const sceneName = scene.name || `Scene ${sceneId}`;

      if (scene.layout && typeof scene.layout === 'object') {
        for (const [key, value] of Object.entries(scene.layout as Record<string, any>)) {
          // Skip background elements
          if (key === 'background') continue;

          // Determine asset type based on name
          let assetType: ExtractedAsset['type'] = 'element';
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('text') || lowerKey.includes('title') || lowerKey.includes('label')) {
            assetType = 'text';
          } else if (lowerKey.includes('icon')) {
            assetType = 'icon';
          } else if (lowerKey.includes('shape') || lowerKey.includes('circle') || lowerKey.includes('rect')) {
            assetType = 'shape';
          } else if (lowerKey.includes('particle') || lowerKey.includes('bg')) {
            assetType = 'background';
          }

          assets.push({
            id: `scene${sceneId}-${key}`,
            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
            type: assetType,
            sceneId,
            sceneName,
            description: scene.visual || sceneName,
            position: value?.x || value?.y ? { x: value.x || 'center', y: value.y || '50%' } : undefined,
            size: value?.width || value?.height ? { width: value.width || 'auto', height: value.height || 'auto' } : undefined,
          });
        }
      }

      // Also check for icons array
      if (scene.icons && Array.isArray(scene.icons)) {
        for (const icon of scene.icons) {
          assets.push({
            id: `scene${sceneId}-icon-${icon.name || icon}`,
            name: typeof icon === 'string' ? icon : icon.name,
            type: 'icon',
            sceneId,
            sceneName,
            description: `Icon in ${sceneName}`,
          });
        }
      }
    }

    // Write assets.json to project directory
    const assetsPath = join(projectDir, 'assets.json');
    await writeFile(assetsPath, JSON.stringify({ assets, extractedAt: new Date().toISOString() }, null, 2));
    logger.info({ projectDir, assetCount: assets.length }, 'Extracted assets from composition');

  } catch (error) {
    logger.warn({ projectDir, error }, 'Failed to extract assets from composition');
  }

  return assets;
}

// Environment validation results (cached after first check)
let environmentValidated = false;
let environmentError: string | null = null;

/**
 * Validate that Python and Claude Agent SDK are available.
 * Call this at worker startup to fail fast if dependencies are missing.
 */
export async function validateEnvironment(): Promise<{ valid: boolean; error?: string }> {
  if (environmentValidated) {
    return environmentError ? { valid: false, error: environmentError } : { valid: true };
  }

  try {
    // Check Python is available
    const pythonPath = config.pythonPath;
    const pythonCheck = spawn(pythonPath, ['--version'], { stdio: 'pipe' });
    const pythonResult = await new Promise<{ code: number | null; output: string }>((resolve) => {
      let output = '';
      pythonCheck.stdout?.on('data', (data) => { output += data.toString(); });
      pythonCheck.stderr?.on('data', (data) => { output += data.toString(); });
      pythonCheck.on('close', (code) => resolve({ code, output }));
      pythonCheck.on('error', () => resolve({ code: -1, output: 'Python not found' }));
    });

    if (pythonResult.code !== 0) {
      environmentError = `Python not available: ${pythonResult.output}`;
      environmentValidated = true;
      return { valid: false, error: environmentError };
    }

    logger.info({ pythonVersion: pythonResult.output.trim() }, 'Python version detected');

    // Check Claude Code CLI is available
    const claudeCheck = spawn('claude', ['--version'], { stdio: 'pipe', shell: true });
    const claudeResult = await new Promise<{ code: number | null; output: string }>((resolve) => {
      let output = '';
      claudeCheck.stdout?.on('data', (data) => { output += data.toString(); });
      claudeCheck.stderr?.on('data', (data) => { output += data.toString(); });
      claudeCheck.on('close', (code) => resolve({ code, output }));
      claudeCheck.on('error', () => resolve({ code: -1, output: 'Claude Code CLI not found' }));
    });

    if (claudeResult.code !== 0) {
      environmentError = `Claude Code CLI not available. Install from: https://github.com/anthropics/claude-code\nError: ${claudeResult.output}`;
      environmentValidated = true;
      return { valid: false, error: environmentError };
    }

    logger.info({ claudeVersion: claudeResult.output.trim() }, 'Claude Code CLI detected');

    environmentValidated = true;
    return { valid: true };

  } catch (error) {
    environmentError = `Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    environmentValidated = true;
    return { valid: false, error: environmentError };
  }
}

export function cancelJob(jobId: string): boolean {
  const process = runningProcesses.get(jobId);
  if (process) {
    logger.info({ jobId }, 'Cancelling Claude Code generator');
    process.kill('SIGTERM');
    runningProcesses.delete(jobId);
    return true;
  }
  return false;
}

export function getRunningJobs(): string[] {
  return Array.from(runningProcesses.keys());
}

/**
 * Upload bundle directory to S3 storage.
 * Uploads all files in the bundle directory to outputs/bundles/{compositionId}/
 */
async function uploadBundleToStorage(bundleDir: string, compositionId: string): Promise<void> {
  const files = await readdir(bundleDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      // Get relative path from bundle dir
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(bundleDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      // Upload to S3: outputs/bundles/{compositionId}/{relativePath}
      const s3Key = `bundles/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  logger.info({ compositionId, bundleDir }, 'Bundle uploaded to S3');
}

/**
 * Upload source project directory to S3 storage.
 * Uploads ALL source files to outputs/sources/{compositionId}/ including:
 * - SCENE_PLAN.md - Director's visual story plan
 * - IMPLEMENTATION_LOG.md - Implementation decisions and reasoning
 * - scenes.json - Scene definitions with timing
 * - metadata.json - Composition metadata
 * - index.tsx - Main composition code
 * - constants.ts - Colors, timing, spring configs
 * - components/*.tsx - Reusable components (Background, etc.)
 * - scenes/*.tsx - Individual scene components
 *
 * This preserves the full AI context so users can continue editing later.
 */
async function uploadSourceToStorage(projectDir: string, compositionId: string): Promise<string> {
  const files = await readdir(projectDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      // Get relative path from project dir
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(projectDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      // Upload to S3: outputs/sources/{compositionId}/{relativePath}
      const s3Key = `sources/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  const sourceUrl = `/api/sources/${compositionId}`;
  logger.info({ compositionId, projectDir, sourceUrl }, 'Source project files uploaded to S3');
  return sourceUrl;
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
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio' | 'kinetic-typography';
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

interface VisualMetadata {
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

interface JobMetrics {
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

interface ClaudeCodeResult {
  bundleUrl: string;
  bundlePath: string;
  filesWritten: number;
  durationMs: number;
  status: string;
}

/**
 * Inject user-uploaded assets into the workspace for the Animator to use.
 * Downloads from MinIO → public/assets/user/ and writes user_assets.json manifest.
 */
async function injectUserAssets(projectId: string, projectDir: string): Promise<number> {
  const workspacePath = getWorkspacePath();
  const assets = await db.select().from(projectAssets)
    .where(eq(projectAssets.projectId, projectId));

  if (assets.length === 0) return 0;

  const userAssetsDir = join(workspacePath, 'public', 'assets', 'user');
  await mkdir(userAssetsDir, { recursive: true });

  const manifest: { assets: Array<{ filename: string; label: string; contentType: string; remotionPath: string }> } = { assets: [] };

  for (const asset of assets) {
    // Sanitize filename for safe staticFile() paths, add ID suffix to prevent collisions
    const extMatch = asset.filename.match(/\.[^.]+$/);
    const extPart = extMatch ? extMatch[0] : '';
    const basePart = asset.filename.replace(/\.[^.]+$/, '').replace(/[^\w.-]/g, '_');
    const safeFilename = `${basePart}_${asset.id.slice(0, 8)}${extPart}`;
    const destPath = join(userAssetsDir, safeFilename);
    try {
      await downloadFile('uploads', asset.storageKey, destPath);
      manifest.assets.push({
        filename: safeFilename,
        label: asset.label || asset.filename.replace(/\.[^.]+$/, ''),
        contentType: asset.contentType,
        remotionPath: `assets/user/${safeFilename}`,
      });
    } catch (err) {
      logger.warn({ err, assetId: asset.id, storageKey: asset.storageKey }, 'Failed to download user asset');
    }
  }

  // Write manifest to project src dir so the Animator can read it
  const manifestPath = join(projectDir, 'user_assets.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  logger.info({ projectId, assetCount: manifest.assets.length }, 'Injected user assets into workspace');

  return manifest.assets.length;
}

/**
 * Video asset manifest for render phase — maps scene indices to video clips.
 */
interface VideoAssetEntry {
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

interface VideoManifest {
  videos: VideoAssetEntry[];
}

/**
 * Prepare video assets manifest from user's video selections.
 * This manifest is used by the render processor to download clips for final export.
 */
async function prepareVideoAssets(
  selectedVideos: Record<number, Record<string, VideoSelection>> | undefined,
  projectDir: string
): Promise<VideoManifest> {
  const manifest: VideoManifest = { videos: [] };

  if (!selectedVideos) return manifest;

  for (const [sceneIndexStr, keywords] of Object.entries(selectedVideos)) {
    const sceneIndex = parseInt(sceneIndexStr, 10);
    for (const [keyword, selection] of Object.entries(keywords as Record<string, VideoSelection>)) {
      manifest.videos.push({
        sceneId: String(sceneIndex + 1), // 1-indexed scene ID
        keyword,
        videoId: selection.videoId,
        sourceUrl: selection.url,
        title: selection.title,
        thumbnailUrl: selection.thumbnailUrl,
        trimStart: 0,
        trimEnd: 30, // Default 30s clip
      });
    }
  }

  if (manifest.videos.length > 0) {
    // Write manifest for render phase
    const manifestPath = join(projectDir, 'video_assets.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    logger.info({ projectDir, videoCount: manifest.videos.length }, 'Wrote video_assets.json manifest');
  }

  return manifest;
}

export async function processGenerateVisualsJob(job: Job<GenerateVisualsJobData>) {
  const { projectId, jobId, stylePreset, layoutMode, dimensions, styleGuide } = job.data;
  setJobProjectId(jobId, projectId);
  const compositionId = `proj_${projectId.replace(/-/g, '_')}`;

  // Proactive lock extension — prevents BullMQ from marking 30-min jobs as stalled
  const lockExtender = setInterval(async () => {
    try {
      await job.extendLock(job.token!, 120_000);
    } catch (err) {
      logger.error({ jobId, err }, 'Lock extension failed');
    }
  }, 55_000);

  // Declared outside try so catch block can stop it on failure
  let heartbeat: { stop: () => void; raiseWaterMark: (p: number) => void } | null = null;

  try {
    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading project...');

    // Load project and transcript
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.projectId, projectId),
    });

    if (!transcript || !transcript.words) {
      throw new Error('Project has no transcript');
    }

    await publishJobProgress(jobId, 10, 'Preparing workspace...');

    // Clean up old composition directories in workspace
    const workspacePath = getWorkspacePath();
    const srcDir = join(workspacePath, 'src');
    try {
      const entries = await readdir(srcDir);
      for (const entry of entries) {
        if (entry.startsWith('proj_') && entry !== compositionId) {
          const oldDir = join(srcDir, entry);
          logger.info({ oldDir, compositionId }, 'Removing stale composition directory');
          await rm(oldDir, { recursive: true, force: true });
        }
      }
    } catch (e) {
      logger.debug({ srcDir, error: e }, 'Could not clean old compositions (may not exist yet)');
    }

    // Check if previous attempt left any artifacts worth preserving for checkpoint resume.
    // If scenes.json exists, preserve the directory — the Python agent's checkpoint logic
    // will detect what phase to resume from (scenes only, setup+scenes, full pipeline, etc.).
    const projectDir = join(workspacePath, 'src', compositionId);
    const scenesJsonPath = join(projectDir, 'scenes.json');
    let hasExistingSources = false;
    try {
      await readFile(scenesJsonPath);
      hasExistingSources = true;
      logger.info({ projectDir }, 'Previous scenes.json found — preserving for checkpoint resume');
    } catch {
      // No artifacts worth preserving — clean and start fresh
      try {
        await rm(projectDir, { recursive: true, force: true });
        logger.info({ projectDir }, 'Cleaned stale project directory');
      } catch {
        // Directory may not exist yet — that's fine
      }
    }
    createProjectDir(compositionId); // mkdir -p is idempotent
    logger.info({ projectDir, compositionId, hasExistingSources }, 'Project directory ready');

    // Write head tracking data for spatial overlay awareness
    if (project.headTrackingData) {
      const htPath = join(projectDir, 'head_tracking.json');
      await writeFile(htPath, JSON.stringify(project.headTrackingData), 'utf-8');
      logger.info({ projectDir }, 'Wrote head_tracking.json for spatial overlay');
    }

    // Inject user-uploaded assets (logos, icons, brand images) into workspace
    const userAssetCount = await injectUserAssets(projectId, projectDir);
    if (userAssetCount > 0) {
      logger.info({ projectId, userAssetCount }, 'User assets injected into workspace');
    }

    // Prepare video assets manifest from user selections (for render phase)
    const videoManifest = await prepareVideoAssets(job.data.selectedVideos, projectDir);

    // If this is an Animator-only run (plan was created separately), write plan files to project dir
    // Also enrich scenes.json with per-scene effectiveDimensions
    const canvasWidth = dimensions?.width || 1080;
    const canvasHeight = dimensions?.height || 1920;
    const pipEffective = job.data.pipEffective || { width: canvasWidth, height: canvasHeight };

    if (job.data.planJobId) {
      // Detect if the plan changed (e.g. after "start over") by comparing the planJobId
      // to a marker file. If it changed, old generation artifacts (constants.ts, Scene*.tsx,
      // index.tsx) are stale and must be cleaned to prevent the checkpoint system from
      // resuming with scene files that don't match the new plan.
      const planMarkerPath = join(projectDir, '.plan_job_id');
      if (hasExistingSources) {
        let planChanged = false;
        try {
          const existingPlanJobId = (await readFile(planMarkerPath, 'utf-8')).trim();
          planChanged = existingPlanJobId !== job.data.planJobId;
        } catch {
          // No marker file → assume plan changed (safe default)
          planChanged = true;
        }
        if (planChanged) {
          logger.info({ projectDir, planJobId: job.data.planJobId }, 'Plan changed — cleaning stale generation artifacts');
          const scenesDir = join(projectDir, 'scenes');
          await rm(scenesDir, { recursive: true, force: true }).catch(() => {});
          for (const f of ['constants.ts', 'index.tsx', 'metadata.json']) {
            await rm(join(projectDir, f), { force: true }).catch(() => {});
          }
        }
      }
      await writeFile(planMarkerPath, job.data.planJobId, 'utf-8');

      const planJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.data.planJobId) });
      if (planJob?.planData) {
        const pd = planJob.planData as { scenePlan: string; scenes: Record<string, unknown> };
        // Write plan files to projectDir (workspace/src/{compositionId}) — the Python
        // generator receives compositionId as --project-id, so it looks there.
        const scenePlanPath = join(projectDir, 'SCENE_PLAN.md');
        await writeFile(scenePlanPath, pd.scenePlan, 'utf-8');

        // Enrich scenes with per-scene effectiveDimensions before writing
        const scenesObj = pd.scenes as Record<string, unknown>;
        const scenesArray = (scenesObj.scenes as Array<Record<string, unknown>>) || [];
        const fps = project.fps || 30;
        for (const scene of scenesArray) {
          const dm = (scene.displayMode as string) || 'default';
          if (dm === 'fullscreen' || dm === 'overlay') {
            scene.effectiveDimensions = { width: canvasWidth, height: canvasHeight };
          } else {
            scene.effectiveDimensions = { width: pipEffective.width, height: pipEffective.height };
          }

          // Pre-inject speaker grid for overlay scenes so the animator doesn't need to call a tool
          if (dm === 'overlay' && project.headTrackingData) {
            const frames = scene.frames as [number, number] | undefined;
            if (frames) {
              const startMs = (frames[0] / fps) * 1000;
              const endMs = (frames[1] / fps) * 1000;
              scene.speakerGrid = computeSpeakerGrid(
                project.headTrackingData as { frames?: HeadTrackingFrame[]; video?: { width: number; height: number } },
                startMs,
                endMs,
              );
            }
          }

          // Enrich scenes with video indicator for Animator awareness
          const sceneIdStr = String(scene.id);
          const sceneVideo = videoManifest.videos.find(v => v.sceneId === sceneIdStr);
          if (sceneVideo) {
            scene.hasVideo = true;
            scene.videoKeyword = sceneVideo.keyword;
          }
        }
        await writeFile(scenesJsonPath, JSON.stringify({ ...scenesObj, scenes: scenesArray }, null, 2), 'utf-8');
        logger.info({ projectDir, planJobId: job.data.planJobId, sceneCount: scenesArray.length }, 'Wrote enriched plan files from plan job for Animator-only run');
      } else {
        logger.warn({ planJobId: job.data.planJobId }, 'Plan job not found or has no planData');
      }
    }

    // Update workspace Root.tsx and index.ts to import from the correct project ID.
    // This prevents TypeScript import errors and eliminates the self-healing cycle.
    const compositionIdDashed = compositionId.replace(/_/g, '-'); // e.g. proj-abc-def
    const rootTsx = join(workspacePath, 'src', 'Root.tsx');
    const indexTs = join(workspacePath, 'src', 'index.ts');
    try {
      const durationFrames = Math.ceil(((project.durationMs || 60000) / 1000) * (project.fps || 30));
      await writeFile(rootTsx, `import "./index.css";
import { Composition } from "remotion";
import MainComposition from "./${compositionId}";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="${compositionIdDashed}"
        component={MainComposition}
        durationInFrames={${durationFrames}}
        fps={${project.fps || 30}}
        width={${dimensions?.width || 1080}}
        height={${dimensions?.height || 1920}}
      />
    </>
  );
};
`, 'utf-8');
      await writeFile(indexTs, `import { registerRoot } from "remotion";
import { RemotionRoot } from "./${compositionId}/index";

registerRoot(RemotionRoot);
`, 'utf-8');
      logger.info({ compositionId }, 'Updated Root.tsx and index.ts with correct project imports');
    } catch (e) {
      logger.warn({ error: e }, 'Failed to update Root.tsx/index.ts — self-heal will fix it');
    }

    // Write Studio template catalog + source files to workspace when studio style is selected
    if (stylePreset === 'studio') {
      await publishJobProgress(jobId, 13, 'Loading studio templates...');
      try {
        const srcDir = join(workspacePath, 'src');
        const templatesDir = join(srcDir, '.templates');
        await mkdir(templatesDir, { recursive: true });

        // Write template catalog markdown
        const catalog = buildStudioTemplateCatalog();
        await writeFile(join(srcDir, 'STUDIO_TEMPLATES.md'), catalog, 'utf-8');

        // Copy template source files so the Animator agent can read them.
        // Read directly from the monorepo source tree instead of using getTemplateFiles()
        // which is broken after bundling (import.meta.url resolves to dist/ on Windows).
        const templatesSrcRoot = join(findPackagesRoot(), 'templates', 'src', 'templates');
        const studioTemplates = listTemplates({ theme: 'studio' });
        for (const t of studioTemplates) {
          const tDir = join(templatesDir, t.meta.slug);
          await mkdir(tDir, { recursive: true });
          try {
            const tSrcDir = join(templatesSrcRoot, t.meta.slug);
            await copyDirRecursive(tSrcDir, tDir);
          } catch (err) {
            logger.warn({ slug: t.meta.slug, err }, 'Failed to copy template files');
          }
        }

        logger.info({ templateCount: studioTemplates.length, templatesDir }, 'Studio templates written to workspace');
      } catch (err) {
        logger.warn({ err }, 'Failed to write studio templates to workspace (non-fatal)');
      }
    }

    await publishJobProgress(jobId, 15, 'Starting Claude Code generator...');

    // Start heartbeat progress to prevent stall detection during long SDK calls.
    // The exponential decay curve fills gaps between Python PROGRESS: lines (15→68 over ~20 min).
    // Python's specific checkpoints (19, 35, 55, etc.) override the heartbeat when they fire,
    // and pollJobProgress's highWaterMark ensures the frontend only sees monotonic increases.
    heartbeat = startHeartbeatProgress(jobId, 15, 68, 20 * 60 * 1000);

    // Calculate duration in frames
    const durationFrames = Math.ceil(((project.durationMs || 60000) / 1000) * (project.fps || 30));

    // Prepare transcript text and words
    const words = transcript.words as any[];
    const transcriptText = words
      .map((w: any) => w.word || w.text || '')
      .join(' ');

    // Run Claude Agent generator (always uses two-phase pipeline)
    const llmModel = config.claudeAgent.model;
    const claudeResult = await runClaudeCodeGenerator({
      projectId: compositionId,
      jobId,
      transcript: transcriptText,
      words,  // Always pass words for two-phase pipeline
      durationFrames,
      fps: project.fps || 30,
      width: canvasWidth,
      height: canvasHeight,
      stylePreset: stylePreset || 'modern',
      layoutMode: layoutMode || 'pip',
      styleGuide,
      planJobId: job.data.planJobId,
      pipWidth: pipEffective.width,
      pipHeight: pipEffective.height,
      onProgress: (percent) => heartbeat?.raiseWaterMark(percent),
    });

    // Store metrics in job (no token cost for OAuth)
    const jobMetrics: JobMetrics = {
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      durationMs: claudeResult.durationMs,
      llmModel,
      filesWritten: claudeResult.filesWritten,
      screenshotsTaken: 0,
      finalScore: 100,
      totalIterations: 1,
      status: claudeResult.status,
    };

    await db.update(jobs)
      .set({ metrics: jobMetrics, logs: [`Claude Code generator completed in ${claudeResult.durationMs}ms`] })
      .where(eq(jobs.id, jobId));

    logger.info({ projectId, jobMetrics }, 'Job metrics recorded');

    heartbeat?.stop();

    // Always upload sources immediately after agent completes — even if bundling fails later.
    // This preserves the AI-generated code so retries can pick up where we left off.
    const earlyBundleCompositionId = compositionId.replace(/_/g, '-');
    try {
      await uploadSourceToStorage(projectDir, earlyBundleCompositionId);
      logger.info({ projectId }, 'Sources uploaded (pre-bundle) for failure recovery');
    } catch (err) {
      logger.warn({ projectId, err }, 'Pre-bundle source upload failed (non-fatal)');
    }

    await publishJobProgress(jobId, 70, 'Reading metadata...');

    // Read metadata file that the agent should have created
    const metadataPath = join(projectDir, 'metadata.json');
    const scenesPath = join(projectDir, 'scenes.json');
    let metadata: VisualMetadata;

    try {
      const metadataContent = await readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);

      if (!metadata.compositionId || typeof metadata.durationInFrames !== 'number') {
        throw new Error('Invalid metadata.json: missing required fields');
      }

      // Try to read scenes.json for detailed scene information
      try {
        const scenesContent = await readFile(scenesPath, 'utf-8');
        const scenesData = JSON.parse(scenesContent);

        if (scenesData.scenes && Array.isArray(scenesData.scenes) && scenesData.scenes.length > 0) {
          // Convert scenes.json format to timestamps format for the database
          metadata.visuals = scenesData.scenes.map((scene: any) => {
            // Extract elements from layout if present
            const elements: Array<{
              id: string;
              name: string;
              type: string;
              x: string;
              y: string;
              width: string;
              height: string;
            }> = [];

            if (scene.layout && typeof scene.layout === 'object') {
              Object.entries(scene.layout).forEach(([key, value]: [string, any]) => {
                if (value && typeof value === 'object') {
                  elements.push({
                    id: `scene${scene.id}-${key}`,
                    name: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize
                    type: key,
                    x: value.x || 'center',
                    y: value.y || '50%',
                    width: value.width || '100%',
                    height: value.height || '100%',
                  });
                }
              });
            }

            return {
              startMs: Math.round(scene.timestampRange[0] * 1000),
              endMs: Math.round(scene.timestampRange[1] * 1000),
              type: scene.name || `Scene ${scene.id}`,
              description: scene.visual || scene.emotion || '',
              displayMode: scene.displayMode || undefined,
              transition: scene.transition || undefined,
              elements: elements.length > 0 ? elements : undefined,
            };
          });
          logger.info({ projectId, sceneCount: metadata.visuals.length }, 'Loaded scenes from scenes.json');
        }
      } catch (scenesErr) {
        logger.warn({ projectId, error: scenesErr }, 'Could not read scenes.json, falling back to metadata.visuals');
      }

      if (!metadata.visuals || !Array.isArray(metadata.visuals)) {
        throw new Error('Invalid metadata.json: visuals must be an array');
      }

      if (metadata.visuals.length === 0) {
        throw new Error('Agent completed but generated no visuals.');
      }

      logger.info({ projectId, visualCount: metadata.visuals.length }, 'Metadata validated successfully');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error reading metadata';

      // Check if the index.tsx file was at least created
      const indexPath = join(projectDir, 'index.tsx');
      let indexExists = false;
      try {
        await readFile(indexPath, 'utf-8');
        indexExists = true;
      } catch {
        // Index doesn't exist
      }

      if (!indexExists) {
        throw new Error(`Agent failed to generate any code. ${errorMsg}`);
      }

      // Create minimal fallback metadata
      logger.warn({ projectId, error: errorMsg }, 'Metadata missing, using fallback');
      metadata = {
        compositionId,
        durationInFrames: durationFrames,
        fps: project.fps || 30,
        width: canvasWidth,
        height: canvasHeight,
        visuals: [{
          startMs: 0,
          endMs: project.durationMs || 60000,
          type: 'generated',
          description: 'AI-generated visual',
        }],
      };
    }

    await publishJobProgress(jobId, 80, 'Verifying bundle...');

    // Verify bundle exists
    const bundleCompositionId = compositionId.replace(/_/g, '-');
    const bundleDir = join(config.remotion.bundleOutputDir, bundleCompositionId);
    const bundleIndex = join(bundleDir, 'index.html');

    try {
      await readFile(bundleIndex);
      logger.info({ projectId, bundleDir }, 'Bundle verified');
    } catch (err) {
      throw new Error(`Bundle not found at ${bundleDir}. Generator may have failed to create it.`);
    }

    // Ensure user assets are in the bundle (Remotion bundle may not always copy them)
    const userAssetsSource = join(getWorkspacePath(), 'public', 'assets', 'user');
    if (existsSync(userAssetsSource)) {
      const userAssetsDest = join(bundleDir, 'public', 'assets', 'user');
      await mkdir(userAssetsDest, { recursive: true });
      const userFiles = await readdir(userAssetsSource);
      for (const f of userFiles) {
        await copyFile(join(userAssetsSource, f), join(userAssetsDest, f));
      }
      if (userFiles.length > 0) {
        logger.info({ count: userFiles.length }, 'Copied user assets into bundle');
      }
    }

    // Upload bundle to S3 for production persistence
    await publishJobProgress(jobId, 82, 'Uploading bundle to storage...');
    await uploadBundleToStorage(bundleDir, bundleCompositionId);

    // Sources already uploaded pre-bundle (for failure recovery).
    const sourceUrl = `/api/sources/${bundleCompositionId}`;

    // Extract assets from composition for frontend selection
    await publishJobProgress(jobId, 84, 'Extracting assets...');
    const extractedAssets = await extractAssets(projectDir);

    // Upload assets.json to S3 as well
    const assetsPath = join(projectDir, 'assets.json');
    try {
      await uploadFile('outputs', `sources/${bundleCompositionId}/assets.json`, assetsPath);
      logger.info({ projectId, assetCount: extractedAssets.length }, 'Assets uploaded to storage');
    } catch (err) {
      logger.warn({ projectId, error: err }, 'Failed to upload assets.json');
    }

    // Bundle URL points to API route that serves from S3
    const bundleUrl = `/api/bundles/${bundleCompositionId}/index.html`;

    await publishJobProgress(jobId, 85, 'Registering visual...');

    // Wrap DB completion in a transaction — ensures frontend is never notified
    // before DB is consistent.
    await db.transaction(async (tx) => {
      // Clean up old visuals for this project
      const existingVisuals = await tx.select().from(visuals).where(eq(visuals.projectId, projectId));
      if (existingVisuals.length > 0) {
        logger.info({ projectId, count: existingVisuals.length }, 'Cleaning up existing visuals');

        for (const oldVisual of existingVisuals) {
          const allItems = await tx.select().from(timelineItems);
          for (const item of allItems) {
            if (item.type === 'visual' && (item.data as any)?.visualId === oldVisual.id) {
              await tx.delete(timelineItems).where(eq(timelineItems.id, item.id));
            }
          }

          if (oldVisual.compositionId) {
            const oldBundleDir = join(config.remotion.bundleOutputDir, oldVisual.compositionId);
            try {
              await rm(oldBundleDir, { recursive: true, force: true });
            } catch {
              // Ignore cleanup errors
            }
          }
        }

        await tx.delete(visuals).where(eq(visuals.projectId, projectId));
      }

      // Enrich timestamps with sourceSceneId (1-indexed scene file mapping)
      const timestampsWithSourceId = metadata.visuals.map((v, i) => ({
        ...v,
        sourceSceneId: i + 1,
      }));

      // Insert into visuals table
      const [insertedVisual] = await tx.insert(visuals).values({
        projectId,
        compositionId: metadata.compositionId,
        bundleUrl,
        sourceUrl, // Source project files for AI context restoration
        durationFrames: metadata.durationInFrames,
        fps: metadata.fps,
        width: metadata.width,
        height: metadata.height,
        stylePreset,
        llmModel,
        timestamps: timestampsWithSourceId,
      }).returning({ id: visuals.id });
      const visualId = insertedVisual.id;

      // Find or create visuals track
      const existingTracks = await tx.select().from(tracks).where(eq(tracks.projectId, projectId));
      let visualsTrack = existingTracks.find(t => t.type === 'visual');

      if (!visualsTrack) {
        const [newTrack] = await tx.insert(tracks).values({
          projectId,
          type: 'visual',
          name: 'Visuals',
          position: existingTracks.length,
        }).returning();
        visualsTrack = newTrack;
      }

      // Create one timeline item per scene so they appear as separate blocks on the track
      for (let sceneIndex = 0; sceneIndex < metadata.visuals.length; sceneIndex++) {
        const scene = metadata.visuals[sceneIndex];
        // Compute per-scene effective dimensions
        const sceneDm = scene.displayMode || 'default';
        const sceneEffectiveW = (sceneDm === 'fullscreen' || sceneDm === 'overlay')
          ? canvasWidth : pipEffective.width;
        const sceneEffectiveH = (sceneDm === 'fullscreen' || sceneDm === 'overlay')
          ? canvasHeight : pipEffective.height;

        // Compute speaker bbox for overlay scenes (for player-level face masking)
        let speakerBbox: { x: number; y: number; w: number; h: number } | undefined;
        if (sceneDm === 'overlay' && project.headTrackingData) {
          const htData = project.headTrackingData as { frames?: HeadTrackingFrame[]; video?: { width: number; height: number } };
          const videoW = htData.video?.width || 1;
          const videoH = htData.video?.height || 1;
          const htFrames = (htData.frames || []).filter(
            (f) => f.timestamp_ms >= scene.startMs && f.timestamp_ms <= scene.endMs && f.face?.bbox,
          );
          if (htFrames.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const f of htFrames) {
              const b = f.face!.bbox!;
              minX = Math.min(minX, b.x / videoW);
              minY = Math.min(minY, b.y / videoH);
              maxX = Math.max(maxX, (b.x + b.width) / videoW);
              maxY = Math.max(maxY, (b.y + b.height) / videoH);
            }
            speakerBbox = {
              x: Math.max(0, minX),
              y: Math.max(0, minY),
              w: Math.min(1, maxX) - Math.max(0, minX),
              h: Math.min(1, maxY) - Math.max(0, minY),
            };
          }
        }

        // sourceSceneId: 1-indexed scene ID mapping to scenes/SceneN.tsx
        // Survives timeline splits so the agent can target the correct file
        const sourceSceneId = sceneIndex + 1;

        // Check if this scene has a video clip selected
        const sceneVideo = videoManifest.videos.find(v => v.sceneId === String(sourceSceneId));

        // Detect youtube-clip scenes for template-based rendering
        const isYouTubeClip = scene.type === 'youtube-clip';

        await tx.insert(timelineItems).values({
          trackId: visualsTrack.id,
          type: 'visual',
          startMs: scene.startMs,
          endMs: scene.endMs,
          data: {
            visualId,
            compositionId: isYouTubeClip
              ? `youtube-clip-scene${sourceSceneId}`
              : metadata.compositionId,
            bundleUrl: isYouTubeClip ? '' : bundleUrl,
            type: scene.type || 'visual',
            description: scene.description || 'AI-generated visual',
            width: canvasWidth,
            height: canvasHeight,
            fps: metadata.fps,
            effectiveWidth: sceneEffectiveW,
            effectiveHeight: sceneEffectiveH,
            displayMode: sceneDm,
            transition: scene.transition || undefined,
            sourceSceneId,
            ...(speakerBbox ? { speakerBbox } : {}),
            // Template-based rendering for youtube-clip scenes
            ...(isYouTubeClip ? {
              templateId: 'youtube-clip',
              templateProps: {
                clipUrl: '', // Filled by render.ts during export; preview uses videoUrl
                frame: (scene as any).frameStyle || 'browser',
                trimStartSeconds: sceneVideo?.trimStart ?? 0,
                trimEndSeconds: sceneVideo?.trimEnd ?? 30,
                backgroundColor: '#000000',
                muted: false,
                volume: 1,
              },
            } : {}),
            // Video clip URLs for preview and export
            ...(sceneVideo ? {
              sourceVideoUrl: sceneVideo.sourceUrl,
              videoUrl: sceneVideo.proxyUrl || sceneVideo.sourceUrl || '',
              hasVideo: true,
            } : {}),
          },
        });
      }

      // Update job and project status
      await tx.update(jobs)
        .set({
          status: 'complete',
          progress: 100,
          completedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      // Persist layoutMode into project videoSettings so the editor/export
      // uses the same layout the user selected at generation time.
      const existingVideoSettings = (project.videoSettings as Record<string, unknown>) || {};
      const existingLayoutSettings = (existingVideoSettings.layoutSettings as Record<string, unknown>) || {};
      await tx.update(projects)
        .set({
          status: 'ready',
          outputKey: null,
          updatedAt: new Date(),
          videoSettings: {
            ...existingVideoSettings,
            layoutSettings: {
              ...existingLayoutSettings,
              mode: layoutMode,
            },
          },
        })
        .where(eq(projects.id, projectId));
    });

    // Only AFTER transaction succeeds — notify frontend
    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId, compositionId, model: llmModel }, 'Visual generation complete');

  } catch (error) {
    heartbeat?.stop();
    logger.error({ projectId, err: error }, 'Visual generation failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Best-effort DB update — use Promise.race with timeout to prevent hanging
    try {
      await Promise.race([
        db.transaction(async (tx) => {
          await tx.update(jobs)
            .set({ status: 'failed', error: errorMessage })
            .where(eq(jobs.id, jobId));

          await tx.update(projects)
            .set({ status: 'failed' })
            .where(eq(projects.id, projectId));
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB update timeout')), 10_000)),
      ]);
    } catch (dbErr) {
      logger.error({ jobId, err: dbErr }, 'Failed to update DB on job failure — BullMQ on(failed) handler will retry');
    }

    // Best-effort SSE notification
    try {
      await publishJobError(jobId, errorMessage);
    } catch (sseErr) {
      logger.error({ jobId, err: sseErr }, 'Failed to publish job error event');
    }

    throw error;
  } finally {
    clearInterval(lockExtender);
  }
}


// =============================================================================
// Claude Code Visual Generator
// =============================================================================

interface ClaudeCodeOptions {
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
  /** Callback to raise heartbeat water mark when Python emits PROGRESS checkpoints */
  onProgress?: (percent: number) => void;
}

/**
 * Run the Claude Code visual generator.
 *
 * Uses Claude Agent SDK with OAuth authentication from Claude Pro/Max subscription.
 * No API key costs - included in subscription.
 */
async function runClaudeCodeGenerator(
  options: ClaudeCodeOptions
): Promise<ClaudeCodeResult> {
  const { projectId, jobId, transcript, words, durationFrames, fps, width, height, stylePreset, layoutMode, styleGuide, planJobId, pipWidth, pipHeight, onProgress } = options;

  const pythonPath = config.pythonPath;
  const agentScript = join(__dirname, '..', 'agents', 'claude_visual_generator.py');
  const workspacePath = getWorkspacePath();
  const bundleOutputDir = config.remotion.bundleOutputDir;

  logger.info({
    projectId,
    jobId,
    workspacePath,
    model: config.claudeAgent.model,
  }, 'Starting Claude Agent visual generator...');

  const startTime = Date.now();

  // Write transcript to temp file
  const transcriptPath = join(tmpdir(), `claude-transcript-${jobId}.txt`);
  await writeFile(transcriptPath, transcript, 'utf-8');

  // Write words JSON if available (for two-phase pipeline)
  let wordsPath: string | null = null;
  if (words && words.length > 0) {
    wordsPath = join(tmpdir(), `claude-words-${jobId}.json`);
    await writeFile(wordsPath, JSON.stringify(words), 'utf-8');
  }

  // Write style guide to temp file if provided
  let styleGuidePath: string | null = null;
  if (styleGuide && styleGuide.trim()) {
    styleGuidePath = join(tmpdir(), `claude-styleguide-${jobId}.txt`);
    await writeFile(styleGuidePath, styleGuide, 'utf-8');
  }

  try {
    const args = [
      agentScript,
      '--workspace', workspacePath,
      '--project-id', projectId,
      '--bundle-output', bundleOutputDir,
      '--transcript', transcriptPath,
      '--width', String(width),
      '--height', String(height),
      '--duration', String(durationFrames),
      '--fps', String(fps),
      '--model', config.claudeAgent.model,
      '--style-preset', stylePreset,
      '--layout-mode', layoutMode,
    ];

    // Add words JSON path if available (required for two-phase pipeline)
    if (wordsPath) {
      args.push('--words-json', wordsPath);
    }

    // Add style guide path if provided
    if (styleGuidePath) {
      args.push('--style-guide', styleGuidePath);
    }

    // Add pip effective dimensions for per-scene dimension-aware generation
    if (pipWidth && pipHeight) {
      args.push('--pip-width', String(pipWidth));
      args.push('--pip-height', String(pipHeight));
    }

    // If planJobId is set, skip Director and run Animator only
    if (planJobId) {
      args.push('--phase', 'animator');
      logger.info({ projectId, planJobId }, 'Using Animator-only mode (plan provided from plan job)');
    } else {
      // Two-phase pipeline is always used
      logger.info({ projectId }, 'Using two-phase pipeline (Director + Animator)');
    }

    const subprocess = spawn(pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Ensure Python uses UTF-8 encoding
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        // Claude SDK will read OAuth token from credential store
      },
    });

    // Track for cancellation
    runningProcesses.set(jobId, subprocess);

    // Register cancel handler
    registerCancelHandler(jobId, () => {
      logger.info({ jobId, projectId }, 'Cancelling Claude Code generator via Redis');
      subprocess.kill('SIGTERM');
    });

    let stdout = '';
    let stderr = '';

    subprocess.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stdout += text;

      const lines = text.split('\n');
      for (const line of lines) {
        // Parse PROGRESS:XX:message or PROGRESS:XX:message|{json_metadata}
        const progressMatch = line.match(/^PROGRESS:(\d+):(.+?)(?:\|(.+))?$/);
        if (progressMatch) {
          const percent = parseInt(progressMatch[1], 10);
          const message = progressMatch[2];
          const metaJson = progressMatch[3];
          let meta: Record<string, unknown> | undefined;
          if (metaJson) {
            try { meta = JSON.parse(metaJson); } catch { /* ignore malformed meta */ }
          }
          // Raise heartbeat water mark so it doesn't regress below this checkpoint
          onProgress?.(percent);
          publishJobProgress(jobId, percent, message, meta ? { meta } : undefined);
          logger.info({ projectId, percent, message, meta }, 'Claude generator progress');
          continue;
        }
      }

      logger.info({ projectId, output: text.slice(0, 500) }, 'Claude generator stdout');
    });

    let fatalStderrDetected = false;

    subprocess.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stderr += text;
      logger.error({ projectId, stderr: text.slice(0, 1000) }, 'Claude generator stderr');
      // Detect fatal crashes: unhandled rejections mean the CLI is likely hung
      if (
        text.includes('unhandled') ||
        text.includes('UnhandledPromiseRejection') ||
        text.includes('rejecting a promise which was not handled') ||
        text.includes('uncaughtException')
      ) {
        logger.error({ projectId, stderr: text.slice(0, 500) }, 'Claude generator fatal error detected, killing subprocess');
        fatalStderrDetected = true;
        subprocess.kill('SIGTERM');
      }
    });

    // Wait for completion with timeout
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        subprocess.kill('SIGTERM');
        setTimeout(() => {
          if (!subprocess.killed) {
            subprocess.kill('SIGKILL');
            setTimeout(() => {
              if (!subprocess.killed) {
                logger.error({ jobId }, 'CRITICAL: subprocess survived SIGKILL — potential zombie');
              }
            }, 5000);
          }
        }, 10000);
        reject(new Error(`Claude Agent generator timed out after ${config.claudeAgent.timeoutSeconds} seconds`));
      }, config.claudeAgent.timeoutSeconds * 1000);

      subprocess.on('close', (code) => {
        clearTimeout(timeoutId);
        runningProcesses.delete(jobId);
        unregisterCancelHandler(jobId);
        if (fatalStderrDetected) {
          // OOM and other crashes — retryable (sources may be partially written)
          reject(new Error(`Claude generator crashed: ${stderr.slice(-500)}`));
        } else if (code === 0) {
          resolve();
        } else {
          // Non-zero exit — may be retryable (transient API errors, etc.)
          const errorOutput = stderr || stdout.slice(-1000);
          reject(new Error(`Claude Code generator exited with code ${code}: ${errorOutput}`));
        }
      });

      subprocess.on('error', (err) => {
        clearTimeout(timeoutId);
        runningProcesses.delete(jobId);
        unregisterCancelHandler(jobId);
        reject(err);
      });
    });

    const durationMs = Date.now() - startTime;

    // Parse result from stdout
    let result: any;
    try {
      // Find JSON object at the end of output - look for the final result JSON
      // The Python script outputs: {"success": true, "bundleUrl": ..., "bundlePath": ...}
      // We need to find this specific JSON, not any random {} in logs

      // Method 1: Look for standalone { on a line (start of JSON object)
      const lines = stdout.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        // Look for a line that is just "{" or starts with '{"'
        if (line === '{' || line.startsWith('{"')) {
          // Collect lines until braces balance
          let jsonStr = '';
          let braceCount = 0;
          for (let j = i; j < lines.length; j++) {
            jsonStr += lines[j] + '\n';
            braceCount += (lines[j].match(/\{/g) || []).length;
            braceCount -= (lines[j].match(/\}/g) || []).length;
            if (braceCount === 0 && jsonStr.trim().length > 2) {
              break;
            }
          }
          try {
            const parsed = JSON.parse(jsonStr.trim());
            // Verify it's our expected result object
            if (parsed.success !== undefined && parsed.bundleUrl) {
              result = parsed;
              break;
            }
          } catch {
            // Not valid JSON, continue searching backwards
          }
        }
      }

      // Method 2: Fallback - look for JSON block in the last portion of output
      if (!result) {
        // Find the last occurrence of '{\n  "success"' pattern
        const lastJsonStart = stdout.lastIndexOf('{\n  "success"');
        if (lastJsonStart !== -1) {
          // Find the matching closing brace
          let braceCount = 0;
          let endIndex = lastJsonStart;
          for (let i = lastJsonStart; i < stdout.length; i++) {
            if (stdout[i] === '{') braceCount++;
            if (stdout[i] === '}') braceCount--;
            if (braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
          const jsonStr = stdout.slice(lastJsonStart, endIndex);
          try {
            result = JSON.parse(jsonStr);
          } catch {
            // Still failed
          }
        }
      }
    } catch (e) {
      logger.error({ projectId, error: e, stdoutTail: stdout.slice(-2000) }, 'Failed to parse Claude generator JSON output');
    }

    if (!result || !result.success) {
      logger.error({
        projectId,
        result,
        stdoutLength: stdout.length,
        stdoutTail: stdout.slice(-1000)
      }, 'Claude Code generator did not produce valid output');
      throw new Error('Claude Code generator did not produce valid output');
    }

    logger.info({
      projectId,
      durationMs,
      bundleUrl: result.bundleUrl,
    }, 'Claude Code generator completed');

    return {
      bundleUrl: result.bundleUrl,
      bundlePath: result.bundlePath,
      filesWritten: result.filesWritten || 2,
      durationMs,
      status: 'completed',
    };

  } finally {
    runningProcesses.delete(jobId);
    unregisterCancelHandler(jobId);

    try {
      await rm(transcriptPath);
    } catch (err) {
      logger.warn({ jobId, path: transcriptPath, err }, 'Failed to clean temp file');
    }

    if (wordsPath) {
      try {
        await rm(wordsPath);
      } catch (err) {
        logger.warn({ jobId, path: wordsPath, err }, 'Failed to clean temp file');
      }
    }

    if (styleGuidePath) {
      try {
        await rm(styleGuidePath);
      } catch (err) {
        logger.warn({ jobId, path: styleGuidePath, err }, 'Failed to clean temp file');
      }
    }
  }
}
