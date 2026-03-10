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
import type { SubtitleItem } from '@viona/renderer';
import { renderMedia, selectComposition, getCompositions } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import { generateASSForComposite, generateASSSubtitles, formatASSTime } from './subtitles.js';
import { SYSTEM_FONTS_DIR, GOOGLE_FONT_URLS, detectFontsInBundle, injectGoogleFontsIntoBundle } from './fonts.js';
import type {
  VideoManifest,
  VideoClipOverride,
  LayoutSettings,
  VideoCropSettings,
  DisplayModeSegment,
  OverlayZone,
  RenderRemotionOptions,
  AddAudioAndSubtitlesOptions,
  RenderWithPiPLayoutOptions,
  FinalizeRemotionVideoOptions,
  CompositeFullVideoOptions,
} from './types.js';
import { isValidYouTubeUrl, PIP_SIZE_MAP, escapePathForFilter } from './types.js';

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

// Fallback: FFmpeg subtitle burning for when Remotion fails
export async function renderSubtitlesWithFFmpeg(
  inputPath: string,
  outputPath: string,
  items: any[],
  project: any,
  fontsDir: string = escapePathForFilter(SYSTEM_FONTS_DIR)
): Promise<void> {
  // Filter subtitle items
  const subtitles = items.filter(item => item.type === 'subtitle');

  logger.info({ inputPath, outputPath, subtitleCount: subtitles.length }, 'Rendering with FFmpeg fallback');

  // Verify input file exists
  try {
    await access(inputPath, constants.R_OK);
    logger.info({ inputPath }, 'Input file verified');
  } catch (err) {
    logger.error({ inputPath, err }, 'Input file not accessible');
    throw new Error(`Input file not accessible: ${inputPath}`);
  }

  if (subtitles.length === 0) {
    // No subtitles, just copy the video using spawn with cwd
    return copyVideo(inputPath, outputPath);
  }

  // Create ASS subtitle file for FFmpeg
  const assPath = inputPath.replace('.mp4', '.ass');
  const assContent = generateASSSubtitles(subtitles, project);

  await writeFile(assPath, assContent, 'utf-8');
  logger.info({ assPath }, 'ASS subtitle file created');

  // Burn subtitles into video using subtitles filter
  // Use relative path by extracting just the filename - FFmpeg will find it in cwd
  const { spawn } = await import('child_process');
  const assFilename = basename(assPath);  // Just "input.ass"
  const workingDir = dirname(assPath);    // The temp directory

  logger.info({ assPath, assFilename, workingDir }, 'Using subtitles filter with relative path');

  // Use spawn directly with cwd to avoid path escaping issues
  return new Promise((resolve, reject) => {
    const args = [
      '-i', 'input.mp4',
      '-y',
      '-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`,
      '-c:a', 'copy',
      'output.mp4'
    ];

    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workingDir }, 'FFmpeg subtitle burn started');

    const proc = spawn('ffmpeg', args, {
      cwd: workingDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg subtitle burn completed');
        resolve();
      } else {
        logger.error({ code, stderr }, 'FFmpeg subtitle burn failed');
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err: Error) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
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
  const projectDir = compositionId.replace(/-/g, '_');
  const fixedId = compositionId.replace(/_/g, '-');
  const entryContent = `
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
  const { bundlePath, compositionId, outputPath, onProgress } = options;

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

  let composition;
  let serveUrl = bundlePath;

  if (hasUnderscores) {
    // Skip getCompositions() - we know the existing bundle will fail validation
    // Go straight to rebuild with fixed IDs
    logger.info({ compositionId, hyphenatedId }, 'Composition ID has underscores, rebuilding bundle with hyphens...');
    serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);

    composition = await selectComposition({
      serveUrl,
      id: hyphenatedId,
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
      });
    } catch (err) {
      logger.error({ err, compositionId }, 'Failed to select composition, attempting rebuild from CJS');
      serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);
      composition = await selectComposition({
        serveUrl,
        id: compositionId,
      });
    }
  }

  // Inject Google Fonts into bundle HTML so headless Chromium renders them
  const detectedFonts = await detectFontsInBundle(serveUrl);
  await injectGoogleFontsIntoBundle(serveUrl, detectedFonts);

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
 * Composite Remotion visuals with source video using FFmpeg.
 * Overlays the Remotion output on top of the source video.
 */
export async function compositeVideos(
  sourceVideoPath: string,
  remotionVideoPath: string,
  outputPath: string,
  audioPath: string | null
): Promise<void> {
  const { spawn } = await import('child_process');

  const workingDir = dirname(outputPath);
  const sourceFilename = basename(sourceVideoPath);
  const remotionFilename = basename(remotionVideoPath);
  const outputFilename = basename(outputPath);

  // Copy files to working directory if needed
  const localSourcePath = join(workingDir, 'source_' + sourceFilename);
  const localRemotionPath = join(workingDir, 'remotion_' + remotionFilename);

  await copyFile(sourceVideoPath, localSourcePath);
  await copyFile(remotionVideoPath, localRemotionPath);

  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = basename(audioPath);
    const localAudioPath = join(workingDir, audioFilename);
    if (audioPath !== localAudioPath) {
      await copyFile(audioPath, localAudioPath);
    }
  }

  logger.info({
    sourceFilename,
    remotionFilename,
    audioFilename,
    outputFilename,
    workingDir
  }, 'Compositing videos with FFmpeg');

  // Build FFmpeg command for overlay
  // The Remotion video is overlaid on top of the source video
  const args = [
    '-i', 'source_' + sourceFilename,
    '-i', 'remotion_' + remotionFilename,
  ];

  // Add audio input if available
  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-filter_complex', '[0:v][1:v]overlay=0:0[outv]',
    '-map', '[outv]',
  );

  // Map audio from enhanced audio or source video
  if (audioFilename) {
    args.push('-map', '2:a');
  } else {
    args.push('-map', '0:a?');  // Use source audio if available
  }

  // Encoding: 'faster' preset balances quality and memory usage
  args.push(
    '-c:v', 'libx264',
    '-preset', 'faster',
    '-crf', '18',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    outputFilename
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}` }, 'FFmpeg composite started');

    const proc = spawn('ffmpeg', args, {
      cwd: workingDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg composite completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg composite failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err: Error) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

/**
 * Render only the Remotion composition (no source video overlay).
 * Use this when the composition is standalone.
 */
export async function renderRemotionOnly(
  bundlePath: string,
  compositionId: string,
  outputPath: string,
  audioPath: string | null,
  onProgress?: (progress: number) => void
): Promise<void> {
  const { spawn } = await import('child_process');

  // First render Remotion to a temp file
  const workingDir = dirname(outputPath);
  const remotionTempPath = join(workingDir, 'remotion_temp.mp4');

  await renderWithRemotion({
    bundlePath,
    compositionId,
    outputPath: remotionTempPath,
    onProgress,
  });

  // If we have enhanced audio, mux it with the Remotion video
  if (audioPath) {
    const audioFilename = basename(audioPath);
    const localAudioPath = join(workingDir, audioFilename);

    if (audioPath !== localAudioPath) {
      await copyFile(audioPath, localAudioPath);
    }

    logger.info({ remotionTempPath, audioPath, outputPath }, 'Muxing audio with Remotion video');

    const args = [
      '-i', 'remotion_temp.mp4',
      '-i', audioFilename,
      '-y',
      '-map', '0:v',
      '-map', '1:a',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      basename(outputPath)
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', args, {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code: number | null) => {
        if (code === 0) {
          logger.info({ outputPath }, 'Audio muxing completed');
          resolve();
        } else {
          logger.error({ code, stderr: stderr.slice(-1000) }, 'Audio muxing failed');
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });

    // Clean up temp file
    await rm(remotionTempPath, { force: true });
  } else {
    // No audio to add, just rename the temp file
    const { rename } = await import('fs/promises');
    await rename(remotionTempPath, outputPath);
  }
}

/**
 * Add audio and subtitles to a video file.
 * Simple pass-through - no layout changes.
 */
export async function addAudioAndSubtitles(options: AddAudioAndSubtitlesOptions): Promise<void> {
  const {
    videoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width,
    height,
    fontsDir = escapePathForFilter(SYSTEM_FONTS_DIR),
    fontSizeMultiplier = 1,
  } = options;

  const { spawn } = await import('child_process');

  // Copy video to working directory
  const localVideoPath = join(workDir, 'video.mp4');
  await copyFile(videoPath, localVideoPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles if we have any
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, width, height, undefined, undefined, fontSizeMultiplier);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length }, 'Generated subtitles');
  }

  logger.info({
    videoPath,
    audioPath,
    subtitleCount: subtitles.length,
    outputPath,
  }, 'Adding audio and subtitles');

  // Build FFmpeg args
  const args = ['-i', 'video.mp4'];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push('-y');

  // Add subtitles filter if we have them, otherwise copy video
  if (assFilename) {
    args.push('-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`);
    args.push('-c:v', 'libx264', '-preset', 'faster', '-crf', '18', '-threads', '4');
  } else {
    args.push('-c:v', 'copy');
  }

  // Map streams
  if (audioFilename) {
    args.push('-map', '0:v', '-map', '1:a', '-c:a', 'aac');
  } else {
    args.push('-an');  // No audio if none provided
  }

  args.push('-shortest', basename(outputPath));

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err: Error) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

