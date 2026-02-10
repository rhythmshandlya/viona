import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, access, constants, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, projects, tracks, timelineItems, jobs, visuals } from '../db/index.js';
import { downloadFile, uploadFile, listObjects } from '../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { renderVideo, SubtitleItem, SubtitleStyle } from '@reelify/renderer';
import { renderMedia, selectComposition, getCompositions } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';

export interface LayoutSettings {
  mode: 'pip' | 'split-horizontal' | 'split-vertical';
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
  };
  split: {
    position: 'visuals-first' | 'video-first';
    ratio: number;
    gap: number;
  };
}

const PIP_SIZE_MAP: Record<string, number> = {
  small: 18,
  medium: 25,
  large: 35,
  custom: 25,
};

export interface RenderJobData {
  projectId: string;
  jobId: string;
  layoutSettings?: LayoutSettings;
}

export async function processRenderJob(job: Job<RenderJobData>) {
  const { projectId, jobId, layoutSettings } = job.data;
  const workDir = join(tmpdir(), `reelify-render-${nanoid()}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading project...');

    // Load project data
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const projectTracks = await db.query.tracks.findMany({
      where: eq(tracks.projectId, projectId),
    });

    // Get all timeline items for all tracks
    const allItems = [];
    for (const track of projectTracks) {
      const items = await db.select().from(timelineItems)
        .where(eq(timelineItems.trackId, track.id));
      allItems.push(...items);
    }

    await publishJobProgress(jobId, 10, 'Downloading video...');

    // Download original video
    const videoPath = join(workDir, 'input.mp4');
    await downloadFile('uploads', project.videoKey!, videoPath);

    await publishJobProgress(jobId, 20, 'Preparing render...');

    // Convert timeline items to subtitle format
    const subtitles = convertToSubtitles(allItems);
    const outputPath = join(workDir, 'output.mp4');

    // Debug: Log subtitle data to verify styles are being passed
    logger.info({
      subtitleCount: subtitles.length,
      firstSubtitleStyle: subtitles[0]?.style,
      firstSubtitleText: subtitles[0]?.text,
      allItemTypes: allItems.map((i: any) => i.type),
    }, 'Converted subtitles with styles');

    // Check for enhanced audio
    const audioItems = allItems.filter((item: any) => item.type === 'audio');
    const enhancedAudioItem = audioItems.find((item: any) => {
      const data = item.data as any;
      return data.isEnhanced && data.src;
    });

    // Download enhanced audio if available
    let enhancedAudioPath: string | null = null;
    if (enhancedAudioItem) {
      const audioData = enhancedAudioItem.data as any;
      // Extract the audio key from the src URL (e.g., /api/media/outputs/xxx/enhanced.m4a -> xxx/enhanced.m4a)
      const audioSrc = audioData.src as string;
      const audioKeyMatch = audioSrc.match(/\/media\/outputs\/(.+)$/);
      if (audioKeyMatch) {
        const audioKey = audioKeyMatch[1];
        enhancedAudioPath = join(workDir, 'enhanced.m4a');
        try {
          await downloadFile('outputs', audioKey, enhancedAudioPath);
          logger.info({ audioKey, enhancedAudioPath }, 'Downloaded enhanced audio');
        } catch (err) {
          logger.warn({ err, audioKey }, 'Failed to download enhanced audio, using original');
          enhancedAudioPath = null;
        }
      }
    }

    // Check for visual compositions to render with Remotion SSR
    const projectVisual = await db.query.visuals.findFirst({
      where: eq(visuals.projectId, projectId),
    });

    // Render path with Remotion visuals - export exactly what user sees in preview
    if (projectVisual) {
      await publishJobProgress(jobId, 30, 'Rendering visuals with Remotion...');

      // Get bundle path from compositionId (hyphens for directory, underscores for composition ID)
      const bundleDirName = projectVisual.compositionId.replace(/_/g, '-');
      const bundlePath = join(config.remotion.bundleOutputDir, bundleDirName);

      const visualWidth = projectVisual.width || 1080;
      const visualHeight = projectVisual.height || 1920;

      logger.info({
        projectId,
        compositionId: projectVisual.compositionId,
        bundlePath,
        hasEnhancedAudio: !!enhancedAudioPath,
        subtitleCount: subtitles.length,
        visualWidth,
        visualHeight,
      }, 'Starting Remotion SSR render');

      // Step 1: Render Remotion composition exactly as shown in preview
      // Note: compositionId uses underscores (as registered in bundle), bundlePath uses hyphens
      const remotionTempPath = join(workDir, 'remotion_visuals.mp4');
      await renderWithRemotion({
        bundlePath,
        compositionId: projectVisual.compositionId,
        outputPath: remotionTempPath,
        onProgress: (progress) => {
          const jobProgress = 30 + Math.round(progress * 40);
          publishJobProgress(jobId, jobProgress, `Rendering: ${Math.round(progress * 100)}%`);
        },
      });

      logger.info({ projectId, remotionTempPath }, 'Remotion render complete');

      await publishJobProgress(jobId, 75, 'Compositing video with audio and subtitles...');

      // Step 2: Composite source video + Remotion visuals + audio + subtitles
      // Use layoutSettings from export request for exact preview match
      await renderWithPiPLayout({
        sourceVideoPath: videoPath,
        remotionVideoPath: remotionTempPath,
        audioPath: enhancedAudioPath,
        subtitles,
        outputPath,
        workDir,
        width: visualWidth,
        height: visualHeight,
        layoutSettings,
      });

      logger.info({ projectId, outputPath }, 'Export complete with full composite');
    } else {
      // No visuals - use FFmpeg with subtitles and audio
      await publishJobProgress(jobId, 30, 'Encoding video...');

      logger.info({
        hasEnhancedAudio: !!enhancedAudioPath,
        subtitleCount: subtitles.length,
      }, 'No visuals found, using FFmpeg encode');

      if (subtitles.length > 0) {
        // Render with subtitles
        await encodeVideoWithSubtitles(videoPath, enhancedAudioPath, subtitles, outputPath, workDir);
      } else {
        await encodeVideoWithAudio(videoPath, enhancedAudioPath, outputPath);
      }
    }

    await publishJobProgress(jobId, 85, 'Uploading result...');

    // Upload output
    const outputKey = `${nanoid()}/output.mp4`;
    await uploadFile('outputs', outputKey, outputPath);

    // Update project
    await db.update(projects)
      .set({
        status: 'complete',
        outputKey,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId }, 'Render complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Render failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'failed' })
      .where(eq(projects.id, projectId));

    await publishJobError(jobId, errorMessage);

    throw error;
  } finally {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

function convertToSubtitles(items: any[]): SubtitleItem[] {
  // Frontend uses 'caption' type, not 'subtitle'
  return items
    .filter(item => item.type === 'caption' || item.type === 'subtitle')
    .map(item => {
      const data = item.data as any;
      return {
        id: item.id,
        startMs: item.startMs,
        endMs: item.endMs,
        text: data.text || '',
        words: data.words || [{ text: data.text || '', startMs: item.startMs, endMs: item.endMs }],
        style: data.style,
      };
    });
}

async function copyVideo(inputPath: string, outputPath: string): Promise<void> {
  const ffmpeg = (await import('fluent-ffmpeg')).default;

  // Use native paths - FFmpeg handles them correctly on Windows
  logger.info({ inputPath, outputPath }, 'Copying video with FFmpeg');

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(['-c', 'copy'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

async function encodeVideoWithAudio(
  videoPath: string,
  audioPath: string | null,
  outputPath: string
): Promise<void> {
  const { spawn } = await import('child_process');
  const { basename, dirname } = await import('path');
  const { copyFile } = await import('fs/promises');

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
      proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info({ outputPath }, 'FFmpeg encode completed');
          resolve();
        } else {
          logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg encode failed');
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
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
async function renderSubtitlesWithFFmpeg(
  inputPath: string,
  outputPath: string,
  items: any[],
  project: any
): Promise<void> {
  const ffmpeg = (await import('fluent-ffmpeg')).default;
  const { access, constants } = await import('fs/promises');

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
    // No subtitles, just copy the video using native paths
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('start', (cmd) => logger.info({ cmd }, 'FFmpeg copy started'))
        .on('end', () => {
          logger.info({ outputPath }, 'FFmpeg copy completed');
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          logger.error({ err, stdout, stderr }, 'FFmpeg copy failed');
          reject(err);
        })
        .run();
    });
  }

  // Create ASS subtitle file for FFmpeg
  const assPath = inputPath.replace('.mp4', '.ass');
  const assContent = generateASSSubtitles(subtitles, project);

  const { writeFile } = await import('fs/promises');
  await writeFile(assPath, assContent, 'utf-8');
  logger.info({ assPath }, 'ASS subtitle file created');

  // Burn subtitles into video using subtitles filter
  // Use relative path by extracting just the filename - FFmpeg will find it in cwd
  const { basename, dirname } = await import('path');
  const { spawn } = await import('child_process');
  const assFilename = basename(assPath);  // Just "input.ass"
  const workingDir = dirname(assPath);    // The temp directory

  logger.info({ assPath, assFilename, workingDir }, 'Using subtitles filter with relative path');

  // Use spawn directly with cwd to avoid path escaping issues
  return new Promise((resolve, reject) => {
    const args = [
      '-i', 'input.mp4',
      '-y',
      '-vf', `subtitles=${assFilename}`,
      '-c:a', 'copy',
      'output.mp4'
    ];

    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workingDir }, 'FFmpeg subtitle burn started');

    const proc = spawn('ffmpeg', args, {
      cwd: workingDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg subtitle burn completed');
        resolve();
      } else {
        logger.error({ code, stderr }, 'FFmpeg subtitle burn failed');
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

function generateASSSubtitles(subtitles: any[], project: any): string {
  const width = project.sourceWidth || 1920;
  const height = project.sourceHeight || 1080;

  // ASS header
  let ass = `[Script Info]
Title: Reelify Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Add dialogue entries
  for (const subtitle of subtitles) {
    const data = subtitle.data as any;
    const startTime = formatASSTime(subtitle.startMs);
    const endTime = formatASSTime(subtitle.endMs);
    const text = (data.text || '').replace(/\n/g, '\\N');

    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
  }

  return ass;
}

function formatASSTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

// =============================================================================
// Remotion Server-Side Rendering
// =============================================================================

interface RenderRemotionOptions {
  bundlePath: string;
  compositionId: string;
  outputPath: string;
  onProgress?: (progress: number) => void;
}

/**
 * Download a Remotion bundle from S3 storage if it doesn't exist locally.
 * Bundles are uploaded during visual generation and need to be restored after container restarts.
 */
async function ensureBundleExists(bundlePath: string, compositionId: string): Promise<void> {
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
 * Rebuild the Remotion bundle using the proper bundle() API.
 * Creates a temp entry point that imports composition.cjs.js, then bundles it.
 */
async function rebuildBundleFromCJS(bundlePath: string, compositionId: string): Promise<string> {
  const cjsPath = join(bundlePath, 'composition.cjs.js');

  logger.info({ cjsPath, compositionId }, 'Rebuilding bundle from composition.cjs.js');

  // Check if composition.cjs.js exists
  try {
    await access(cjsPath, constants.R_OK);
  } catch {
    throw new Error(`composition.cjs.js not found at ${cjsPath}`);
  }

  // Create a temp directory for our entry point
  const tempDir = join(tmpdir(), `remotion-rebuild-${nanoid()}`);
  await mkdir(tempDir, { recursive: true });

  // Copy composition.cjs.js to temp dir, fixing the composition ID
  // Remotion doesn't allow underscores in IDs, only hyphens
  const cjsContent = await readFile(cjsPath, 'utf-8');
  // Replace the composition ID from underscores to hyphens
  const fixedCjsContent = cjsContent.replace(
    new RegExp(compositionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
    compositionId.replace(/_/g, '-')
  );
  const tempCjsPath = join(tempDir, 'composition.cjs.js');
  await writeFile(tempCjsPath, fixedCjsContent, 'utf-8');

  // Create a minimal entry point that imports the CJS file
  // The CJS file already calls registerRoot() at the end
  const entryContent = `
// Entry point for Remotion bundle
// This imports the pre-compiled composition which registers itself
require('./composition.cjs.js');
`;

  const entryPath = join(tempDir, 'index.js');
  await writeFile(entryPath, entryContent, 'utf-8');

  logger.info({ entryPath, tempDir }, 'Created temp entry point');

  // Use Remotion's bundle() to create a proper bundle
  // ignoreRegisterRootWarning because registerRoot is in the required CJS file
  const newBundleLocation = await bundle({
    entryPoint: entryPath,
    outDir: bundlePath,
    ignoreRegisterRootWarning: true,
  });

  // Clean up temp dir
  await rm(tempDir, { recursive: true, force: true });

  logger.info({ newBundleLocation, compositionId }, 'Bundle rebuilt successfully');
  return newBundleLocation;
}

/**
 * Render a Remotion composition to a video file using SSR.
 * Uses the existing bundle created by the visual generator.
 * If the composition is not found, attempts to rebuild the bundle from source.
 */
async function renderWithRemotion(options: RenderRemotionOptions): Promise<void> {
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

  logger.info({
    compositionId: composition.id,
    width: composition.width,
    height: composition.height,
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
  }, 'Composition selected');

  // Render the composition to video
  // Limit concurrency to prevent OOM on Railway (default uses all CPUs)
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
    // Limit parallel frame rendering to prevent OOM
    concurrency: 2,
    // Use JPEG for faster rendering (no transparency needed for final output)
    imageFormat: 'jpeg',
    jpegQuality: 90,
    // Use faster x264 preset to reduce memory usage
    x264Preset: 'faster',
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
async function compositeVideos(
  sourceVideoPath: string,
  remotionVideoPath: string,
  outputPath: string,
  audioPath: string | null
): Promise<void> {
  const { spawn } = await import('child_process');
  const { dirname, basename } = await import('path');
  const { copyFile } = await import('fs/promises');

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

  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
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
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg composite completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg composite failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

/**
 * Render only the Remotion composition (no source video overlay).
 * Use this when the composition is standalone.
 */
async function renderRemotionOnly(
  bundlePath: string,
  compositionId: string,
  outputPath: string,
  audioPath: string | null,
  onProgress?: (progress: number) => void
): Promise<void> {
  const { spawn } = await import('child_process');
  const { dirname, basename } = await import('path');
  const { copyFile } = await import('fs/promises');

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
      proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
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

interface AddAudioAndSubtitlesOptions {
  videoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  width: number;
  height: number;
}

/**
 * Add audio and subtitles to a video file.
 * Simple pass-through - no layout changes.
 */
async function addAudioAndSubtitles(options: AddAudioAndSubtitlesOptions): Promise<void> {
  const {
    videoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width,
    height,
  } = options;

  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

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
    const assContent = generateASSForComposite(subtitles, width, height);
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
    args.push('-vf', `subtitles=${assFilename}`);
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '18');
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
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

interface RenderWithPiPLayoutOptions {
  sourceVideoPath: string;
  remotionVideoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  width: number;
  height: number;
  layoutSettings?: LayoutSettings;
}

/**
 * Render final video with configurable layout:
 * - PiP mode: Remotion visuals fullscreen, source video as overlay
 * - Split modes: Side by side or top/bottom
 * Uses layoutSettings for exact position, size, and styling to match preview
 */
async function renderWithPiPLayout(options: RenderWithPiPLayoutOptions): Promise<void> {
  const {
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width,
    height,
    layoutSettings,
  } = options;

  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

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
  };
  const split = layoutSettings?.split || {
    position: 'visuals-first' as const,
    ratio: 50,
    gap: 0,
  };

  let filterComplex: string;

  if (mode === 'pip') {
    // Calculate PiP dimensions based on settings
    const pipSizePercent = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size];
    const pipWidth = Math.round(width * (pipSizePercent / 100));
    const pipHeight = Math.round(pipWidth); // Square aspect ratio for PiP

    // Calculate position based on settings
    let pipX: number, pipY: number;
    switch (pip.position) {
      case 'top-left':
        pipX = pip.offsetX;
        pipY = pip.offsetY;
        break;
      case 'top-right':
        pipX = width - pipWidth - pip.offsetX;
        pipY = pip.offsetY;
        break;
      case 'bottom-left':
        pipX = pip.offsetX;
        pipY = height - pipHeight - pip.offsetY;
        break;
      case 'bottom-right':
      default:
        pipX = width - pipWidth - pip.offsetX;
        pipY = height - pipHeight - pip.offsetY;
        break;
    }

    // Parse border color to RGB values
    const parseBorderColor = (color: string): { r: number; g: number; b: number; a: number } => {
      // Handle rgba format
      const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (rgbaMatch) {
        return {
          r: parseInt(rgbaMatch[1], 10),
          g: parseInt(rgbaMatch[2], 10),
          b: parseInt(rgbaMatch[3], 10),
          a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
        };
      }
      // Handle hex format
      let hex = color.replace('#', '');
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      return {
        r: parseInt(hex.substring(0, 2), 16) || 255,
        g: parseInt(hex.substring(2, 4), 16) || 255,
        b: parseInt(hex.substring(4, 6), 16) || 255,
        a: 1,
      };
    };

    const borderColor = parseBorderColor(pip.borderColor);
    const shadowColor = parseBorderColor(pip.shadowColor);

    logger.info({
      mode,
      pipSettings: pip,
      pipDimensions: { pipWidth, pipHeight, pipX, pipY },
      borderColor,
      shadowColor,
    }, 'Rendering with PiP layout (full styling)');

    // Build filter chain for styled PiP
    const filters: string[] = [];

    // 1. Background: Remotion visuals fill the screen
    filters.push(`[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[bg]`);

    // 2. Scale source video to PiP size
    filters.push(`[0:v]scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=increase,crop=${pipWidth}:${pipHeight},setsar=1,format=rgba[pip_scaled]`);

    // 3. Apply shape mask (circle, rounded, or square)
    if (pip.shape === 'circle') {
      // Circular mask - radius is half the width
      const radius = pipWidth / 2;
      filters.push(`[pip_scaled]geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(gt(pow(X-${radius},2)+pow(Y-${radius},2),pow(${radius},2)),0,255)'[pip_shaped]`);
    } else if (pip.shape === 'rounded' && pip.borderRadius > 0) {
      // Rounded rectangle mask using geq
      // Formula: point is inside if it's either in the inner rect or within radius of a corner
      const r = Math.min(pip.borderRadius, pipWidth / 2, pipHeight / 2);
      const innerW = pipWidth - 2 * r;
      const innerH = pipHeight - 2 * r;
      // Rounded rect: check if in center rect OR within radius of corners
      filters.push(`[pip_scaled]geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(between(X,${r},${pipWidth - r})+between(Y,${r},${pipHeight - r})+lte(hypot(X-${r},Y-${r}),${r})+lte(hypot(X-${pipWidth - r},Y-${r}),${r})+lte(hypot(X-${r},Y-${pipHeight - r}),${r})+lte(hypot(X-${pipWidth - r},Y-${pipHeight - r}),${r}),255,0)'[pip_shaped]`);
    } else {
      // Square - no mask needed, just rename
      filters.push(`[pip_scaled]copy[pip_shaped]`);
    }

    // 4. Apply opacity if not fully opaque
    if (pip.opacity < 1) {
      const alpha = pip.opacity;
      filters.push(`[pip_shaped]colorchannelmixer=aa=${alpha}[pip_alpha]`);
    } else {
      filters.push(`[pip_shaped]copy[pip_alpha]`);
    }

    // Track current output label
    let currentBg = 'bg';
    let currentPip = 'pip_alpha';

    // 5. Add shadow if enabled
    if (pip.shadowEnabled && pip.shadowBlur > 0) {
      // Shadow offset (slight offset for depth effect)
      const shadowOffsetX = Math.round(pip.shadowBlur / 4);
      const shadowOffsetY = Math.round(pip.shadowBlur / 4);
      const blurRadius = Math.max(1, Math.round(pip.shadowBlur / 2));

      // Create shadow: colorize to shadow color, blur it
      // Using format=rgba to preserve alpha, then colorize via geq
      filters.push(`[${currentPip}]split[pip_main][pip_shadow_src]`);

      // Colorize the shadow source to shadow color and reduce alpha for softness
      const shadowAlpha = shadowColor.a * 0.6; // Softer shadow
      filters.push(`[pip_shadow_src]geq=r='${shadowColor.r}':g='${shadowColor.g}':b='${shadowColor.b}':a='alpha(X,Y)*${shadowAlpha}',boxblur=${blurRadius}:${blurRadius}[pip_shadow]`);

      // Overlay shadow first, then PiP on top
      filters.push(`[${currentBg}][pip_shadow]overlay=${pipX + shadowOffsetX}:${pipY + shadowOffsetY}:format=auto[bg_shadow]`);
      currentBg = 'bg_shadow';
      currentPip = 'pip_main';
    }

    // 6. Add border if borderWidth > 0
    if (pip.borderWidth > 0) {
      const bw = pip.borderWidth;
      const totalW = pipWidth + bw * 2;
      const totalH = pipHeight + bw * 2;

      // Create border background with border color
      filters.push(`color=c=0x${borderColor.r.toString(16).padStart(2, '0')}${borderColor.g.toString(16).padStart(2, '0')}${borderColor.b.toString(16).padStart(2, '0')}:s=${totalW}x${totalH}:d=1,format=rgba[border_bg]`);

      // Apply same shape mask to border (but larger)
      if (pip.shape === 'circle') {
        const borderRadius = totalW / 2;
        filters.push(`[border_bg]geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(gt(pow(X-${borderRadius},2)+pow(Y-${borderRadius},2),pow(${borderRadius},2)),0,${Math.round(borderColor.a * 255)})'[border_shaped]`);
      } else if (pip.shape === 'rounded' && pip.borderRadius > 0) {
        const r = Math.min(pip.borderRadius + bw, totalW / 2, totalH / 2);
        filters.push(`[border_bg]geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(between(X,${r},${totalW - r})+between(Y,${r},${totalH - r})+lte(hypot(X-${r},Y-${r}),${r})+lte(hypot(X-${totalW - r},Y-${r}),${r})+lte(hypot(X-${r},Y-${totalH - r}),${r})+lte(hypot(X-${totalW - r},Y-${totalH - r}),${r}),${Math.round(borderColor.a * 255)},0)'[border_shaped]`);
      } else {
        filters.push(`[border_bg]colorchannelmixer=aa=${borderColor.a}[border_shaped]`);
      }

      // Overlay border on background
      filters.push(`[${currentBg}][border_shaped]overlay=${pipX - bw}:${pipY - bw}:format=auto[bg_border]`);
      currentBg = 'bg_border';
    }

    // 7. Final overlay: PiP on top
    filters.push(`[${currentBg}][${currentPip}]overlay=${pipX}:${pipY}:format=auto[outv]`);

    filterComplex = filters.join(';');

  } else if (mode === 'split-horizontal') {
    // Split horizontal (top/bottom)
    const visualsPercent = split.ratio / 100;
    const videoPercent = 1 - visualsPercent;
    const gap = split.gap;
    const isVisualsFirst = split.position === 'visuals-first';

    const visualsHeight = Math.round((height - gap) * visualsPercent);
    const videoHeight = Math.round((height - gap) * videoPercent);

    logger.info({
      mode,
      splitSettings: split,
      dimensions: { visualsHeight, videoHeight, gap },
    }, 'Rendering with horizontal split layout');

    // Use scale + crop to fill containers without black bars
    if (isVisualsFirst) {
      filterComplex = [
        `[1:v]scale=${width}:${visualsHeight}:force_original_aspect_ratio=increase,crop=${width}:${visualsHeight},setsar=1[visuals]`,
        `[0:v]scale=${width}:${videoHeight}:force_original_aspect_ratio=increase,crop=${width}:${videoHeight},setsar=1[video]`,
        `[visuals][video]vstack=inputs=2[outv]`
      ].join(';');
    } else {
      filterComplex = [
        `[0:v]scale=${width}:${videoHeight}:force_original_aspect_ratio=increase,crop=${width}:${videoHeight},setsar=1[video]`,
        `[1:v]scale=${width}:${visualsHeight}:force_original_aspect_ratio=increase,crop=${width}:${visualsHeight},setsar=1[visuals]`,
        `[video][visuals]vstack=inputs=2[outv]`
      ].join(';');
    }

  } else if (mode === 'split-vertical') {
    // Split vertical (left/right)
    const visualsPercent = split.ratio / 100;
    const videoPercent = 1 - visualsPercent;
    const gap = split.gap;
    const isVisualsFirst = split.position === 'visuals-first';

    const visualsWidth = Math.round((width - gap) * visualsPercent);
    const videoWidth = Math.round((width - gap) * videoPercent);

    logger.info({
      mode,
      splitSettings: split,
      dimensions: { visualsWidth, videoWidth, gap },
    }, 'Rendering with vertical split layout');

    // Use scale + crop to fill containers without black bars
    if (isVisualsFirst) {
      filterComplex = [
        `[1:v]scale=${visualsWidth}:${height}:force_original_aspect_ratio=increase,crop=${visualsWidth}:${height},setsar=1[visuals]`,
        `[0:v]scale=${videoWidth}:${height}:force_original_aspect_ratio=increase,crop=${videoWidth}:${height},setsar=1[video]`,
        `[visuals][video]hstack=inputs=2[outv]`
      ].join(';');
    } else {
      filterComplex = [
        `[0:v]scale=${videoWidth}:${height}:force_original_aspect_ratio=increase,crop=${videoWidth}:${height},setsar=1[video]`,
        `[1:v]scale=${visualsWidth}:${height}:force_original_aspect_ratio=increase,crop=${visualsWidth}:${height},setsar=1[visuals]`,
        `[video][visuals]hstack=inputs=2[outv]`
      ].join(';');
    }

  } else {
    // Fallback to PiP with defaults (use crop for no black bars)
    const pipWidth = Math.round(width * 0.25);
    const pipHeight = Math.round(pipWidth);
    const pipX = width - pipWidth - 16;
    const pipY = height - pipHeight - 16;

    filterComplex = [
      `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[bg]`,
      `[0:v]scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=increase,crop=${pipWidth}:${pipHeight},setsar=1[pip]`,
      `[bg][pip]overlay=${pipX}:${pipY}[outv]`
    ].join(';');
  }

  // Generate ASS subtitles if we have any - AFTER layout settings are parsed
  // so we can position captions correctly based on layout mode
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, width, height, layoutSettings);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename, mode }, 'Generated ASS subtitles with layout');
  }

  // Add subtitles filter if we have them
  if (assFilename) {
    filterComplex = filterComplex.replace('[outv]', '[pre]') + `;[pre]subtitles=${assFilename}[outv]`;
  }

  // Build FFmpeg args
  // Input order: 0=source, 1=remotion, 2=audio (optional)
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
    args.push('-map', '0:a?');  // Use source audio if available
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
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
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg PiP render completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg PiP render failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

interface FinalizeRemotionVideoOptions {
  remotionVideoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  width: number;
  height: number;
}

/**
 * Finalize Remotion video by adding subtitles and audio.
 * The Remotion video is used fullscreen (exactly what user sees in preview).
 */
async function finalizeRemotionVideo(options: FinalizeRemotionVideoOptions): Promise<void> {
  const {
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width,
    height,
  } = options;

  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

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
    const assContent = generateASSForComposite(subtitles, width, height);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename }, 'Generated ASS subtitles');
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
    args.push('-vf', `subtitles=${assFilename}`);
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
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '18');
  }

  args.push('-shortest', basename(outputPath));

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg finalize started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg finalize completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg finalize failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

