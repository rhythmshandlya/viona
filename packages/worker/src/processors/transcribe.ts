import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import { db, projects, tracks, timelineItems, transcripts, jobs } from '../db/index.js';
import { downloadFile } from '../services/minio.js';
import { logger } from '../logger.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { DEFAULT_SUBTITLE_STYLE } from '@viona/shared';

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
  // Use spawn with cwd and relative filenames to avoid Windows path issues
  // (FFmpeg interprets colons in paths like C:/... as stream specifiers)
  const { dirname, basename } = await import('path');

  const workDir = dirname(videoPath);
  const inputFilename = basename(videoPath);
  const outputFilename = basename(audioPath);

  // First check if the video has an audio stream
  const hasAudio = await checkHasAudioStream(workDir, inputFilename);

  if (!hasAudio) {
    // Create a silent audio file for videos without audio
    const args = [
      '-f', 'lavfi',
      '-i', 'anullsrc=r=16000:cl=mono',
      '-t', '1',  // 1 second of silence (will be extended if needed)
      '-y',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      outputFilename
    ];

    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg (silent audio) exited with code ${code}: ${stderr.slice(-500)}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
      });
    });
  }

  const args = [
    '-i', inputFilename,
    '-y',
    '-vn',           // No video
    '-acodec', 'pcm_s16le',  // 16-bit PCM
    '-ar', '16000',  // 16kHz sample rate
    '-ac', '1',      // Mono
    outputFilename
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

async function checkHasAudioStream(workDir: string, inputFilename: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a',
      '-show_entries', 'stream=index',
      '-of', 'csv=p=0',
      inputFilename
    ], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });

    proc.on('close', () => {
      // If there's any output, there's an audio stream
      resolve(stdout.trim().length > 0);
    });

    proc.on('error', () => {
      // On error, assume there might be audio and let ffmpeg handle it
      resolve(true);
    });
  });
}

async function getVideoDuration(videoPath: string): Promise<number> {
  // Use spawn with cwd to avoid Windows path issues with colons
  const { dirname, basename } = await import('path');
  const workDir = dirname(videoPath);
  const inputFilename = basename(videoPath);

  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputFilename
    ], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(stdout.trim()) || 0;
        resolve(Math.round(duration * 1000)); // Convert to milliseconds
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ffprobe: ${err.message}`));
    });
  });
}

async function getVideoMetadata(videoPath: string): Promise<{ width: number; height: number; fps: number }> {
  // Use spawn with cwd to avoid Windows path issues with colons
  const { dirname, basename } = await import('path');
  const workDir = dirname(videoPath);
  const inputFilename = basename(videoPath);

  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,r_frame_rate',
      '-of', 'json',
      inputFilename
    ], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(stdout);
          const stream = data.streams?.[0];
          if (!stream) {
            reject(new Error('No video stream found'));
            return;
          }

          // Parse fps from r_frame_rate (e.g., "30/1" or "30000/1001")
          let fps = 30;
          if (stream.r_frame_rate) {
            const [num, den] = stream.r_frame_rate.split('/').map(Number);
            fps = Math.round(num / (den || 1));
          }

          resolve({
            width: stream.width || 1920,
            height: stream.height || 1080,
            fps,
          });
        } catch {
          reject(new Error(`Failed to parse ffprobe output: ${stdout}`));
        }
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ffprobe: ${err.message}`));
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
 * Run OpenAI Whisper API for transcription.
 * Uses the OpenAI SDK to transcribe audio with word-level timestamps.
 */
async function runOpenAIWhisper(
  audioPath: string,
  jobId: string,
  projectId: string,
): Promise<WhisperXOutput> {
  const apiKey = config.transcription.openaiApiKey;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for API transcription mode');
  }

  logger.info({ projectId }, 'Starting OpenAI Whisper transcription');

  // Use OpenAI SDK for proper file upload handling
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });

  const transcription = await openai.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
    language: config.whisperx.language || 'en',
  });

  // The SDK returns typed response
  const result = transcription as {
    text: string;
    words?: Array<{ word: string; start: number; end: number }>;
    segments?: Array<{ text: string; start: number; end: number }>;
  };

  // Convert OpenAI format to WhisperX format
  const words: WhisperXWord[] = (result.words || []).map(w => ({
    text: w.word.trim(),
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
    confidence: 1.0, // OpenAI doesn't provide confidence scores
  }));

  const segments: WhisperXSegment[] = (result.segments || []).map(s => ({
    text: s.text.trim(),
    startMs: Math.round(s.start * 1000),
    endMs: Math.round(s.end * 1000),
  }));

  logger.info({ projectId, wordCount: words.length }, 'OpenAI Whisper transcription complete');

  return {
    words,
    segments,
    language: config.whisperx.language || 'en',
  };
}