/**
 * Render final video with configurable layout:
 * - PiP mode: Remotion visuals fullscreen, source video as overlay
 * - Split modes: Side by side or top/bottom
 * Uses layoutSettings for exact position, size, and styling to match preview
 */
export async function renderWithPiPLayout(options: RenderWithPiPLayoutOptions): Promise<void> {
  const {
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width: fullWidth,
    height: fullHeight,
    layoutSettings,
    videoCrop,
    fullscreenVisualSegments,
    overlaySegments,
    gapSegments,
    onProgress,
    fontsDir,
    resolvedFontFamily,
    fontSizeMultiplier = 1,
    videoClipPaths,
    videoManifest,
    sceneTimestamps,
  } = options;

  // Render at full resolution for caption/text quality
  const width = fullWidth;
  const height = fullHeight;

  logger.info({
    width,
    height,
  }, 'Compositing at full resolution');

  const { spawn, execSync } = await import('child_process');

  // Get video duration for progress tracking using ffprobe
  let durationSeconds = 0;
  try {
    const ffprobeOutput = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${sourceVideoPath}"`,
      { encoding: 'utf-8' }
    );
    durationSeconds = parseFloat(ffprobeOutput.trim()) || 0;
  } catch {
    logger.warn('Could not get video duration for progress tracking');
  }

  // Copy files to working directory with simple names
  const localSourcePath = join(workDir, 'source.mp4');
  const localRemotionPath = join(workDir, 'remotion.mp4');
  await copyFile(sourceVideoPath, localSourcePath);
  await copyFile(remotionVideoPath, localRemotionPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Default layout settings if not provided
  const mode = layoutSettings?.mode || 'pip';
  const pip = layoutSettings?.pip || {
    position: 'bottom-right' as const,
    offsetX: 16,
    offsetY: 16,
    size: 'medium' as const,
    customSize: 25,
    shape: 'rounded' as const,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowEnabled: true,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowBlur: 20,
    opacity: 1,
    rotation: 0,
  };
  const split = layoutSettings?.split || {
    position: 'visuals-first' as const,
    ratio: 50,
    gap: 0,
  };

  // Build video crop filter strings for all video scaling operations.
  // When videoCrop is available, the source video is scaled+cropped to match the
  // user's exact pan/zoom from the preview. Without it, center crop is used.
  const srcCropFull = videoCrop
    ? buildVideoCropFilter(videoCrop, width, height)
    : `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;

  let filterComplex: string;

  if (mode === 'pip') {
    // Calculate PiP dimensions based on settings
    const pipSizePercent = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size];
    const pipWidth = Math.round(width * (pipSizePercent / 100));
    const pipHeight = Math.round(pipWidth); // Square aspect ratio for PiP

    // Calculate position based on settings
    const scaledOffsetX = Math.round(pip.offsetX);
    const scaledOffsetY = Math.round(pip.offsetY);
    let pipX: number, pipY: number;
    switch (pip.position) {
      case 'top-left':
        pipX = scaledOffsetX;
        pipY = scaledOffsetY;
        break;
      case 'top-right':
        pipX = width - pipWidth - scaledOffsetX;
        pipY = scaledOffsetY;
        break;
      case 'bottom-left':
        pipX = scaledOffsetX;
        pipY = height - pipHeight - scaledOffsetY;
        break;
      case 'bottom-right':
      default:
        pipX = width - pipWidth - scaledOffsetX;
        pipY = height - pipHeight - scaledOffsetY;
        break;
    }

    // Build PiP-specific crop filter using PiP's own crop settings
    const pipCrop = (pip as any).crop || { cropX: 50, cropY: 50, zoom: 1.0 };
    const pipHasCrop = pipCrop.cropX !== 50 || pipCrop.cropY !== 50 || pipCrop.zoom !== 1.0;

    let pipCropFilter: string;
    if (pipHasCrop && videoCrop) {
      // Use PiP-specific crop values with the source video dimensions
      const pipVideoCrop: VideoCropSettings = {
        sourceWidth: videoCrop.sourceWidth,
        sourceHeight: videoCrop.sourceHeight,
        cropX: pipCrop.cropX,
        cropY: pipCrop.cropY,
        scale: pipCrop.zoom,
      };
      pipCropFilter = buildVideoCropFilter(pipVideoCrop, pipWidth, pipHeight);
    } else if (pipHasCrop) {
      // No global videoCrop but PiP has custom crop — estimate source dimensions
      const pipVideoCrop: VideoCropSettings = {
        sourceWidth: 1920,
        sourceHeight: 1080,
        cropX: pipCrop.cropX,
        cropY: pipCrop.cropY,
        scale: pipCrop.zoom,
      };
      pipCropFilter = buildVideoCropFilter(pipVideoCrop, pipWidth, pipHeight);
    } else if (videoCrop) {
      // No PiP-specific crop, fall back to global video crop
      pipCropFilter = buildVideoCropFilter(videoCrop, pipWidth, pipHeight);
    } else {
      // Default center cover
      pipCropFilter = `scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=increase,crop=${pipWidth}:${pipHeight},setsar=1`;
    }

    // Apply PiP styling: rounded corners, border, shadow, opacity
    // Uses FFmpeg geq+alphaextract for rounded mask, drawbox for border
    const pipStyleFilters: string[] = [];

    // Rounded corners / circle via alpha mask
    const pipBorderRadius = pip.shape === 'circle' ? Math.round(pipWidth / 2) : Math.round(pip.borderRadius);
    if (pipBorderRadius > 0) {
      // Use geq filter to create rounded rectangle alpha mask
      // The formula calculates distance from corners and applies smooth rounding
      const r = Math.min(pipBorderRadius, Math.round(pipWidth / 2), Math.round(pipHeight / 2));
      const pw = pipWidth;
      const ph = pipHeight;
      // geq expression: evaluate distance from each corner; if within radius, check against circle
      pipStyleFilters.push(`format=yuva420p`);
      pipStyleFilters.push(
        `geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':` +
        `a='if(lte(X,${r})*lte(Y,${r}),if(lte(hypot(${r}-X,${r}-Y),${r}),255,0),` +
        `if(gte(X,${pw}-${r})*lte(Y,${r}),if(lte(hypot(X-${pw}+${r},${r}-Y),${r}),255,0),` +
        `if(lte(X,${r})*gte(Y,${ph}-${r}),if(lte(hypot(${r}-X,Y-${ph}+${r}),${r}),255,0),` +
        `if(gte(X,${pw}-${r})*gte(Y,${ph}-${r}),if(lte(hypot(X-${pw}+${r},Y-${ph}+${r}),${r}),255,0),` +
        `255))))'`
      );
    }

    // Rotation
    const pipRotation = pip.rotation || 0;
    if (pipRotation !== 0) {
      if (!pipStyleFilters.some(f => f.includes('format=yuva420p'))) {
        pipStyleFilters.push('format=yuva420p');
      }
      const radians = (pipRotation * Math.PI / 180).toFixed(4);
      pipStyleFilters.push(`rotate=${radians}:ow=rotw(${radians}):oh=roth(${radians}):c=none`);
    }

    // Opacity
    if (pip.opacity < 1) {
      if (!pipStyleFilters.some(f => f.includes('format=yuva420p'))) {
        pipStyleFilters.push('format=yuva420p');
      }
      pipStyleFilters.push(`colorchannelmixer=aa=${pip.opacity.toFixed(2)}`);
    }

    const pipFilterChain = pipStyleFilters.length > 0
      ? `,${pipStyleFilters.join(',')}`
      : '';

    // Build enable expression to hide PiP during fullscreen visual segments
    const pipDisableExpr = fullscreenVisualSegments && fullscreenVisualSegments.length > 0
      ? `:enable='not(${fullscreenVisualSegments.map(s => `between(t,${(s.startMs / 1000).toFixed(3)},${(s.endMs / 1000).toFixed(3)})`).join('+')})'`
      : '';

    logger.info({
      mode,
      pipDimensions: { pipWidth, pipHeight, pipX, pipY },
      pipBorderRadius,
      pipOpacity: pip.opacity,
      pipDisableExpr: pipDisableExpr ? 'yes' : 'no',
    }, 'Rendering with PiP layout');
    filterComplex = [
      // Scale Remotion visuals to full screen
      `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[bg]`,
      // Scale source video to PiP size with crop/pan + styling
      `[0:v]${pipCropFilter}${pipFilterChain}[pip]`,
      // Overlay PiP on background (disabled during fullscreen visual segments)
      `[bg][pip]overlay=${pipX}:${pipY}:format=auto${pipDisableExpr}[outv]`
    ].join(';');

  } else if (mode === 'stacked') {
    // Stacked (top/bottom)
    const visualsPercent = split.ratio / 100;
    const videoPercent = 1 - visualsPercent;
    const gap = Math.round(split.gap);
    const isVisualsFirst = split.position === 'visuals-first';

    const visualsHeight = Math.round((height - gap) * visualsPercent);
    const videoHeight = Math.round((height - gap) * videoPercent);

    logger.info({
      mode,
      splitSettings: split,
      dimensions: { visualsHeight, videoHeight, gap },
    }, 'Rendering with stacked layout');

    // Use scale + crop to fill containers without black bars
    // IMPORTANT: Visual stream (1:v) must crop from top-left (0:0) because Remotion
    // renders visual content at position (0,0) with effective dimensions.
    // Source video uses user's crop/pan/scale settings for preview-accurate positioning.
    const splitHCropFilter = videoCrop
      ? buildVideoCropFilter(videoCrop, width, videoHeight)
      : `scale=${width}:${videoHeight}:force_original_aspect_ratio=increase,crop=${width}:${videoHeight},setsar=1`;

    if (isVisualsFirst) {
      filterComplex = [
        `[1:v]scale=${width}:${visualsHeight}:force_original_aspect_ratio=increase,crop=${width}:${visualsHeight}:0:0,setsar=1[visuals]`,
        `[0:v]${splitHCropFilter}[video]`,
        `[visuals][video]vstack=inputs=2[outv]`
      ].join(';');
    } else {
      filterComplex = [
        `[0:v]${splitHCropFilter}[video]`,
        `[1:v]scale=${width}:${visualsHeight}:force_original_aspect_ratio=increase,crop=${width}:${visualsHeight}:0:0,setsar=1[visuals]`,
        `[video][visuals]vstack=inputs=2[outv]`
      ].join(';');
    }

  } else if (mode === 'split-vertical') {
    // Split vertical (left/right)
    const visualsPercent = split.ratio / 100;
    const videoPercent = 1 - visualsPercent;
    const gap = Math.round(split.gap);
    const isVisualsFirst = split.position === 'visuals-first';

    const visualsWidth = Math.round((width - gap) * visualsPercent);
    const videoWidth = Math.round((width - gap) * videoPercent);

    logger.info({
      mode,
      splitSettings: split,
      dimensions: { visualsWidth, videoWidth, gap },
    }, 'Rendering with vertical split layout');

    // Use scale + crop to fill containers without black bars
    // IMPORTANT: Visual stream (1:v) must crop from top-left (0:0) because Remotion
    // renders visual content at position (0,0) with effective dimensions.
    // Source video uses user's crop/pan/scale settings for preview-accurate positioning.
    const splitVCropFilter = videoCrop
      ? buildVideoCropFilter(videoCrop, videoWidth, height)
      : `scale=${videoWidth}:${height}:force_original_aspect_ratio=increase,crop=${videoWidth}:${height},setsar=1`;

    if (isVisualsFirst) {
      filterComplex = [
        `[1:v]scale=${visualsWidth}:${height}:force_original_aspect_ratio=increase,crop=${visualsWidth}:${height}:0:0,setsar=1[visuals]`,
        `[0:v]${splitVCropFilter}[video]`,
        `[visuals][video]hstack=inputs=2[outv]`
      ].join(';');
    } else {
      filterComplex = [
        `[0:v]${splitVCropFilter}[video]`,
        `[1:v]scale=${visualsWidth}:${height}:force_original_aspect_ratio=increase,crop=${visualsWidth}:${height}:0:0,setsar=1[visuals]`,
        `[video][visuals]hstack=inputs=2[outv]`
      ].join(';');
    }

  } else {
    // Fallback to PiP with defaults (use crop for no black bars)
    const pipWidth = Math.round(width * 0.25);
    const pipHeight = Math.round(pipWidth);
    const pipX = width - pipWidth - 16;
    const pipY = height - pipHeight - 16;

    const fallbackCropFilter = videoCrop
      ? buildVideoCropFilter(videoCrop, pipWidth, pipHeight)
      : `scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=increase,crop=${pipWidth}:${pipHeight},setsar=1`;

    // Build enable expression to hide PiP during fullscreen visual segments
    const fallbackDisableExpr = fullscreenVisualSegments && fullscreenVisualSegments.length > 0
      ? `:enable='not(${fullscreenVisualSegments.map(s => `between(t,${(s.startMs / 1000).toFixed(3)},${(s.endMs / 1000).toFixed(3)})`).join('+')})'`
      : '';

    filterComplex = [
      `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[bg]`,
      `[0:v]${fallbackCropFilter}[pip]`,
      `[bg][pip]overlay=${pipX}:${pipY}${fallbackDisableExpr}[outv]`
    ].join(';');
  }

  // Per-scene display mode switching via FFmpeg overlay layers with enable expressions
  // Fullscreen visual segments: Remotion fills entire canvas (hides split/pip layout)
  // Gap segments: Source video fills entire canvas (no visuals active)
  // Overlay segments: Source video fullscreen with Remotion at reduced opacity on top
  const needsFullscreen = fullscreenVisualSegments && fullscreenVisualSegments.length > 0;
  const needsOverlay = overlaySegments && overlaySegments.length > 0;
  const needsGaps = gapSegments && gapSegments.length > 0;
  const hasNonPipSegments = needsFullscreen || needsOverlay || needsGaps;

  if (hasNonPipSegments) {
    // Calculate how many copies of each stream we need
    // Source (0:v): 1 for layout + 1 per gap/overlay background segment
    const gapAndOverlaySegs = [...(gapSegments || []), ...(overlaySegments || [])];
    const srcExtraCount = gapAndOverlaySegs.length;
    const srcSplitCount = 1 + srcExtraCount;
    // Remotion (1:v): 1 for layout + 1 per fullscreen segment + 1 per overlay segment
    // Each segment needs its own stream to avoid chained-fade interference
    const fsCount = fullscreenVisualSegments?.length || 0;
    const ovlCount = overlaySegments?.length || 0;
    const visSplitCount = 1 + fsCount + ovlCount;

    // Replace raw input refs in existing filter with split output labels
    filterComplex = filterComplex.replace(/\[0:v\]/g, '[src_layout]');
    filterComplex = filterComplex.replace(/\[1:v\]/g, '[vis_layout]');

    // Build split filters
    const splitFilters: string[] = [];

    // Source split — one stream per gap/overlay background segment
    const srcLabels = ['src_layout'];
    for (let i = 0; i < srcExtraCount; i++) srcLabels.push(`src_extra_${i}`);
    if (srcSplitCount > 1) {
      splitFilters.push(`[0:v]split=${srcSplitCount}${srcLabels.map(l => `[${l}]`).join('')}`);
    } else {
      splitFilters.push(`[0:v]copy[src_layout]`);
    }

    // Remotion split — one stream per fullscreen/overlay segment
    const visLabels = ['vis_layout'];
    for (let i = 0; i < fsCount; i++) visLabels.push(`vis_fs_${i}`);
    for (let i = 0; i < ovlCount; i++) visLabels.push(`vis_ovl_${i}`);
    if (visSplitCount > 1) {
      splitFilters.push(`[1:v]split=${visSplitCount}${visLabels.map(l => `[${l}]`).join('')}`);
    } else {
      splitFilters.push(`[1:v]copy[vis_layout]`);
    }

    // Prepend split filters before existing layout filter
    filterComplex = [...splitFilters, filterComplex].join(';');

    // Rename current output to chain through overlay layers
    let currentOut = 'outv';

    // Layer 1: Fullscreen visual — Remotion fills canvas (hides split/pip)
    // Each segment gets its own stream to avoid chained-fade interference:
    // fade=t=in:alpha=1 sets alpha=0 for ALL frames before st, so a later
    // segment's fade-in would destroy an earlier segment's alpha.
    if (needsFullscreen) {
      const prevOut = currentOut;
      filterComplex = filterComplex.replace(`[${prevOut}]`, `[${prevOut === 'outv' ? 'base' : prevOut}]`);
      let chainLabel = prevOut === 'outv' ? 'base' : prevOut;

      for (let i = 0; i < fullscreenVisualSegments!.length; i++) {
        const seg = fullscreenVisualSegments![i];
        const isLast = i === fullscreenVisualSegments!.length - 1;
        const outLabel = isLast ? 'after_fs' : `after_fs_${i}`;
        const inputLabel = `vis_fs_${i}`;
        const enableExpr = `between(t,${(seg.startMs / 1000).toFixed(3)},${(seg.endMs / 1000).toFixed(3)})`;

        const hasFades = (seg.enterDurationMs || 0) > 0 || (seg.exitDurationMs || 0) > 0;
        if (hasFades) {
          const fades: string[] = [];
          if ((seg.enterDurationMs || 0) > 0) {
            fades.push(`fade=t=in:st=${(seg.startMs / 1000).toFixed(3)}:d=${((seg.enterDurationMs || 0) / 1000).toFixed(3)}:alpha=1`);
          }
          if ((seg.exitDurationMs || 0) > 0) {
            fades.push(`fade=t=out:st=${((seg.endMs - (seg.exitDurationMs || 0)) / 1000).toFixed(3)}:d=${((seg.exitDurationMs || 0) / 1000).toFixed(3)}:alpha=1`);
          }
          filterComplex += `;[${inputLabel}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,format=yuva420p,${fades.join(',')}[${inputLabel}_f]`;
          filterComplex += `;[${chainLabel}][${inputLabel}_f]overlay=0:0:enable='${enableExpr}':format=auto[${outLabel}]`;
        } else {
          // No transitions — skip yuva420p conversion, just hard overlay
          filterComplex += `;[${inputLabel}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[${inputLabel}_s]`;
          filterComplex += `;[${chainLabel}][${inputLabel}_s]overlay=0:0:enable='${enableExpr}'[${outLabel}]`;
        }
        chainLabel = outLabel;
      }
      currentOut = 'after_fs';
    }

    // Layer 2: Gap + Overlay background — Source video fills canvas
    // Per-segment streams (same fix as Layer 1) to avoid chained-fade interference.
    if (gapAndOverlaySegs.length > 0) {
      const prevOut = currentOut;
      if (prevOut === 'outv') {
        filterComplex = filterComplex.replace('[outv]', '[base]');
      }
      let chainLabel = prevOut === 'outv' ? 'base' : prevOut;

      for (let i = 0; i < gapAndOverlaySegs.length; i++) {
        const seg = gapAndOverlaySegs[i];
        const isLast = i === gapAndOverlaySegs.length - 1;
        const outLabel = isLast ? 'after_src' : `after_src_${i}`;
        const inputLabel = `src_extra_${i}`;
        const enableExpr = `between(t,${(seg.startMs / 1000).toFixed(3)},${(seg.endMs / 1000).toFixed(3)})`;

        const hasFades = (seg.enterDurationMs || 0) > 0 || (seg.exitDurationMs || 0) > 0;
        if (hasFades) {
          const fades: string[] = [];
          if ((seg.enterDurationMs || 0) > 0) {
            fades.push(`fade=t=in:st=${(seg.startMs / 1000).toFixed(3)}:d=${((seg.enterDurationMs || 0) / 1000).toFixed(3)}:alpha=1`);
          }
          if ((seg.exitDurationMs || 0) > 0) {
            fades.push(`fade=t=out:st=${((seg.endMs - (seg.exitDurationMs || 0)) / 1000).toFixed(3)}:d=${((seg.exitDurationMs || 0) / 1000).toFixed(3)}:alpha=1`);
          }
          filterComplex += `;[${inputLabel}]${srcCropFull},format=yuva420p,${fades.join(',')}[${inputLabel}_f]`;
          filterComplex += `;[${chainLabel}][${inputLabel}_f]overlay=0:0:enable='${enableExpr}':format=auto[${outLabel}]`;
        } else {
          filterComplex += `;[${inputLabel}]${srcCropFull}[${inputLabel}_s]`;
          filterComplex += `;[${chainLabel}][${inputLabel}_s]overlay=0:0:enable='${enableExpr}'[${outLabel}]`;
        }
        chainLabel = outLabel;
      }
      currentOut = 'after_src';
    }

    // Layer 3: Overlay visuals — Remotion on top of source with alpha compositing.
    // Uses overlay filter with reduced alpha (colorchannelmixer=aa=OP) to match the
    // editor preview's CSS opacity compositing. Previous screen blend approach caused
    // heavy color tinting from the composition's background (screen formula brightens
    // every pixel, whereas alpha compositing simply blends at the target opacity).
    // Each segment gets its own stream (same chained-fade fix as fullscreen).
    if (needsOverlay) {
      const prevOut = currentOut;
      if (prevOut === 'outv') {
        filterComplex = filterComplex.replace('[outv]', '[base]');
      }
      let chainLabel = prevOut === 'outv' ? 'base' : prevOut;

      for (let i = 0; i < overlaySegments!.length; i++) {
        const seg = overlaySegments![i];
        const isLast = i === overlaySegments!.length - 1;
        const outLabel = isLast ? 'after_ovl' : `after_ovl_${i}`;
        const inputLabel = `vis_ovl_${i}`;
        const enableExpr = `between(t,${(seg.startMs / 1000).toFixed(3)},${(seg.endMs / 1000).toFixed(3)})`;
        const opacity = Math.max(0, Math.min(1, seg.overlayOpacity ?? 0.85));

        const hasFades = (seg.enterDurationMs || 0) > 0 || (seg.exitDurationMs || 0) > 0;
        if (hasFades) {
          // Alpha fades for smooth transitions — fade the alpha channel so the
          // overlay smoothly appears/disappears over the source video.
          const fades: string[] = [];
          if ((seg.enterDurationMs || 0) > 0) {
            fades.push(`fade=t=in:st=${(seg.startMs / 1000).toFixed(3)}:d=${((seg.enterDurationMs || 0) / 1000).toFixed(3)}:alpha=1`);
          }
          if ((seg.exitDurationMs || 0) > 0) {
            fades.push(`fade=t=out:st=${((seg.endMs - (seg.exitDurationMs || 0)) / 1000).toFixed(3)}:d=${((seg.exitDurationMs || 0) / 1000).toFixed(3)}:alpha=1`);
          }
          filterComplex += `;[${inputLabel}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,format=yuva420p,colorchannelmixer=aa=${opacity},${fades.join(',')}[${inputLabel}_f]`;
          filterComplex += `;[${chainLabel}][${inputLabel}_f]overlay=0:0:enable='${enableExpr}':format=auto[${outLabel}]`;
        } else {
          filterComplex += `;[${inputLabel}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,format=yuva420p,colorchannelmixer=aa=${opacity}[${inputLabel}_s]`;
          filterComplex += `;[${chainLabel}][${inputLabel}_s]overlay=0:0:enable='${enableExpr}':format=auto[${outLabel}]`;
        }
        chainLabel = outLabel;
      }
      currentOut = 'after_ovl';
    }

    // Final output must be [outv] for downstream subtitle filter and mapping
    if (currentOut !== 'outv') {
      filterComplex += `;[${currentOut}]copy[outv]`;
    }

    logger.info({
      fullscreenVisualCount: fullscreenVisualSegments?.length || 0,
      overlayCount: overlaySegments?.length || 0,
      gapCount: gapSegments?.length || 0,
      srcSplitCount,
      visSplitCount,
    }, 'Added per-scene display mode overlays to FFmpeg filter');
  }

  // Generate ASS subtitles if we have any - AFTER layout settings are parsed
  // so we can position captions correctly based on layout mode
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, width, height, layoutSettings, resolvedFontFamily, fontSizeMultiplier);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename, mode, resolvedFontFamily, fontSizeMultiplier }, 'Generated ASS subtitles with layout');
  }

  // Build video clip input mappings and filters
  const clipInputs: Array<{ sceneId: string; inputIdx: number; clipPath: string }> = [];
  let nextInputIdx = 2; // 0=source, 1=remotion, clips start at 2

  if (videoClipPaths && videoClipPaths.size > 0 && sceneTimestamps) {
    for (const [sceneId, clipPath] of videoClipPaths) {
      clipInputs.push({ sceneId, inputIdx: nextInputIdx, clipPath });
      nextInputIdx++;
    }
    logger.info({ clipCount: clipInputs.length }, 'Adding video clip inputs to FFmpeg');
  }

  // Add video clip overlay filters (before subtitles, so clips appear under captions)
  if (clipInputs.length > 0 && sceneTimestamps) {
    // Chain clip overlays into the filter
    filterComplex = filterComplex.replace('[outv]', '[pre_clips]');
    let chainLabel = 'pre_clips';

    for (let i = 0; i < clipInputs.length; i++) {
      const clip = clipInputs[i];
      const isLast = i === clipInputs.length - 1;
      const outLabel = isLast ? 'outv' : `after_clip_${i}`;

      // Find scene timing from timestamps using sourceSceneId
      const sceneTs = sceneTimestamps.find(s =>
        String(s.sourceSceneId) === clip.sceneId
      );
      if (!sceneTs) {
        logger.warn({ sceneId: clip.sceneId }, 'No timestamp found for video clip scene');
        if (isLast) {
          // If this is the last clip but we couldn't find timing, just pass through
          filterComplex += `;[${chainLabel}]copy[outv]`;
        }
        continue;
      }

      const startSec = (sceneTs.startMs / 1000).toFixed(3);
      const endSec = (sceneTs.endMs / 1000).toFixed(3);

      // Scale clip to canvas size and overlay during scene time range
      filterComplex += `;[${clip.inputIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,setpts=PTS-STARTPTS[clip_${clip.sceneId}]`;
      filterComplex += `;[${chainLabel}][clip_${clip.sceneId}]overlay=0:0:enable='between(t,${startSec},${endSec})'[${outLabel}]`;

      chainLabel = outLabel;
    }
  }

  // Add subtitles filter if we have them
  if (assFilename) {
    filterComplex = filterComplex.replace('[outv]', '[pre]') + `;[pre]subtitles=${assFilename}:fontsdir=${fontsDir}[outv]`;
  }

  // Build FFmpeg args
  // Input order: 0=source, 1=remotion, 2..N=clips (optional), then audio
  const args = [
    '-i', 'source.mp4',
    '-i', 'remotion.mp4',
  ];

  // Add clip inputs
  for (const clip of clipInputs) {
    args.push('-i', clip.clipPath);
  }

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-filter_complex', filterComplex,
    '-map', '[outv]',
  );

  // Map audio (audio input index = 2 + number of clip inputs)
  if (audioFilename) {
    const audioInputIdx = 2 + clipInputs.length;
    args.push('-map', `${audioInputIdx}:a`);
  } else {
    args.push('-map', '0:a?');  // Use source audio if available
  }

  // Encoding: 'faster' preset balances quality and memory usage to avoid OOM
  args.push(
    '-c:v', 'libx264',
    '-preset', 'faster',
    '-crf', '18',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    basename(outputPath)
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg PiP render started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    let lastReportedProgress = 0;
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();

      // Parse FFmpeg progress from stderr (e.g., "time=00:01:23.45")
      if (onProgress && durationSeconds > 0) {
        const timeMatch = chunk.toString().match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseInt(timeMatch[3], 10);
          const centiseconds = parseInt(timeMatch[4], 10);
          const currentTime = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
          const progress = Math.min(currentTime / durationSeconds, 1);
          // Only report if progress increased by at least 1%
          if (progress - lastReportedProgress >= 0.01) {
            lastReportedProgress = progress;
            onProgress(progress);
          }
        }
      }
    });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg PiP render completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg PiP render failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err: Error) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

