import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, writeFile, readFile, readdir } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn, spawnSync, ChildProcess } from 'child_process';
// Bundling now happens inside Docker container - these imports removed:
// import { bundle } from '@remotion/bundler';
// import { renderMedia, selectComposition } from '@remotion/renderer';
import { db, projects, tracks, timelineItems, transcripts, jobs, visuals } from '../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError, registerCancelHandler, unregisterCancelHandler } from '../services/redis.js';
import { createLogStreamer, LogStreamer } from '../services/log-streamer.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { buildGenerateVisualsPrompt, STYLE_GUIDELINES } from '../prompts/generate-visuals.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// LLM configuration - supports Claude Max (local proxy) or OpenRouter
interface LLMConfig {
  provider: 'claude-max' | 'openrouter';
  baseUrl: string;
  apiKey: string;
  model: string;
  modelFlash: string;
  temperature: number;
  // Cost tracking (only for OpenRouter)
  inputCostPer1M?: number;
  outputCostPer1M?: number;
}

function getLLMConfig(): LLMConfig {
  const provider = config.llm.provider;

  if (provider === 'claude-max') {
    logger.info({ provider }, 'Using Claude Max via local proxy');
    return {
      provider: 'claude-max',
      baseUrl: config.llm.claudeMax.proxyUrl,
      apiKey: config.llm.claudeMax.apiKey,
      model: config.llm.claudeMax.model,
      modelFlash: config.llm.claudeMax.modelFlash,
      temperature: config.llm.temperature,
      // No per-token cost for Claude Max (subscription)
    };
  }

  // Default: OpenRouter
  logger.info({ provider }, 'Using OpenRouter');
  return {
    provider: 'openrouter',
    baseUrl: config.llm.openrouter.baseUrl,
    apiKey: config.llm.openrouter.apiKey,
    model: config.llm.openrouter.model,
    modelFlash: config.llm.openrouter.modelFlash,
    temperature: config.llm.temperature,
    inputCostPer1M: 0.10,  // Gemini 3 Flash pricing
    outputCostPer1M: 12.00,
  };
}

// Timeout configuration (in milliseconds)
const AGENT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes max per job
const GRACEFUL_SHUTDOWN_MS = 10 * 1000; // 10 seconds for graceful shutdown

// Track running processes for cancellation
const runningProcesses = new Map<string, ChildProcess>();

// Environment validation results (cached after first check)
let environmentValidated = false;
let environmentError: string | null = null;

/**
 * Validate that Python and OpenHands are available.
 * Call this at worker startup to fail fast if dependencies are missing.
 */
