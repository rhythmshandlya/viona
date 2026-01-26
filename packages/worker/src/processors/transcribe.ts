import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import ffmpeg from 'fluent-ffmpeg';
import {
  installWhisperCpp,
  downloadWhisperModel,
  transcribe,
  toCaptions,
} from '@remotion/install-whisper-cpp';
import { createTikTokStyleCaptions } from '@remotion/captions';
import { db, projects, tracks, timelineItems, transcripts, jobs } from '../db/index.js';
import { downloadFile } from '../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { DEFAULT_SUBTITLE_STYLE } from '@reelify/shared';

export interface TranscribeJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
}

async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        '-vn',           // No video
        '-acodec', 'pcm_s16le',  // 16-bit PCM
        '-ar', '16000',  // 16kHz sample rate (required by Whisper)
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

    // Step 1: Download video (10%)
    await publishJobProgress(jobId, 5, 'Downloading video...');
    await downloadFile(config.minio.buckets.uploads, videoKey, videoPath);
    await publishJobProgress(jobId, 10, 'Video downloaded');

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
        width: metadata.width,
        height: metadata.height,
      })
      .where(eq(projects.id, projectId));

    // Step 3: Extract audio (20%)
    await publishJobProgress(jobId, 15, 'Extracting audio...');
    await extractAudio(videoPath, audioPath);
    await publishJobProgress(jobId, 20, 'Audio extracted');

    // Step 4: Ensure Whisper is installed (25%)
    await publishJobProgress(jobId, 22, 'Checking Whisper installation...');

    // Install Whisper.cpp if needed
    await installWhisperCpp({
      to: config.whisper.path,
      version: '1.5.5',
    });

    // Download model if needed
    await downloadWhisperModel({
      model: config.whisper.model as any,
      folder: config.whisper.path,
    });

    await publishJobProgress(jobId, 25, 'Whisper ready');

    // Step 5: Transcribe (25% - 70%)
    await publishJobProgress(jobId, 30, 'Transcribing audio...');

    const whisperOutput = await transcribe({
      inputPath: audioPath,
      whisperPath: config.whisper.path,
      model: config.whisper.model as any,
      tokenLevelTimestamps: true,
      onProgress: (progress) => {
        const mappedProgress = 30 + Math.round(progress * 40); // 30-70%
        publishJobProgress(jobId, mappedProgress, 'Transcribing...');
      },
    });

    await publishJobProgress(jobId, 70, 'Transcription complete');

    // Step 6: Convert to captions (75%)
    await publishJobProgress(jobId, 72, 'Processing captions...');

    const { captions } = toCaptions({ whisperCppOutput: whisperOutput });

    // Create TikTok-style caption pages
    const { pages } = createTikTokStyleCaptions({
      captions,
      combineTokensWithinMilliseconds: 800, // Group words within 800ms
    });

    await publishJobProgress(jobId, 75, 'Captions processed');

    // Step 7: Save transcript to database (80%)
    await publishJobProgress(jobId, 78, 'Saving transcript...');

    // Convert captions to our word format
    const words = captions.map(c => ({
      text: c.text,
      startMs: c.startMs,
      endMs: c.endMs,
      confidence: c.confidence || 1,
    }));

    await db.insert(transcripts).values({
      projectId,
      rawOutput: whisperOutput as any,
      words: words as any,
    });

    await publishJobProgress(jobId, 80, 'Transcript saved');

    // Step 8: Create subtitle track and items (90%)
    await publishJobProgress(jobId, 82, 'Creating subtitle track...');

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
      endMs: page.startMs + (page.tokens[page.tokens.length - 1]?.toMs || 0) - page.tokens[0]?.fromMs || 2000,
      data: {
        text: page.text,
        words: page.tokens.map(t => ({
          text: t.text,
          startMs: page.startMs + t.fromMs,
          endMs: page.startMs + t.toMs,
        })),
        style: DEFAULT_SUBTITLE_STYLE,
      },
    }));

    if (subtitleItems.length > 0) {
      await db.insert(timelineItems).values(subtitleItems);
    }

    await publishJobProgress(jobId, 90, 'Subtitle track created');

    // Step 9: Update project status (100%)
    await db.update(projects)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    console.log(`Transcription complete for project ${projectId}`);

  } catch (error) {
    console.error(`Transcription failed for project ${projectId}:`, error);

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
