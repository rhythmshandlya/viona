/**
 * Edit Visuals Processor
 *
 * Allows users to continue editing existing compositions by:
 * 1. Restoring source files from MinIO to workspace
 * 2. Running Claude with existing context + user's edit request
 * 3. Re-bundling the updated composition
 * 4. Uploading the new bundle and sources back to MinIO
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { readFile, readdir, copyFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { db, projects, jobs, visuals } from '../../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError, setJobProjectId } from '../../services/redis.js';
import { downloadSourceFromStorage, uploadFile } from '../../services/minio.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { getWorkspacePath, createProjectDir } from '../../workspace.js';
import { extractAssets, injectUserAssets } from './context.js';
import { runClaudeEditor } from './editor.js';
import { compileCjs, autoFixProjectFiles, uploadBundleToStorage, uploadSourceToStorage } from './build.js';
import type { EditVisualsJobData } from './types.js';

export type { EditVisualsJobData } from './types.js';

export async function processEditVisualsJob(job: Job<EditVisualsJobData>) {
  const { projectId, jobId, compositionId, prompt, sceneId, elementName, transcript, scenePlan } = job.data;
  setJobProjectId(jobId, projectId);

  // Convert compositionId format: proj-xxx-xxx -> proj_xxx_xxx for workspace
  const workspaceCompositionId = compositionId.replace(/-/g, '_');

  const lockExtender = setInterval(async () => {
    try {
      await job.extendLock(job.token!, 120_000);
    } catch (err) {
      logger.error({ jobId, err }, 'Lock extension failed');
    }
  }, 55_000);

  try {
    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading project...');

    // Load project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Extract canvas dimensions from project settings
    const videoSettings = (project.videoSettings || {}) as Record<string, unknown>;
    const canvasWidth = (videoSettings.canvasWidth as number) ?? 1080;
    const canvasHeight = (videoSettings.canvasHeight as number) ?? 1920;

    // Load existing visual
    const visual = await db.query.visuals.findFirst({
      where: eq(visuals.projectId, projectId),
    });

    if (!visual) {
      throw new Error('No existing visuals found');
    }

    // Create project directory in workspace
    const workspacePath = getWorkspacePath();
    const projectDir = createProjectDir(workspaceCompositionId);

    // Check if source files already exist in workspace (skip download if present)
    const indexPath = join(projectDir, 'index.tsx');
    const scenesPath = join(projectDir, 'scenes.json');
    let downloadedFiles: string[] = [];

    if (existsSync(indexPath) && existsSync(scenesPath)) {
      // Files already exist - just list them instead of downloading
      logger.info({ projectId, compositionId }, 'Source files already in workspace, skipping download');
      // Skip past the restore phase (20+) so frontend shows "AI analyzing" immediately
      await publishJobProgress(jobId, 20, 'Source files ready, analyzing...');

      // List existing files in projectDir
      const listFilesRecursive = async (dir: string, base: string = ''): Promise<string[]> => {
        const entries = await readdir(dir, { withFileTypes: true });
        const files: string[] = [];
        for (const entry of entries) {
          const relativePath = base ? `${base}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            files.push(...await listFilesRecursive(join(dir, entry.name), relativePath));
          } else {
            files.push(relativePath);
          }
        }
        return files;
      };
      downloadedFiles = await listFilesRecursive(projectDir);
    } else {
      // Download source files from MinIO to workspace
      await publishJobProgress(jobId, 10, 'Restoring source files from storage...');
      // Sources are stored with dashes (proj-xxx-xxx), ensure we use that format
      const sourceCompositionId = compositionId.replace(/_/g, '-');
      downloadedFiles = await downloadSourceFromStorage(sourceCompositionId, projectDir);
      logger.info({ projectId, compositionId, fileCount: downloadedFiles.length }, 'Source files restored');
    }

    // Inject user-uploaded assets (logos, icons, brand images)
    await injectUserAssets(projectId, projectDir);

    await publishJobProgress(jobId, 22, 'AI is editing your visuals...');

    // Run Claude to edit the composition
    const editResult = await runClaudeEditor({
      projectId: workspaceCompositionId,
      jobId,
      projectDir,
      prompt,
      existingFiles: downloadedFiles,
      targetSceneId: sceneId,
      targetElementName: elementName,
      transcript,
      scenePlan,
      canvasWidth,
      canvasHeight,
    });

    await publishJobProgress(jobId, 85, 'Validating changes...');

    await publishJobProgress(jobId, 86, 'Reading updated metadata...');

    // Read updated metadata
    const metadataPath = join(projectDir, 'metadata.json');
    let metadata;
    try {
      const metadataContent = await readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);
    } catch {
      // Use existing metadata if not updated
      metadata = {
        compositionId: workspaceCompositionId,
        durationInFrames: visual.durationFrames,
        fps: visual.fps,
        width: visual.width,
        height: visual.height,
      };
    }

    // Auto-fix common issues in edited source files (descending interpolate ranges, etc.)
    await publishJobProgress(jobId, 87, 'Auto-fixing common issues...');
    await autoFixProjectFiles(projectDir);

    await publishJobProgress(jobId, 88, 'Verifying bundle...');

    // Verify bundle exists
    const bundleDir = join(config.remotion.bundleOutputDir, compositionId);
    const bundleIndex = join(bundleDir, 'index.html');

    try {
      await readFile(bundleIndex);
      logger.info({ projectId, bundleDir }, 'Bundle verified');
    } catch {
      throw new Error(`Bundle not found at ${bundleDir}. Editor may have failed to create it.`);
    }

    // Compile composition to CJS for dynamic frontend loading
    await publishJobProgress(jobId, 89, 'Compiling for preview...');
    await compileCjs(projectDir, bundleDir);

    // Ensure user assets are in the bundle (Remotion bundle may not always copy them)
    const userAssetsSource = join(getWorkspacePath(), 'public', 'assets', 'user');
    if (existsSync(userAssetsSource)) {
      const userAssetsDest = join(bundleDir, 'public', 'assets', 'user');
      await mkdir(userAssetsDest, { recursive: true });
      const userFiles = await readdir(userAssetsSource);
      for (const f of userFiles) {
        await copyFile(join(userAssetsSource, f), join(userAssetsDest, f));
      }
      if (userFiles.length > 0) {
        logger.info({ count: userFiles.length }, 'Copied user assets into bundle');
      }
    }

    // Upload updated bundle to S3
    await publishJobProgress(jobId, 91, 'Uploading updated bundle...');
    await uploadBundleToStorage(bundleDir, compositionId);

    // Upload updated source files to S3
    await publishJobProgress(jobId, 93, 'Uploading updated sources...');
    const sourceUrl = await uploadSourceToStorage(projectDir, compositionId);

    // Extract and upload assets
    await publishJobProgress(jobId, 95, 'Extracting assets...');
    const extractedAssets = await extractAssets(projectDir);
    try {
      const assetsPath = join(projectDir, 'assets.json');
      await uploadFile('outputs', `sources/${compositionId}/assets.json`, assetsPath);
      logger.info({ projectId, assetCount: extractedAssets.length }, 'Assets uploaded');
    } catch (err) {
      logger.warn({ projectId, error: err }, 'Failed to upload assets.json');
    }

    await publishJobProgress(jobId, 97, 'Updating database...');

    // Try to read scenes.json for detailed scene information (scenesPath already defined above)
    let timestamps: any[] | undefined;
    try {
      const scenesContent = await readFile(scenesPath, 'utf-8');
      const scenesData = JSON.parse(scenesContent);

      if (scenesData.scenes && Array.isArray(scenesData.scenes) && scenesData.scenes.length > 0) {
        // Convert scenes.json format to timestamps format for the database
        const sceneTimestamps = scenesData.scenes.map((scene: any) => {
          // Extract elements from layout if present
          const elements: Array<{
            id: string;
            name: string;
            type: string;
            x: string;
            y: string;
            width: string;
            height: string;
          }> = [];

          if (scene.layout && typeof scene.layout === 'object') {
            Object.entries(scene.layout).forEach(([key, value]: [string, any]) => {
              if (value && typeof value === 'object') {
                elements.push({
                  id: `scene${scene.id}-${key}`,
                  name: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize
                  type: key,
                  x: value.x || 'center',
                  y: value.y || '50%',
                  width: value.width || '100%',
                  height: value.height || '100%',
                });
              }
            });
          }

          return {
            startMs: Math.round(scene.timestampRange[0] * 1000),
            endMs: Math.round(scene.timestampRange[1] * 1000),
            type: scene.name || `Scene ${scene.id}`,
            description: scene.visual || scene.emotion || '',
            elements: elements.length > 0 ? elements : undefined,
          };
        });
        timestamps = sceneTimestamps;
        logger.info({ projectId, sceneCount: sceneTimestamps.length }, 'Loaded scenes from scenes.json');
      }
    } catch (scenesErr) {
      logger.warn({ projectId, error: scenesErr }, 'Could not read scenes.json, timestamps unchanged');
    }

    // Update visuals record
    await db.update(visuals)
      .set({
        durationFrames: metadata.durationInFrames || visual.durationFrames,
        fps: metadata.fps || visual.fps,
        width: metadata.width || visual.width,
        height: metadata.height || visual.height,
        sourceUrl,
        ...(timestamps && { timestamps }),
      })
      .where(eq(visuals.id, visual.id));

    // Update job and project status
    await db.update(jobs)
      .set({
        status: 'complete',
        progress: 100,
        completedAt: new Date(),
        metrics: {
          durationMs: editResult.durationMs,
          filesWritten: editResult.filesEdited,
        },
      })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'ready', outputKey: null, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId, compositionId, prompt: prompt.slice(0, 50) }, 'Edit visuals complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Edit visuals failed');

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
    clearInterval(lockExtender);
  }
}
