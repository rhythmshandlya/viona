/**
 * Plan Visuals Processor (Director Phase Only)
 *
 * Runs the Python visual generator with --phase director to create a scene plan
 * without generating actual code or bundles. The plan is stored in the job's
 * planData column for the agent to present to the user for approval.
 *
 * Uses Claude Code (Agent SDK) with OAuth authentication from Claude Pro/Max subscription.
 * No API key costs - included in subscription.
 */

import { Job, UnrecoverableError } from 'bullmq';
import { eq } from 'drizzle-orm';
import { writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { db, projects, transcripts, jobs } from '../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError, registerCancelHandler, unregisterCancelHandler, setJobProjectId } from '../services/redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getWorkspacePath, createProjectDir } from '../workspace.js';
import { startHeartbeatProgress } from '../utils/heartbeat-progress.js';
import { searchIcons, type IconOption } from '../services/freepik.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Track running processes for cancellation
const runningProcesses = new Map<string, ChildProcess>();

export interface PlanVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio';
  layoutMode: 'pip' | 'split-horizontal' | 'split-vertical';
  dimensions: {
    width: number;
    height: number;
  };
  /** User-provided style/layout guidance for the Director agent */
  styleGuide?: string;
}

interface PlanData {
  scenePlan: string;
  scenes: Record<string, unknown>;
}

export function cancelPlanJob(jobId: string): boolean {
  const process = runningProcesses.get(jobId);
  if (process) {
    logger.info({ jobId }, 'Cancelling plan-visuals generator');
    process.kill('SIGTERM');
    runningProcesses.delete(jobId);
    return true;
  }
  return false;
}

export async function processPlanVisualsJob(job: Job<PlanVisualsJobData>) {
  const { projectId, jobId, stylePreset, layoutMode, dimensions, styleGuide } = job.data;
  setJobProjectId(jobId, projectId);
  const compositionId = `proj_${projectId.replace(/-/g, '_')}`;

  // Proactive lock extension — prevents BullMQ from marking 10-15 min jobs as stalled
  const lockExtender = setInterval(async () => {
    try {
      await job.extendLock(job.token!, 120_000);
    } catch (err) {
      logger.error({ jobId, err }, 'Lock extension failed');
    }
  }, 55_000);

  try {
    let heartbeat: { stop: () => void } | null = null;

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

      // Create project directory in workspace
      const projectDir = createProjectDir(compositionId);
      logger.info({ projectDir, compositionId }, 'Created project directory for plan');

      await publishJobProgress(jobId, 15, 'Starting Director phase...');

      // Calculate duration in frames
      const durationFrames = Math.ceil(((project.durationMs || 60000) / 1000) * (project.fps || 30));

      // Prepare transcript text and words
      const words = transcript.words as any[];
      const transcriptText = words
        .map((w: any) => w.word || w.text || '')
        .join(' ');

      // Run the Director phase
      await publishJobProgress(jobId, 20, 'Planning scenes — this may take a few minutes...');
      heartbeat = startHeartbeatProgress(jobId, 20, 88, 12 * 60 * 1000); // 12 min estimate

      const planData = await runDirectorPhase({
        projectId: compositionId,
        jobId,
        transcript: transcriptText,
        words,
        durationFrames,
        fps: project.fps || 30,
        width: dimensions?.width || 1080,
        height: dimensions?.height || 1920,
        stylePreset: stylePreset || 'modern',
        layoutMode: layoutMode || 'pip',
        styleGuide,
      });

      heartbeat.stop();
      await publishJobProgress(jobId, 90, 'Fetching icon options...');

      // Fetch SVG options for each icon keyword in the plan
      const planDataWithIcons = await fetchSvgOptionsForPlan(planData);

      await publishJobProgress(jobId, 95, 'Parsing scene plan...');

      // Store plan data in the job record
      await db.update(jobs)
        .set({
          status: 'complete',
          progress: 100,
          completedAt: new Date(),
          planData: planDataWithIcons,
        })
        .where(eq(jobs.id, jobId));

      await publishJobProgress(jobId, 100, 'Plan ready');
      await publishJobComplete(jobId, projectId);

      logger.info({ projectId, compositionId, sceneCount: (planData.scenes as any)?.scenes?.length ?? 'unknown' }, 'Plan visuals complete');

    } catch (error) {
      heartbeat?.stop();
      logger.error({ projectId, err: error }, 'Plan visuals failed');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await db.update(jobs)
        .set({ status: 'failed', error: errorMessage })
        .where(eq(jobs.id, jobId));

      await publishJobError(jobId, errorMessage);

      throw error;
    }
  } finally {
    clearInterval(lockExtender);
  }
}

