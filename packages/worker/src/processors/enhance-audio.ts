import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm } from 'fs/promises';
import { join, resolve as resolve_ } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import { db, jobs, timelineItems } from '../db/index.js';
import { downloadFile, uploadFile } from '../services/minio.js';
import { logger } from '../logger.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';

export interface EnhanceAudioJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
  audioTrackId: string;
  audioItemId: string;
  videoItemId: string;
}

/**
 * Extract audio from video as 48kHz WAV mono
 */
function extractAudio48k(videoPath: string, audioPath: string): Promise<void> {
  // Normalize paths for FFmpeg on Windows (use forward slashes)
  const normalizedInput = videoPath.replace(/\\/g, '/');
  const normalizedOutput = audioPath.replace(/\\/g, '/');

  return new Promise((resolve, reject) => {
    ffmpeg(normalizedInput)
      .outputOptions([
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '48000',
        '-ac', '1',
      ])
      .output(normalizedOutput)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Transcode WAV to AAC m4a
 */
function transcodeToAac(inputPath: string, outputPath: string): Promise<void> {
  // Normalize paths for FFmpeg on Windows (use forward slashes)
  const normalizedInput = inputPath.replace(/\\/g, '/');
  const normalizedOutput = outputPath.replace(/\\/g, '/');

  return new Promise((resolve, reject) => {
    ffmpeg(normalizedInput)
      .outputOptions([
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
      ])
      .output(normalizedOutput)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Run the Python enhancement script as a subprocess
 */
function runEnhancementScript(
  inputPath: string,
  outputPath: string,
  onProgress: (percent: number, message: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = resolve_(config.enhance.scriptPath);
    const proc = spawn(config.pythonPath, [
      scriptPath,
      '--input', inputPath,
      '--output', outputPath,
      '--lufs', '-14',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      // Parse progress lines: PROGRESS:XX%:message
      const lines = text.split('\n');
      for (const line of lines) {
        const match = line.match(/^PROGRESS:(\d+)%:(.+)$/);
        if (match) {
          onProgress(parseInt(match[1], 10), match[2]);
        }
        // Check for error
        if (line.startsWith('ERROR:')) {
          reject(new Error(line.slice(6)));
        }
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Enhancement script exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start enhancement script: ${err.message}`));
    });
  });
}

export async function processEnhanceAudioJob(job: Job<EnhanceAudioJobData>) {
  const { projectId, jobId, videoKey, audioTrackId, audioItemId, videoItemId } = job.data;
  const workDir = join(tmpdir(), `reelify-enhance-${nanoid()}`);

  try {
    await mkdir(workDir, { recursive: true });

    const videoPath = join(workDir, 'video.mp4');
    const rawAudioPath = join(workDir, 'raw.wav');
    const enhancedWavPath = join(workDir, 'enhanced.wav');
    const originalM4aPath = join(workDir, 'original.m4a');
    const enhancedM4aPath = join(workDir, 'enhanced.m4a');

    const pubExtras = { projectId, audioItemId };

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    // Step 1: Download video (0-10%)
    await publishJobProgress(jobId, 2, 'Downloading video...', pubExtras);
    await downloadFile('uploads', videoKey, videoPath);
    await publishJobProgress(jobId, 10, 'Video downloaded', pubExtras);

    // Step 2: Extract audio as 48kHz WAV (10-15%)
    await publishJobProgress(jobId, 12, 'Extracting audio...', pubExtras);
    await extractAudio48k(videoPath, rawAudioPath);

    // Probe actual video duration so the audio item gets the correct endMs
    // Normalize path for FFmpeg on Windows
    const normalizedVideoPath = videoPath.replace(/\\/g, '/');
    const durationMs: number = await new Promise((res, rej) => {
      ffmpeg.ffprobe(normalizedVideoPath, (err, meta) => {
        if (err) return rej(err);
        res(Math.round((meta.format.duration || 0) * 1000));
      });
    });

    if (durationMs > 0) {
      await db.update(timelineItems)
        .set({ endMs: durationMs })
        .where(eq(timelineItems.id, audioItemId));
    }

    await publishJobProgress(jobId, 15, 'Audio extracted', pubExtras);

    // Step 3: Run Python enhancement pipeline (15-75%) - or skip if disabled
    if (config.enhance.disabled) {
      logger.info({ projectId }, 'Audio enhancement disabled via DISABLE_AUDIO_ENHANCEMENT, skipping');
      await publishJobProgress(jobId, 75, 'Enhancement skipped (disabled)', pubExtras);
    } else {
      await runEnhancementScript(rawAudioPath, enhancedWavPath, (percent, message) => {
        const mappedProgress = 15 + Math.round(percent * 0.6); // 15-75%
        publishJobProgress(jobId, mappedProgress, message, pubExtras);
      });
      await publishJobProgress(jobId, 75, 'Enhancement complete', pubExtras);
    }

    // Step 4: Transcode to AAC (75-85%)
    await publishJobProgress(jobId, 77, 'Transcoding original to AAC...', pubExtras);
    await transcodeToAac(rawAudioPath, originalM4aPath);
    await publishJobProgress(jobId, 80, 'Transcoding enhanced to AAC...', pubExtras);
    // When enhancement is disabled, use raw audio as "enhanced"
    const sourceForEnhanced = config.enhance.disabled ? rawAudioPath : enhancedWavPath;
    await transcodeToAac(sourceForEnhanced, enhancedM4aPath);
    await publishJobProgress(jobId, 85, 'Transcoding complete', pubExtras);

    // Step 5: Upload to MinIO (85-95%)
    const originalKey = `${projectId}/audio/original-${nanoid(8)}.m4a`;
    const enhancedKey = `${projectId}/audio/enhanced-${nanoid(8)}.m4a`;

    await publishJobProgress(jobId, 87, 'Uploading original audio...', pubExtras);
    await uploadFile('outputs', originalKey, originalM4aPath);
    await publishJobProgress(jobId, 90, 'Uploading enhanced audio...', pubExtras);
    await uploadFile('outputs', enhancedKey, enhancedM4aPath);
    await publishJobProgress(jobId, 95, 'Upload complete', pubExtras);

    // Step 6: Update database (95-100%)
    await publishJobProgress(jobId, 97, 'Updating project...', pubExtras);

    await db.update(timelineItems)
      .set({
        endMs: durationMs > 0 ? durationMs : undefined,
        data: {
          src: enhancedKey,
          originalSrc: originalKey,
          enhancedSrc: enhancedKey,
          isEnhanced: !config.enhance.disabled,
          sourceVideoItemId: videoItemId,
          volume: 1,
          enhancementStatus: config.enhance.disabled ? 'skipped' : 'complete',
          enhancementProgress: 100,
        },
        updatedAt: new Date(),
      })
      .where(eq(timelineItems.id, audioItemId));

    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete', pubExtras);
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId }, 'Audio enhancement complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Audio enhancement failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(timelineItems)
      .set({
        data: {
          src: '',
          originalSrc: '',
          isEnhanced: false,
          sourceVideoItemId: videoItemId,
          volume: 1,
          enhancementStatus: 'error',
        },
        updatedAt: new Date(),
      })
      .where(eq(timelineItems.id, audioItemId));

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await publishJobError(jobId, errorMessage, { projectId });

    throw error;
  } finally {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
