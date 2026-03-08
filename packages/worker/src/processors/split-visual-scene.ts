/**
 * Split Visual Scene Processor
 *
 * When a user cuts a visual timeline item, this processor:
 * 1. Downloads existing composition source files
 * 2. Calculates frame ranges for each half
 * 3. Runs Claude editor to create two new scene files
 * 4. Updates index.tsx and scenes.json
 * 5. Re-bundles and uploads
 * 6. Updates DB: timeline items + visuals.timestamps
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { db, projects, jobs, visuals, timelineItems } from '../db/index.js';
import {
  publishJobProgress,
  publishJobComplete,
  publishJobError,
  setJobProjectId,
} from '../services/redis.js';
import { downloadSourceFromStorage } from '../services/minio.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { createProjectDir } from '../workspace.js';
import {
  uploadBundleToStorage,
  uploadSourceToStorage,
  compileCjs,
  autoFixProjectFiles,
  injectUserAssets,
  runClaudeEditor,
} from './edit-visuals.js';

export interface SplitVisualSceneJobData {
  projectId: string;
  jobId: string;
  compositionId: string;
  sourceSceneId: number;
  splitAtMs: number;
  leftItemId: string;
  rightItemId: string;
  transcript?: string;
}

export async function processSplitVisualSceneJob(job: Job<SplitVisualSceneJobData>) {
  const {
    projectId, jobId, compositionId, sourceSceneId,
    splitAtMs, leftItemId, rightItemId, transcript,
  } = job.data;

  setJobProjectId(jobId, projectId);

  // compositionId comes in with hyphens (proj-abc-def), workspace uses underscores
  const workspaceCompositionId = compositionId.replace(/-/g, '_');

  const lockExtender = setInterval(async () => {
    try { await job.extendLock(job.token!, 120_000); } catch { /* ignore */ }
  }, 55_000);

  try {
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading project...');

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) throw new Error('Project not found');

    const visual = await db.query.visuals.findFirst({ where: eq(visuals.projectId, projectId) });
    if (!visual) throw new Error('No visuals found');

    // Fetch left and right timeline items
    const leftItem = await db.query.timelineItems.findFirst({
      where: eq(timelineItems.id, leftItemId),
    });
    const rightItem = await db.query.timelineItems.findFirst({
      where: eq(timelineItems.id, rightItemId),
    });
    if (!leftItem || !rightItem) throw new Error('Split timeline items not found in DB');

    // Set up workspace
    const projectDir = createProjectDir(workspaceCompositionId);
    const indexPath = join(projectDir, 'index.tsx');
    const scenesJsonPath = join(projectDir, 'scenes.json');

    await publishJobProgress(jobId, 10, 'Restoring source files...');

    // Download sources if not already in workspace
    let existingFiles: string[];
    if (existsSync(indexPath) && existsSync(scenesJsonPath)) {
      await publishJobProgress(jobId, 20, 'Source files already in workspace');
      existingFiles = await listFilesRecursive(projectDir);
    } else {
      const sourceCompositionId = compositionId.replace(/_/g, '-');
      existingFiles = await downloadSourceFromStorage(sourceCompositionId, projectDir);
    }

    await injectUserAssets(projectId, projectDir);

    // Read scenes.json to find the target scene and determine new IDs
    await publishJobProgress(jobId, 25, 'Analyzing scene structure...');

    const scenesContent = await readFile(scenesJsonPath, 'utf-8');
    const scenesData = JSON.parse(scenesContent);
    const scenes: Array<{ id: number; timestampRange: [number, number]; name?: string; visual?: string }> =
      scenesData.scenes || [];

    const targetScene = scenes.find((s) => s.id === sourceSceneId);
    if (!targetScene) {
      throw new Error(`Scene ${sourceSceneId} not found in scenes.json`);
    }

    // Assign new sequential scene IDs
    const maxExistingId = Math.max(...scenes.map((s) => s.id));
    const leftSceneId = maxExistingId + 1;
    const rightSceneId = maxExistingId + 2;

    // Calculate frame info
    const fps = visual.fps || 30;
    const sceneStartMs = targetScene.timestampRange[0] * 1000;
    const sceneEndMs = targetScene.timestampRange[1] * 1000;
    const sceneStartSec = targetScene.timestampRange[0];
    const sceneEndSec = targetScene.timestampRange[1];
    const splitSec = splitAtMs / 1000;

    const totalSceneDurationMs = sceneEndMs - sceneStartMs;
    const splitOffsetMs = splitAtMs - sceneStartMs;
    const leftDurationFrames = Math.round((splitOffsetMs / 1000) * fps);
    const rightDurationFrames = Math.round(((totalSceneDurationMs - splitOffsetMs) / 1000) * fps);
    const totalSceneFrames = Math.round((totalSceneDurationMs / 1000) * fps);

    logger.info({
      projectId, sourceSceneId, leftSceneId, rightSceneId,
      leftDurationFrames, rightDurationFrames, totalSceneFrames,
    }, 'Splitting scene');

    // Build the Claude editor prompt
    const prompt = buildSplitPrompt({
      sourceSceneId, leftSceneId, rightSceneId,
      sceneStartSec, sceneEndSec, splitSec,
      totalSceneFrames, leftDurationFrames, rightDurationFrames,
      fps, targetScene,
    });

    await publishJobProgress(jobId, 30, 'AI splitting scene...');

    const editResult = await runClaudeEditor({
      projectId: workspaceCompositionId,
      jobId,
      projectDir,
      prompt,
      existingFiles,
      transcript,
    });

    await publishJobProgress(jobId, 70, 'Auto-fixing generated scenes...');
    await autoFixProjectFiles(projectDir);

    // Verify bundle exists (runClaudeEditor instructs Claude to bundle)
    await publishJobProgress(jobId, 75, 'Verifying bundle...');
    const bundleDir = join(config.remotion.bundleOutputDir, compositionId);
    const bundleIndex = join(bundleDir, 'index.html');

    try {
      await readFile(bundleIndex);
    } catch {
      throw new Error(`Bundle not found at ${bundleDir}. The Claude editor may not have triggered bundling.`);
    }

    await publishJobProgress(jobId, 82, 'Compiling for preview...');
    await compileCjs(projectDir, bundleDir);

    await publishJobProgress(jobId, 85, 'Uploading bundle...');
    await uploadBundleToStorage(bundleDir, compositionId);

    await publishJobProgress(jobId, 90, 'Uploading sources...');
    const sourceUrl = await uploadSourceToStorage(projectDir, compositionId);

    await publishJobProgress(jobId, 93, 'Updating database...');

    // Read updated scenes.json for new timing info
    const updatedScenesContent = await readFile(scenesJsonPath, 'utf-8');
    const updatedScenesData = JSON.parse(updatedScenesContent);
    const updatedScenes: Array<{ id: number; timestampRange: [number, number]; name?: string; visual?: string }> =
      updatedScenesData.scenes || [];

    // Build new timestamps array replacing sourceSceneId with leftSceneId + rightSceneId
    const currentTimestamps = (visual.timestamps || []) as Array<{
      startMs: number; endMs: number; type: string; description?: string; sourceSceneId?: number;
    }>;

    const newTimestamps = currentTimestamps.flatMap((ts) => {
      if (ts.sourceSceneId === sourceSceneId) {
        const leftScene = updatedScenes.find((s) => s.id === leftSceneId);
        const rightScene = updatedScenes.find((s) => s.id === rightSceneId);
        return [
          {
            startMs: leftScene ? Math.round(leftScene.timestampRange[0] * 1000) : Math.round(sceneStartMs),
            endMs: leftScene ? Math.round(leftScene.timestampRange[1] * 1000) : Math.round(splitAtMs),
            type: ts.type,
            description: leftScene?.visual || ts.description || '',
            sourceSceneId: leftSceneId,
          },
          {
            startMs: rightScene ? Math.round(rightScene.timestampRange[0] * 1000) : Math.round(splitAtMs),
            endMs: rightScene ? Math.round(rightScene.timestampRange[1] * 1000) : Math.round(sceneEndMs),
            type: ts.type,
            description: rightScene?.visual || ts.description || '',
            sourceSceneId: rightSceneId,
          },
        ];
      }
      return [ts];
    });

    // Update visuals record
    await db.update(visuals)
      .set({ sourceUrl, timestamps: newTimestamps })
      .where(eq(visuals.id, visual.id));

    // Update left timeline item's sourceSceneId
    const leftData = { ...(leftItem.data as Record<string, unknown>), sourceSceneId: leftSceneId };
    await db.update(timelineItems)
      .set({ data: leftData })
      .where(eq(timelineItems.id, leftItemId));

    // Update right timeline item's sourceSceneId
    const rightData = { ...(rightItem.data as Record<string, unknown>), sourceSceneId: rightSceneId };
    await db.update(timelineItems)
      .set({ data: rightData })
      .where(eq(timelineItems.id, rightItemId));

    // Mark job complete
    await db.update(jobs)
      .set({
        status: 'complete',
        progress: 100,
        completedAt: new Date(),
        metrics: { durationMs: editResult.durationMs, filesWritten: editResult.filesEdited },
      })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'ready', outputKey: null, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId, compositionId, leftSceneId, rightSceneId }, 'Scene split complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Scene split failed');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'ready' })
      .where(eq(projects.id, projectId));

    await publishJobError(jobId, errorMessage);
    throw error;
  } finally {
    clearInterval(lockExtender);
  }
}