interface CompositeFullVideoOptions {
  sourceVideoPath: string;
  remotionVideoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  projectWidth: number;
  projectHeight: number;
}

/**
 * Composite source video + Remotion visuals + subtitles + audio into final output.
 * Uses picture-in-picture layout with Remotion visuals in corner.
 */
async function compositeFullVideo(options: CompositeFullVideoOptions): Promise<void> {
  const {
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    projectWidth,
    projectHeight,
  } = options;

  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

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
    const assContent = generateASSForComposite(subtitles, projectWidth, projectHeight);
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
    filterComplex += `,subtitles=${assFilename}`;
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

  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
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
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg full composite completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg full composite failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

/**
 * Convert hex or rgba color to ASS color format (&HAABBGGRR)
 */
function hexToASSColor(color: string): string {
  if (!color) return '&H00FFFFFF'; // Default to white

  // Handle rgba format: rgba(r, g, b, a)
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] ? Math.round((1 - parseFloat(rgbaMatch[4])) * 255) : 0;
    const result = `&H${a.toString(16).padStart(2, '0').toUpperCase()}${b.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${r.toString(16).padStart(2, '0').toUpperCase()}`;
    logger.info({ input: color, type: 'rgba', r, g, b, a, result }, 'hexToASSColor conversion');
    return result;
  }

  // Handle hex format
  let hex = color.replace('#', '');

  // Handle short hex (#fff -> #ffffff)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // ASS uses &HAABBGGRR format (alpha, blue, green, red)
  // Alpha 00 = fully opaque
  const result = `&H00${b.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${r.toString(16).padStart(2, '0').toUpperCase()}`;
  logger.info({ input: color, type: 'hex', hex, r, g, b, result }, 'hexToASSColor conversion');
  return result;
}