/**
 * Finalize Remotion video by adding subtitles and audio.
 * The Remotion video is used fullscreen (exactly what user sees in preview).
 */
export async function finalizeRemotionVideo(options: FinalizeRemotionVideoOptions): Promise<void> {
  const {
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width,
    height,
    fontsDir = escapePathForFilter(SYSTEM_FONTS_DIR),
    resolvedFontFamily,
    fontSizeMultiplier = 1,
  } = options;

  const { spawn } = await import('child_process');

  // Copy Remotion video to working directory
  const localRemotionPath = join(workDir, 'remotion.mp4');
  await copyFile(remotionVideoPath, localRemotionPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles if we have any
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, width, height, undefined, resolvedFontFamily, fontSizeMultiplier);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename, resolvedFontFamily, fontSizeMultiplier }, 'Generated ASS subtitles');
  }

  logger.info({
    remotionVideoPath,
    audioPath,
    subtitleCount: subtitles.length,
    outputPath,
  }, 'Finalizing Remotion video with subtitles and audio');

  // Build FFmpeg args
  const args = ['-i', 'remotion.mp4'];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push('-y');

  // Add video filter for subtitles if we have them
  if (assFilename) {
    args.push('-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`);
  } else {
    args.push('-c:v', 'copy');  // No re-encode needed if no subtitles
  }

  // Map video (already added via -vf or -c:v copy)
  if (audioFilename) {
    args.push('-map', '0:v', '-map', '1:a');
    args.push('-c:a', 'aac');
  } else {
    // No audio - check if Remotion video has audio
    args.push('-map', '0:v', '-map', '0:a?');
    args.push('-c:a', 'aac');
  }

  // Encoding settings (only if we have subtitles to burn)
  if (assFilename) {
    args.push('-c:v', 'libx264', '-preset', 'faster', '-crf', '18', '-threads', '4');
  }

  args.push('-shortest', basename(outputPath));

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg finalize started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg finalize completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg finalize failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err: Error) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