/** Recursively list all files in a directory */
async function listFilesRecursive(dir: string, base = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(join(dir, entry.name), rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

/** Build the Claude editor prompt for splitting a scene */
export function buildSplitPrompt(opts: {
  sourceSceneId: number;
  leftSceneId: number;
  rightSceneId: number;
  sceneStartSec: number;
  sceneEndSec: number;
  splitSec: number;
  totalSceneFrames: number;
  leftDurationFrames: number;
  rightDurationFrames: number;
  fps: number;
  targetScene: { visual?: string };
}): string {
  const {
    sourceSceneId, leftSceneId, rightSceneId,
    sceneStartSec, sceneEndSec, splitSec,
    totalSceneFrames, leftDurationFrames, rightDurationFrames,
    fps, targetScene,
  } = opts;

  return `Split scene_${sourceSceneId} into two independent halves.

Original scene covers: ${sceneStartSec.toFixed(3)}s to ${sceneEndSec.toFixed(3)}s (${totalSceneFrames} frames at ${fps}fps)
Split point: ${splitSec.toFixed(3)}s from video start (${leftDurationFrames} frames from scene start)

STEP 1 — Read the current scenes/scene_${sourceSceneId}.tsx to understand the visual content.

STEP 2 — Create scenes/scene_${leftSceneId}.tsx (LEFT HALF):
- Copy scenes/scene_${sourceSceneId}.tsx as the starting point
- Rename the component export to Scene${leftSceneId}
- This component plays for exactly ${leftDurationFrames} frames total
- Scale all interpolation inputRanges that referenced [0, ${totalSceneFrames}] to [0, ${leftDurationFrames}]
- Keep the visual look representing the first half of the original content

STEP 3 — Create scenes/scene_${rightSceneId}.tsx (RIGHT HALF):
- Copy scenes/scene_${sourceSceneId}.tsx as the starting point
- Rename the component export to Scene${rightSceneId}
- This component plays for exactly ${rightDurationFrames} frames total
- Scale all interpolation inputRanges that referenced [0, ${totalSceneFrames}] to [0, ${rightDurationFrames}]
- Keep the visual look representing the second half of the original content

STEP 4 — Update index.tsx:
- Read current index.tsx
- Add imports for Scene${leftSceneId} and Scene${rightSceneId} from their respective files
- Remove the import for scene_${sourceSceneId}
- Find the <Sequence> block that contains scene_${sourceSceneId} and replace it with TWO consecutive Sequence blocks:
  <Sequence from={ORIGINAL_FROM} durationInFrames={${leftDurationFrames}} name="scene_${leftSceneId}">
    <Scene${leftSceneId} />
  </Sequence>
  <Sequence from={ORIGINAL_FROM + ${leftDurationFrames}} durationInFrames={${rightDurationFrames}} name="scene_${rightSceneId}">
    <Scene${rightSceneId} />
  </Sequence>
  (where ORIGINAL_FROM is whatever the original from= value was)

STEP 5 — Update scenes.json:
- Read current scenes.json
- Replace the entry with id: ${sourceSceneId} with TWO entries:
  { "id": ${leftSceneId}, "timestampRange": [${sceneStartSec.toFixed(3)}, ${splitSec.toFixed(3)}], "name": "Scene ${leftSceneId}", "visual": "${(targetScene.visual || 'Left half of scene ' + sourceSceneId).replace(/"/g, '\\"')}" }
  { "id": ${rightSceneId}, "timestampRange": [${splitSec.toFixed(3)}, ${sceneEndSec.toFixed(3)}], "name": "Scene ${rightSceneId}", "visual": "${(targetScene.visual || 'Right half of scene ' + sourceSceneId).replace(/"/g, '\\"')}" }
- Keep all other scene entries unchanged

Do NOT modify SCENE_PLAN.md, constants.ts, or any other scene files.`;
}
