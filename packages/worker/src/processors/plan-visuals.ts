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

import { Job } from 'bullmq';
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
import { searchIcons, type IconOption, type IconStyleFilters } from '../services/freepik.js';
import { searchIconify } from '../services/iconify.js';
import { fetchImageOptionsForPlan } from '../services/image-fetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Track running processes for cancellation
const runningProcesses = new Map<string, ChildProcess>();

export interface PlanVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: string;
  layoutMode: 'pip' | 'stacked';
  dimensions: {
    width: number;
    height: number;
  };
  /** Effective dimensions for default scenes in stacked layout */
  pipEffective?: {
    width: number;
    height: number;
  };
  /** User-provided style/layout guidance for the Director agent */
  styleGuide?: string;
  sourceWidth?: number;
  sourceHeight?: number;
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

      // Clean old generation artifacts — a new plan means old scene code is stale.
      // This covers the "start over" flow where the user deletes visuals then re-plans.
      const projectDir = join(getWorkspacePath(), 'src', compositionId);
      try {
        const scenesDir = join(projectDir, 'scenes');
        await rm(scenesDir, { recursive: true, force: true });
        for (const f of ['constants.ts', 'index.tsx', 'metadata.json', '.plan_job_id']) {
          await rm(join(projectDir, f), { force: true }).catch(() => {});
        }
      } catch {
        // Directory may not exist yet — that's fine
      }
      createProjectDir(compositionId); // mkdir -p, idempotent
      logger.info({ projectDir, compositionId }, 'Created project directory for plan');

      // Write head tracking data to project folder for spatial overlay awareness
      if (project.headTrackingData) {
        const htPath = join(projectDir, 'head_tracking.json');
        await writeFile(htPath, JSON.stringify(project.headTrackingData), 'utf-8');
        logger.info({ projectDir }, 'Wrote head_tracking.json for spatial overlay');
      }

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
        stylePreset: stylePreset || 'studio-dark',
        layoutMode: layoutMode || 'pip',
        styleGuide,
        sourceWidth: job.data.sourceWidth,
        sourceHeight: job.data.sourceHeight,
        pipWidth: job.data.pipEffective?.width,
        pipHeight: job.data.pipEffective?.height,
      });

      heartbeat.stop();
      await publishJobProgress(jobId, 90, 'Fetching icon options...');

      // Fetch SVG options for each icon keyword in the plan
      const planDataWithIcons = await fetchSvgOptionsForPlan(planData);

      await publishJobProgress(jobId, 92, 'Fetching image options...');

      // Fetch image options (thumbnails) for photo/illustration keywords in the plan
      const planDataWithImages = await fetchImageOptionsForPlan(planDataWithIcons as PlanData & Record<string, unknown>);

      await publishJobProgress(jobId, 95, 'Parsing scene plan...');

      // Store plan data in the job record
      await db.update(jobs)
        .set({
          status: 'complete',
          progress: 100,
          completedAt: new Date(),
          planData: planDataWithImages as PlanData,
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
  sourceWidth?: number;
  sourceHeight?: number;
  pipWidth?: number;
  pipHeight?: number;
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

    // Add source video dimensions if available (for coverage-aware layout planning)
    if (options.sourceWidth && options.sourceHeight) {
      args.push('--source-width', String(options.sourceWidth));
      args.push('--source-height', String(options.sourceHeight));
    }

    // Add pip effective dimensions for per-scene dimension-aware generation
    if (options.pipWidth && options.pipHeight) {
      args.push('--pip-width', String(options.pipWidth));
      args.push('--pip-height', String(options.pipHeight));
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

    let fatalStderrDetected = false;

    subprocess.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stderr += text;
      logger.error({ projectId, stderr: text.slice(0, 1000) }, 'Director phase stderr');
      // Detect fatal crashes: unhandled rejections mean the CLI is likely hung
      if (
        text.includes('unhandled') ||
        text.includes('UnhandledPromiseRejection') ||
        text.includes('rejecting a promise which was not handled') ||
        text.includes('uncaughtException')
      ) {
        logger.error({ projectId, stderr: text.slice(0, 500) }, 'Director phase fatal error detected, killing subprocess');
        fatalStderrDetected = true;
        subprocess.kill('SIGTERM');
      }
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
        if (fatalStderrDetected) {
          // OOM and other crashes — retryable
          reject(new Error(`Director phase crashed: ${stderr.slice(-500)}`));
        } else if (code === 0) {
          resolve();
        } else {
          // Non-zero exit — may be retryable (transient API errors, etc.)
          const errorOutput = stderr || stdout.slice(-1000);
          reject(new Error(`Director phase exited with code ${code}: ${errorOutput}`));
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
 * from Freepik, with Iconify as a fallback for keywords with no Freepik results
 * (e.g. brand icons like slack, notion, whatsapp).
 * Returns planData with svgOptions merged in.
 */
async function fetchSvgOptionsForPlan(planData: PlanData): Promise<PlanData & { svgOptions?: Record<string, Record<string, IconOption[]>> }> {
  const scenesObj = planData.scenes as Record<string, unknown>;
  const scenesArray = (scenesObj?.scenes as Array<Record<string, unknown>>) || [];

  // Read AI-chosen icon style from plan root (shape + color filters for Freepik)
  // Validate against known Freepik API values to prevent hallucinated values from silently failing
  const VALID_SHAPES = new Set(['outline', 'fill', 'lineal-color', 'hand-drawn']);
  const VALID_COLORS = new Set([
    'gradient', 'solid-black', 'multicolor', 'azure', 'black', 'blue',
    'chartreuse', 'cyan', 'gray', 'green', 'orange', 'red', 'rose',
    'spring-green', 'violet', 'white', 'yellow',
  ]);
  const rawStyle = scenesObj?.iconStyle as Record<string, unknown> | undefined;
  const iconStyle: IconStyleFilters | undefined = rawStyle ? {
    ...(typeof rawStyle.shape === 'string' && VALID_SHAPES.has(rawStyle.shape) ? { shape: rawStyle.shape as IconStyleFilters['shape'] } : {}),
    ...(typeof rawStyle.color === 'string' && VALID_COLORS.has(rawStyle.color) ? { color: rawStyle.color } : {}),
  } : undefined;
  if (iconStyle) {
    logger.info({ iconStyle, raw: rawStyle }, 'Using AI-chosen icon style filters');
  }

  // Normalize Lucide/Feather-style icon names to plain English search terms
  // e.g. "edit-3" → "edit", "message-square" → "message square", "check-circle" → "check circle"
  function normalizeIconKeyword(keyword: string): string {
    return keyword
      .replace(/-\d+$/, '')    // strip trailing numbers: "edit-3" → "edit"
      .replace(/-/g, ' ')      // hyphens to spaces: "message-square" → "message square"
      .trim();
  }

  // Collect all unique icon keywords across scenes, mapped to scene IDs
  // Keys are the normalized search terms; we also track original→normalized for logging
  const keywordToScenes = new Map<string, string[]>();
  for (const scene of scenesArray) {
    const icons = scene.icons as string[] | undefined;
    const sceneId = String(scene.id ?? scene.name ?? '');
    if (icons && Array.isArray(icons)) {
      for (const rawKeyword of icons) {
        const keyword = normalizeIconKeyword(rawKeyword);
        if (keyword !== rawKeyword) {
          logger.info({ original: rawKeyword, normalized: keyword }, 'Normalized icon keyword');
        }
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

  // Family-ID lock strategy: search first keyword alone to discover the family,
  // then search remaining keywords in parallel locked to that family.
  const keywords = [...keywordToScenes.keys()];
  const styleWithFamily: IconStyleFilters = { ...iconStyle };

  // Step 1: Search the first keyword alone (no familyId yet)
  const firstResult = await searchIcons(keywords[0], 5, styleWithFamily);

  // Step 2: Extract familyId from the first result
  if (firstResult.familyId !== undefined) {
    styleWithFamily.familyId = firstResult.familyId;
    logger.info({ familyId: firstResult.familyId, keyword: keywords[0] }, 'Locked icon family from first keyword');
  }

  // Step 3: Search remaining keywords in parallel with familyId locked
  const remainingKeywords = keywords.slice(1);
  const remainingResults = await Promise.all(
    remainingKeywords.map(async (keyword) => {
      const result = await searchIcons(keyword, 5, styleWithFamily);
      // Fallback: if family-locked search returns 0 results, retry without familyId
      if (result.options.length === 0 && styleWithFamily.familyId !== undefined) {
        const { familyId: _drop, ...styleWithoutFamily } = styleWithFamily;
        logger.info({ keyword, familyId: styleWithFamily.familyId }, 'No results with family lock — retrying without');
        const fallback = await searchIcons(keyword, 5, styleWithoutFamily);
        return { keyword, options: fallback.options };
      }
      return { keyword, options: result.options };
    })
  );

  // Combine first result with remaining results
  const results = [
    { keyword: keywords[0], options: firstResult.options },
    ...remainingResults,
  ];

  // Iconify fallback: for keywords with 0 Freepik results, try Iconify (brands, logos)
  const failedKeywords = results.filter(r => r.options.length === 0).map(r => r.keyword);
  if (failedKeywords.length > 0) {
    logger.info({ keywords: failedKeywords }, 'Falling back to Iconify for keywords with no Freepik results');
    const iconifyResults = await Promise.all(
      failedKeywords.map(async (keyword) => ({
        keyword,
        options: await searchIconify(keyword, 5),
      }))
    );
    // Merge Iconify results back into the results array
    for (const iconifyResult of iconifyResults) {
      const idx = results.findIndex(r => r.keyword === iconifyResult.keyword);
      if (idx !== -1 && iconifyResult.options.length > 0) {
        results[idx].options = iconifyResult.options;
        logger.info({ keyword: iconifyResult.keyword, count: iconifyResult.options.length }, 'Iconify fallback found results');
      }
    }
  }

  // Log keywords that failed both Freepik and Iconify
  const stillFailed = results.filter(r => r.options.length === 0).map(r => r.keyword);
  if (stillFailed.length > 0) {
    logger.warn({ keywords: stillFailed }, 'No icon results from Freepik or Iconify for these keywords');
  }

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
