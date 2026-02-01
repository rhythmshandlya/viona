import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, projects, tracks, timelineItems, jobs } from '../db/index.js';
import { downloadFile, uploadFile } from '../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { renderVideo, SubtitleItem, SubtitleStyle } from '@reelify/renderer';

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
    await downloadFile(config.minio.buckets.uploads, project.videoKey!, videoPath);

    await publishJobProgress(jobId, 20, 'Preparing render...');

    // Convert timeline items to subtitle format
    const subtitles = convertToSubtitles(allItems);
    const outputPath = join(workDir, 'output.mp4');

    // Check if we have subtitles to render
    if (subtitles.length === 0) {
      // No subtitles, just copy the video using FFmpeg
      await publishJobProgress(jobId, 30, 'Copying video (no subtitles)...');
      await copyVideo(videoPath, outputPath);
    } else {
      // Render with Remotion for animated subtitles
      await publishJobProgress(jobId, 30, 'Rendering with animated subtitles...');

      const durationMs = project.durationMs || 60000; // Default 60s if not set
      const width = project.sourceWidth || 1920;
      const height = project.sourceHeight || 1080;
      const fps = project.fps || 30;

      // Default subtitle style
      const defaultSubtitleStyle: SubtitleStyle = {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: Math.round(height / 22), // Scale font to video size
        fontWeight: 700,
        color: '#ffffff',
        activeColor: '#ffff00',
        position: 'bottom',
        animation: 'highlight',
      };

      try {
        // Normalize paths for Windows - use forward slashes and proper file:// URL format
        const normalizedVideoPath = videoPath.replace(/\\/g, '/');
        const normalizedOutputPath = outputPath.replace(/\\/g, '/');
        // On Windows, file:// URLs need three slashes: file:///C:/path/to/file
        const videoFileUrl = process.platform === 'win32'
          ? `file:///${normalizedVideoPath}`
          : `file://${normalizedVideoPath}`;

        await renderVideo({
          videoUrl: videoFileUrl,
          subtitles,
          outputPath: normalizedOutputPath,
          width,
          height,
          fps,
          durationMs,
          defaultSubtitleStyle,
          onProgress: async (progress) => {
            // Map Remotion progress (0-100) to our progress range (30-80)
            const mappedProgress = 30 + Math.round(progress * 0.5);
            await publishJobProgress(jobId, mappedProgress, `Rendering... ${progress}%`);
          },
        });
      } catch (renderError) {
        logger.error({ err: renderError }, 'Remotion render failed, falling back to FFmpeg');
        // Fallback to FFmpeg subtitle burning
        await renderSubtitlesWithFFmpeg(videoPath, outputPath, allItems, project);
      }
    }

    await publishJobProgress(jobId, 85, 'Uploading result...');

    // Upload output
    const outputKey = `${nanoid()}/output.mp4`;
    await uploadFile(config.minio.buckets.outputs, outputKey, outputPath);

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

  // Normalize paths for FFmpeg on Windows (use forward slashes)
  const normalizedInput = inputPath.replace(/\\/g, '/');
  const normalizedOutput = outputPath.replace(/\\/g, '/');

  return new Promise((resolve, reject) => {
    ffmpeg(normalizedInput)
      .outputOptions(['-c', 'copy'])
      .output(normalizedOutput)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

// Fallback: FFmpeg subtitle burning for when Remotion fails
async function renderSubtitlesWithFFmpeg(
  inputPath: string,
  outputPath: string,
  items: any[],
  project: any
): Promise<void> {
  const ffmpeg = (await import('fluent-ffmpeg')).default;

  // Filter subtitle items
  const subtitles = items.filter(item => item.type === 'subtitle');

  if (subtitles.length === 0) {
    // No subtitles, just copy the video
    // Normalize paths for FFmpeg on Windows
    const normalizedInput = inputPath.replace(/\\/g, '/');
    const normalizedOutput = outputPath.replace(/\\/g, '/');
    return new Promise((resolve, reject) => {
      ffmpeg(normalizedInput)
        .outputOptions(['-c', 'copy'])
        .output(normalizedOutput)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  // Create ASS subtitle file for FFmpeg
  const assPath = inputPath.replace('.mp4', '.ass');
  const assContent = generateASSSubtitles(subtitles, project);

  const { writeFile } = await import('fs/promises');
  await writeFile(assPath, assContent, 'utf-8');

  // Burn subtitles into video
  // Normalize paths for FFmpeg on Windows
  const normalizedInput = inputPath.replace(/\\/g, '/');
  const normalizedOutput = outputPath.replace(/\\/g, '/');
  const normalizedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');

  return new Promise((resolve, reject) => {
    ffmpeg(normalizedInput)
      .outputOptions([
        '-vf', `ass=${normalizedAss}`,
        '-c:a', 'copy',
      ])
      .output(normalizedOutput)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
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