/**
 * Composite source video + Remotion visuals + subtitles + audio into final output.
 * Uses picture-in-picture layout with Remotion visuals in corner.
 */
export async function compositeFullVideo(options: CompositeFullVideoOptions): Promise<void> {
  const {
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    projectWidth: fullWidth,
    projectHeight: fullHeight,
    fontsDir = escapePathForFilter(SYSTEM_FONTS_DIR),
    fontSizeMultiplier = 1,
  } = options;

  // Render at full resolution for caption/text quality
  const projectWidth = fullWidth;
  const projectHeight = fullHeight;

  logger.info({
    projectWidth,
    projectHeight,
  }, 'Compositing at full resolution');

  const { spawn } = await import('child_process');

  // Copy files to working directory with simple names
  const localSourcePath = join(workDir, 'source.mp4');
  const localRemotionPath = join(workDir, 'remotion.mp4');
  await copyFile(sourceVideoPath, localSourcePath);
  await copyFile(remotionVideoPath, localRemotionPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles if we have any
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, projectWidth, projectHeight, undefined, undefined, fontSizeMultiplier);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename }, 'Generated ASS subtitles');
  }

  logger.info({
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitleCount: subtitles.length,
    outputPath,
  }, 'Compositing full video');

  // Build FFmpeg filter complex
  // Layout: Source video as main, Remotion visuals scaled to PiP in top-right corner
  // Then burn subtitles on top
  const pipScale = 0.3; // PiP is 30% of source video size
  const pipWidth = Math.round(projectWidth * pipScale);
  const pipHeight = Math.round(projectHeight * pipScale);
  const pipX = projectWidth - pipWidth - 20; // 20px padding from right
  const pipY = 20; // 20px padding from top

  let filterComplex = `[1:v]scale=${pipWidth}:${pipHeight}[pip];[0:v][pip]overlay=${pipX}:${pipY}`;

  // Add subtitles filter if we have them
  if (assFilename) {
    filterComplex += `,subtitles=${assFilename}:fontsdir=${fontsDir}`;
  }

  filterComplex += '[outv]';

  // Build FFmpeg args
  const args = [
    '-i', 'source.mp4',
    '-i', 'remotion.mp4',
  ];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-filter_complex', filterComplex,
    '-map', '[outv]',
  );

  // Map audio
  if (audioFilename) {
    args.push('-map', '2:a');
  } else {
    args.push('-map', '0:a?');
  }

  // Encoding: 'faster' preset balances quality and memory usage
  args.push(
    '-c:v', 'libx264',
    '-preset', 'faster',
    '-crf', '18',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    basename(outputPath)
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg full composite started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg full composite completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg full composite failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err: Error) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

