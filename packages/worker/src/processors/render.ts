import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import { db, projects, tracks, timelineItems, jobs } from '../db/index.js';
import { downloadFile, uploadFile, objectExists } from '../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface RenderJobData {
  projectId: string;
  jobId: string;
}

interface VisualItem {
  id: string;
  startMs: number;
  endMs: number;
  videoUrl: string;
  localPath?: string;
}

interface AudioItem {
  id: string;
  startMs: number;
  endMs: number;
  src: string;
  volume: number;
  localPath?: string;
}

interface CaptionItem {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words: Array<{ text: string; startMs: number; endMs: number }>;
  style: any;
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
    const allItems: any[] = [];
    for (const track of projectTracks) {
      const items = await db.select().from(timelineItems)
        .where(eq(timelineItems.trackId, track.id));
      allItems.push(...items);
    }

    await publishJobProgress(jobId, 10, 'Downloading assets...');

    // Download original video
    const videoPath = join(workDir, 'input.mp4');
    await downloadFile(config.minio.buckets.uploads, project.videoKey!, videoPath);

    // Separate items by type
    const visualItems = allItems.filter(item => item.type === 'visual');
    const audioItems = allItems.filter(item => item.type === 'audio');
    const captionItems = allItems.filter(item => item.type === 'caption' || item.type === 'subtitle');

