import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, access, constants } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, projects, tracks, timelineItems, jobs, visuals } from '../db/index.js';
import { downloadFile, uploadFile } from '../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { renderVideo, SubtitleItem, SubtitleStyle } from '@reelify/renderer';
import { renderMedia, selectComposition } from '@remotion/renderer';

export interface RenderJobData {
  projectId: string;
  jobId: string;
}

export async function processRenderJob(job: Job<RenderJobData>) {
  const { projectId, jobId } = job.data;
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

      // Get bundle path from compositionId
      const bundleCompositionId = projectVisual.compositionId.replace(/_/g, '-');
      const bundlePath = join(config.remotion.bundleOutputDir, bundleCompositionId);

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
      const remotionTempPath = join(workDir, 'remotion_visuals.mp4');
      await renderWithRemotion({
        bundlePath,
        compositionId: bundleCompositionId,
        outputPath: remotionTempPath,
        onProgress: (progress) => {
          const jobProgress = 30 + Math.round(progress * 40);
          publishJobProgress(jobId, jobProgress, `Rendering: ${Math.round(progress * 100)}%`);
        },
      });

      logger.info({ projectId, remotionTempPath }, 'Remotion render complete');

      await publishJobProgress(jobId, 75, 'Adding audio and subtitles...');

      // Step 2: Add audio and subtitles to the rendered video
      await addAudioAndSubtitles({
        videoPath: remotionTempPath,
        audioPath: enhancedAudioPath,
        subtitles,
        outputPath,
        workDir,
        width: visualWidth,
        height: visualHeight,
      });

      logger.info({ projectId, outputPath }, 'Export complete');
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
  return items
    .filter(item => item.type === 'subtitle')
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
 * Render a Remotion composition to a video file using SSR.
 * Uses the existing bundle created by the visual generator.
 */
async function renderWithRemotion(options: RenderRemotionOptions): Promise<void> {
  const { bundlePath, compositionId, outputPath, onProgress } = options;

  logger.info({ bundlePath, compositionId, outputPath }, 'Starting Remotion SSR render');

  // Verify bundle exists
  const bundleIndexPath = join(bundlePath, 'index.html');
  try {
    await access(bundleIndexPath, constants.R_OK);
  } catch {
    throw new Error(`Remotion bundle not found at ${bundlePath}`);
  }

  // Select the composition from the bundle
  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: compositionId,
  });

  logger.info({
    compositionId: composition.id,
    width: composition.width,
    height: composition.height,
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
  }, 'Composition selected');

  // Render the composition to video
  await renderMedia({
    composition,
    serveUrl: bundlePath,
    codec: 'h264',
    outputLocation: outputPath,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
    // Use JPEG for faster rendering (no transparency needed for final output)
    imageFormat: 'jpeg',
    jpegQuality: 90,
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
    '-preset', 'medium',
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
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18');
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
}

/**
 * Render final video with PiP layout:
 * - Remotion visuals = fullscreen background
 * - Source video (talking head) = small PiP (25%) in bottom-right corner
 * - Subtitles burned on top
 * - Audio track added
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
    const assContent = generateASSForComposite(subtitles, width, height);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename }, 'Generated ASS subtitles');
  }

  // Calculate PiP dimensions (25% of output size, bottom-right corner)
  const pipWidth = Math.round(width * 0.25);
  const pipHeight = Math.round(pipWidth * (height / width));
  const pipMargin = Math.round(width * 0.03);
  const pipX = width - pipWidth - pipMargin;
  const pipY = height - pipHeight - pipMargin;

  logger.info({
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitleCount: subtitles.length,
    outputPath,
    pipDimensions: { pipWidth, pipHeight, pipX, pipY },
  }, 'Rendering with PiP layout');

  // Build FFmpeg filter complex:
  // [1:v] = Remotion visuals -> scale to full size -> [bg]
  // [0:v] = Source video -> scale to PiP size -> [pip]
  // Overlay pip on bg -> [outv]
  // Optionally add subtitles
  let filterComplex = [
    `[1:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[bg]`,
    `[0:v]scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=decrease,pad=${pipWidth}:${pipHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1[pip]`,
    `[bg][pip]overlay=${pipX}:${pipY}[outv]`
  ].join(';');

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
    '-preset', 'medium',
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
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18');
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
    '-preset', 'medium',
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
 * Convert hex color to ASS color format (&HAABBGGRR)
 */
function hexToASSColor(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // ASS uses &HAABBGGRR format (alpha, blue, green, red)
  // Alpha 00 = fully opaque
  return `&H00${b.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${r.toString(16).padStart(2, '0').toUpperCase()}`;
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
 */
function generateASSForComposite(subtitles: SubtitleItem[], width: number, height: number): string {
  // Get style from first subtitle (they should all have same style)
  const firstStyle = subtitles[0]?.style as any || {};

  const fontFamily = (firstStyle.fontFamily || 'Inter').split(',')[0].trim();
  const fontSize = firstStyle.fontSize || 48;
  const color = hexToASSColor(firstStyle.color || '#ffffff');
  const outlineColor = hexToASSColor(firstStyle.outlineColor || '#000000');
  const highlightColor = hexToASSColor(firstStyle.highlightColor || firstStyle.activeColor || '#ffff00');
  const fontWeight = firstStyle.fontWeight || 400;
  const bold = fontWeight >= 700 ? -1 : 0;  // -1 = bold in ASS
  const position = firstStyle.position || 'bottom';
  const alignment = getASSAlignment(position);

  // Calculate margin based on position
  const marginV = position === 'top' ? 50 : position === 'middle' ? 0 : 80;

  let ass = `[Script Info]
Title: Reelify Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${fontSize},${color},${highlightColor},${outlineColor},&H80000000,${bold},0,0,0,100,100,0,0,1,3,2,${alignment},10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  for (const subtitle of subtitles) {
    const startTime = formatASSTime(subtitle.startMs);
    const endTime = formatASSTime(subtitle.endMs);
    const text = (subtitle.text || '').replace(/\n/g, '\\N');
    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
  }

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
    '-preset', 'medium',
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
