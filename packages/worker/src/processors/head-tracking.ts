import { Job, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import { db, projects, jobs } from '../db/index.js';
import { downloadFile } from '../services/minio.js';
import { logger } from '../logger.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';

export interface HeadTrackingJobData {
  projectId: string;
  jobId: string;
  videoKey: string;
}

export async function processHeadTrackingJob(job: Job<HeadTrackingJobData>) {
  const { projectId, jobId, videoKey } = job.data;
  const workDir = join(tmpdir(), `reelify-headtrack-${nanoid()}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    const pubExtras = { projectId };

    // Step 1: Download video (10%)
    await publishJobProgress(jobId, 5, 'Downloading video for head tracking...', pubExtras);
    const videoPath = join(workDir, 'video.mp4');
    await downloadFile('uploads', videoKey, videoPath);
    await publishJobProgress(jobId, 10, 'Video downloaded', pubExtras);

    // Step 2: Run detect_head.py (10-80%)
    await publishJobProgress(jobId, 15, 'Running head detection...', pubExtras);

    const trackingOutputPath = join(workDir, 'video_tracking.json');
    // detect_head.py is in the scripts directory relative to the worker package
    const resolvedScriptPath = resolve(join(process.cwd(), 'scripts', 'detect_head.py'));

    await runHeadDetection(
      videoPath,
      trackingOutputPath,
      resolvedScriptPath,
      jobId,
      projectId,
    );

    await publishJobProgress(jobId, 80, 'Head detection complete', pubExtras);

    // Step 3: Read tracking data and store in DB (90%)
    await publishJobProgress(jobId, 85, 'Saving tracking data...', pubExtras);

    const trackingJson = await readFile(trackingOutputPath, 'utf-8');
    const trackingData = JSON.parse(trackingJson);

    await db.update(projects)
      .set({
        headTrackingData: trackingData,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    await publishJobProgress(jobId, 90, 'Tracking data saved', pubExtras);

    // Step 4: Auto-queue reframe generation
    await publishJobProgress(jobId, 92, 'Generating reframe keyframes...', pubExtras);

    try {
      // Create reframe job directly via BullMQ
      function parseRedisUrl(url: string) {
        const parsed = new URL(url);
        return {
          host: parsed.hostname,
          port: parseInt(parsed.port || '6379', 10),
          password: parsed.password || undefined,
        };
      }
      const connection = parseRedisUrl(config.redis.url);
      const reframeQueue = new Queue('generate-reframe', { connection });

      // Create job record in DB
      const [reframeJob] = await db.insert(jobs).values({
        projectId,
        type: 'generate-reframe',
        status: 'pending',
      }).returning();

      await reframeQueue.add('generate-reframe', {
        projectId,
        jobId: reframeJob.id,
      }, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      });

      await reframeQueue.close();
      logger.info({ projectId, reframeJobId: reframeJob.id }, 'Auto-queued reframe generation');
    } catch (err) {
      logger.warn({ err, projectId }, 'Failed to auto-queue reframe generation (non-critical)');
    }

    // Step 5: Complete
    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete', pubExtras);
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId }, 'Head tracking complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Head tracking failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

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

async function runHeadDetection(
  videoPath: string,
  outputPath: string,
  scriptPath: string,
  jobId: string,
  projectId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonPath = config.pythonPath || 'python3';

    const args = [
      scriptPath,
      videoPath,
      '--output', outputPath,
      '--interval', '3',
    ];

    logger.info({ pythonPath, args }, 'Running head detection script');

    const proc = spawn(pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      // Parse progress from output
      for (const line of text.split('\n')) {
        if (line.includes('Processed') && line.includes('samples')) {
          const match = line.match(/Processed (\d+) samples/);
          if (match) {
            const samples = parseInt(match[1], 10);
            // Map to 15-80% range
            const progress = Math.min(80, 15 + Math.round((samples / 1000) * 65));
            publishJobProgress(jobId, progress, `Tracking: ${samples} frames processed`, { projectId });
          }
        }
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        const lastLines = stderr.trim().split('\n').slice(-3).join(' | ');
        reject(new Error(`detect_head.py exited with code ${code}: ${lastLines}`));
        return;
      }
      resolve();
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn detect_head.py: ${err.message}`));
    });
  });
}
