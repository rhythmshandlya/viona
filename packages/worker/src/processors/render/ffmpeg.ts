import { mkdir, rm, access, constants, readFile, writeFile, readdir, symlink, copyFile } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { downloadFile, listObjects } from '../../services/minio.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { getWorkspacePath } from '../../workspace.js';
import { renderMedia, selectComposition, getCompositions } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import type {
  VideoManifest,
  VideoClipOverride,
  VideoCropSettings,
  OverlayZone,
  RenderRemotionOptions,
} from './types.js';
import { isValidYouTubeUrl } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Build FFmpeg scale+crop filter that mirrors the preview's calculateVideoTransform.
 * Scales the source video to fill the target area (with optional zoom via scale),
 * then crops at an offset determined by cropX/cropY (0=left/top, 50=center, 100=right/bottom).
 */
export function buildVideoCropFilter(
  crop: VideoCropSettings,
  targetWidth: number,
  targetHeight: number,
): string {
  const { sourceWidth, sourceHeight, cropX, cropY, scale } = crop;
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;

  let scaleW: number;
  let scaleH: number;

  if (sourceAspect > targetAspect) {
    // Source is wider: match height first, then apply user zoom
    scaleH = Math.round(targetHeight * scale);
    scaleW = Math.round(sourceWidth * (scaleH / sourceHeight));
  } else {
    // Source is taller: match width first, then apply user zoom
    scaleW = Math.round(targetWidth * scale);
    scaleH = Math.round(sourceHeight * (scaleW / sourceWidth));
  }

  // Ensure at least target dimensions (handles scale < 1 edge case)
  scaleW = Math.max(scaleW, targetWidth);
  scaleH = Math.max(scaleH, targetHeight);

  // Make even (required by many video codecs)
  scaleW = scaleW % 2 === 0 ? scaleW : scaleW + 1;
  scaleH = scaleH % 2 === 0 ? scaleH : scaleH + 1;

  // Calculate crop position from user's pan settings
  const overflowX = scaleW - targetWidth;
  const overflowY = scaleH - targetHeight;
  const cropXPos = Math.round(overflowX * (cropX / 100));
  const cropYPos = Math.round(overflowY * (cropY / 100));

  return `scale=${scaleW}:${scaleH},crop=${targetWidth}:${targetHeight}:${cropXPos}:${cropYPos},setsar=1`;
}

/**
 * Format seconds as HH:MM:SS for yt-dlp --download-sections
 */
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Download video clips for render using yt-dlp.
 * Returns clips map (sceneId → local clip path) and list of failed scene IDs.
 * @param videoClipOverrides - User-edited trim values from the editor (overrides video_assets.json values)
 */
