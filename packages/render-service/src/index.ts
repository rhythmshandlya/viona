import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { Client as MinioClient } from 'minio';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdir, rm, writeFile, copyFile, readdir, stat as fsStat } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import { nanoid } from 'nanoid';
import pino from 'pino';
import pg from 'pg';
import IORedis from 'ioredis';

const execFileAsync = promisify(execFile);
const logger = pino({ name: 'render-service' });

// ---- Config ----

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://viona:viona123@localhost:5432/viona';

const minioConfig = {
  endPoint: process.env.BUCKET_ENDPOINT || process.env.S3_ENDPOINT || 'localhost',
  port: parseInt(process.env.BUCKET_PORT || process.env.S3_PORT || '9000', 10),
  useSSL: (process.env.BUCKET_ENDPOINT?.includes('.railway.') && !process.env.BUCKET_ENDPOINT?.includes('.internal'))
    || process.env.S3_USE_SSL === 'true',
  accessKey: process.env.BUCKET_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || 'viona',
  secretKey: process.env.BUCKET_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || 'viona123',
};
const BUCKET = process.env.BUCKET_NAME || process.env.S3_BUCKET || 'viona';

/**
 * Find a browser with full codec support (H.264 for <Video> playback).
 * chrome-headless-shell does NOT support video decoding — must use full Chrome.
 */
