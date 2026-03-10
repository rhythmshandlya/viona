// packages/worker/src/monitor/checkpoint.ts

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import type { CheckpointState, AnimatePhaseCheckpoint } from '@viona/shared';
import { createEmptyCheckpoint } from '@viona/shared';

const CHECKPOINT_FILENAME = '.checkpoint.json';

export async function readCheckpoint(workDir: string, jobId: string): Promise<CheckpointState> {
  const filePath = join(workDir, CHECKPOINT_FILENAME);
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as CheckpointState;
  } catch {
    return createEmptyCheckpoint(jobId);
  }
}

export async function writeCheckpoint(workDir: string, checkpoint: CheckpointState): Promise<void> {
  const filePath = join(workDir, CHECKPOINT_FILENAME);
  checkpoint.updatedAt = Date.now();
  await writeFile(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

export async function scanCheckpointFromDisk(
  workDir: string,
  jobId: string,
): Promise<CheckpointState> {
  const cp = createEmptyCheckpoint(jobId);

  const exists = async (name: string) => {
    try { await stat(join(workDir, name)); return true; } catch { return false; }
  };

  // Plan phase
  const hasScenePlan = await exists('SCENE_PLAN.md');
  const hasScenesJson = await exists('scenes.json');
  if (hasScenePlan) cp.phases.plan.artifacts.push('SCENE_PLAN.md');
  if (hasScenesJson) cp.phases.plan.artifacts.push('scenes.json');
  if (hasScenePlan && hasScenesJson) {
    cp.phases.plan.status = 'complete';
    cp.phases.plan.completedAt = Date.now();
  } else if (hasScenePlan) {
    cp.phases.plan.status = 'running';
  }

  // Animate phase
  const hasConstants = await exists('constants.ts');
  if (hasConstants) cp.phases.animate.artifacts.push('constants.ts');

  // Count completed scenes
  const scenesDir = join(workDir, 'scenes');
  try {
    const sceneFiles = await readdir(scenesDir);
    const sceneNums = sceneFiles
      .filter((f) => /^Scene\d+\.tsx$/.test(f))
      .map((f) => parseInt(f.match(/Scene(\d+)/)?.[1] ?? '0', 10))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    cp.phases.animate.scenesComplete = sceneNums;
    for (const n of sceneNums) {
      cp.phases.animate.artifacts.push(`scenes/Scene${n}.tsx`);
    }

    if (hasScenesJson) {
      try {
        const raw = await readFile(join(workDir, 'scenes.json'), 'utf-8');
        const data = JSON.parse(raw);
        cp.phases.animate.scenesTotal = data.scenes?.length ?? 0;
      } catch { /* malformed scenes.json */ }
    }

    if (cp.phases.animate.scenesTotal > 0 &&
        sceneNums.length >= cp.phases.animate.scenesTotal) {
      cp.phases.animate.status = 'complete';
      cp.phases.animate.completedAt = Date.now();
    } else if (sceneNums.length > 0 || hasConstants) {
      cp.phases.animate.status = 'running';
    }
  } catch {
    // scenes/ directory doesn't exist yet
  }

  // Verify phase
  const hasIndex = await exists('index.tsx');
  if (hasIndex) {
    cp.phases.verify.artifacts.push('index.tsx');
    cp.phases.verify.status = 'running';
  }

  // Bundle phase
  const hasMetadata = await exists('metadata.json');
  if (hasMetadata) {
    cp.phases.bundle.artifacts.push('metadata.json');
    cp.phases.bundle.status = 'running';
  }

  cp.updatedAt = Date.now();
  return cp;
}