// =============================================================================
// Director Phase Runner
// =============================================================================

interface DirectorPhaseOptions {
  projectId: string;
  jobId: string;
  transcript: string;
  words?: any[];
  durationFrames: number;
  fps: number;
  width: number;
  height: number;
  stylePreset: string;
  layoutMode: string;
  styleGuide?: string;
}

/**
 * Run the Python visual generator with --phase director.
 *
 * Parses PROGRESS: and PLAN_READY: lines from stdout.
 * Returns the parsed plan data on success.
 */
async function runDirectorPhase(options: DirectorPhaseOptions): Promise<PlanData> {
  const { projectId, jobId, transcript, words, durationFrames, fps, width, height, stylePreset, layoutMode, styleGuide } = options;

  const pythonPath = config.pythonPath;
  const agentScript = join(__dirname, '..', 'agents', 'claude_visual_generator.py');
  const workspacePath = getWorkspacePath();
  const bundleOutputDir = config.remotion.bundleOutputDir;

  logger.info({
    projectId,
    jobId,
    workspacePath,
    model: config.claudeAgent.model,
  }, 'Starting Director phase (plan-visuals)...');

  const startTime = Date.now();

  // Write transcript to temp file
  const transcriptPath = join(tmpdir(), `claude-plan-transcript-${jobId}.txt`);
  await writeFile(transcriptPath, transcript, 'utf-8');

  // Write words JSON if available
  let wordsPath: string | null = null;
  if (words && words.length > 0) {
    wordsPath = join(tmpdir(), `claude-plan-words-${jobId}.json`);
    await writeFile(wordsPath, JSON.stringify(words), 'utf-8');
  }

  // Write style guide to temp file if provided
  let styleGuidePath: string | null = null;
  if (styleGuide && styleGuide.trim()) {
    styleGuidePath = join(tmpdir(), `claude-plan-styleguide-${jobId}.txt`);
    await writeFile(styleGuidePath, styleGuide, 'utf-8');
  }

  try {
    const args = [
      agentScript,
      '--workspace', workspacePath,
      '--project-id', projectId,
      '--bundle-output', bundleOutputDir,
      '--transcript', transcriptPath,
      '--width', String(width),
      '--height', String(height),
      '--duration', String(durationFrames),
      '--fps', String(fps),
      '--model', config.claudeAgent.model,
      '--style-preset', stylePreset,
      '--layout-mode', layoutMode,
      '--phase', 'director',
    ];

    // Add words JSON path if available
    if (wordsPath) {
      args.push('--words-json', wordsPath);
    }

    // Add style guide path if provided
    if (styleGuidePath) {
      args.push('--style-guide', styleGuidePath);
    }

    logger.info({ projectId }, 'Running Director phase only (--phase director)');

    const subprocess = spawn(pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    });

    // Track for cancellation
    runningProcesses.set(jobId, subprocess);

    // Register cancel handler
    registerCancelHandler(jobId, () => {
      logger.info({ jobId, projectId }, 'Cancelling Director phase via Redis');
      subprocess.kill('SIGTERM');
    });

    let stdout = '';
    let stderr = '';
    let planData: PlanData | null = null;
    let gotRealProgress = false;

    // Periodic progress ticker — keeps the UI alive while Claude starts up.
    // Cycles through descriptive messages so users know something is happening.
    const TICKER_MESSAGES = [
      [18, 'Starting Claude Code generator...'],
      [22, 'Connecting to Claude...'],
      [26, 'Authenticating...'],
      [30, 'Analyzing transcript...'],
      [35, 'Identifying key topics...'],
      [40, 'Mapping visual concepts...'],
      [45, 'Designing scene structure...'],
      [50, 'Refining scene details...'],
      [55, 'Crafting visual descriptions...'],
      [58, 'Finalizing scene plan...'],
    ] as const;
    let tickerIndex = 0;

    const progressTicker = setInterval(() => {
      if (gotRealProgress || tickerIndex >= TICKER_MESSAGES.length) return;
      const [percent, message] = TICKER_MESSAGES[tickerIndex];
      publishJobProgress(jobId, percent, message);
      tickerIndex++;
    }, 5_000);

    subprocess.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stdout += text;

      // Parse progress updates and PLAN_READY from stdout
      const lines = text.split('\n');
      for (const line of lines) {
        // Parse PROGRESS:XX:message
        const progressMatch = line.match(/^PROGRESS:(\d+):(.+)$/);
        if (progressMatch) {
          gotRealProgress = true;
          const percent = parseInt(progressMatch[1], 10);
          const message = progressMatch[2];
          // Map progress to 60-90% range for real progress (ticker covers 15-58%)
          const mappedPercent = Math.min(90, Math.max(60, percent));
          publishJobProgress(jobId, mappedPercent, message);
          logger.info({ projectId, percent: mappedPercent, message }, 'Director phase progress');
        }

        // Parse PLAN_READY:{json}
        const planMatch = line.match(/^PLAN_READY:(.+)$/);
        if (planMatch) {
          try {
            planData = JSON.parse(planMatch[1]) as PlanData;
            publishJobProgress(jobId, 95, 'Plan ready — preparing preview...');
            logger.info({ projectId, hasScenePlan: !!planData?.scenePlan }, 'Received PLAN_READY from Director');
          } catch (parseErr) {
            logger.error({ projectId, error: parseErr, raw: planMatch[1].slice(0, 200) }, 'Failed to parse PLAN_READY JSON');
          }
        }
      }

      logger.info({ projectId, output: text.slice(0, 500) }, 'Director phase stdout');
    });

    subprocess.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stderr += text;
      logger.error({ projectId, stderr: text.slice(0, 1000) }, 'Director phase stderr');
    });

    // Use the same configurable timeout as generate/edit visuals
    const DIRECTOR_TIMEOUT_MS = config.claudeAgent.timeoutSeconds * 1000;

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        subprocess.kill('SIGTERM');
        setTimeout(() => {
          if (!subprocess.killed) {
            subprocess.kill('SIGKILL');
            setTimeout(() => {
              if (!subprocess.killed) {
                logger.error({ jobId }, 'CRITICAL: subprocess survived SIGKILL — potential zombie');
              }
            }, 5000);
          }
        }, 10000);
        reject(new Error(`Director phase timed out after ${config.claudeAgent.timeoutSeconds} seconds`));
      }, DIRECTOR_TIMEOUT_MS);

      subprocess.on('close', (code) => {
        clearTimeout(timeoutId);
        clearInterval(progressTicker);
        runningProcesses.delete(jobId);
        unregisterCancelHandler(jobId);
        if (code === 0) {
          resolve();
        } else {
          const errorOutput = stderr || stdout.slice(-1000);
          // Non-zero exit = bad input/prompt, don't retry
          reject(new UnrecoverableError(`Director phase exited with code ${code}: ${errorOutput}`));
        }
      });

      subprocess.on('error', (err) => {
        clearTimeout(timeoutId);
        clearInterval(progressTicker);
        runningProcesses.delete(jobId);
        unregisterCancelHandler(jobId);
        reject(err);
      });
    });

    const durationMs = Date.now() - startTime;
    logger.info({ projectId, durationMs }, 'Director phase subprocess completed');

    // If we got plan data from PLAN_READY line, use it
    if (planData) {
      logger.info({ projectId, durationMs }, 'Director phase completed with PLAN_READY data');
      return planData;
    }

    // Fallback: try to parse PLAN_READY from full stdout (in case the line was split across chunks)
    const fullPlanMatch = stdout.match(/PLAN_READY:(.+)/);
    if (fullPlanMatch) {
      try {
        planData = JSON.parse(fullPlanMatch[1]) as PlanData;
        logger.info({ projectId }, 'Parsed PLAN_READY from full stdout');
        return planData;
      } catch (parseErr) {
        logger.error({ projectId, error: parseErr }, 'Failed to parse PLAN_READY from full stdout');
      }
    }

    // If no PLAN_READY was found, the Director phase did not produce a plan
    throw new Error('Director phase completed but did not emit PLAN_READY data');

  } finally {
    runningProcesses.delete(jobId);
    unregisterCancelHandler(jobId);

    // Clean up temp files
    try {
      await rm(transcriptPath);
    } catch (err) {
      logger.warn({ jobId, path: transcriptPath, err }, 'Failed to clean temp file');
    }

    if (wordsPath) {
      try {
        await rm(wordsPath);
      } catch (err) {
        logger.warn({ jobId, path: wordsPath, err }, 'Failed to clean temp file');
      }
    }

    if (styleGuidePath) {
      try {
        await rm(styleGuidePath);
      } catch (err) {
        logger.warn({ jobId, path: styleGuidePath, err }, 'Failed to clean temp file');
      }
    }
  }
}

