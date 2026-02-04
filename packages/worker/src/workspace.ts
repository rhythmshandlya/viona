/**
 * Workspace management for Claude Code visual generator.
 *
 * Each worker has a dedicated workspace with a pre-installed Remotion template.
 * This avoids copying node_modules for every job.
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, rmSync } from 'fs';
import { join, relative } from 'path';
import { execSync, spawn } from 'child_process';
import { config } from './config';

/**
 * Copy directory recursively, excluding node_modules.
 */
function copyDirSync(src: string, dest: string, exclude: string[] = ['node_modules']): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (exclude.includes(entry.name)) {
      continue;
    }

    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, exclude);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Initialize the worker workspace.
 *
 * 1. Create workspace directory if it doesn't exist
 * 2. Copy template files (excluding node_modules)
 * 3. Install dependencies if node_modules doesn't exist
 *
 * This should be called once on worker startup.
 */
export async function initializeWorkspace(): Promise<void> {
  const { workspacePath, templatePath, id } = config.worker;

  console.log(`[Workspace] Initializing workspace for worker: ${id}`);
  console.log(`[Workspace] Path: ${workspacePath}`);
  console.log(`[Workspace] Template: ${templatePath}`);

  // Ensure template exists
  if (!existsSync(templatePath)) {
    throw new Error(`Template not found at: ${templatePath}`);
  }

  // Create workspace if it doesn't exist
  if (!existsSync(workspacePath)) {
    console.log('[Workspace] Creating workspace directory...');
    mkdirSync(workspacePath, { recursive: true });
  }

  // Check if package.json exists in workspace
  const packageJsonPath = join(workspacePath, 'package.json');
  const nodeModulesPath = join(workspacePath, 'node_modules');

  if (!existsSync(packageJsonPath)) {
    console.log('[Workspace] Copying template files...');
    copyDirSync(templatePath, workspacePath);
  }

  // Install dependencies if node_modules doesn't exist
  if (!existsSync(nodeModulesPath)) {
    console.log('[Workspace] Installing dependencies (this may take a while)...');
    try {
      execSync('npm install', {
        cwd: workspacePath,
        stdio: 'inherit',
        timeout: 300000, // 5 minute timeout
      });
      console.log('[Workspace] Dependencies installed successfully');
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error}`);
    }
  } else {
    console.log('[Workspace] Dependencies already installed');
  }

  // Create src directory if it doesn't exist
  const srcPath = join(workspacePath, 'src');
  if (!existsSync(srcPath)) {
    mkdirSync(srcPath, { recursive: true });
  }

  console.log('[Workspace] Workspace initialized successfully');
}

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
 * Clean up a project directory after bundling.
 *
 * @param projectId - The project ID to clean up
 */
export function cleanupProject(projectId: string): void {
  const projectPath = join(config.worker.workspacePath, 'src', projectId);

  if (existsSync(projectPath)) {
    console.log(`[Workspace] Cleaning up project: ${projectId}`);
    rmSync(projectPath, { recursive: true, force: true });
  }
}

/**
 * Run TypeScript validation on the workspace.
 *
 * @returns Object with success status and any errors
 */
export async function runTypeScriptValidation(): Promise<{ success: boolean; errors: string[] }> {
  const workspacePath = config.worker.workspacePath;

  return new Promise((resolve) => {
    const tsc = spawn('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
      cwd: workspacePath,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    tsc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    tsc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    tsc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, errors: [] });
      } else {
        const output = stdout + stderr;
        const errors = output
          .split('\n')
          .filter((line) => line.includes('error TS'))
          .map((line) => line.trim());

        resolve({ success: false, errors });
      }
    });

    tsc.on('error', (error) => {
      resolve({ success: false, errors: [error.message] });
    });
  });
}

/**
 * Bundle the Remotion project.
 *
 * @param projectId - The project ID to bundle
 * @param outputDir - Output directory for the bundle
 * @returns Path to the bundled output
 */
export async function bundleProject(
  projectId: string,
  outputDir: string
): Promise<string> {
  const workspacePath = config.worker.workspacePath;
  const bundlePath = join(outputDir, projectId);

  console.log(`[Workspace] Bundling project: ${projectId}`);
  console.log(`[Workspace] Output: ${bundlePath}`);

  // Create output directory
  if (!existsSync(bundlePath)) {
    mkdirSync(bundlePath, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const bundle = spawn(
      'npx',
      ['remotion', 'bundle', '--out-dir', bundlePath],
      {
        cwd: workspacePath,
        shell: true,
      }
    );

    let stdout = '';
    let stderr = '';

    bundle.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`[Bundle] ${output.trim()}`);
    });

    bundle.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(`[Bundle] ${output.trim()}`);
    });

    bundle.on('close', (code) => {
      if (code === 0) {
        resolve(bundlePath);
      } else {
        reject(new Error(`Bundle failed with code ${code}: ${stderr}`));
      }
    });

    bundle.on('error', (error) => {
      reject(new Error(`Bundle process error: ${error.message}`));
    });
  });
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