/**
 * Run transcription using the configured mode (local or api).
 */
async function runTranscription(
  audioPath: string,
  jobId: string,
  projectId: string,
): Promise<WhisperXOutput> {
  if (config.transcription.mode === 'api') {
    return runOpenAIWhisper(audioPath, jobId, projectId);
  }
  return runWhisperX(audioPath, jobId, projectId);
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

// Check if a file is an audio-only file by extension
function isAudioFile(key: string): boolean {
  const ext = key.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  return ['.mp3', '.m4a', '.wav', '.ogg', '.flac'].includes(ext);
}

// Convert audio to 16kHz mono WAV for Whisper
async function convertToWhisperWav(inputPath: string, outputPath: string): Promise<void> {
  const { dirname, basename } = await import('path');
  const workDir = dirname(inputPath);
  const inputFilename = basename(inputPath);
  const outputFilename = basename(outputPath);

  const args = [
    '-i', inputFilename,
    '-y',
    '-vn',
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    outputFilename,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg (convert WAV) exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

export async function processTranscribeJob(job: Job<TranscribeJobData>) {
  const { projectId, jobId, videoKey } = job.data;
  const workDir = join(tmpdir(), `viona-${nanoid()}`);

  try {
    // Create working directory
    await mkdir(workDir, { recursive: true });

    const isAudio = isAudioFile(videoKey);
    const inputExt = videoKey.match(/\.[^.]+$/)?.[0] || (isAudio ? '.mp3' : '.mp4');
    const inputPath = join(workDir, `input${inputExt}`);
    const audioPath = join(workDir, 'audio.wav');

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    const pubExtras = { projectId };

    // Step 1: Download media (10%)
    await publishJobProgress(jobId, 5, `Downloading ${isAudio ? 'audio' : 'video'}...`, pubExtras);
    await downloadFile('uploads', videoKey, inputPath);
    await publishJobProgress(jobId, 10, `${isAudio ? 'Audio' : 'Video'} downloaded`, pubExtras);

    // Step 2: Get metadata
    let durationMs: number;
    if (isAudio) {
      // Audio files: only get duration, skip video metadata
      durationMs = await getVideoDuration(inputPath);

      await db.update(projects)
        .set({ durationMs })
        .where(eq(projects.id, projectId));
    } else {
      // Video files: get full metadata
      const [duration, metadata] = await Promise.all([
        getVideoDuration(inputPath),
        getVideoMetadata(inputPath),
      ]);
      durationMs = duration;

      await db.update(projects)
        .set({
          durationMs,
          fps: metadata.fps,
          sourceWidth: metadata.width,
          sourceHeight: metadata.height,
        })
        .where(eq(projects.id, projectId));
    }

    // Step 3: Prepare audio for Whisper (20%)
    if (isAudio) {
      // Audio files: convert directly to 16kHz WAV (no need to extract from video)
      await publishJobProgress(jobId, 15, 'Converting audio...', pubExtras);
      await convertToWhisperWav(inputPath, audioPath);
      await publishJobProgress(jobId, 20, 'Audio ready', pubExtras);
    } else {
      // Video files: extract audio track
      await publishJobProgress(jobId, 15, 'Extracting audio...', pubExtras);
      await extractAudio(inputPath, audioPath);
      await publishJobProgress(jobId, 20, 'Audio extracted', pubExtras);
    }

    // Step 4: Run transcription (25% - 70%)
    const transcriptionMode = config.transcription.mode;
    await publishJobProgress(jobId, 25, `Starting ${transcriptionMode === 'api' ? 'OpenAI Whisper' : 'WhisperX'} transcription...`, pubExtras);
    const whisperxOutput = await runTranscription(audioPath, jobId, projectId);
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

    // Step 8: For audio projects, create audio track + timeline item referencing uploaded audio
    if (isAudio) {
      const [audioTrack] = await db.insert(tracks).values({
        projectId,
        type: 'audio',
        name: 'Audio',
        position: 2,
      }).returning();

      await db.insert(timelineItems).values({
        trackId: audioTrack.id,
        type: 'audio',
        startMs: 0,
        endMs: durationMs,
        data: {
          src: `/api/projects/${projectId}/audio`,
          originalSrc: `/api/projects/${projectId}/audio`,
          isEnhanced: false,
          sourceVideoItemId: '',
          volume: 1,
        },
      });
    }

    // Step 9: Update project status (100%)
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
