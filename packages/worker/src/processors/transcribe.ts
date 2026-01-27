import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import { db, projects, tracks, timelineItems, transcripts, jobs } from '../db/index.js';
import { downloadFile } from '../services/minio.js';
import { logger } from '../logger.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { DEFAULT_SUBTITLE_STYLE } from '@reelify/shared';

export interface TranscribeJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
}

interface WhisperXWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

interface WhisperXSegment {
  text: string;
  startMs: number;
  endMs: number;
}

interface WhisperXOutput {
  words: WhisperXWord[];
  segments: WhisperXSegment[];
  language: string;
}

async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        '-vn',           // No video
        '-acodec', 'pcm_s16le',  // 16-bit PCM
        '-ar', '16000',  // 16kHz sample rate
        '-ac', '1',      // Mono
      ])
      .output(audioPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const duration = metadata.format.duration || 0;
      resolve(Math.round(duration * 1000)); // Convert to milliseconds
    });
  });
}

async function getVideoMetadata(videoPath: string): Promise<{ width: number; height: number; fps: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      // Parse fps from r_frame_rate (e.g., "30/1" or "30000/1001")
      let fps = 30;
      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
        fps = Math.round(num / (den || 1));
      }

      resolve({
        width: videoStream.width || 1920,
        height: videoStream.height || 1080,
        fps,
      });
    });
  });
}

async function runWhisperX(
  audioPath: string,
  jobId: string,
  projectId: string,
): Promise<WhisperXOutput> {
  const { scriptPath, model, language, device, computeType, batchSize } = config.whisperx;
  const resolvedScript = resolve(scriptPath);

  return new Promise((resolve, reject) => {
    const args = [
      resolvedScript,
      '--input', audioPath,
      '--model', model,
      '--language', language,
      '--device', device,
      '--compute-type', computeType,
      '--batch-size', String(batchSize),
    ];

    const proc = spawn(config.pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // PyTorch 2.6+ defaults weights_only=True which breaks pyannote model loading
        TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      // Parse progress lines: PROGRESS:<percent>%:<message>
      for (const line of text.split('\n')) {
        const match = line.match(/^PROGRESS:(\d+)%:(.+)$/);
        if (match) {
          const percent = parseInt(match[1], 10);
          const message = match[2];
          // Map WhisperX 0-100% to our 25-70% range
          const mappedProgress = 25 + Math.round((percent / 100) * 45);
          publishJobProgress(jobId, mappedProgress, message, { projectId });
        }
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        // Extract error message from stderr
        const errorMatch = stderr.match(/ERROR:(.+)/);
        const lastLines = stderr.trim().split('\n').slice(-3).join(' | ');
        const errorMsg = errorMatch ? errorMatch[1].trim() : `WhisperX exited with code ${code}: ${lastLines}`;
        reject(new Error(errorMsg));
        return;
      }

      try {
        // Extract the last line that looks like JSON — libraries may leak
        // log messages to stdout despite our stderr redirects.
        const lines = stdout.trim().split('\n');
        const jsonLine = lines.reverse().find(l => l.startsWith('{'));
        if (!jsonLine) {
          reject(new Error(`No JSON found in WhisperX output: ${stdout.slice(0, 500)}`));
          return;
        }
        const result = JSON.parse(jsonLine);
        resolve(result as WhisperXOutput);
      } catch {
        reject(new Error(`Failed to parse WhisperX output: ${stdout.slice(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn WhisperX: ${err.message}`));
    });
  });
}

/**
 * Group words into caption pages (TikTok-style).
 * Groups words that are within `gapMs` of each other, up to `maxWords` per page.
 */