function findBrowserExecutable(): string | null {
  if (process.platform === 'win32') {
    const candidates = [
      join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    for (const p of candidates) {
      if (p && existsSync(p)) return p;
    }
  } else {
    const candidates = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  }
  return null;
}

const browserExecutable = findBrowserExecutable();

const CONCURRENCY = parseInt(process.env.RENDER_CONCURRENCY || '2', 10);
const REMOTION_CONCURRENCY = parseInt(process.env.REMOTION_CONCURRENCY || '4', 10);

// ---- Clients ----

const minio = new MinioClient(minioConfig);
const pool = new pg.Pool({ connectionString: DATABASE_URL });

function getRedisConnection() {
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

// ---- Job interface ----

interface RenderJobData {
  projectId: string;
  jobId: string;
  projectType?: string;
  manifest?: any;
  bundleMinioKey?: string;
}

// ---- MinIO helpers ----

async function downloadFromMinio(key: string, destPath: string): Promise<void> {
  const stream = await minio.getObject(BUCKET, key);
  const ws = createWriteStream(destPath);
  await pipeline(stream, ws);
}

async function uploadToMinio(key: string, srcPath: string, contentType?: string): Promise<void> {
  await minio.fPutObject(BUCKET, key, srcPath, contentType ? { 'Content-Type': contentType } : {});
}

// ---- DB helpers ----

async function updateJob(jobId: string, fields: Record<string, any>): Promise<void> {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    // Convert camelCase to snake_case
    const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    sets.push(`"${col}" = $${i++}`);
    vals.push(v);
  }
  vals.push(jobId);
  await pool.query(`UPDATE jobs SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

async function updateProject(projectId: string, fields: Record<string, any>): Promise<void> {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    sets.push(`"${col}" = $${i++}`);
    vals.push(v);
  }
  vals.push(projectId);
  await pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

async function getProject(projectId: string): Promise<any> {
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
  return rows[0];
}

// ---- Redis pub/sub for progress ----

const pubRedis = getRedisConnection();

async function publishProgress(jobId: string, progress: number, message: string): Promise<void> {
  const payload = JSON.stringify({ jobId, progress, message });
  await pubRedis.publish(`job:progress:${jobId}`, payload);
  // Also update DB so polling fallback shows progress
  await updateJob(jobId, { progress, progressMessage: message }).catch(() => {});
}

async function publishComplete(jobId: string, projectId: string): Promise<void> {
  await pubRedis.publish(`job:complete:${jobId}`, JSON.stringify({ jobId, projectId }));
}

async function publishError(jobId: string, error: string): Promise<void> {
  await pubRedis.publish(`job:error:${jobId}`, JSON.stringify({ jobId, error }));
}

// ---- Render logic ----

async function processRenderJob(job: Job<RenderJobData>): Promise<void> {
  const { projectId, jobId, manifest, bundleMinioKey } = job.data;
  const workDir = join(tmpdir(), `render-${nanoid()}`);

  logger.info({ projectId, jobId, bundleMinioKey }, 'Starting render job');

  try {
    await mkdir(workDir, { recursive: true });
    await updateJob(jobId, { status: 'processing', progress: 0 });

    if (!manifest || !bundleMinioKey) {
      throw new Error('Missing manifest or bundleMinioKey');
    }

    // 1. Download and extract bundle
    await publishProgress(jobId, 5, 'Downloading bundle...');
    const tarPath = join(workDir, 'bundle.tar.gz');
    await downloadFromMinio(bundleMinioKey, tarPath);

    const bundlePath = join(workDir, 'bundle');
    await mkdir(bundlePath, { recursive: true });
    await execFileAsync('tar', ['-xzf', tarPath, '-C', bundlePath], { timeout: 60_000 });
    logger.info({ bundlePath }, 'Bundle extracted');

    // 2. Download source media into bundle's public/
    await publishProgress(jobId, 15, 'Downloading source media...');
    const project = await getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const bundlePublicDir = join(bundlePath, 'public');
    await mkdir(bundlePublicDir, { recursive: true });

    // Remove stale symlinks from sandbox (point to /workspace/ which doesn't exist here)
    const manifestLink = join(bundlePublicDir, 'manifest.json');
    await rm(manifestLink, { force: true }).catch(() => {});

    // Download source video
    const mediaKey = project.video_key || project.audio_key;
    if (mediaKey) {
      const videoPath = join(workDir, 'source.mp4');
      const minioBucketKey = `uploads/${mediaKey}`;
      logger.info({ minioBucketKey, videoPath }, 'Downloading source media from MinIO');
      await downloadFromMinio(minioBucketKey, videoPath);

      const { size } = await fsStat(videoPath);
      logger.info({ videoPath, sizeBytes: size }, 'Source media downloaded');

      const destPath = join(bundlePublicDir, 'source.mp4');
      await copyFile(videoPath, destPath);
      logger.info({ destPath }, 'Source media placed in bundle public/');

      // Extract audio track for AudioItem components (if not already in bundle)
      const audioPath = join(bundlePublicDir, 'audio.aac');
      if (!existsSync(audioPath)) {
        try {
          await execFileAsync('ffmpeg', [
            '-i', videoPath,
            '-vn', '-acodec', 'aac', '-b:a', '128k',
            '-y', audioPath,
          ], { timeout: 120_000 });
          logger.info({ audioPath }, 'Audio track extracted via ffmpeg');
        } catch (err: any) {
          logger.warn({ err: err.message }, 'ffmpeg audio extraction failed — audio items may not render');
        }
      } else {
        logger.info('audio.aac already present in bundle');
      }
    } else {
      logger.warn({ projectId }, 'No video_key or audio_key — skipping media download');
    }

    // Write manifest as a real file
    await writeFile(manifestLink, JSON.stringify(manifest));

    // Log bundle public/ contents for debugging
    try {
      const publicFiles = await readdir(bundlePublicDir);
      const fileSizes: Record<string, number> = {};
      for (const f of publicFiles) {
        const s = await fsStat(join(bundlePublicDir, f)).catch(() => null);
        if (s) fileSizes[f] = s.size;
      }
      logger.info({ publicFiles: fileSizes }, 'Bundle public/ directory contents');
    } catch { /* non-critical */ }

    // 3. Render with Remotion
    await publishProgress(jobId, 25, 'Rendering video...');

    const fps = manifest.fps || 30;
    const width = manifest.canvas?.width || 1920;
    const height = manifest.canvas?.height || 1080;
    const durationInFrames = Math.ceil((manifest.durationMs || 5000) / 1000 * fps);
    const inputProps = { manifest };

    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: 'MainComposition',
      browserExecutable,
      inputProps,
      timeoutInMilliseconds: 60_000,
    });

    // Override with manifest values (calculateMetadata may fail on staticFile)
    composition.props = inputProps;
    composition.width = width;
    composition.height = height;
    composition.durationInFrames = durationInFrames;
    composition.fps = fps;

    const outputPath = join(workDir, 'output.mp4');

    await renderMedia({
      composition,
      serveUrl: bundlePath,
      codec: 'h264',
      outputLocation: outputPath,
      crf: 18,
      concurrency: REMOTION_CONCURRENCY,
      imageFormat: 'png',
      x264Preset: 'faster',
      browserExecutable,
      inputProps,
      timeoutInMilliseconds: 120_000,
      onProgress: ({ progress }) => {
        const pct = 25 + Math.round(progress * 65);
        publishProgress(jobId, pct, `Rendering: ${Math.round(progress * 100)}%`);
      },
    });

    // 4. Upload output
    await publishProgress(jobId, 92, 'Uploading output...');
    const outputKey = `outputs/${nanoid()}/output.mp4`;
    await uploadToMinio(outputKey, outputPath, 'video/mp4');

    // 5. Update DB — strip "outputs/" prefix for project.outputKey
    const projectOutputKey = outputKey.replace(/^outputs\//, '');
    await updateProject(projectId, {
      status: 'complete',
      outputKey: projectOutputKey,
      updatedAt: new Date(),
    });
    await updateJob(jobId, { status: 'complete', progress: 100, completedAt: new Date() });

    await publishProgress(jobId, 100, 'Complete');
    await publishComplete(jobId, projectId);

    logger.info({ projectId, jobId, outputKey }, 'Render complete');

  } catch (error: any) {
    logger.error({ projectId, jobId, err: error.message }, 'Render failed');

    await updateJob(jobId, { status: 'failed', error: error.message }).catch(() => {});
    await updateProject(projectId, { status: 'failed' }).catch(() => {});
    await publishError(jobId, error.message);

    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---- Start worker ----

const worker = new Worker('sandbox-render', processRenderJob, {
  connection: getRedisConnection(),
  concurrency: CONCURRENCY,
  lockDuration: 600_000, // 10 min
  stalledInterval: 300_000,
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.data.jobId }, 'Job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.data.jobId, err: err.message }, 'Job failed');
});

logger.info({ concurrency: CONCURRENCY, remotionConcurrency: REMOTION_CONCURRENCY, browserExecutable: browserExecutable || 'remotion-managed' }, 'Render service started');
