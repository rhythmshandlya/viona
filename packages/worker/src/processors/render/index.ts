import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, writeFile, copyFile } from 'fs/promises';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, projects, jobs } from '../../db/index.js';
import { downloadFile, uploadFile } from '../../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError, setJobProjectId } from '../../services/redis.js';
import { logger } from '../../logger.js';
import {
  downloadVideoClipsForRender,
  renderWithRemotion,
} from './ffmpeg.js';
import type { RenderJobData } from './types.js';

// Re-exports for public API
export type { RenderJobData } from './types.js';

/**
 * Workspace-based render path.
 * Uses the workspace Remotion bundle directly with manifest as inputProps.
 * The bundle's PlayerComposition handles all manifest → props conversion internally.
 */
async function renderFromManifest(
  jobData: RenderJobData,
  workDir: string,
  jobId: string,
): Promise<boolean> {
  const manifest = jobData.manifest;
  const bundlePath = jobData.workspaceBundlePath;
  if (!manifest || !bundlePath) return false;

  const projectId = jobData.projectId;

  await publishJobProgress(jobId, 5, 'Preparing workspace-based render...');

  // 1. Load project for source media keys
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new Error(`Project not found: ${projectId}`);

  // 2. Download source media
  const isAudioProject = (jobData.projectType || project.projectType || 'video') === 'audio';
  let sourceVideoPath: string | undefined;
  let audioPath: string | undefined;

  if (isAudioProject) {
    if (project.audioKey) {
      const audioExt = project.audioKey.match(/\.[^.]+$/)?.[0] || '.mp3';
      audioPath = join(workDir, `input${audioExt}`);
      await downloadFile('uploads', project.audioKey, audioPath);
    }
  } else {
    if (project.videoKey) {
      sourceVideoPath = join(workDir, 'input.mp4');
      await downloadFile('uploads', project.videoKey!, sourceVideoPath);
    }
  }

  await publishJobProgress(jobId, 15, 'Preparing bundle assets...');

  // 3. Copy source media into bundle's public/ directory
  const bundlePublicDir = join(bundlePath, 'public');
  await mkdir(bundlePublicDir, { recursive: true });

  let videoUrl: string | undefined;
  let audioUrl: string | undefined;

  if (sourceVideoPath) {
    await copyFile(sourceVideoPath, join(bundlePublicDir, 'source.mp4'));
    videoUrl = 'source.mp4';
  }
  if (isAudioProject && audioPath) {
    // Preserve original extension (.mp3, .m4a, .wav, etc.)
    const audioFilename = `audio${audioPath.match(/\.[^.]+$/)?.[0] || '.mp3'}`;
    await copyFile(audioPath, join(bundlePublicDir, audioFilename));
    audioUrl = audioFilename;
  }

  // 4. Handle video clips (YouTube clips for scenes)
  if (jobData.videoClipData?.length) {
    const { clips: videoClipPaths } = await downloadVideoClipsForRender(
      projectId, workDir, jobData.videoClipData,
    );
    if (videoClipPaths.size > 0) {
      const bundleClipsDir = join(bundlePublicDir, 'assets', 'clips');
      await mkdir(bundleClipsDir, { recursive: true });
      for (const [, clipPath] of videoClipPaths) {
        await copyFile(clipPath, join(bundleClipsDir, basename(clipPath)));
      }
    }
  }

  // 5. Handle enhanced audio (data shape is loosely typed — audio items may carry extra fields)
  const enhancedAudioItem = (manifest.items || []).find((item) => {
    const d = item.data as Record<string, unknown>;
    return item.type === 'audio' && d?.isEnhanced && d?.src;
  });

  if (enhancedAudioItem) {
    const audioSrc = (enhancedAudioItem.data as Record<string, unknown>).src as string;
    const audioKeyMatch = audioSrc.match(/\/media\/outputs\/(.+)$/);
    if (audioKeyMatch) {
      try {
        const enhancedPath = join(workDir, 'enhanced.m4a');
        await downloadFile('outputs', audioKeyMatch[1], enhancedPath);
        await copyFile(enhancedPath, join(bundlePublicDir, 'enhanced.m4a'));
        audioUrl = 'enhanced.m4a';
      } catch (err) {
        logger.warn({ err }, 'Failed to download enhanced audio, using original');
      }
    }
  }

  await publishJobProgress(jobId, 25, 'Rendering video...');

  // 6. Build inputProps — manifest + media URLs
  const inputProps = {
    manifest,
    videoUrl,
    audioUrl,
  };

  const propsPath = join(workDir, 'input-props.json');
  await writeFile(propsPath, JSON.stringify(inputProps), 'utf-8');

  // 7. Render with Remotion
  const outputPath = join(workDir, 'output.mp4');
  await renderWithRemotion({
    bundlePath,
    compositionId: 'Preview',
    outputPath,
    propsPath,
    onProgress: (progress) => {
      const jobProgress = 25 + Math.round(progress * 65);
      publishJobProgress(jobId, jobProgress, `Rendering: ${Math.round(progress * 100)}%`);
    },
  });

  await publishJobProgress(jobId, 92, 'Uploading output...');

  // 8. Upload to S3
  const outputKey = `${nanoid()}/output.mp4`;
  await uploadFile('outputs', outputKey, outputPath);

  // 9. Update project + job
  await db.update(projects).set({
    status: 'complete',
    outputKey,
    updatedAt: new Date(),
  }).where(eq(projects.id, projectId));

  await db.update(jobs)
    .set({ status: 'complete', progress: 100, completedAt: new Date() })
    .where(eq(jobs.id, jobId));

  await publishJobProgress(jobId, 100, 'Complete');
  await publishJobComplete(jobId, projectId);

  return true;
}

export async function processRenderJob(job: Job<RenderJobData>) {
  const { projectId, jobId } = job.data;
  setJobProjectId(jobId, projectId);
  const workDir = join(tmpdir(), `viona-render-${nanoid()}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    // Render from workspace manifest + bundle
    const handled = await renderFromManifest(job.data, workDir, jobId);
    if (!handled) {
      throw new Error(
        'Workspace render not available — manifest or bundle path missing. ' +
        'Ensure the workspace is active before exporting.',
      );
    }

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