function groupWordsIntoPages(
  words: WhisperXWord[],
  { gapMs = 800, maxWords = 8 }: { gapMs?: number; maxWords?: number } = {},
) {
  const pages: { text: string; startMs: number; endMs: number; words: WhisperXWord[] }[] = [];
  let currentPage: WhisperXWord[] = [];

  for (const word of words) {
    const lastWord = currentPage[currentPage.length - 1];
    const gap = lastWord ? word.startMs - lastWord.endMs : 0;

    if (currentPage.length > 0 && (gap > gapMs || currentPage.length >= maxWords)) {
      // Flush current page
      pages.push({
        text: currentPage.map(w => w.text).join(' '),
        startMs: currentPage[0].startMs,
        endMs: currentPage[currentPage.length - 1].endMs,
        words: [...currentPage],
      });
      currentPage = [];
    }

    currentPage.push(word);
  }

  // Flush remaining
  if (currentPage.length > 0) {
    pages.push({
      text: currentPage.map(w => w.text).join(' '),
      startMs: currentPage[0].startMs,
      endMs: currentPage[currentPage.length - 1].endMs,
      words: [...currentPage],
    });
  }

  return pages;
}

export async function processTranscribeJob(job: Job<TranscribeJobData>) {
  const { projectId, jobId, videoKey } = job.data;
  const workDir = join(tmpdir(), `reelify-${nanoid()}`);

  try {
    // Create working directory
    await mkdir(workDir, { recursive: true });

    const videoPath = join(workDir, 'video.mp4');
    const audioPath = join(workDir, 'audio.wav');

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    const pubExtras = { projectId };

    // Step 1: Download video (10%)
    await publishJobProgress(jobId, 5, 'Downloading video...', pubExtras);
    await downloadFile(config.minio.buckets.uploads, videoKey, videoPath);
    await publishJobProgress(jobId, 10, 'Video downloaded', pubExtras);

    // Step 2: Get video metadata
    const [durationMs, metadata] = await Promise.all([
      getVideoDuration(videoPath),
      getVideoMetadata(videoPath),
    ]);

    // Update project with video info
    await db.update(projects)
      .set({
        durationMs,
        fps: metadata.fps,
        sourceWidth: metadata.width,
        sourceHeight: metadata.height,
      })
      .where(eq(projects.id, projectId));

    // Step 3: Extract audio (20%)
    await publishJobProgress(jobId, 15, 'Extracting audio...', pubExtras);
    await extractAudio(videoPath, audioPath);
    await publishJobProgress(jobId, 20, 'Audio extracted', pubExtras);

    // Step 4: Run WhisperX (25% - 70%)
    await publishJobProgress(jobId, 25, 'Starting WhisperX transcription...', pubExtras);
    const whisperxOutput = await runWhisperX(audioPath, jobId, projectId);
    await publishJobProgress(jobId, 70, 'Transcription complete', pubExtras);

    // Step 5: Process captions (75%)
    await publishJobProgress(jobId, 72, 'Processing captions...', pubExtras);

    const pages = groupWordsIntoPages(whisperxOutput.words);

    await publishJobProgress(jobId, 75, 'Captions processed', pubExtras);

    // Step 6: Save transcript to database (80%)
    await publishJobProgress(jobId, 78, 'Saving transcript...', pubExtras);

    await db.insert(transcripts).values({
      projectId,
      rawOutput: whisperxOutput as any,
      words: whisperxOutput.words as any,
    });

    await publishJobProgress(jobId, 80, 'Transcript saved', pubExtras);

    // Step 7: Create subtitle track and items (90%)
    await publishJobProgress(jobId, 82, 'Creating subtitle track...', pubExtras);

    // Create subtitle track
    const [subtitleTrack] = await db.insert(tracks).values({
      projectId,
      type: 'subtitle',
      name: 'Subtitles',
      position: 1,
    }).returning();

    // Create timeline items from caption pages
    const subtitleItems = pages.map((page) => ({
      trackId: subtitleTrack.id,
      type: 'subtitle' as const,
      startMs: page.startMs,
      endMs: page.endMs,
      data: {
        text: page.text,
        words: page.words.map(w => ({
          text: w.text,
          startMs: w.startMs,
          endMs: w.endMs,
        })),
        style: DEFAULT_SUBTITLE_STYLE,
      },
    }));

    if (subtitleItems.length > 0) {
      await db.insert(timelineItems).values(subtitleItems);
    }

    await publishJobProgress(jobId, 90, 'Subtitle track created', pubExtras);

    // Step 8: Update project status (100%)
    await db.update(projects)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete', pubExtras);
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId }, 'Transcription complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Transcription failed');

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
    // Cleanup working directory
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
