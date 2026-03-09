/**
 * SVG Animation Processor
 *
 * Converts user-uploaded images to animated SVG compositions:
 * 1. Download image from S3
 * 2. Convert to SVG using Claude Vision API
 * 3. Generate animated Remotion composition using Claude Code
 * 4. Bundle and upload to S3
 * 5. Create visual record and timeline item
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { db, projects, tracks, timelineItems, jobs, visuals } from '../../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError, setJobProjectId } from '../../services/redis.js';
import { downloadFile, uploadFile } from '../../services/minio.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { getWorkspacePath, createProjectDir } from '../../workspace.js';
import { SvgAnimationJobData } from './types.js';
import { extractSearchKeywords, findTimestampInTranscript, convertImageToSvg } from './converter.js';
import { generateAnimatedComposition, generateImageAnimatedComposition } from './components.js';
import { compileCjs, bundleComposition, uploadBundleToStorage, uploadSourceToStorage } from './build.js';

// Re-export types
export type { SvgAnimationJobData, SvgAnimationMetadata } from './types.js';

export async function processSvgAnimationJob(job: Job<SvgAnimationJobData>) {
  const {
    projectId,
    jobId,
    imageKey,
    animationType,
    animationStyle,
    durationSeconds,
    trackId,
    startMs: defaultStartMs,
    width,
    height,
    description,
    sceneId,
    useOriginalImage,
  } = job.data;
  setJobProjectId(jobId, projectId);

  const fps = 30;
  const durationMs = durationSeconds * 1000;
  const compositionId = `svg-anim-${jobId.slice(0, 8)}`;
  const workspaceCompositionId = compositionId.replace(/-/g, '_');

  // Determine actual startMs based on description, sceneId, or default
  let startMs = defaultStartMs;
  let placementSource = 'default';

  // First priority: search transcript based on description (e.g., "when I say front matter")
  if (description) {
    const searchKeywords = extractSearchKeywords(description);
    if (searchKeywords) {
      const transcriptStartMs = await findTimestampInTranscript(projectId, searchKeywords);
      if (transcriptStartMs !== null) {
        startMs = transcriptStartMs;
        placementSource = 'transcript';
        logger.info({ projectId, description, searchKeywords, startMs }, 'Found timestamp from transcript');
      }
    }
  }

  // Second priority: if no transcript match and sceneId provided, use scene's startMs
  if (placementSource === 'default' && sceneId) {
    try {
      const projectVisual = await db.query.visuals.findFirst({
        where: eq(visuals.projectId, projectId),
      });

      if (projectVisual?.timestamps && Array.isArray(projectVisual.timestamps)) {
        const scene = (projectVisual.timestamps as any[]).find((t: any) => t.id === sceneId);
        if (scene?.startMs !== undefined) {
          startMs = scene.startMs;
          placementSource = 'scene';
          logger.info({ projectId, sceneId, startMs }, 'Using scene startMs for animation placement');
        }
      }
    } catch (err) {
      logger.warn({ projectId, sceneId, err }, 'Failed to find scene for placement');
    }
  }

  logger.info({ projectId, jobId, description, sceneId, startMs, placementSource }, 'Processing SVG animation with placement context');

  try {
    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Downloading image...');

    // Download image from S3
    const imageExt = imageKey.split('.').pop() || 'png';
    const imagePath = join(tmpdir(), `svg-anim-${jobId}-image.${imageExt}`);
    await downloadFile('uploads', imageKey, imagePath);

    logger.info({ projectId, jobId, imagePath, useOriginalImage }, 'Image downloaded');

    // Create project directory in workspace
    const workspacePath = getWorkspacePath();
    const projectDir = createProjectDir(workspaceCompositionId);

    let svg: string;
    let imagePublicUrl: string | undefined;

    if (useOriginalImage) {
      // Use original image - copy to outputs and create image-based animation
      await publishJobProgress(jobId, 15, 'Preparing image...');

      // Copy image to outputs bucket for public access
      const outputImageKey = `images/${compositionId}/image.${imageExt}`;
      await uploadFile('outputs', outputImageKey, imagePath);
      imagePublicUrl = `/api/media/outputs/${outputImageKey}`;

      logger.info({ projectId, jobId, imagePublicUrl }, 'Image uploaded for animation');

      await publishJobProgress(jobId, 40, 'Generating animated composition...');

      // Generate image-based animation (not SVG)
      await generateImageAnimatedComposition(projectDir, imagePublicUrl, {
        compositionId,
        workspaceCompositionId,
        animationStyle,
        durationSeconds,
        width,
        height,
        fps,
      });
    } else {
      // Convert image to SVG using OpenAI Vision
      await publishJobProgress(jobId, 15, 'Converting image to SVG...');

      svg = await convertImageToSvg(imagePath, width, height, animationType);

      logger.info({ projectId, jobId, svgLength: svg.length }, 'SVG generated from image');

      await publishJobProgress(jobId, 40, 'Generating animated composition...');

      // Generate SVG-based Remotion composition
      await generateAnimatedComposition(projectDir, svg, {
        compositionId,
        workspaceCompositionId,
        animationType,
        animationStyle,
        durationSeconds,
        width,
        height,
        fps,
      });
    }

    await publishJobProgress(jobId, 60, 'Bundling composition...');

    // Bundle the composition
    const bundleDir = await bundleComposition(
      compositionId,
      config.remotion.bundleOutputDir
    );

    await publishJobProgress(jobId, 70, 'Compiling for preview...');

    // Compile to CJS for frontend dynamic loading
    await compileCjs(projectDir, bundleDir);

    await publishJobProgress(jobId, 80, 'Uploading to storage...');

    // Upload bundle to S3
    await uploadBundleToStorage(bundleDir, compositionId);

    // Upload source files to S3
    const sourceUrl = await uploadSourceToStorage(projectDir, compositionId);

    await publishJobProgress(jobId, 85, 'Creating timeline item...');

    // Bundle URL
    const bundleUrl = `/api/bundles/${compositionId}/index.html`;

    // Create or get the target track
    let targetTrackId = trackId;
    if (!targetTrackId) {
      // Look for an existing visual track first
      const existingTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));
      const existingVisualTrack = existingTracks.find(t => t.type === 'visual');

      if (existingVisualTrack) {
        targetTrackId = existingVisualTrack.id;
        logger.info({ projectId, trackId: targetTrackId }, 'Using existing visual track');
      } else {
        // Create a new "Animations" track
        const [newTrack] = await db.insert(tracks).values({
          projectId,
          type: 'visual',
          name: 'Animations',
          position: existingTracks.length,
        }).returning();
        targetTrackId = newTrack.id;
        logger.info({ projectId, trackId: targetTrackId }, 'Created new visual track');
      }
    }

    // Create visual record - include user description if provided
    const animationDescription = description || `SVG ${animationType} animation`;
    const [insertedVisual] = await db.insert(visuals).values({
      projectId,
      compositionId,
      bundleUrl,
      sourceUrl,
      durationFrames: durationSeconds * fps,
      fps,
      width,
      height,
      stylePreset: animationStyle,
      llmModel: 'gpt-4o',
      timestamps: [{
        startMs,
        endMs: startMs + durationMs,
        type: animationType === 'draw' ? 'svg-draw' : 'svg-motion',
        description: animationDescription,
        sceneId: sceneId || undefined,
      }],
    }).returning({ id: visuals.id });

    // Create timeline item
    await db.insert(timelineItems).values({
      trackId: targetTrackId,
      type: 'visual',
      startMs,
      endMs: startMs + durationMs,
      data: {
        visualId: insertedVisual.id,
        compositionId,
        bundleUrl,
        type: `svg-${animationType}`,
        description: animationDescription,
        width,
        height,
        fps,
        sceneId: sceneId || undefined,
      },
    });

    await publishJobProgress(jobId, 95, 'Finalizing...');

    // Update job status
    await db.update(jobs)
      .set({
        status: 'complete',
        progress: 100,
        completedAt: new Date(),
        metrics: {
          durationMs: durationMs,
          filesWritten: 3,
          llmModel: 'gpt-4o',
        },
      })
      .where(eq(jobs.id, jobId));

    // Reset project status to ready
    await db.update(projects)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    // Cleanup temp image
    try {
      await rm(imagePath);
    } catch {
      // Ignore cleanup errors
    }

    logger.info({ projectId, jobId, compositionId }, 'SVG animation job complete');

  } catch (error) {
    logger.error({ projectId, jobId, err: error }, 'SVG animation job failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'failed' })
      .where(eq(projects.id, projectId));

    await publishJobError(jobId, errorMessage);

    throw error;
  }
}