// =============================================================================
// SVG Options Fetching
// =============================================================================

/**
 * Extract icon keywords from plan scenes and fetch 5 SVG options per keyword
 * from Freepik. Returns planData with svgOptions merged in.
 */
async function fetchSvgOptionsForPlan(planData: PlanData): Promise<PlanData & { svgOptions?: Record<string, Record<string, IconOption[]>> }> {
  const scenesObj = planData.scenes as Record<string, unknown>;
  const scenesArray = (scenesObj?.scenes as Array<Record<string, unknown>>) || [];

  // Collect all unique icon keywords across scenes, mapped to scene IDs
  const keywordToScenes = new Map<string, string[]>();
  for (const scene of scenesArray) {
    const icons = scene.icons as string[] | undefined;
    const sceneId = String(scene.id ?? scene.name ?? '');
    if (icons && Array.isArray(icons)) {
      for (const keyword of icons) {
        const existing = keywordToScenes.get(keyword) || [];
        existing.push(sceneId);
        keywordToScenes.set(keyword, existing);
      }
    }
  }

  if (keywordToScenes.size === 0) {
    logger.info('No icon keywords found in plan — skipping SVG options fetch');
    return planData;
  }

  logger.info({ keywordCount: keywordToScenes.size, keywords: [...keywordToScenes.keys()] }, 'Fetching SVG options for icon keywords');

  // Fetch 5 options per unique keyword in parallel
  const keywords = [...keywordToScenes.keys()];
  const results = await Promise.all(
    keywords.map(async (keyword) => {
      const options = await searchIcons(keyword, 5);
      return { keyword, options };
    })
  );

  // Build svgOptions map: { sceneId: { keyword: IconOption[] } }
  const svgOptions: Record<string, Record<string, IconOption[]>> = {};
  for (const { keyword, options } of results) {
    if (options.length === 0) continue;
    const sceneIds = keywordToScenes.get(keyword) || [];
    for (const sceneId of sceneIds) {
      if (!svgOptions[sceneId]) svgOptions[sceneId] = {};
      svgOptions[sceneId][keyword] = options;
    }
  }

  logger.info({ sceneCount: Object.keys(svgOptions).length }, 'SVG options fetched for plan');

  return { ...planData, svgOptions };
}
