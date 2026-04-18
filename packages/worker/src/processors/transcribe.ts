import { Job, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import { db, projects, tracks, timelineItems, transcripts, jobs } from '../db/index.js';
import { downloadFile } from '../services/minio.js';
import { logger } from '../logger.js';
import { publishJobProgress, publishJobComplete, publishJobError, setJobProjectId } from '../services/redis.js';
import { config } from '../config.js';
import { DEFAULT_SUBTITLE_STYLE } from '@viona/shared';
import { redisConnection } from '../utils/redis.js';

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

// Per-word style overrides stored in subtitle item JSONB data.
// Uses the full editor-side field set (activeColor, textTransform) even though
// @viona/shared's WordStyleOverrides is narrower — JSONB accepts any shape.
export interface PerWordStyleOverrides {
  scale?: number;
  fontWeight?: number;
  color?: string;
  activeColor?: string;
  textTransform?: 'uppercase' | 'lowercase' | 'none';
}

export type WordTier = 'power' | 'medium' | 'filler';

export function mapWordTypeToOverrides(type: WordTier): PerWordStyleOverrides | null {
  if (type === 'power') {
    return {
      scale: 1.6,
      fontWeight: 900,
      color: '#ffffff',
      activeColor: '#FFD400',
      textTransform: 'uppercase',
    };
  }
  if (type === 'filler') {
    return {
      scale: 1.0,
      fontWeight: 500,
      color: 'rgba(255,255,255,0.7)',
      activeColor: 'rgba(255,255,255,0.85)',
    };
  }
  // medium — let the preset's base style apply
  return null;
}

const WORD_ANALYSIS_BATCH_SIZE = 200;

const WORD_ANALYSIS_SYSTEM_PROMPT = `You are a subtitle typography designer.
Classify each spoken word for visual emphasis in short-form video subtitles.

Types:
- "power": emotionally strong, surprising, impactful, or key-information words (nouns, strong verbs, numbers, dollar amounts, superlatives, emotional adjectives)
- "filler": articles (a, an, the), prepositions (in, on, at, to, of, for, with, by, from), conjunctions (and, but, or), auxiliary verbs (is, are, was, were, be, been, do, did, has, had, have, will, would, could, should), pronouns (i, you, we, they, he, she, it, me, us, them)
- "medium": everything else (default — do not include in output)

Return ONLY a JSON object. Keys = word index (string), values = {"type":"power"|"filler"}.
Include ONLY power and filler words. Omit medium words entirely.
Example: {"3":{"type":"power"},"7":{"type":"filler"},"12":{"type":"power"}}`;

async function analyzeWordStyles(
  words: WhisperXWord[],
  apiKey: string,
  model: string,
): Promise<Record<number, PerWordStyleOverrides>> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });

  const allOverrides: Record<number, PerWordStyleOverrides> = {};

  // Process in batches to stay within token limits
  for (let batchStart = 0; batchStart < words.length; batchStart += WORD_ANALYSIS_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + WORD_ANALYSIS_BATCH_SIZE, words.length);
    const batchWords = words.slice(batchStart, batchEnd);

    // Build word list with global indices
    const wordList = batchWords
      .map((w, localIdx) => `${batchStart + localIdx}: "${w.text}"`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: WORD_ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: `Classify these words:\n${wordList}` },
      ],
      temperature: 0,
      max_tokens: 800,
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    let parsed: Record<string, { type: WordTier }>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      logger.warn({ batchStart }, 'Word style analysis: failed to parse LLM JSON, skipping batch');
      continue;
    }

    for (const [idxStr, entry] of Object.entries(parsed)) {
      const globalIdx = parseInt(idxStr, 10);
      if (isNaN(globalIdx) || globalIdx < batchStart || globalIdx >= batchEnd) continue;
      const tier = entry?.type as WordTier;
      if (tier !== 'power' && tier !== 'filler' && tier !== 'medium') continue;
      const overrides = mapWordTypeToOverrides(tier);
      if (overrides) {
        allOverrides[globalIdx] = overrides;
      }
    }
  }

  return allOverrides;
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
    language: config.transcription.language,
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
    language: config.transcription.language,
  };
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

// Check if a downloaded file actually has a video stream (handles .mp4 with audio-only)
async function hasVideoStream(filePath: string): Promise<boolean> {
  const { dirname, basename } = await import('path');
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'json',
      basename(filePath),
    ], { cwd: dirname(filePath), stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.on('close', () => {
      try {
        const data = JSON.parse(stdout);
        resolve((data.streams?.length ?? 0) > 0);
      } catch {
        resolve(false);
      }
    });
    proc.on('error', () => resolve(false));
  });
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
  setJobProjectId(jobId, projectId);
  const workDir = join(tmpdir(), `viona-${nanoid()}`);

  try {
    // Create working directory
    await mkdir(workDir, { recursive: true });

    let isAudio = isAudioFile(videoKey);
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

    // Handle .mp4 files that are actually audio-only (no video stream)
    if (!isAudio && !(await hasVideoStream(inputPath))) {
      isAudio = true;
    }

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
    await publishJobProgress(jobId, 25, 'Starting transcription...', pubExtras);
    const whisperxOutput = await runOpenAIWhisper(audioPath, jobId, projectId);
    await publishJobProgress(jobId, 70, 'Transcription complete', pubExtras);

    // Step 5: Save transcript to database (85%)
    // Word-level timing is preserved here so captions can be created later
    // on demand — either by the user clicking "Add captions" in the editor
    // or by the sandbox Caption Agent when the AI pipeline runs. We don't
    // materialize subtitle track/items here anymore (previously we auto-created
    // a `subtitle` track + one item per page + LLM word-style analysis, which
    // put captions on every fresh project regardless of user intent).
    await publishJobProgress(jobId, 80, 'Saving transcript...', pubExtras);

    await db.insert(transcripts).values({
      projectId,
      rawOutput: whisperxOutput as any,
      words: whisperxOutput.words as any,
    });

    await publishJobProgress(jobId, 90, 'Transcript saved', pubExtras);

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

    // Queue cinematic caption analysis (non-blocking)
    try {
      const analyzeCaptionsQueue = new Queue('analyze-captions', { connection: redisConnection });
      await analyzeCaptionsQueue.add('analyze', {
        projectId,
        jobId: `analyze-${jobId}`,
      });
      logger.info({ projectId }, '[transcribe] Queued analyze-captions job');
    } catch (e) {
      logger.error({ projectId, err: e }, '[transcribe] Failed to queue analyze-captions');
    }

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