export async function validateEnvironment(): Promise<{ valid: boolean; error?: string }> {
  if (environmentValidated) {
    return environmentError ? { valid: false, error: environmentError } : { valid: true };
  }

  try {
    // Check Python is available
    const pythonPath = config.openHands.pythonPath;
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

    // Check OpenHands is installed
    const openhandsCheck = spawn(pythonPath, ['-c', 'import openhands; print(openhands.__version__ if hasattr(openhands, "__version__") else "installed")'], { stdio: 'pipe' });
    const openhandsResult = await new Promise<{ code: number | null; output: string }>((resolve) => {
      let output = '';
      openhandsCheck.stdout?.on('data', (data) => { output += data.toString(); });
      openhandsCheck.stderr?.on('data', (data) => { output += data.toString(); });
      openhandsCheck.on('close', (code) => resolve({ code, output }));
      openhandsCheck.on('error', () => resolve({ code: -1, output: 'Failed to check OpenHands' }));
    });

    if (openhandsResult.code !== 0) {
      environmentError = `OpenHands not installed. Run: pip install openhands-ai\nError: ${openhandsResult.output}`;
      environmentValidated = true;
      return { valid: false, error: environmentError };
    }

    logger.info({ openhandsVersion: openhandsResult.output.trim() }, 'OpenHands version detected');

    // Check API keys are configured
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    if (!hasGeminiKey && !hasAnthropicKey && !hasOpenAIKey) {
      logger.warn('No LLM API keys configured. Set GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY');
    } else {
      logger.info({ hasGeminiKey, hasAnthropicKey, hasOpenAIKey }, 'LLM API keys configured');
    }

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
    logger.info({ jobId }, 'Cancelling OpenHands process');
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

interface AgentEvent {
  type: string;
  tool?: string;
  count?: number;
  command?: string;
  message?: string;
  files_written?: number;
  edits_made?: number;
  screenshots_taken?: number;
  input_tokens?: number;
  output_tokens?: number;
  // Iteration events
  iteration?: number;
  max_iterations?: number;
  score?: number;
  breakdown?: {
    correctness?: number;
    completeness?: number;
    visualQuality?: number;
    codeQuality?: number;
  };
  issues?: string[];
  suggestion?: string;
  // Complete event
  status?: string;
  final_score?: number;
  best_iteration?: number;
  total_iterations?: number;
  threshold?: number;
  // Enhanced error details
  error?: string;
  error_type?: string;
  stack_trace?: string;
  // Video rendering result
  video_url?: string;
  // Tool result details
  success?: boolean;
  exit_code?: number;
  output?: string;
  duration_ms?: number;
  // Validation details
  validation_type?: string;
  errors?: Array<{ file?: string; line?: number; message?: string } | string>;
}

interface JobMetrics {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  llmModel: string;
  filesWritten: number;
  screenshotsTaken: number;
  // New fields for iterative refinement
  finalScore?: number;
  totalIterations?: number;
  status?: string;
}

export async function processGenerateVisualsJob(job: Job<GenerateVisualsJobData>) {
  const { projectId, jobId, stylePreset, layoutMode, dimensions } = job.data;
  const compositionId = `proj_${projectId.replace(/-/g, '_')}`;
  const projectDir = join(config.remotion.projectDir, 'src', compositionId);

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

    // Clean up ALL old composition directories to prevent stale imports in Root.tsx
    // The root_generator scans src/ for proj_* directories, so we need to remove old ones
    const srcDir = join(config.remotion.projectDir, 'src');
    try {
      const entries = await readdir(srcDir);
      for (const entry of entries) {
        // Remove any proj_* directory that isn't the current composition
        if (entry.startsWith('proj_') && entry !== compositionId) {
          const oldDir = join(srcDir, entry);
          logger.info({ oldDir, compositionId }, 'Removing stale composition directory');
          await rm(oldDir, { recursive: true, force: true });
        }
      }
    } catch (e) {
      // srcDir might not exist yet on first run, that's fine
      logger.debug({ srcDir, error: e }, 'Could not clean old compositions (may not exist yet)');
    }

    // Clean up any existing project directory for a fresh start
    await rm(projectDir, { recursive: true, force: true });

    // Create project directory in Remotion workspace
    await mkdir(projectDir, { recursive: true });

    await publishJobProgress(jobId, 15, 'Starting AI agent...');

    // Build prompt for the agent
    const prompt = buildGenerateVisualsPrompt({
      transcript: transcript.words as any[],
      projectId: compositionId,
      stylePreset,
      styleGuidelines: STYLE_GUIDELINES[stylePreset],
      durationMs: project.durationMs || 60000,
      fps: project.fps || 30,
      width: dimensions?.width || 1080,
      height: dimensions?.height || 1920,
      layoutMode: layoutMode || 'pip',
    });

    // Calculate duration in frames
    const durationFrames = Math.ceil(((project.durationMs || 60000) / 1000) * (project.fps || 30));

    // Get LLM configuration (Claude Max or OpenRouter)
    const llmConfig = getLLMConfig();

    // Run OpenHands agent and capture metrics
    const agentResult = await runOpenHandsAgent(prompt, {
      workspace: config.remotion.projectDir,
      projectId: compositionId,
      jobId,
      model: llmConfig.model,
      modelFlash: llmConfig.modelFlash,
      baseUrl: llmConfig.baseUrl,
      apiKey: llmConfig.apiKey,
      temperature: llmConfig.temperature,
      inputCostPer1M: llmConfig.inputCostPer1M,
      outputCostPer1M: llmConfig.outputCostPer1M,
      durationFrames,
      fps: project.fps || 30,
      width: dimensions?.width || 1080,
      height: dimensions?.height || 1920,
      stylePreset: stylePreset || 'modern',
      layoutMode: layoutMode || 'pip',
      reasoningEffort: 'high', // Maximum Gemini reasoning for best quality
      verbose: job.data.verbose,
    });

    // Calculate estimated cost (only for OpenRouter - Claude Max has no per-token cost)
    const estimatedCostUsd = llmConfig.inputCostPer1M && llmConfig.outputCostPer1M
      ? (agentResult.inputTokens / 1_000_000) * llmConfig.inputCostPer1M +
        (agentResult.outputTokens / 1_000_000) * llmConfig.outputCostPer1M
      : 0;

    // Store metrics in job
    const jobMetrics: JobMetrics = {
      inputTokens: agentResult.inputTokens,
      outputTokens: agentResult.outputTokens,
      estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000, // Round to 4 decimal places
      durationMs: agentResult.durationMs,
      llmModel: llmConfig.model,
      filesWritten: agentResult.filesWritten,
      screenshotsTaken: agentResult.screenshotsTaken,
      finalScore: agentResult.finalScore,
      totalIterations: agentResult.totalIterations,
      status: agentResult.status,
    };

    await db.update(jobs)
      .set({ metrics: jobMetrics, logs: agentResult.logs })
      .where(eq(jobs.id, jobId));

    logger.info({ projectId, jobMetrics, logCount: agentResult.logs.length }, 'Job metrics and logs recorded');

    await publishJobProgress(jobId, 70, 'Reading metadata...');

    // Read metadata file that the agent should have created
    const metadataPath = join(projectDir, 'metadata.json');
    let metadata: VisualMetadata;

    try {
      const metadataContent = await readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);

      // Validate metadata structure
      if (!metadata.compositionId || typeof metadata.durationInFrames !== 'number') {
        throw new Error('Invalid metadata.json: missing required fields');
      }

      // Validate visuals array exists and has content
      if (!metadata.visuals || !Array.isArray(metadata.visuals)) {
        throw new Error('Invalid metadata.json: visuals must be an array');
      }

      if (metadata.visuals.length === 0) {
        throw new Error('Agent completed but generated no visuals. The transcript may not have visualizable content.');
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

      // If index exists but no metadata, the agent partially completed
      logger.warn({ projectId, error: errorMsg }, 'Metadata missing or invalid, but code was generated');

      // Create minimal fallback metadata from the generated code
      metadata = {
        compositionId,
        durationInFrames: Math.ceil(((project.durationMs || 60000) / 1000) * (project.fps || 30)),
        fps: project.fps || 30,
        width: 1920,
        height: 1080,
        visuals: [{
          startMs: 0,
          endMs: project.durationMs || 60000,
          type: 'generated',
          description: 'AI-generated visual (metadata incomplete)',
        }],
      };
    }

    await publishJobProgress(jobId, 70, 'Verifying bundle...');

    // Bundle is created inside Docker container - verify it exists
    // The composition ID uses dashes (container converts underscores to dashes)
    const bundleCompositionId = compositionId.replace(/_/g, '-');
    const bundleDir = join(config.remotion.bundleOutputDir, bundleCompositionId);
    const bundleIndex = join(bundleDir, 'index.html');

    // Check if bundle was created by the container
    try {
      await readFile(bundleIndex);
      logger.info({ projectId, bundleDir, bundleCompositionId }, 'Bundle verified - created by container');
    } catch (err) {
      throw new Error(`Bundle not found at ${bundleDir}. The container may have failed to create it.`);
    }

    // Bundle URL for frontend
    const bundleUrl = `/bundles/${bundleCompositionId}/index.html`;

    // Video URL from agent (rendered video for playback)
    const videoUrl: string | null = agentResult.videoUrl;
    if (videoUrl) {
      logger.info({ projectId, videoUrl }, 'Video rendered by agent');
    } else {
      logger.warn({ projectId }, 'No video URL from agent - visual will use bundle fallback');
    }

    await publishJobProgress(jobId, 85, 'Registering visual...');

    // Clean up old visuals for this project (in case of regeneration)
    const existingVisuals = await db.select().from(visuals).where(eq(visuals.projectId, projectId));
    if (existingVisuals.length > 0) {
      logger.info({ projectId, count: existingVisuals.length }, 'Cleaning up existing visuals');

      // Delete old timeline items that reference old visuals
      for (const oldVisual of existingVisuals) {
        // Find and delete timeline items with this visualId in their data
        const allItems = await db.select().from(timelineItems);
        for (const item of allItems) {
          if (item.type === 'visual' && (item.data as any)?.visualId === oldVisual.id) {
            await db.delete(timelineItems).where(eq(timelineItems.id, item.id));
          }
        }

        // Try to clean up old bundle directory
        if (oldVisual.compositionId) {
          const oldBundleDir = join(config.remotion.bundleOutputDir, oldVisual.compositionId);
          try {
            await rm(oldBundleDir, { recursive: true, force: true });
            logger.debug({ oldBundleDir }, 'Removed old bundle directory');
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      // Delete old visual records
      await db.delete(visuals).where(eq(visuals.projectId, projectId));
    }

    // Insert into visuals table (let DB generate UUID)
    const [insertedVisual] = await db.insert(visuals).values({
      projectId,
      compositionId: metadata.compositionId,
      bundleUrl,
      videoUrl, // Rendered video URL for playback
      durationFrames: metadata.durationInFrames,
      fps: metadata.fps,
      width: metadata.width,
      height: metadata.height,
      stylePreset,
      llmModel: llmConfig.model,
      timestamps: metadata.visuals,
    }).returning({ id: visuals.id });
    const visualId = insertedVisual.id;

    await publishJobProgress(jobId, 90, 'Creating timeline items...');

    // Create a visuals track if it doesn't exist
    let visualsTrack = await db.query.tracks.findFirst({
      where: eq(tracks.projectId, projectId),
    });

    // Find or create visuals track
    const existingTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));
    visualsTrack = existingTracks.find(t => t.type === 'visual');

    if (!visualsTrack) {
      const [newTrack] = await db.insert(tracks).values({
        projectId,
        type: 'visual',
        name: 'Visuals',
        position: existingTracks.length,
      }).returning();
      visualsTrack = newTrack;
    }

    // Create ONE timeline item for the full composition
    // The composition handles its own internal timing with Sequence components
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
        videoUrl, // Rendered video for playback
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

    logger.info({ projectId, compositionId, model: llmConfig.model }, 'Visual generation complete');

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

interface OpenHandsOptions {
  workspace: string;
  projectId: string;
  jobId: string;
  model: string;           // Pro model for code generation
  modelFlash: string;      // Flash model for critic/planning
  baseUrl: string;         // LLM API base URL
  apiKey: string;          // LLM API key
  temperature: number;
  inputCostPer1M?: number; // Optional - not available for Claude Max
  outputCostPer1M?: number;
  durationFrames: number;
  fps: number;
  width: number;
  height: number;
  stylePreset: string;     // Style preset (minimal, modern, playful, bold, classic)
  layoutMode: string;      // Layout mode (pip, split-horizontal, split-vertical)
  reasoningEffort?: string; // Reasoning effort for Gemini: none|low|medium|high
  verbose?: boolean;
}

interface AgentResult {
  filesWritten: number;
  screenshotsTaken: number;
  editsCount: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  logs: string[];
  // Iterative refinement results
  finalScore: number;
  totalIterations: number;
  status: string;
  // Rendered video URL
  videoUrl: string | null;
}

async function runOpenHandsAgent(
  prompt: string,
  options: OpenHandsOptions
): Promise<AgentResult> {
  const { workspace, projectId, jobId, model, modelFlash, baseUrl, apiKey } = options;

  // Write prompt to temp file with unique name to avoid conflicts
  const tempId = `${jobId}-${Date.now()}`;
  const promptPath = join(tmpdir(), `openhands-prompt-${tempId}.txt`);

  // Remove any existing file or directory with this path
  try {
    await rm(promptPath, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }

  await writeFile(promptPath, prompt, 'utf-8');

  // Path to Python agent script
  const agentScript = join(__dirname, '..', 'agents', 'visual_generator.py');

  // Determine if we should use Docker sandbox
  const useDocker = config.openHands.useDocker;

  let subprocess: ChildProcess;

  try {
    if (useDocker) {
      // Run inside Docker container for isolation
      // Workspace is INTERNAL to Docker (no mount) - only mount output directory for results
      logger.info({ projectId, model, dockerImage: config.openHands.dockerImage }, 'Starting OpenHands agent in Docker...');

      // Clean up any existing container with the same name (from previous failed runs)
      const containerName = `openhands-${jobId}`;
      spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' });

      // Create output directory for generated project files (must be absolute path for Docker mounts)
      const outputDir = resolve(join(workspace, 'src'));
      await mkdir(outputDir, { recursive: true });

      // Create bundle output directory (must be absolute path for Docker mounts)
      const bundleOutputDir = resolve(config.remotion.bundleOutputDir);
      await mkdir(bundleOutputDir, { recursive: true });

      // Docker run command with mounts for source and bundle output
      // Workspace is internal to Docker (/opt/remotion-template) with pre-installed node_modules
      // Mounts: prompt file (input), output directory (source), bundle directory (bundle)

      // Replace localhost with host.docker.internal for Docker to reach host services
      const dockerBaseUrl = baseUrl.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal');

      subprocess = spawn('docker', [
        'run',
        '--rm',
        '--name', containerName,
        // Resource limits
        '--memory', config.openHands.memoryLimit,
        '--cpus', config.openHands.cpuLimit,
        // Mount prompt file (read-only input)
        '-v', `${promptPath}:/tmp/prompt.txt:ro`,
        // Mount output directory (for exporting source files)
        '-v', `${outputDir}:/output`,
        // Mount bundle directory (for exporting compiled bundle)
        '-v', `${bundleOutputDir}:/bundles`,
        // Environment variables for LiteLLM to use custom base URL
        '-e', `OPENAI_API_BASE=${dockerBaseUrl}`,
        '-e', `OPENAI_API_KEY=${apiKey}`,
        // Image
        config.openHands.dockerImage,
        // Arguments passed to entrypoint (which runs visual_generator.py)
        '--project-id', projectId,
        '--model', model,
        '--model-flash', modelFlash,
        '--base-url', dockerBaseUrl,
        '--api-key', apiKey,
        '--prompt-file', '/tmp/prompt.txt',
        '--output-dir', '/output',
        '--bundle-dir', '/bundles',
        '--duration-frames', String(options.durationFrames),
        '--fps', String(options.fps),
        '--width', String(options.width || 1080),
        '--height', String(options.height || 1920),
        '--style-preset', options.stylePreset || 'modern',
        '--layout-mode', options.layoutMode || 'pip',
        '--reasoning-effort', options.reasoningEffort || 'high',
        '--temperature', String(options.temperature),
        '--max-iterations', '3',
        '--quality-threshold', '70',
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        // IMPORTANT: Disable MSYS/Git Bash path conversion on Windows
        // Without this, paths like /tmp/prompt.txt get converted to C:/Program Files/Git/tmp/prompt.txt
        env: { ...process.env, MSYS_NO_PATHCONV: '1', MSYS2_ARG_CONV_EXCL: '*' },
      });
    } else {
      // Run directly on host (development mode)
      const pythonPath = config.openHands.pythonPath;
      logger.info({ projectId, model, workspace, pythonPath }, 'Starting OpenHands agent (host mode)...');

      subprocess = spawn(pythonPath, [
        agentScript,
        '--workspace', workspace,
        '--project-id', projectId,
        '--model', model,
        '--model-flash', modelFlash,
        '--base-url', baseUrl,
        '--api-key', apiKey,
        '--prompt-file', promptPath,
        '--duration-frames', String(options.durationFrames),
        '--fps', String(options.fps),
        '--width', String(options.width || 1080),
        '--height', String(options.height || 1920),
        '--style-preset', options.stylePreset || 'modern',
        '--layout-mode', options.layoutMode || 'pip',
        '--reasoning-effort', options.reasoningEffort || 'high',
        '--temperature', String(options.temperature),
        '--max-iterations', '3',
        '--quality-threshold', '70',
      ], {
        env: {
          ...process.env,
          REMOTION_PROJECT_DIR: workspace,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    // Register process for cancellation
    runningProcesses.set(jobId, subprocess);

    // Register cancel handler via Redis pub/sub
    registerCancelHandler(jobId, () => {
      logger.info({ jobId, projectId, useDocker }, 'Cancelling OpenHands agent via Redis');
      if (useDocker) {
        // Stop Docker container gracefully
        spawn('docker', ['stop', `openhands-${jobId}`], { stdio: 'ignore' });
      } else {
        subprocess.kill('SIGTERM');
      }
    });

    let filesWritten = 0;
    let screenshotsTaken = 0;
    let editsCount = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let lastStatus = '';
    let finalScore = 0;
    let totalIterations = 0;
    let agentStatus = 'running';
    let videoUrl: string | null = null;
    const startTime = Date.now();
    const logEntries: string[] = [];

    // Create log streamer for real-time WebSocket streaming
    // Use verbose mode for detailed debugging when requested
    const verbose = options.verbose ?? false;
    const logStreamer = createLogStreamer(jobId, {
      debounceMs: verbose ? 100 : 500, // Faster updates in verbose mode
      minLevel: verbose ? 'debug' : 'tool', // Include debug in verbose mode
      verbose,
      maxContentLength: verbose ? 2000 : 500,
      errorContextSize: verbose ? 10 : 5,
    });

    const addLog = (message: string) => {
      const timestamp = new Date().toISOString();
      logEntries.push(`[${timestamp}] ${message}`);
      // Keep only last 100 log entries to avoid memory issues
      if (logEntries.length > 100) {
        logEntries.shift();
      }
    };

    addLog(`Starting agent with model: ${model}`);
    logStreamer.progress(`Starting agent with model: ${model}`);

    // Stream and parse stdout events
    subprocess.stdout?.on('data', async (chunk: Buffer) => {
      const text = chunk.toString();
      const lines = text.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const event: AgentEvent = JSON.parse(line);

          // Stream to WebSocket via LogStreamer
          logStreamer.logAgentEvent(event);

          switch (event.type) {
            case 'started':
              lastStatus = `Agent started with ${event.tool || model}`;
              addLog(`Started with max ${event.max_iterations || 3} iterations`);
              break;

            case 'planning':
            case 'planning_start':
              lastStatus = 'Visual Director analyzing transcript...';
              addLog('Planning phase: Visual Director creating visual plan');
              break;

            case 'planning_complete':
              lastStatus = `Visual plan created: ${event.scene_count || 0} scenes`;
              addLog(`Planning complete: ${event.scene_count || 0} scenes, ${event.entity_count || 0} entities, ${event.validation_errors || 0} validation issues`);
              break;

            case 'planning_error':
              logger.warn({ projectId, error: event.error, errors: event.errors }, 'Planning phase had issues');
              addLog(`Planning issue: ${event.error || event.errors?.join(', ') || 'unknown'}`);
              break;

            case 'iteration_start':
              lastStatus = `Iteration ${event.iteration}/${event.max_iterations || 3}...`;
              addLog(`Starting iteration ${event.iteration}`);
              break;

            case 'iteration_complete':
              totalIterations = event.iteration || totalIterations + 1;
              const score = event.score || 0;
              lastStatus = `Iteration ${event.iteration} complete (score: ${score}/100)`;
              addLog(`Iteration ${event.iteration} score: ${score}/100`);
              if (event.issues && event.issues.length > 0) {
                addLog(`Issues: ${event.issues.slice(0, 3).join(', ')}`);
              }
              break;

            case 'tool_call':
              if (event.tool === 'generator') {
                lastStatus = 'Generating code...';
                addLog('Running generator agent');
              } else if (event.tool === 'critic') {
                lastStatus = 'Validating output...';
                addLog('Running critic agent');
              } else if (event.tool === 'root_generator') {
                lastStatus = 'Generating Root.tsx...';
                addLog(event.message || 'Auto-generating Root.tsx');
              } else if (event.tool === 'write') {
                filesWritten = event.count || filesWritten + 1;
                lastStatus = `Writing files... (${filesWritten} files)`;
                addLog(`Tool: write (file #${filesWritten})`);
              } else if (event.tool === 'edit') {
                editsCount = event.count || editsCount + 1;
                lastStatus = `Editing code... (${editsCount} edits)`;
                addLog(`Tool: edit (edit #${editsCount})`);
              } else if (event.tool === 'screenshot') {
                screenshotsTaken = event.count || screenshotsTaken + 1;
                lastStatus = `Taking screenshot #${screenshotsTaken}...`;
                addLog(`Tool: screenshot #${screenshotsTaken}`);
              } else if (event.tool === 'bash') {
                lastStatus = `Running command...`;
                addLog(`Tool: bash - ${event.command || 'command'}`);
              } else if (event.tool === 'read') {
                lastStatus = 'Reading files...';
                addLog(`Tool: read`);
              }
              break;

            case 'complete':
              filesWritten = event.files_written || filesWritten;
              screenshotsTaken = event.screenshots_taken || screenshotsTaken;
              inputTokens = event.input_tokens || inputTokens;
              outputTokens = event.output_tokens || outputTokens;
              finalScore = event.final_score || 0;
              totalIterations = event.total_iterations || totalIterations;
              agentStatus = event.status || 'completed';
              videoUrl = event.video_url || null;
              lastStatus = `Agent ${agentStatus} (score: ${finalScore}/100, ${totalIterations} iterations)`;
              addLog(`Completed: ${agentStatus}, score ${finalScore}/100, ${totalIterations} iterations, ${filesWritten} files`);
              if (videoUrl) {
                addLog(`Video rendered: ${videoUrl}`);
              }
              break;

            case 'error':
              logger.error({
                projectId,
                error: event.message,
                errorType: event.error_type,
                stackTrace: event.stack_trace?.slice(0, 500),
              }, 'Agent error');
              addLog(`ERROR [${event.error_type || 'unknown'}]: ${event.message}`);
              if (event.stack_trace) {
                addLog(`Stack: ${event.stack_trace.slice(0, 200)}...`);
              }
              agentStatus = 'failed';
              break;

            case 'tool_result':
              if (!event.success) {
                logger.warn({
                  projectId,
                  tool: event.tool,
                  error: event.error,
                  exitCode: event.exit_code,
                }, 'Tool failed');
                addLog(`Tool ${event.tool} failed: ${event.error || 'unknown error'}`);
              }
              break;

            case 'critic_result':
              logger.info({
                projectId,
                score: event.score,
                threshold: event.threshold,
                breakdown: event.breakdown,
                issueCount: event.issues?.length,
              }, 'Critic result');
              addLog(`Critic: ${event.score}/${event.threshold} - ${event.issues?.length || 0} issues`);
              break;

            case 'validation_error':
              logger.warn({
                projectId,
                validationType: event.validation_type,
                errorCount: event.errors?.length,
              }, 'Validation failed');
              addLog(`Validation (${event.validation_type}): ${event.errors?.length || 0} errors`);
              for (const err of (event.errors || []).slice(0, 3)) {
                const errMsg = typeof err === 'string' ? err : `${err.file}:${err.line} - ${err.message}`;
                addLog(`  - ${errMsg}`);
              }
              break;

            case 'cancelled':
              logger.info({ projectId }, 'Agent cancelled');
              addLog('Agent was cancelled');
              agentStatus = 'cancelled';
              break;
          }

          // Calculate progress: 15% base + progress based on iteration and activity
          // Each iteration is roughly 20% of progress (3 iterations = 60%)
          const iterationProgress = Math.min(totalIterations * 20, 60);
          const activityScore = Math.min(
            (filesWritten * 2) + (editsCount * 1) + (screenshotsTaken * 3),
            25
          );
          const progress = 15 + iterationProgress + activityScore;

          await publishJobProgress(jobId, Math.min(progress, 65), lastStatus);
          logger.debug({ projectId, progress, lastStatus, iteration: totalIterations }, 'Agent progress');

        } catch {
          // Not JSON - log as debug
          logger.debug({ projectId, output: line.slice(0, 200) }, 'Agent output');
        }
      }
    });

    // Log stderr
    subprocess.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      logger.warn({ projectId, stderr: text.slice(0, 500) }, 'Agent stderr');
    });

    // Wait for completion with timeout
    await new Promise<void>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      let isTimedOut = false;

      // Set up timeout
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        logger.warn({ projectId, jobId, timeoutMs: AGENT_TIMEOUT_MS, useDocker }, 'Agent timeout - initiating shutdown');

        if (useDocker) {
          // Stop Docker container gracefully
          spawn('docker', ['stop', '-t', '10', `openhands-${jobId}`], { stdio: 'ignore' });

          // Force kill after graceful shutdown period
          setTimeout(() => {
            spawn('docker', ['kill', `openhands-${jobId}`], { stdio: 'ignore' });
          }, GRACEFUL_SHUTDOWN_MS);
        } else {
          subprocess.kill('SIGTERM');

          // Force kill after graceful shutdown period
          setTimeout(() => {
            if (!subprocess.killed) {
              logger.warn({ projectId, jobId }, 'Agent did not exit gracefully - sending SIGKILL');
              subprocess.kill('SIGKILL');
            }
          }, GRACEFUL_SHUTDOWN_MS);
        }
      }, AGENT_TIMEOUT_MS);

      subprocess.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);

        if (isTimedOut) {
          reject(new Error(`Agent timed out after ${AGENT_TIMEOUT_MS / 1000 / 60} minutes`));
        } else if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Agent exited with code ${code}`));
        }
      });

      subprocess.on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(err);
      });
    });

    const durationMs = Date.now() - startTime;
    addLog(`Agent finished in ${Math.round(durationMs / 1000)}s with score ${finalScore}/100`);

    // Close the log streamer to flush remaining logs
    await logStreamer.close();

    logger.info({
      projectId,
      filesWritten,
      screenshotsTaken,
      editsCount,
      inputTokens,
      outputTokens,
      durationMs,
      finalScore,
      totalIterations,
      agentStatus,
    }, 'OpenHands agent completed');

    return {
      filesWritten,
      screenshotsTaken,
      editsCount,
      inputTokens,
      outputTokens,
      durationMs,
      logs: logEntries,
      finalScore,
      totalIterations,
      status: agentStatus,
      videoUrl,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ projectId, error: errorMessage }, 'OpenHands agent failed');
    throw new Error(`OpenHands agent failed: ${errorMessage}`);
  } finally {
    // Remove from running processes
    runningProcesses.delete(jobId);

    // Unregister cancel handler
    unregisterCancelHandler(jobId);

    // Cleanup prompt file
    try {
      await rm(promptPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
