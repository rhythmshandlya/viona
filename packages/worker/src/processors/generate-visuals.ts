/**
 * Visual Generation Processor
 *
 * Uses Claude Code (Agent SDK) with OAuth authentication from Claude Pro/Max subscription.
 * No API key costs - included in subscription.
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, writeFile, readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { db, projects, tracks, timelineItems, transcripts, jobs, visuals } from '../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError, registerCancelHandler, unregisterCancelHandler } from '../services/redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getWorkspacePath, createProjectDir } from '../workspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Track running processes for cancellation
const runningProcesses = new Map<string, ChildProcess>();

// Environment validation results (cached after first check)
let environmentValidated = false;
let environmentError: string | null = null;

/**
 * Validate that Python and Claude Agent SDK are available.
 * Call this at worker startup to fail fast if dependencies are missing.
 */
export async function validateEnvironment(): Promise<{ valid: boolean; error?: string }> {
  if (environmentValidated) {
    return environmentError ? { valid: false, error: environmentError } : { valid: true };
  }

  try {
    // Check Python is available
    const pythonPath = config.pythonPath;
    const pythonCheck = spawn(pythonPath, ['--version'], { stdio: 'pipe' });
    const pythonResult = await new Promise<{ code: number | null; output: string }>((resolve) => {
      let output = '';
      pythonCheck.stdout?.on('data', (data) => { output += data.toString(); });
      pythonCheck.stderr?.on('data', (data) => { output += data.toString(); });
      pythonCheck.on('close', (code) => resolve({ code, output }));
      pythonCheck.on('error', () => resolve({ code: -1, output: 'Python not found' }));
    });

    if (pythonResult.code !== 0) {
      environmentError = `Python not available: ${pythonResult.output}`;
      environmentValidated = true;
      return { valid: false, error: environmentError };
    }

    logger.info({ pythonVersion: pythonResult.output.trim() }, 'Python version detected');

    // Check Claude Code CLI is available
    const claudeCheck = spawn('claude', ['--version'], { stdio: 'pipe', shell: true });
    const claudeResult = await new Promise<{ code: number | null; output: string }>((resolve) => {
      let output = '';
      claudeCheck.stdout?.on('data', (data) => { output += data.toString(); });
      claudeCheck.stderr?.on('data', (data) => { output += data.toString(); });
      claudeCheck.on('close', (code) => resolve({ code, output }));
      claudeCheck.on('error', () => resolve({ code: -1, output: 'Claude Code CLI not found' }));
    });

    if (claudeResult.code !== 0) {
      environmentError = `Claude Code CLI not available. Install from: https://github.com/anthropics/claude-code\nError: ${claudeResult.output}`;
      environmentValidated = true;
      return { valid: false, error: environmentError };
    }

    logger.info({ claudeVersion: claudeResult.output.trim() }, 'Claude Code CLI detected');

    environmentValidated = true;
    return { valid: true };

  } catch (error) {
    environmentError = `Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    environmentValidated = true;
    return { valid: false, error: environmentError };
  }
}

export function cancelJob(jobId: string): boolean {
  const process = runningProcesses.get(jobId);
  if (process) {
    logger.info({ jobId }, 'Cancelling Claude Code generator');
    process.kill('SIGTERM');
    runningProcesses.delete(jobId);
    return true;
  }
  return false;
}

export function getRunningJobs(): string[] {
  return Array.from(runningProcesses.keys());
}

export type VisualsLayoutMode = 'pip' | 'split-horizontal' | 'split-vertical';

export interface VisualsDimensions {
  width: number;
  height: number;
}

export interface GenerateVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic';
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
  /** Enable verbose logging for debugging */
  verbose?: boolean;
}

interface VisualMetadata {
  compositionId: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  visuals: Array<{
    startMs: number;
    endMs: number;
    type: string;
    description: string;
  }>;
}

interface JobMetrics {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  llmModel: string;
  filesWritten: number;
  screenshotsTaken: number;
  finalScore?: number;
  totalIterations?: number;
  status?: string;
}

interface ClaudeCodeResult {
  bundleUrl: string;
  bundlePath: string;
  filesWritten: number;
  durationMs: number;
  status: string;
}

export async function processGenerateVisualsJob(job: Job<GenerateVisualsJobData>) {
  const { projectId, jobId, stylePreset, layoutMode, dimensions } = job.data;
  const compositionId = `proj_${projectId.replace(/-/g, '_')}`;

  try {
    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading project...');

    // Load project and transcript
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.projectId, projectId),
    });

    if (!transcript || !transcript.words) {
      throw new Error('Project has no transcript');
    }

    await publishJobProgress(jobId, 10, 'Preparing workspace...');

    // Clean up old composition directories in workspace
    const workspacePath = getWorkspacePath();
    const srcDir = join(workspacePath, 'src');
    try {
      const entries = await readdir(srcDir);
      for (const entry of entries) {
        if (entry.startsWith('proj_') && entry !== compositionId) {
          const oldDir = join(srcDir, entry);
          logger.info({ oldDir, compositionId }, 'Removing stale composition directory');
          await rm(oldDir, { recursive: true, force: true });
        }
      }
    } catch (e) {
      logger.debug({ srcDir, error: e }, 'Could not clean old compositions (may not exist yet)');
    }

    // Create project directory in workspace
    const projectDir = createProjectDir(compositionId);
    logger.info({ projectDir, compositionId }, 'Created project directory');

    await publishJobProgress(jobId, 15, 'Starting Claude Code generator...');

    // Calculate duration in frames
    const durationFrames = Math.ceil(((project.durationMs || 60000) / 1000) * (project.fps || 30));

    // Prepare transcript text
    const transcriptText = (transcript.words as any[])
      .map((w: any) => w.word || w.text || '')
      .join(' ');

    // Run Claude Code generator
    const llmModel = config.claudeCode.model;
    const claudeResult = await runClaudeCodeGenerator({
      projectId: compositionId,
      jobId,
      transcript: transcriptText,
      durationFrames,
      fps: project.fps || 30,
      width: dimensions?.width || 1080,
      height: dimensions?.height || 1920,
      stylePreset: stylePreset || 'modern',
    });

    // Store metrics in job (no token cost for OAuth)
    const jobMetrics: JobMetrics = {
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      durationMs: claudeResult.durationMs,
      llmModel,
      filesWritten: claudeResult.filesWritten,
      screenshotsTaken: 0,
      finalScore: 100,
      totalIterations: 1,
      status: claudeResult.status,
    };

    await db.update(jobs)
      .set({ metrics: jobMetrics, logs: [`Claude Code generator completed in ${claudeResult.durationMs}ms`] })
      .where(eq(jobs.id, jobId));

    logger.info({ projectId, jobMetrics }, 'Job metrics recorded');

    await publishJobProgress(jobId, 70, 'Reading metadata...');

    // Read metadata file that the agent should have created
    const metadataPath = join(projectDir, 'metadata.json');
    let metadata: VisualMetadata;

    try {
      const metadataContent = await readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);

      if (!metadata.compositionId || typeof metadata.durationInFrames !== 'number') {
        throw new Error('Invalid metadata.json: missing required fields');
      }

      if (!metadata.visuals || !Array.isArray(metadata.visuals)) {
        throw new Error('Invalid metadata.json: visuals must be an array');
      }

      if (metadata.visuals.length === 0) {
        throw new Error('Agent completed but generated no visuals.');
      }

      logger.info({ projectId, visualCount: metadata.visuals.length }, 'Metadata validated successfully');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error reading metadata';

      // Check if the index.tsx file was at least created
      const indexPath = join(projectDir, 'index.tsx');
      let indexExists = false;
      try {
        await readFile(indexPath, 'utf-8');
        indexExists = true;
      } catch {
        // Index doesn't exist
      }

      if (!indexExists) {
        throw new Error(`Agent failed to generate any code. ${errorMsg}`);
      }

      // Create minimal fallback metadata
      logger.warn({ projectId, error: errorMsg }, 'Metadata missing, using fallback');
      metadata = {
        compositionId,
        durationInFrames: durationFrames,
        fps: project.fps || 30,
        width: dimensions?.width || 1920,
        height: dimensions?.height || 1080,
        visuals: [{
          startMs: 0,
          endMs: project.durationMs || 60000,
          type: 'generated',
          description: 'AI-generated visual',
        }],
      };
    }

    await publishJobProgress(jobId, 80, 'Verifying bundle...');

    // Verify bundle exists
    const bundleCompositionId = compositionId.replace(/_/g, '-');
    const bundleDir = join(config.remotion.bundleOutputDir, bundleCompositionId);
    const bundleIndex = join(bundleDir, 'index.html');

    try {
      await readFile(bundleIndex);
      logger.info({ projectId, bundleDir }, 'Bundle verified');
    } catch (err) {
      throw new Error(`Bundle not found at ${bundleDir}. Generator may have failed to create it.`);
    }

    const bundleUrl = `/bundles/${bundleCompositionId}/index.html`;

    await publishJobProgress(jobId, 85, 'Registering visual...');

    // Clean up old visuals for this project
    const existingVisuals = await db.select().from(visuals).where(eq(visuals.projectId, projectId));
    if (existingVisuals.length > 0) {
      logger.info({ projectId, count: existingVisuals.length }, 'Cleaning up existing visuals');

      for (const oldVisual of existingVisuals) {
        const allItems = await db.select().from(timelineItems);
        for (const item of allItems) {
          if (item.type === 'visual' && (item.data as any)?.visualId === oldVisual.id) {
            await db.delete(timelineItems).where(eq(timelineItems.id, item.id));
          }
        }

        if (oldVisual.compositionId) {
          const oldBundleDir = join(config.remotion.bundleOutputDir, oldVisual.compositionId);
          try {
            await rm(oldBundleDir, { recursive: true, force: true });
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      await db.delete(visuals).where(eq(visuals.projectId, projectId));
    }

    // Insert into visuals table
    const [insertedVisual] = await db.insert(visuals).values({
      projectId,
      compositionId: metadata.compositionId,
      bundleUrl,
      durationFrames: metadata.durationInFrames,
      fps: metadata.fps,
      width: metadata.width,
      height: metadata.height,
      stylePreset,
      llmModel,
      timestamps: metadata.visuals,
    }).returning({ id: visuals.id });
    const visualId = insertedVisual.id;

    await publishJobProgress(jobId, 90, 'Creating timeline items...');

    // Find or create visuals track
    const existingTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));
    let visualsTrack = existingTracks.find(t => t.type === 'visual');

    if (!visualsTrack) {
      const [newTrack] = await db.insert(tracks).values({
        projectId,
        type: 'visual',
        name: 'Visuals',
        position: existingTracks.length,
      }).returning();
      visualsTrack = newTrack;
    }

    // Create timeline item for the full composition
    const fullDurationMs = Math.round((metadata.durationInFrames / metadata.fps) * 1000);
    const visualTypes = metadata.visuals.map(v => v.type).filter(Boolean).join(', ');
    const visualDescriptions = metadata.visuals.map(v => v.description).filter(Boolean).join('; ');

    await db.insert(timelineItems).values({
      trackId: visualsTrack.id,
      type: 'visual',
      startMs: 0,
      endMs: fullDurationMs,
      data: {
        visualId,
        compositionId: metadata.compositionId,
        bundleUrl,
        type: visualTypes || 'visual',
        description: visualDescriptions || 'AI-generated visual',
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps,
      },
    });

    // Update job and project status
    await db.update(jobs)
      .set({
        status: 'complete',
        progress: 100,
        completedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId, compositionId, model: llmModel }, 'Visual generation complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Visual generation failed');

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


// =============================================================================
// Claude Code Visual Generator
// =============================================================================

interface ClaudeCodeOptions {
  projectId: string;
  jobId: string;
  transcript: string;
  durationFrames: number;
  fps: number;
  width: number;
  height: number;
  stylePreset: string;
}

/**
 * Run the Claude Code visual generator.
 *
 * Uses Claude Agent SDK with OAuth authentication from Claude Pro/Max subscription.
 * No API key costs - included in subscription.
 */
async function runClaudeCodeGenerator(
  options: ClaudeCodeOptions
): Promise<ClaudeCodeResult> {
  const { projectId, jobId, transcript, durationFrames, fps, width, height, stylePreset } = options;

  const pythonPath = config.pythonPath;
  const agentScript = join(__dirname, '..', 'agents', 'claude_visual_generator.py');
  const workspacePath = getWorkspacePath();
  const bundleOutputDir = config.remotion.bundleOutputDir;

  logger.info({
    projectId,
    jobId,
    workspacePath,
    model: config.claudeCode.model,
  }, 'Starting Claude Code visual generator...');

  const startTime = Date.now();

  // Write transcript to temp file
  const transcriptPath = join(tmpdir(), `claude-transcript-${jobId}.txt`);
  await writeFile(transcriptPath, transcript, 'utf-8');

  try {
    const subprocess = spawn(pythonPath, [
      agentScript,
      '--workspace', workspacePath,
      '--project-id', projectId,
      '--bundle-output', bundleOutputDir,
      '--transcript', transcriptPath,
      '--width', String(width),
      '--height', String(height),
      '--duration', String(durationFrames),
      '--fps', String(fps),
      '--model', config.claudeCode.model,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Claude SDK will read OAuth token from credential store
      },
    });

    // Track for cancellation
    runningProcesses.set(jobId, subprocess);

    // Register cancel handler
    registerCancelHandler(jobId, () => {
      logger.info({ jobId, projectId }, 'Cancelling Claude Code generator via Redis');
      subprocess.kill('SIGTERM');
    });

    let stdout = '';
    let stderr = '';

    subprocess.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      logger.debug({ projectId, output: text.slice(0, 200) }, 'Claude generator output');
    });

    subprocess.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      logger.warn({ projectId, stderr: text.slice(0, 500) }, 'Claude generator stderr');
    });

    // Wait for completion with timeout
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        subprocess.kill('SIGTERM');
        setTimeout(() => {
          if (!subprocess.killed) {
            subprocess.kill('SIGKILL');
          }
        }, 10000);
        reject(new Error(`Claude Code generator timed out after ${config.claudeCode.timeoutSeconds} seconds`));
      }, config.claudeCode.timeoutSeconds * 1000);

      subprocess.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Claude Code generator exited with code ${code}: ${stderr}`));
        }
      });

      subprocess.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });

    const durationMs = Date.now() - startTime;

    // Parse result from stdout
    let result: any;
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*"success"[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Couldn't parse JSON result
    }

    if (!result || !result.success) {
      throw new Error('Claude Code generator did not produce valid output');
    }

    logger.info({
      projectId,
      durationMs,
      bundleUrl: result.bundleUrl,
    }, 'Claude Code generator completed');

    return {
      bundleUrl: result.bundleUrl,
      bundlePath: result.bundlePath,
      filesWritten: result.filesWritten || 2,
      durationMs,
      status: 'completed',
    };

  } finally {
    runningProcesses.delete(jobId);
    unregisterCancelHandler(jobId);

    try {
      await rm(transcriptPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
