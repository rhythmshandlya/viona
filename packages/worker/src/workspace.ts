/**
 * Workspace management for the worker.
 * Provides workspace path helpers and worker ID.
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

/**
 * Create a project directory within the workspace.
 *
 * @param projectId - The project ID (e.g., "proj-abc123")
 * @returns Path to the project directory
 */
export function createProjectDir(projectId: string): string {
  const projectPath = join(config.worker.workspacePath, 'src', projectId);

  if (!existsSync(projectPath)) {
    mkdirSync(projectPath, { recursive: true });
  }

  return projectPath;
}

/**
 * Get the workspace path.
 */
export function getWorkspacePath(): string {
  return config.worker.workspacePath;
}

/**
 * Get the worker ID.
 */
export function getWorkerId(): string {
  return config.worker.id;
}