    // Download visual videos if they exist
    const visuals: VisualItem[] = [];
    for (let i = 0; i < visualItems.length; i++) {
      const item = visualItems[i];
      const data = item.data as any;
      if (data.videoUrl) {
        const visualPath = join(workDir, `visual_${i}.mp4`);
        // videoUrl is like /bundles/proj-xxx/video.mp4, need to extract the key
        const videoKey = data.videoUrl.replace(/^\//, ''); // Remove leading slash

        try {
          // Check if the visual video exists in outputs bucket
          const exists = await objectExists(config.minio.buckets.outputs, videoKey);
          if (exists) {
            await downloadFile(config.minio.buckets.outputs, videoKey, visualPath);
            visuals.push({
              id: item.id,
              startMs: item.startMs,
              endMs: item.endMs,
              videoUrl: data.videoUrl,
              localPath: visualPath,
            });
          } else {
            logger.warn({ videoKey }, 'Visual video not found, skipping');
          }
        } catch (err) {
          logger.warn({ err, videoKey }, 'Failed to download visual video, skipping');
        }
      }
    }

    // Download enhanced audio if it exists
    const audios: AudioItem[] = [];
    for (let i = 0; i < audioItems.length; i++) {
      const item = audioItems[i];
      const data = item.data as any;
      if (data.src) {
        const audioPath = join(workDir, `audio_${i}.m4a`);
        // src is like /media/uploads/xxx/audio.m4a
        const audioKey = data.src.replace(/^\/media\/[^/]+\//, ''); // Extract key after /media/bucket/

        try {
          await downloadFile(config.minio.buckets.uploads, audioKey, audioPath);
          audios.push({
            id: item.id,
            startMs: item.startMs,
            endMs: item.endMs,
            src: data.src,
            volume: data.volume || 1,
            localPath: audioPath,
          });
        } catch (err) {
          logger.warn({ err, audioKey }, 'Failed to download audio, will use video audio');
        }
      }
    }

    // Convert captions
    const captions: CaptionItem[] = captionItems.map(item => {
      const data = item.data as any;
      return {
        id: item.id,
        startMs: item.startMs,
        endMs: item.endMs,
        text: data.text || '',
        words: data.words || [],
        style: data.style || {},
      };
    });

    await publishJobProgress(jobId, 25, 'Rendering video...');

    const outputPath = join(workDir, 'output.mp4');
    const durationMs = project.durationMs || 60000;
    const width = project.canvasWidth || project.sourceWidth || 1080;
    const height = project.canvasHeight || project.sourceHeight || 1920;

    // Render with FFmpeg
    await renderWithFFmpeg({
      videoPath,
      outputPath,
      visuals,
      audios,
      captions,
      width,
      height,
      durationMs,
      workDir,
      onProgress: async (progress) => {
        const mappedProgress = 25 + Math.round(progress * 0.6);
        await publishJobProgress(jobId, mappedProgress, `Rendering... ${Math.round(progress)}%`);
      },
    });

    await publishJobProgress(jobId, 90, 'Uploading result...');

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

interface RenderOptions {
  videoPath: string;
  outputPath: string;
  visuals: VisualItem[];
  audios: AudioItem[];
  captions: CaptionItem[];
  width: number;
  height: number;
  durationMs: number;
  workDir: string;
  onProgress?: (progress: number) => Promise<void>;
}

async function renderWithFFmpeg(options: RenderOptions): Promise<void> {
  const { videoPath, outputPath, visuals, audios, captions, width, height, durationMs, workDir, onProgress } = options;

  const hasVisuals = visuals.length > 0 && visuals.some(v => v.localPath);
  const hasEnhancedAudio = audios.length > 0 && audios.some(a => a.localPath);
  const hasCaptions = captions.length > 0;

  // Generate ASS subtitle file if we have captions
  let assPath: string | null = null;
  if (hasCaptions) {
    assPath = join(workDir, 'subtitles.ass');
    const assContent = generateASSSubtitles(captions, width, height);
    await writeFile(assPath, assContent, 'utf-8');
    logger.info({ assPath, captionCount: captions.length }, 'Generated ASS subtitle file');
  }

  // Build FFmpeg args - start simple
  const args: string[] = [
    '-y',                    // Overwrite output
    '-i', videoPath,         // Main video input
  ];

  // Add visual input if available
  const visualPath = hasVisuals ? visuals[0]?.localPath : null;
  if (visualPath) {
    args.push('-i', visualPath);
    logger.info({ visualPath }, 'Adding visual input');
  }

  // Add enhanced audio input if available
  const audioPath = hasEnhancedAudio ? audios[0]?.localPath : null;
  const audioInputIndex = audioPath ? (visualPath ? 2 : 1) : -1;
  if (audioPath) {
    args.push('-i', audioPath);
    logger.info({ audioPath, audioInputIndex }, 'Adding audio input');
  }

  // Build video filter - start simple, just scale/pad
  const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
  args.push('-vf', vf);

  // TODO: Add subtitle support after basic rendering works
  // The subtitle filter requires special path escaping that varies by platform
  if (assPath) {
    logger.info({ assPath, captionCount: captions.length }, 'Subtitles generated but skipped for now - will add in next iteration');
  }

  // Audio mapping
  if (audioInputIndex >= 0) {
    args.push('-map', '0:v');
    args.push('-map', `${audioInputIndex}:a`);
  }

  // Video encoding settings
  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',       // Faster preset for testing
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    outputPath
  );

  logger.info({
    cmd: 'ffmpeg ' + args.map(a => a.includes(' ') ? `"${a}"` : a).join(' '),
    hasVisuals,
    hasEnhancedAudio,
    hasCaptions,
    width,
    height
  }, 'Running FFmpeg command');

  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn('ffmpeg', args);

    let stderr = '';
    let lastProgress = 0;

    ffmpegProcess.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      // Parse progress from FFmpeg output
      const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (timeMatch && onProgress) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const seconds = parseInt(timeMatch[3], 10);
        const currentMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
        const progress = Math.min(100, (currentMs / durationMs) * 100);
        if (progress > lastProgress) {
          lastProgress = progress;
          onProgress(progress).catch(() => {});
        }
      }
    });

    ffmpegProcess.on('close', (code: number) => {
      if (code === 0) {
        resolve();
      } else {
        logger.error({ code, stderr }, 'FFmpeg failed');
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    ffmpegProcess.on('error', (err: Error) => {
      logger.error({ err, stderr }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

function generateASSSubtitles(captions: CaptionItem[], width: number, height: number): string {
  const fontSize = Math.round(height / 25);

  let ass = `[Script Info]
Title: Reelify Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,10,10,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  for (const caption of captions) {
    const startTime = formatASSTime(caption.startMs);
    const endTime = formatASSTime(caption.endMs);
    const text = caption.text.replace(/\n/g, '\\N');

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