export async function downloadVideoClipsForRender(
  projectId: string,
  workDir: string,
  videoClipOverrides?: VideoClipOverride[]
): Promise<{ clips: Map<string, string>; failed: string[]; manifest: VideoManifest }> {
  const clipPaths = new Map<string, string>();
  const failedScenes: string[] = [];

  // Try to read video_assets.json from project sources
  let videoAssets: VideoManifest = { videos: [] };
  try {
    const sourcesPrefix = `sources/${projectId}/`;
    const manifestKey = `${sourcesPrefix}video_assets.json`;
    const manifestPath = join(workDir, 'video_assets.json');
    await downloadFile('outputs', manifestKey, manifestPath);
    const parsed = JSON.parse(await readFile(manifestPath, 'utf-8')) as VideoManifest;
    videoAssets = parsed;
  } catch {
    // No video_assets.json found - will use videoClipOverrides as primary source
  }

  // Ensure videos array exists
  if (!videoAssets.videos) {
    videoAssets.videos = [];
  }

  // Merge user-specified trim values into video assets AND add any new clips
  // This handles clips added in the editor after generation
  if (videoClipOverrides && videoClipOverrides.length > 0) {
    for (const override of videoClipOverrides) {
      const existingVideo = videoAssets.videos.find(
        v => String(v.sceneId) === String(override.sourceSceneId)
      );
      if (existingVideo) {
        // Update existing entry with user's trim values
        logger.info({
          sceneId: existingVideo.sceneId,
          oldTrim: { start: existingVideo.trimStart, end: existingVideo.trimEnd },
          newTrim: { start: override.trimStartSeconds, end: override.trimEndSeconds },
        }, 'Applying user trim override for video clip');
        existingVideo.trimStart = override.trimStartSeconds;
        existingVideo.trimEnd = override.trimEndSeconds;
        // Also update sourceUrl in case it changed
        if (override.sourceVideoUrl && isValidYouTubeUrl(override.sourceVideoUrl)) {
          existingVideo.sourceUrl = override.sourceVideoUrl;
        }
      } else if (override.sourceVideoUrl && isValidYouTubeUrl(override.sourceVideoUrl)) {
        // Add new clip that was added in the editor (not in video_assets.json)
        logger.info({
          sceneId: override.sourceSceneId,
          sourceUrl: override.sourceVideoUrl,
          trim: { start: override.trimStartSeconds, end: override.trimEndSeconds },
        }, 'Adding video clip from editor (not in video_assets.json)');
        videoAssets.videos.push({
          sceneId: String(override.sourceSceneId),
          keyword: 'editor-added',
          videoId: '',
          sourceUrl: override.sourceVideoUrl,
          title: '',
          thumbnailUrl: '',
          trimStart: override.trimStartSeconds,
          trimEnd: override.trimEndSeconds,
        });
      }
    }
  }

  // If no videos to download, return early
  if (!videoAssets.videos.length) {
    logger.info('No video clips to download (video_assets.json empty and no overrides)');
    return { clips: clipPaths, failed: failedScenes, manifest: videoAssets };
  }

  const clipsDir = join(workDir, 'clips');
  await mkdir(clipsDir, { recursive: true });

  logger.info({
    count: videoAssets.videos.length,
    videos: videoAssets.videos.map(v => ({
      sceneId: v.sceneId,
      url: v.sourceUrl?.substring(0, 50) + '...',
      trim: { start: v.trimStart, end: v.trimEnd },
    })),
  }, 'Downloading video clips for render');

  for (const video of videoAssets.videos) {
    // Validate URL before download (security check)
    if (!isValidYouTubeUrl(video.sourceUrl)) {
      logger.warn({ sourceUrl: video.sourceUrl, sceneId: video.sceneId },
        'Skipping non-YouTube URL for security');
      failedScenes.push(video.sceneId);
      continue;
    }

    try {
      // Download via yt-dlp with scene-based naming for Remotion staticFile() lookup
      const clipFilename = `scene${video.sceneId}-youtube-clip.mp4`;
      const outputPath = join(clipsDir, clipFilename);

      const timeRange = `*${formatTimestamp(video.trimStart || 0)}-${formatTimestamp(video.trimEnd || 30)}`;

      const args = [
        '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        '--download-sections', timeRange,
        '--force-keyframes-at-cuts',
        '-o', outputPath,
        video.sourceUrl,
      ];

      logger.info({ sceneId: video.sceneId, sourceUrl: video.sourceUrl, timeRange, outputPath }, 'Downloading video clip');

      await execFileAsync('yt-dlp', args, {
        timeout: 5 * 60 * 1000, // 5 minute timeout
        maxBuffer: 50 * 1024 * 1024,
      });

      clipPaths.set(video.sceneId, outputPath);
      logger.info({ sceneId: video.sceneId, path: outputPath }, 'Video clip downloaded');
    } catch (err) {
      logger.error({ err, video }, 'Failed to download video clip');
      failedScenes.push(video.sceneId);
    }
  }

  return { clips: clipPaths, failed: failedScenes, manifest: videoAssets };
}

