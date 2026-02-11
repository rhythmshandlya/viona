/**
 * Preload Project Processor
 *
 * Warms up the workspace by downloading source files when the editor opens.
 * This ensures AI edits are fast since files are already cached locally.
 */

import { Job } from 'bullmq';
import { existsSync } from 'fs';
import { join } from 'path';
import { downloadSourceFromStorage } from '../services/minio.js';
import { logger } from '../logger.js';
import { getWorkspacePath, createProjectDir } from '../workspace.js';

export interface PreloadProjectJobData {
  projectId: string;
  compositionId: string;
}

export async function processPreloadProjectJob(job: Job<PreloadProjectJobData>) {
  const { projectId, compositionId } = job.data;

  // Convert compositionId format: proj-xxx-xxx -> proj_xxx_xxx for workspace
  const workspaceCompositionId = compositionId.replace(/-/g, '_');
  const projectDir = join(getWorkspacePath(), 'src', workspaceCompositionId);

  // Check if already cached
  const indexPath = join(projectDir, 'index.tsx');
  const scenesPath = join(projectDir, 'scenes.json');

  if (existsSync(indexPath) && existsSync(scenesPath)) {
    logger.info({ projectId, compositionId }, 'Project already cached in workspace');
    return { cached: true, fileCount: 0 };
  }

  try {
    // Create project directory and download files
    createProjectDir(workspaceCompositionId);

    // Sources are stored with dashes (proj-xxx-xxx)
    const sourceCompositionId = compositionId.replace(/_/g, '-');
    const downloadedFiles = await downloadSourceFromStorage(sourceCompositionId, projectDir);

    logger.info({ projectId, compositionId, fileCount: downloadedFiles.length }, 'Project preloaded to workspace');
    return { cached: false, fileCount: downloadedFiles.length };
  } catch (error) {
    // Preload failures are non-critical - edit will download if needed
    logger.warn({ projectId, compositionId, error }, 'Preload failed, will download on first edit');
    return { cached: false, fileCount: 0, error: String(error) };
  }
}