/**
 * Encode video with subtitles burned in (no Remotion visuals).
 */
export async function encodeVideoWithSubtitles(
  videoPath: string,
  audioPath: string | null,
  subtitles: SubtitleItem[],
  outputPath: string,
  workDir: string,
  canvasWidth: number = 1080,
  canvasHeight: number = 1920,
  fontsDir: string = escapePathForFilter(SYSTEM_FONTS_DIR),
  resolvedFontFamily?: string,
  fontSizeMultiplier: number = 1,
): Promise<void> {
  const { spawn } = await import('child_process');

  // Copy video to working directory
  const localVideoPath = join(workDir, 'input.mp4');
  await copyFile(videoPath, localVideoPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles using actual canvas dimensions
  const assFilename = 'subtitles.ass';
  const assContent = generateASSForComposite(subtitles, canvasWidth, canvasHeight, undefined, resolvedFontFamily, fontSizeMultiplier);
  await writeFile(join(workDir, assFilename), assContent, 'utf-8');

  logger.info({ subtitleCount: subtitles.length, audioPath, fontSizeMultiplier }, 'Encoding video with subtitles');

  const args = [
    '-i', 'input.mp4',
  ];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`,
  );

  if (audioFilename) {
    args.push('-map', '0:v', '-map', '1:a');
  }

  // Encoding: 'faster' preset balances quality and memory usage
  args.push(
    '-c:v', 'libx264',
    '-preset', 'faster',
    '-crf', '18',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    basename(outputPath)
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg subtitle encode started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg subtitle encode completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg subtitle encode failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err: Error) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
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

/**
 * Group visual items by their overlay zone
 */
export function groupVisualsByZone(
  visualItems: Array<{ data: Record<string, unknown>; startMs: number; endMs: number }>
): Record<OverlayZone, typeof visualItems> {
  const grouped: Record<OverlayZone, typeof visualItems> = {
    'background': [],
    'behind': [],
    'frame': [],
    'lower-third': [],
    'top': [],
    'none': [],
  };

  for (const item of visualItems) {
    const zone = (item.data.overlayZone as OverlayZone | undefined) || 'none';
    grouped[zone].push(item);
  }

  return grouped;
}