async function copyVideo(inputPath: string, outputPath: string): Promise<void> {
  const { spawn } = await import('child_process');

  // Use spawn with cwd and relative filenames to avoid Windows path issues
  // (FFmpeg interprets colons in paths like C:/... as stream specifiers)
  const workDir = dirname(inputPath);
  const inputFilename = basename(inputPath);
  const outputFilename = basename(outputPath);

  logger.info({ inputPath, outputPath, workDir }, 'Copying video with FFmpeg');

  const args = [
    '-i', inputFilename,
    '-y',
    '-c', 'copy',
    outputFilename
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

export async function encodeVideoWithAudio(
  videoPath: string,
  audioPath: string | null,
  outputPath: string
): Promise<void> {
  const { spawn } = await import('child_process');

  const workingDir = dirname(videoPath);
  const videoFilename = basename(videoPath);
  const outputFilename = basename(outputPath);

  if (audioPath) {
    // Copy audio to working directory
    const audioFilename = basename(audioPath);
    const localAudioPath = join(workingDir, audioFilename);
    if (audioPath !== localAudioPath) {
      await copyFile(audioPath, localAudioPath);
    }

    logger.info({ videoFilename, audioFilename, outputFilename, workingDir }, 'Encoding video with enhanced audio');

    // Replace audio track with enhanced audio
    const args = [
      '-i', videoFilename,
      '-i', audioFilename,
      '-y',
      '-map', '0:v',      // Take video from first input
      '-map', '1:a',      // Take audio from second input
      '-c:v', 'copy',     // Copy video codec (no re-encode)
      '-c:a', 'aac',      // Encode audio to AAC
      '-shortest',        // End when shortest stream ends
      outputFilename
    ];

    return new Promise((resolve, reject) => {
      logger.info({ cmd: `ffmpeg ${args.join(' ')}` }, 'FFmpeg encode started');

      const proc = spawn('ffmpeg', args, {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code: number | null) => {
        if (code === 0) {
          logger.info({ outputPath }, 'FFmpeg encode completed');
          resolve();
        } else {
          logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg encode failed');
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      proc.on('error', (err: Error) => {
        logger.error({ err }, 'FFmpeg spawn error');
        reject(err);
      });
    });
  } else {
    // No enhanced audio, just copy video
    logger.info({ videoPath, outputPath }, 'No enhanced audio, copying video directly');
    await copyVideo(videoPath, outputPath);
  }
}

/**
 * Download a Remotion bundle from S3 storage if it doesn't exist locally.
 * Bundles are uploaded during visual generation and need to be restored after container restarts.
 */
export async function ensureBundleExists(bundlePath: string, compositionId: string): Promise<void> {
  const bundleIndexPath = join(bundlePath, 'index.html');

  // Check if bundle already exists locally
  try {
    await access(bundleIndexPath, constants.R_OK);
    logger.info({ bundlePath }, 'Bundle exists locally');
    return;
  } catch {
    // Bundle doesn't exist locally, try to download from S3
    logger.info({ bundlePath, compositionId }, 'Bundle not found locally, downloading from S3...');
  }

  // List all files in the bundle from S3
  const s3Prefix = `bundles/${compositionId}/`;
  const files = await listObjects('outputs', s3Prefix);

  if (files.length === 0) {
    throw new Error(`Bundle not found in S3 storage: ${s3Prefix}`);
  }

  logger.info({ compositionId, fileCount: files.length }, 'Found bundle files in S3');

  // Create bundle directory
  await mkdir(bundlePath, { recursive: true });

  // Download all files
  for (const file of files) {
    // file is like "bundles/proj-xxx/index.html" or "bundles/proj-xxx/assets/file.js"
    // We need to extract the relative path within the bundle
    const relativePath = file.replace(s3Prefix, '');
    const localPath = join(bundlePath, relativePath);

    // Create subdirectories if needed
    const dir = join(bundlePath, relativePath.split('/').slice(0, -1).join('/'));
    if (dir !== bundlePath) {
      await mkdir(dir, { recursive: true });
    }

    await downloadFile('outputs', file, localPath);
  }

  logger.info({ bundlePath, compositionId, fileCount: files.length }, 'Bundle downloaded from S3');
}

/**
 * Rebuild the Remotion bundle from TypeScript source files.
 * Downloads sources from S3 and creates a proper bundle with correct composition IDs.
 */
export async function rebuildBundleFromCJS(bundlePath: string, compositionId: string): Promise<string> {
  logger.info({ bundlePath, compositionId }, 'Rebuilding bundle from TypeScript sources');

  // Download source files from S3
  const sourceCompositionId = compositionId.replace(/_/g, '-');
  const s3Prefix = `sources/${sourceCompositionId}/`;
  const sourceFiles = await listObjects('outputs', s3Prefix);

  if (sourceFiles.length === 0) {
    throw new Error(`Source files not found in S3: ${s3Prefix}`);
  }

  // Create temp directory for source files
  const tempDir = join(tmpdir(), `remotion-rebuild-${nanoid()}`);
  const srcDir = join(tempDir, 'src', compositionId.replace(/-/g, '_'));
  await mkdir(srcDir, { recursive: true });

  // Download all source files
  for (const file of sourceFiles) {
    const relativePath = file.replace(s3Prefix, '');
    const localPath = join(srcDir, relativePath);

    // Create subdirectories if needed
    const dir = join(srcDir, relativePath.split('/').slice(0, -1).join('/'));
    if (dir !== srcDir && relativePath.includes('/')) {
      await mkdir(dir, { recursive: true });
    }

    await downloadFile('outputs', file, localPath);
  }

  logger.info({ compositionId, fileCount: sourceFiles.length }, 'Downloaded source files from S3');

  // Download composition infrastructure files (__composition__/ prefix) into src/composition/
  // Fallback: if not in S3 (old projects), copy from the local remotion-template
  const compositionPrefix = `sources/${sourceCompositionId}/__composition__/`;
  const compositionFiles = await listObjects('outputs', compositionPrefix);
  const compositionSrcDir = join(tempDir, 'src', 'composition');
  if (compositionFiles.length > 0) {
    await mkdir(compositionSrcDir, { recursive: true });
    for (const file of compositionFiles) {
      const relativePath = file.replace(compositionPrefix, '');
      const localPath = join(compositionSrcDir, relativePath);
      const dir = dirname(localPath);
      if (dir !== compositionSrcDir) {
        await mkdir(dir, { recursive: true });
      }
      await downloadFile('outputs', file, localPath);
    }
    logger.info({ compositionId, fileCount: compositionFiles.length }, 'Downloaded composition infrastructure files from S3');
  } else {
    // Fallback for old projects: copy composition/ from the local workspace template
    const localCompositionDir = join(config.worker.templatePath, 'src', 'composition');
    try {
      await access(localCompositionDir, constants.R_OK);
      await mkdir(compositionSrcDir, { recursive: true });
      const { readdir, copyFile: cpFile } = await import('fs/promises');
      const entries = await readdir(localCompositionDir);
      for (const entry of entries) {
        await cpFile(join(localCompositionDir, entry), join(compositionSrcDir, entry));
      }
      logger.info({ compositionId, fileCount: entries.length }, 'Copied composition infrastructure from local workspace (not in S3)');
    } catch {
      logger.warn({ localCompositionDir }, 'Composition infrastructure not found locally either');
    }
  }
  // Copy fonts.ts into src/ so generated compositions can resolve '../fonts'
  const fontsSource = join(config.worker.templatePath, 'src', 'fonts.ts');
  const fontsDest = join(tempDir, 'src', 'fonts.ts');
  try {
    await copyFile(fontsSource, fontsDest);
    logger.info({ fontsSource, fontsDest }, 'Copied fonts.ts for bundle rebuild');
  } catch (err) {
    logger.warn({ err, fontsSource }, 'Could not copy fonts.ts, font imports may fail');
  }

  let hasCompositionInfra = false;
  try {
    await access(compositionSrcDir, constants.R_OK);
    const entries = await (await import('fs/promises')).readdir(compositionSrcDir);
    hasCompositionInfra = entries.length > 0;
  } catch {
    // compositionSrcDir doesn't exist
  }

  // Fix composition ID in index.tsx (replace underscores with hyphens for Remotion)
  const indexPath = join(srcDir, 'index.tsx');
  try {
    let indexContent = await readFile(indexPath, 'utf-8');
    // Replace composition ID from underscores to hyphens
    const originalId = compositionId.replace(/-/g, '_');
    const fixedId = compositionId.replace(/_/g, '-');
    indexContent = indexContent.replace(new RegExp(originalId, 'g'), fixedId);
    await writeFile(indexPath, indexContent, 'utf-8');
  } catch (err) {
    logger.warn({ err }, 'Could not fix composition ID in index.tsx');
  }

  // Read dimensions from metadata.json (infrastructure source of truth)
  const metadataPath = join(srcDir, 'metadata.json');
  let metaWidth = 1080;
  let metaHeight = 1920;
  let metaFps = 60;
  let metaDuration = 1800;
  try {
    const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
    metaWidth = metadata.width || metadata.compositionWidth || 1080;
    metaHeight = metadata.height || metadata.compositionHeight || 1920;
    metaFps = metadata.fps || 60;
    metaDuration = metadata.durationInFrames || 1800;
  } catch {
    logger.warn('Could not read metadata.json for dimensions, using defaults');
  }

  // Create entry point that imports MainComposition (default export) and wraps
  // with infrastructure-known dimensions, preventing AI dimension swap bugs.
  // If composition/ infrastructure files were uploaded, use FullComposition wrapper
  // for proper split-screen layout support. Otherwise fall back to direct composition.
  const projectDir = compositionId.replace(/-/g, '_');
  const fixedId = compositionId.replace(/_/g, '-');
  const entryContent = hasCompositionInfra
    ? `
import React from 'react';
import { registerRoot } from 'remotion';
import { Composition } from 'remotion';
import MainComposition from './src/${projectDir}';
import { FullComposition } from './src/composition';
import type { FullCompositionProps } from './src/composition';

const Wrapped: React.FC<FullCompositionProps> = (props) => {
  return (
    <FullComposition {...props}>
      <MainComposition />
    </FullComposition>
  );
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="${fixedId}"
    component={Wrapped}
    durationInFrames={${metaDuration}}
    fps={${metaFps}}
    width={${metaWidth}}
    height={${metaHeight}}
    defaultProps={{
      layoutMode: "stacked",
      splitSettings: { position: "visuals-first", ratio: 50, gap: 0 },
      layoutSegments: [],
      videoCropSettings: { sourceWidth: 1920, sourceHeight: 1080, cropX: 50, cropY: 50, scale: 1.0 },
      sourceVideoFile: "source.mp4",
      subtitles: [],
      defaultSubtitleStyle: {},
    }}
  />
);

registerRoot(RemotionRoot);
`
    : `
import React from 'react';
import { registerRoot } from 'remotion';
import { Composition } from 'remotion';
import MainComposition from './src/${projectDir}';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="${fixedId}"
    component={MainComposition}
    durationInFrames={${metaDuration}}
    fps={${metaFps}}
    width={${metaWidth}}
    height={${metaHeight}}
  />
);

registerRoot(RemotionRoot);
`;
  const entryPath = join(tempDir, 'index.tsx');
  await writeFile(entryPath, entryContent, 'utf-8');

  logger.info({ entryPath, srcDir }, 'Created entry point for bundle');

  // Symlink node_modules from the workspace so webpack can resolve
  // packages like @remotion/google-fonts that generated scenes may import.
  const workspaceNodeModules = join(getWorkspacePath(), 'node_modules');
  try {
    await symlink(workspaceNodeModules, join(tempDir, 'node_modules'));
  } catch (err) {
    logger.warn({ err, workspaceNodeModules }, 'Could not symlink node_modules, bundle may fail');
  }

  // Use Remotion's bundle() to create a proper bundle
  const newBundleLocation = await bundle({
    entryPoint: entryPath,
    outDir: bundlePath,
  });

  // Clean up temp dir
  await rm(tempDir, { recursive: true, force: true });

  logger.info({ newBundleLocation, compositionId }, 'Bundle rebuilt from sources successfully');
  return newBundleLocation;
}

/**
 * Render a Remotion composition to a video file using SSR.
 * Uses the existing bundle created by the visual generator.
 * If the composition is not found, attempts to rebuild the bundle from source.
 */
export async function renderWithRemotion(options: RenderRemotionOptions): Promise<void> {
  const { bundlePath, compositionId, outputPath, propsPath, onProgress } = options;

  logger.info({ bundlePath, compositionId, outputPath }, 'Starting Remotion SSR render');

  // Ensure bundle exists (download from S3 if needed)
  const bundleCompositionId = compositionId.replace(/_/g, '-');
  await ensureBundleExists(bundlePath, bundleCompositionId);

  // Remotion requires hyphens in composition IDs, not underscores
  // The visual generator creates IDs with underscores (proj_xxx), but Remotion validation fails
  // CRITICAL: If compositionId has underscores, skip getCompositions() entirely
  // because the existing bundle's composition.cjs.js also has underscores and will fail validation
  const hasUnderscores = compositionId.includes('_');
  const hyphenatedId = compositionId.replace(/_/g, '-');

  // Load inputProps from propsPath if provided (for full composition mode)
  let inputProps: Record<string, unknown> = {};
  const isFullCompositionMode = !!propsPath;
  if (propsPath) {
    const propsJson = await readFile(propsPath, 'utf-8');
    inputProps = JSON.parse(propsJson);
    logger.info({ propsPath, propKeys: Object.keys(inputProps) }, 'Loaded composition inputProps');
  }

  let composition;
  let serveUrl = bundlePath;

  // Full composition mode: ALWAYS rebuild from sources to ensure the FullComposition
  // wrapper is present. Old bundles (pre-dating this feature) won't have it.
  if (isFullCompositionMode) {
    logger.info({ compositionId }, 'Full composition mode — rebuilding bundle from sources to include FullComposition wrapper');
    serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);

    composition = await selectComposition({
      serveUrl,
      id: hyphenatedId,
      inputProps,
    });
  } else if (hasUnderscores) {
    // Skip getCompositions() - we know the existing bundle will fail validation
    // Go straight to rebuild with fixed IDs
    logger.info({ compositionId, hyphenatedId }, 'Composition ID has underscores, rebuilding bundle with hyphens...');
    serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);

    composition = await selectComposition({
      serveUrl,
      id: hyphenatedId,
      inputProps,
    });
  } else {
    // No underscores - try normal flow
    try {
      const compositions = await getCompositions(bundlePath);
      logger.info({
        availableCompositions: compositions.map(c => c.id),
        requestedComposition: compositionId
      }, 'Available compositions in bundle');

      const hasComposition = compositions.some(c => c.id === compositionId);

      if (!hasComposition) {
        logger.warn({ compositionId }, 'Composition not found in bundle, rebuilding from composition.cjs.js...');
        serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);
      }

      composition = await selectComposition({
        serveUrl,
        id: compositionId,
        inputProps,
      });
    } catch (err) {
      logger.error({ err, compositionId }, 'Failed to select composition, attempting rebuild from CJS');
      serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);
      composition = await selectComposition({
        serveUrl,
        id: compositionId,
        inputProps,
      });
    }
  }

  logger.info({
    compositionId: composition.id,
    width: composition.width,
    height: composition.height,
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
  }, 'Composition selected');

  // Render the composition to video
  // Railway containers have limited RAM — use concurrency 1 and 'faster' preset
  // to keep memory reasonable while maintaining text/caption quality

  logger.info({
    concurrency: 1,
    originalSize: `${composition.width}x${composition.height}`,
  }, 'Starting renderMedia at full resolution');

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
    concurrency: 1,
    imageFormat: 'png',
    x264Preset: 'faster',
    crf: 18,
    // Progress callback
    onProgress: ({ progress }) => {
      if (onProgress) {
        onProgress(progress);
      }
      logger.debug({ progress: Math.round(progress * 100) }, 'Remotion render progress');
    },
  });

  logger.info({ outputPath }, 'Remotion SSR render completed');
}

/**
 * Check if any visual items use zone-based overlay positioning
 */
export function hasZoneBasedVisuals(visualItems: Array<{ data: Record<string, unknown> }>): boolean {
  return visualItems.some(item => {
    const zone = item.data.overlayZone as OverlayZone | undefined;
    return zone && zone !== 'none';
  });
}