/**
 * Get ASS alignment from position string
 * ASS alignments: 1=bottom-left, 2=bottom-center, 3=bottom-right
 *                 4=middle-left, 5=middle-center, 6=middle-right
 *                 7=top-left, 8=top-center, 9=top-right
 */
function getASSAlignment(position: string): number {
  switch (position) {
    case 'top': return 8;
    case 'middle': case 'center': return 5;
    case 'bottom': default: return 2;
  }
}

/**
 * Generate ASS subtitles using style from subtitle data.
 * Matches frontend caption styling as closely as possible.
 * Adjusts positioning based on layout mode (PiP, split-horizontal, split-vertical).
 * Supports word-by-word, phrase, and karaoke display modes.
 */
function generateASSForComposite(subtitles: SubtitleItem[], width: number, height: number, layoutSettings?: LayoutSettings): string {
  // Get style from first subtitle (they should all have same style)
  const firstStyle = subtitles[0]?.style as any || {};

  logger.info({ captionStyle: firstStyle, layoutSettings }, 'Generating ASS subtitles with style and layout');

  const fontFamily = (firstStyle.fontFamily || 'Inter').split(',')[0].trim();
  // Scale font size based on resolution (frontend uses 1080p as base)
  const baseFontSize = firstStyle.fontSize || 56;
  const fontSize = Math.round(baseFontSize * (height / 1920));

  const color = hexToASSColor(firstStyle.color || '#ffffff');
  const activeColor = hexToASSColor(firstStyle.activeColor || '#ffff00');
  const outlineColor = '&H00000000'; // Black outline

  // Handle backgroundColor - convert to ASS BackColour with proper alpha
  let backColor = '&H80000000'; // Default semi-transparent black
  if (firstStyle.backgroundColor && firstStyle.backgroundColor !== 'transparent') {
    backColor = hexToASSColor(firstStyle.backgroundColor);
  }

  const fontWeight = firstStyle.fontWeight || 800;
  const bold = fontWeight >= 700 ? -1 : 0;  // -1 = bold in ASS

  // Letter spacing (ASS Spacing parameter)
  const letterSpacing = Math.round((firstStyle.letterSpacing || 0) * (height / 1920));

  // Text transform - will be applied to each subtitle text
  const textTransform = firstStyle.textTransform || 'none';

  // Display mode for word-by-word/phrase/karaoke styling
  const displayMode = firstStyle.displayMode || 'phrase';
  const wordsPerPhrase = firstStyle.wordsPerPhrase || 5;

  const captionPosition = firstStyle.position || 'bottom';
  const alignment = getASSAlignment(captionPosition);
  const offsetY = firstStyle.offsetY || 0;

  // Get layout info
  const mode = layoutSettings?.mode || 'pip';
  const pip = layoutSettings?.pip;
  const split = layoutSettings?.split;

  // Calculate effective area for captions based on layout
  let effectiveHeight = height;
  let verticalOffset = 0;

  if (mode === 'split-horizontal') {
    // In horizontal split, captions should be in the video section
    const visualsRatio = (split?.ratio || 50) / 100;
    const isVisualsFirst = split?.position === 'visuals-first';

    if (isVisualsFirst) {
      // Visuals on top, video on bottom - captions in bottom section
      effectiveHeight = Math.round(height * (1 - visualsRatio));
      verticalOffset = Math.round(height * visualsRatio);
    } else {
      // Video on top, visuals on bottom - captions in top section
      effectiveHeight = Math.round(height * (1 - visualsRatio));
      verticalOffset = 0;
    }
  } else if (mode === 'split-vertical') {
    // In vertical split, captions span the full height but may need adjustment
    // Keep full height, no offset needed
  }

  // Calculate margin based on position, offsetY, and layout
  let marginV: number;
  if (captionPosition === 'top') {
    marginV = Math.round(effectiveHeight * 0.10 + (offsetY * effectiveHeight / 100));
  } else if (captionPosition === 'center' || captionPosition === 'middle') {
    marginV = Math.round(effectiveHeight * 0.5 + (offsetY * effectiveHeight / 100));
  } else {
    // bottom - most common
    marginV = Math.round(effectiveHeight * 0.15 - (offsetY * effectiveHeight / 100));
  }

  // For split-horizontal with visuals-first, add the vertical offset
  if (mode === 'split-horizontal' && split?.position === 'visuals-first' && captionPosition === 'bottom') {
    // Captions are at bottom of video section which is at bottom of frame
    // marginV is from bottom, so no adjustment needed
  } else if (mode === 'split-horizontal' && split?.position !== 'visuals-first' && captionPosition === 'bottom') {
    // Video on top, captions should be at bottom of top section
    // Need to add offset for visuals section below
    marginV += Math.round(height * ((split?.ratio || 50) / 100));
  }

  // For PiP mode, avoid overlapping with PiP window
  if (mode === 'pip' && pip) {
    const pipSize = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size] || 25;
    const pipHeight = Math.round(width * (pipSize / 100)); // PiP is square

    // If caption is at bottom and PiP is at bottom, add margin to avoid overlap
    if (captionPosition === 'bottom' && (pip.position === 'bottom-left' || pip.position === 'bottom-right')) {
      marginV = Math.max(marginV, pipHeight + pip.offsetY + 20);
    }
    // If caption is at top and PiP is at top, add margin to avoid overlap
    if (captionPosition === 'top' && (pip.position === 'top-left' || pip.position === 'top-right')) {
      marginV = Math.max(marginV, pipHeight + pip.offsetY + 20);
    }
  }

  marginV = Math.max(20, Math.min(marginV, height / 2)); // Clamp to reasonable range

  // Parse textShadow for outline/shadow settings
  // Frontend format: "2px 2px 4px rgba(0,0,0,0.8)"
  let outline = 3;
  let shadow = 2;
  if (firstStyle.textShadow) {
    const shadowMatch = firstStyle.textShadow.match(/(\d+)px\s+(\d+)px\s+(\d+)px/);
    if (shadowMatch) {
      outline = Math.max(2, parseInt(shadowMatch[3], 10) / 2);
      shadow = Math.max(1, parseInt(shadowMatch[1], 10));
    }
  }

  // Helper to apply text transform
  const applyTextTransform = (text: string): string => {
    if (textTransform === 'uppercase') return text.toUpperCase();
    if (textTransform === 'lowercase') return text.toLowerCase();
    return text;
  };

  // Create styles - Default for inactive words, Active for highlighted words
  let ass = `[Script Info]
Title: Reelify Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${fontSize},${color},${activeColor},${outlineColor},${backColor},${bold},0,0,0,100,100,${letterSpacing},0,1,${outline},${shadow},${alignment},10,10,${marginV},1
Style: Active,${fontFamily},${fontSize},${activeColor},${color},${outlineColor},${backColor},${bold},0,0,0,100,100,${letterSpacing},0,1,${outline},${shadow},${alignment},10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Helper to get absolute word timing
  // Words from database may be absolute (>= subtitle.startMs) or relative (< subtitle.startMs)
  const getAbsoluteWordTime = (subtitle: any, word: any, isEnd: boolean) => {
    const wordTime = isEnd ? (word.endMs ?? word.startMs + 500) : (word.startMs ?? 0);
    // If word time is >= subtitle start time, it's already absolute
    // Otherwise, add subtitle start to make it absolute
    if (wordTime >= subtitle.startMs) {
      return wordTime;
    }
    return subtitle.startMs + wordTime;
  };

  // Process subtitles based on display mode
  for (const subtitle of subtitles) {
    const rawWords = subtitle.words || [];
    // Create fallback word if no words exist
    const words = rawWords.length > 0 ? rawWords : [{ text: subtitle.text || '', startMs: subtitle.startMs, endMs: subtitle.endMs }];

    if (displayMode === 'word-by-word') {
      // Show one word at a time with active color
      for (const word of words) {
        const wordStart = getAbsoluteWordTime(subtitle, word, false);
        const wordEnd = getAbsoluteWordTime(subtitle, word, true);
        const startTime = formatASSTime(wordStart);
        const endTime = formatASSTime(wordEnd);
        const text = applyTextTransform(word.text || '').replace(/\n/g, '\\N');
        ass += `Dialogue: 0,${startTime},${endTime},Active,,0,0,0,,${text}\n`;
      }
    } else if (displayMode === 'karaoke') {
      // Show all words with karaoke fill effect - words highlight as they're spoken
      const startTime = formatASSTime(subtitle.startMs);
      const endTime = formatASSTime(subtitle.endMs);

      // Build karaoke text with \kf tags for fill effect
      let karaokeText = '';
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Duration in centiseconds for ASS karaoke tags
        const wordStart = getAbsoluteWordTime(subtitle, word, false);
        const wordEnd = getAbsoluteWordTime(subtitle, word, true);
        const duration = Math.round((wordEnd - wordStart) / 10);
        const wordText = applyTextTransform(word.text || '');
        // \kf = karaoke fill effect (smooth fill from left to right)
        karaokeText += `{\\kf${duration}}${wordText}`;
        if (i < words.length - 1) karaokeText += ' ';
      }
      ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${karaokeText}\n`;
    } else {
      // Phrase mode (default) - show the full phrase with karaoke highlighting
      // Use \k tags which transition from SecondaryColour (activeColor) to PrimaryColour (color)
      const startTime = formatASSTime(subtitle.startMs);
      const endTime = formatASSTime(subtitle.endMs);

      // Build karaoke text - each word gets a \k tag with its duration
      // In ASS, \k shows SecondaryColour first, then switches to PrimaryColour
      // We want the OPPOSITE (show inactive, then highlight active)
      // So we use a style where PrimaryColour=activeColor, SecondaryColour=color
      // and \kf (fill) effect
      let karaokeText = '';
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordStart = getAbsoluteWordTime(subtitle, word, false);
        const wordEnd = getAbsoluteWordTime(subtitle, word, true);
        // Duration in centiseconds
        const duration = Math.max(1, Math.round((wordEnd - wordStart) / 10));
        const wordText = applyTextTransform(word.text || '');
        // \kf = karaoke fill (smooth), \k = instant switch
        karaokeText += `{\\kf${duration}}${wordText}`;
        if (i < words.length - 1) karaokeText += ' ';
      }

      // Use Active style which has activeColor as Primary (so it shows highlighted)
      // and color as Secondary (so before highlight it shows inactive)
      ass += `Dialogue: 0,${startTime},${endTime},Active,,0,0,0,,${karaokeText}\n`;
    }
  }

  // Log sample of generated ASS for debugging
  const assLines = ass.split('\n');
  const dialogueLines = assLines.filter(l => l.startsWith('Dialogue:')).slice(0, 3);
  logger.info({
    sampleDialogueLines: dialogueLines,
    activeColorUsed: activeColor,
    colorUsed: color,
  }, 'ASS dialogue sample');

  logger.info({
    fontFamily,
    fontSize,
    captionPosition,
    marginV,
    mode,
    displayMode,
    textTransform,
    letterSpacing,
    effectiveHeight,
    subtitleCount: subtitles.length
  }, 'ASS subtitles generated with full styling and layout awareness');

  return ass;
}

/**
 * Encode video with subtitles burned in (no Remotion visuals).
 */
async function encodeVideoWithSubtitles(
  videoPath: string,
  audioPath: string | null,
  subtitles: SubtitleItem[],
  outputPath: string,
  workDir: string
): Promise<void> {
  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

  // Copy video to working directory
  const localVideoPath = join(workDir, 'input.mp4');
  await copyFile(videoPath, localVideoPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles
  const assFilename = 'subtitles.ass';
  const assContent = generateASSForComposite(subtitles, 1920, 1080);
  await writeFile(join(workDir, assFilename), assContent, 'utf-8');

  logger.info({ subtitleCount: subtitles.length, audioPath }, 'Encoding video with subtitles');

  const args = [
    '-i', 'input.mp4',
  ];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-vf', `subtitles=${assFilename}`,
  );

  if (audioFilename) {
    args.push('-map', '0:v', '-map', '1:a');
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
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
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg subtitle encode completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg subtitle encode failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}
