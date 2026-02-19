/**
 * Visual Generation Processor
 *
 * Uses Claude Code (Agent SDK) with OAuth authentication from Claude Pro/Max subscription.
 * No API key costs - included in subscription.
 */

import { Job, UnrecoverableError } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, writeFile, readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { db, projects, tracks, timelineItems, transcripts, jobs, visuals } from '../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError, registerCancelHandler, unregisterCancelHandler, setJobProjectId } from '../services/redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getWorkspacePath, createProjectDir } from '../workspace.js';
import { uploadFile } from '../services/minio.js';
import { buildStudioTemplateCatalog } from '../prompts/studio-templates.js';
import { listTemplates, getTemplateFiles } from '@viona/templates';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Track running processes for cancellation
const runningProcesses = new Map<string, ChildProcess>();

/**
 * Asset type for extracted components
 */
interface ExtractedAsset {
  id: string;
  name: string;
  type: 'component' | 'element' | 'text' | 'shape' | 'icon' | 'background';
  sceneId: number;
  sceneName: string;
  description: string;
  position?: { x: string; y: string };
  size?: { width: string; height: string };
}

/**
 * Extract assets from the generated composition.
 * Reads scenes.json and parses layout information to create a list of editable assets.
 */
async function extractAssets(projectDir: string): Promise<ExtractedAsset[]> {
  const assets: ExtractedAsset[] = [];

  try {
    // Read scenes.json
    const scenesPath = join(projectDir, 'scenes.json');
    const scenesContent = await readFile(scenesPath, 'utf-8');
    const scenesData = JSON.parse(scenesContent);

    if (!scenesData.scenes || !Array.isArray(scenesData.scenes)) {
      logger.warn({ projectDir }, 'No scenes found in scenes.json');
      return assets;
    }

    // Extract assets from each scene's layout
    for (const scene of scenesData.scenes) {
      const sceneId = scene.id;
      const sceneName = scene.name || `Scene ${sceneId}`;

      if (scene.layout && typeof scene.layout === 'object') {
        for (const [key, value] of Object.entries(scene.layout as Record<string, any>)) {
          // Skip background elements
          if (key === 'background') continue;

          // Determine asset type based on name
          let assetType: ExtractedAsset['type'] = 'element';
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('text') || lowerKey.includes('title') || lowerKey.includes('label')) {
            assetType = 'text';
          } else if (lowerKey.includes('icon')) {
            assetType = 'icon';
          } else if (lowerKey.includes('shape') || lowerKey.includes('circle') || lowerKey.includes('rect')) {
            assetType = 'shape';
          } else if (lowerKey.includes('particle') || lowerKey.includes('bg')) {
            assetType = 'background';
          }

          assets.push({
            id: `scene${sceneId}-${key}`,
            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
            type: assetType,
            sceneId,
            sceneName,
            description: scene.visual || sceneName,
            position: value?.x || value?.y ? { x: value.x || 'center', y: value.y || '50%' } : undefined,
            size: value?.width || value?.height ? { width: value.width || 'auto', height: value.height || 'auto' } : undefined,
          });
        }
      }

      // Also check for icons array
      if (scene.icons && Array.isArray(scene.icons)) {
        for (const icon of scene.icons) {
          assets.push({
            id: `scene${sceneId}-icon-${icon.name || icon}`,
            name: typeof icon === 'string' ? icon : icon.name,
            type: 'icon',
            sceneId,
            sceneName,
            description: `Icon in ${sceneName}`,
          });
        }
      }
    }

    // Write assets.json to project directory
    const assetsPath = join(projectDir, 'assets.json');
    await writeFile(assetsPath, JSON.stringify({ assets, extractedAt: new Date().toISOString() }, null, 2));
    logger.info({ projectDir, assetCount: assets.length }, 'Extracted assets from composition');

  } catch (error) {
    logger.warn({ projectDir, error }, 'Failed to extract assets from composition');
  }

  return assets;
}

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

/**
 * Upload bundle directory to S3 storage.
 * Uploads all files in the bundle directory to outputs/bundles/{compositionId}/
 */
async function uploadBundleToStorage(bundleDir: string, compositionId: string): Promise<void> {
  const files = await readdir(bundleDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      // Get relative path from bundle dir
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(bundleDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      // Upload to S3: outputs/bundles/{compositionId}/{relativePath}
      const s3Key = `bundles/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  logger.info({ compositionId, bundleDir }, 'Bundle uploaded to S3');
}

/**
 * Upload source project directory to S3 storage.
 * Uploads ALL source files to outputs/sources/{compositionId}/ including:
 * - SCENE_PLAN.md - Director's visual story plan
 * - IMPLEMENTATION_LOG.md - Implementation decisions and reasoning
 * - scenes.json - Scene definitions with timing
 * - metadata.json - Composition metadata
 * - index.tsx - Main composition code
 * - constants.ts - Colors, timing, spring configs
 * - components/*.tsx - Reusable components (Background, etc.)
 * - scenes/*.tsx - Individual scene components
 *
 * This preserves the full AI context so users can continue editing later.
 */
async function uploadSourceToStorage(projectDir: string, compositionId: string): Promise<string> {
  const files = await readdir(projectDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      // Get relative path from project dir
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(projectDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      // Upload to S3: outputs/sources/{compositionId}/{relativePath}
      const s3Key = `sources/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  const sourceUrl = `/api/sources/${compositionId}`;
  logger.info({ compositionId, projectDir, sourceUrl }, 'Source project files uploaded to S3');
  return sourceUrl;
}

export type VisualsLayoutMode = 'pip' | 'split-horizontal' | 'split-vertical';

export interface VisualsDimensions {
  width: number;
  height: number;
}

export interface GenerateVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio';
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
  /** User-provided style/layout guidance for the Director agent */
  styleGuide?: string;
  /** Enable verbose logging for debugging */
  verbose?: boolean;
  /** If set, skip Director phase and run Animator only using plan from this job */
  planJobId?: string;
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
    displayMode?: 'pip' | 'fullscreen' | 'overlay';
    transition?: {
      enter: { type: string; durationMs: number };
      exit: { type: string; durationMs: number };
    };
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
  const { projectId, jobId, stylePreset, layoutMode, dimensions, styleGuide } = job.data;
  setJobProjectId(jobId, projectId);
  const compositionId = `proj_${projectId.replace(/-/g, '_')}`;

  // Proactive lock extension — prevents BullMQ from marking 30-min jobs as stalled
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

    // Clean current project directory so Animator starts fresh (no stale scene files)
    const projectDir = join(workspacePath, 'src', compositionId);
    try {
      await rm(projectDir, { recursive: true, force: true });
      logger.info({ projectDir }, 'Cleaned stale project directory');
    } catch {
      // Directory may not exist yet — that's fine
    }
    createProjectDir(compositionId);
    logger.info({ projectDir, compositionId }, 'Created fresh project directory');

    // If this is an Animator-only run (plan was created separately), write plan files to project dir
    if (job.data.planJobId) {
      const planJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.data.planJobId) });
      if (planJob?.planData) {
        const pd = planJob.planData as { scenePlan: string; scenes: Record<string, unknown> };
        const scenePlanPath = join(projectDir, 'SCENE_PLAN.md');
        const scenesJsonPath = join(projectDir, 'scenes.json');
        await writeFile(scenePlanPath, pd.scenePlan, 'utf-8');
        await writeFile(scenesJsonPath, JSON.stringify(pd.scenes, null, 2), 'utf-8');
        logger.info({ projectDir, planJobId: job.data.planJobId }, 'Wrote plan files from plan job for Animator-only run');
      } else {
        logger.warn({ planJobId: job.data.planJobId }, 'Plan job not found or has no planData');
      }
    }

    // Update workspace Root.tsx and index.ts to import from the correct project ID.
    // This prevents TypeScript import errors and eliminates the self-healing cycle.
    const compositionIdDashed = compositionId.replace(/_/g, '-'); // e.g. proj-abc-def
    const rootTsx = join(workspacePath, 'src', 'Root.tsx');
    const indexTs = join(workspacePath, 'src', 'index.ts');
    try {
      const durationFrames = Math.ceil(((project.durationMs || 60000) / 1000) * (project.fps || 30));
      await writeFile(rootTsx, `import "./index.css";
import { Composition } from "remotion";
import MainComposition from "./${compositionId}";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="${compositionIdDashed}"
        component={MainComposition}
        durationInFrames={${durationFrames}}
        fps={${project.fps || 30}}
        width={${dimensions?.width || 1080}}
        height={${dimensions?.height || 1920}}
      />
    </>
  );
};
`, 'utf-8');
      await writeFile(indexTs, `import { registerRoot } from "remotion";
import { RemotionRoot } from "./${compositionId}/index";

registerRoot(RemotionRoot);
`, 'utf-8');
      logger.info({ compositionId }, 'Updated Root.tsx and index.ts with correct project imports');
    } catch (e) {
      logger.warn({ error: e }, 'Failed to update Root.tsx/index.ts — self-heal will fix it');
    }

    // Write Studio template catalog + source files to workspace when studio style is selected
    if (stylePreset === 'studio') {
      await publishJobProgress(jobId, 13, 'Loading studio templates...');
      try {
        const srcDir = join(workspacePath, 'src');
        const templatesDir = join(srcDir, '.templates');
        await mkdir(templatesDir, { recursive: true });

        // Write template catalog markdown
        const catalog = buildStudioTemplateCatalog();
        await writeFile(join(srcDir, 'STUDIO_TEMPLATES.md'), catalog, 'utf-8');

        // Copy template source files so the Animator agent can read them
        const studioTemplates = listTemplates({ theme: 'studio' });
        for (const t of studioTemplates) {
          const tDir = join(templatesDir, t.meta.slug);
          await mkdir(tDir, { recursive: true });
          try {
            const files = await getTemplateFiles(t.meta.slug);
            for (const f of files) {
              const filePath = join(tDir, f.path);
              // Ensure subdirectories exist (e.g., components/, lib/)
              await mkdir(dirname(filePath), { recursive: true });
              await writeFile(filePath, f.content, 'utf-8');
            }
          } catch (err) {
            logger.warn({ slug: t.meta.slug, err }, 'Failed to copy template files');
          }
        }

        logger.info({ templateCount: studioTemplates.length, templatesDir }, 'Studio templates written to workspace');
      } catch (err) {
        logger.warn({ err }, 'Failed to write studio templates to workspace (non-fatal)');
      }
    }

    await publishJobProgress(jobId, 15, 'Starting Claude Code generator...');

    // Calculate duration in frames
    const durationFrames = Math.ceil(((project.durationMs || 60000) / 1000) * (project.fps || 30));

    // Prepare transcript text and words
    const words = transcript.words as any[];
    const transcriptText = words
      .map((w: any) => w.word || w.text || '')
      .join(' ');

    // Run Claude Agent generator (always uses two-phase pipeline)
    const llmModel = config.claudeAgent.model;
    const claudeResult = await runClaudeCodeGenerator({
      projectId: compositionId,
      jobId,
      transcript: transcriptText,
      words,  // Always pass words for two-phase pipeline
      durationFrames,
      fps: project.fps || 30,
      width: dimensions?.width || 1080,
      height: dimensions?.height || 1920,
      stylePreset: stylePreset || 'modern',
      layoutMode: layoutMode || 'pip',
      styleGuide,
      planJobId: job.data.planJobId,
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
    const scenesPath = join(projectDir, 'scenes.json');
    let metadata: VisualMetadata;

    try {
      const metadataContent = await readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);

      if (!metadata.compositionId || typeof metadata.durationInFrames !== 'number') {
        throw new Error('Invalid metadata.json: missing required fields');
      }

      // Try to read scenes.json for detailed scene information
      try {
        const scenesContent = await readFile(scenesPath, 'utf-8');
        const scenesData = JSON.parse(scenesContent);

        if (scenesData.scenes && Array.isArray(scenesData.scenes) && scenesData.scenes.length > 0) {
          // Convert scenes.json format to timestamps format for the database
          metadata.visuals = scenesData.scenes.map((scene: any) => {
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
              displayMode: scene.displayMode || undefined,
              transition: scene.transition || undefined,
              elements: elements.length > 0 ? elements : undefined,
            };
          });
          logger.info({ projectId, sceneCount: metadata.visuals.length }, 'Loaded scenes from scenes.json');
        }
      } catch (scenesErr) {
        logger.warn({ projectId, error: scenesErr }, 'Could not read scenes.json, falling back to metadata.visuals');
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

    // Upload bundle to S3 for production persistence
    await publishJobProgress(jobId, 82, 'Uploading bundle to storage...');
    await uploadBundleToStorage(bundleDir, bundleCompositionId);

    // Upload source project files to S3 for AI context restoration
    await publishJobProgress(jobId, 83, 'Uploading source files to storage...');
    const sourceUrl = await uploadSourceToStorage(projectDir, bundleCompositionId);

    // Extract assets from composition for frontend selection
    await publishJobProgress(jobId, 84, 'Extracting assets...');
    const extractedAssets = await extractAssets(projectDir);

    // Upload assets.json to S3 as well
    const assetsPath = join(projectDir, 'assets.json');
    try {
      await uploadFile(assetsPath, 'sources', `${bundleCompositionId}/assets.json`);
      logger.info({ projectId, assetCount: extractedAssets.length }, 'Assets uploaded to storage');
    } catch (err) {
      logger.warn({ projectId, error: err }, 'Failed to upload assets.json');
    }

    // Bundle URL points to API route that serves from S3
    const bundleUrl = `/api/bundles/${bundleCompositionId}/index.html`;

    await publishJobProgress(jobId, 85, 'Registering visual...');

    // Wrap DB completion in a transaction — ensures frontend is never notified
    // before DB is consistent.
    await db.transaction(async (tx) => {
      // Clean up old visuals for this project
      const existingVisuals = await tx.select().from(visuals).where(eq(visuals.projectId, projectId));
      if (existingVisuals.length > 0) {
        logger.info({ projectId, count: existingVisuals.length }, 'Cleaning up existing visuals');

        for (const oldVisual of existingVisuals) {
          const allItems = await tx.select().from(timelineItems);
          for (const item of allItems) {
            if (item.type === 'visual' && (item.data as any)?.visualId === oldVisual.id) {
              await tx.delete(timelineItems).where(eq(timelineItems.id, item.id));
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

        await tx.delete(visuals).where(eq(visuals.projectId, projectId));
      }

      // Insert into visuals table
      const [insertedVisual] = await tx.insert(visuals).values({
        projectId,
        compositionId: metadata.compositionId,
        bundleUrl,
        sourceUrl, // Source project files for AI context restoration
        durationFrames: metadata.durationInFrames,
        fps: metadata.fps,
        width: metadata.width,
        height: metadata.height,
        stylePreset,
        llmModel,
        timestamps: metadata.visuals,
      }).returning({ id: visuals.id });
      const visualId = insertedVisual.id;

      // Find or create visuals track
      const existingTracks = await tx.select().from(tracks).where(eq(tracks.projectId, projectId));
      let visualsTrack = existingTracks.find(t => t.type === 'visual');

      if (!visualsTrack) {
        const [newTrack] = await tx.insert(tracks).values({
          projectId,
          type: 'visual',
          name: 'Visuals',
          position: existingTracks.length,
        }).returning();
        visualsTrack = newTrack;
      }

      // Create one timeline item per scene so they appear as separate blocks on the track
      for (const scene of metadata.visuals) {
        await tx.insert(timelineItems).values({
          trackId: visualsTrack.id,
          type: 'visual',
          startMs: scene.startMs,
          endMs: scene.endMs,
          data: {
            visualId,
            compositionId: metadata.compositionId,
            bundleUrl,
            type: scene.type || 'visual',
            description: scene.description || 'AI-generated visual',
            width: metadata.width,
            height: metadata.height,
            fps: metadata.fps,
            displayMode: scene.displayMode || 'pip',
            transition: scene.transition || undefined,
          },
        });
      }

      // Update job and project status
      await tx.update(jobs)
        .set({
          status: 'complete',
          progress: 100,
          completedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      // Persist layoutMode into project videoSettings so the editor/export
      // uses the same layout the user selected at generation time.
      const existingVideoSettings = (project.videoSettings as Record<string, unknown>) || {};
      const existingLayoutSettings = (existingVideoSettings.layoutSettings as Record<string, unknown>) || {};
      await tx.update(projects)
        .set({
          status: 'ready',
          outputKey: null,
          updatedAt: new Date(),
          videoSettings: {
            ...existingVideoSettings,
            layoutSettings: {
              ...existingLayoutSettings,
              mode: layoutMode,
            },
          },
        })
        .where(eq(projects.id, projectId));
    });

    // Only AFTER transaction succeeds — notify frontend
    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId, compositionId, model: llmModel }, 'Visual generation complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Visual generation failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.transaction(async (tx) => {
      await tx.update(jobs)
        .set({ status: 'failed', error: errorMessage })
        .where(eq(jobs.id, jobId));

      await tx.update(projects)
        .set({ status: 'failed' })
        .where(eq(projects.id, projectId));
    });

    await publishJobError(jobId, errorMessage);

    throw error;
  } finally {
    clearInterval(lockExtender);
  }
}


// =============================================================================
// Claude Code Visual Generator
// =============================================================================

interface ClaudeCodeOptions {
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
  /** If set, run only the Animator phase (plan already exists in project dir) */
  planJobId?: string;
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
  const { projectId, jobId, transcript, words, durationFrames, fps, width, height, stylePreset, layoutMode, styleGuide, planJobId } = options;

  const pythonPath = config.pythonPath;
  const agentScript = join(__dirname, '..', 'agents', 'claude_visual_generator.py');
  const workspacePath = getWorkspacePath();
  const bundleOutputDir = config.remotion.bundleOutputDir;

  logger.info({
    projectId,
    jobId,
    workspacePath,
    model: config.claudeAgent.model,
  }, 'Starting Claude Agent visual generator...');

  const startTime = Date.now();

  // Write transcript to temp file
  const transcriptPath = join(tmpdir(), `claude-transcript-${jobId}.txt`);
  await writeFile(transcriptPath, transcript, 'utf-8');

  // Write words JSON if available (for two-phase pipeline)
  let wordsPath: string | null = null;
  if (words && words.length > 0) {
    wordsPath = join(tmpdir(), `claude-words-${jobId}.json`);
    await writeFile(wordsPath, JSON.stringify(words), 'utf-8');
  }

  // Write style guide to temp file if provided
  let styleGuidePath: string | null = null;
  if (styleGuide && styleGuide.trim()) {
    styleGuidePath = join(tmpdir(), `claude-styleguide-${jobId}.txt`);
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
    ];

    // Add words JSON path if available (required for two-phase pipeline)
    if (wordsPath) {
      args.push('--words-json', wordsPath);
    }

    // Add style guide path if provided
    if (styleGuidePath) {
      args.push('--style-guide', styleGuidePath);
    }

    // If planJobId is set, skip Director and run Animator only
    if (planJobId) {
      args.push('--phase', 'animator');
      logger.info({ projectId, planJobId }, 'Using Animator-only mode (plan provided from plan job)');
    } else {
      // Two-phase pipeline is always used
      logger.info({ projectId }, 'Using two-phase pipeline (Director + Animator)');
    }

    const subprocess = spawn(pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Ensure Python uses UTF-8 encoding
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
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
    let gotRealProgress = false;
    let lastToolPercent = 18;

    // Initial ticker for the startup phase (before any tool calls appear)
    const STARTUP_MESSAGES = [
      [18, 'Starting Claude Code generator...'],
      [21, 'Connecting to Claude...'],
      [24, 'Authenticating...'],
      [27, 'Reading approved plan...'],
    ] as const;
    let startupIndex = 0;

    const progressTicker = setInterval(() => {
      if (gotRealProgress || startupIndex >= STARTUP_MESSAGES.length) return;
      const [percent, message] = STARTUP_MESSAGES[startupIndex];
      publishJobProgress(jobId, percent, message);
      lastToolPercent = percent;
      startupIndex++;
    }, 5_000);

    // Map Animator tool calls to user-friendly progress messages
    function toolToProgress(toolName: string, textContext: string): string | null {
      // Check for scene mentions in surrounding text
      const sceneMatch = textContext.match(/Scene\s*(\d+)/i);
      const sceneInfo = sceneMatch ? ` (Scene ${sceneMatch[1]})` : '';

      switch (toolName) {
        case 'Write': return `Writing animation code${sceneInfo}...`;
        case 'Edit': return `Refining code${sceneInfo}...`;
        case 'Read': return `Reading files${sceneInfo}...`;
        case 'Glob': return 'Scanning project files...';
        case 'Bash': return 'Running validation...';
        case 'TodoWrite': return 'Updating task list...';
        default: return null;
      }
    }

    subprocess.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stdout += text;

      const lines = text.split('\n');
      for (const line of lines) {
        // Parse explicit PROGRESS:XX:message from Python script
        const progressMatch = line.match(/^PROGRESS:(\d+):(.+)$/);
        if (progressMatch) {
          gotRealProgress = true;
          const percent = parseInt(progressMatch[1], 10);
          const message = progressMatch[2];
          publishJobProgress(jobId, percent, message);
          lastToolPercent = percent;
          logger.info({ projectId, percent, message }, 'Claude generator progress');
          continue;
        }

        // Parse [Animator Tool: X] or [SelfHeal Tool: X] for live progress
        const toolMatch = line.match(/\[(Animator|SelfHeal) Tool: (\w+)\]/);
        if (toolMatch && !gotRealProgress) {
          const toolName = toolMatch[2];
          const progressMsg = toolToProgress(toolName, stdout.slice(-500));
          if (progressMsg) {
            // Slowly increment from 30% to 55% based on tool calls
            lastToolPercent = Math.min(55, lastToolPercent + 1);
            publishJobProgress(jobId, lastToolPercent, progressMsg);
          }
          continue;
        }

        // Parse scene completion text for higher-fidelity updates
        const sceneDone = line.match(/(?:Scene|Scenes?)\s+([\d,-]+)\s+(?:is|are)\s+(?:also\s+)?(?:done|complete|implemented)/i);
        if (sceneDone && !gotRealProgress) {
          lastToolPercent = Math.min(55, lastToolPercent + 2);
          publishJobProgress(jobId, lastToolPercent, `Completed scene${sceneDone[1].includes(',') || sceneDone[1].includes('-') ? 's' : ''} ${sceneDone[1]}...`);
          continue;
        }

        // Parse self-heal phase
        if (line.includes('self-healing attempt') || line.includes('Self-heal')) {
          publishJobProgress(jobId, Math.max(lastToolPercent, 56), 'Fixing validation errors...');
        }

        // Parse "GENERATION COMPLETE"
        if (line.includes('GENERATION COMPLETE')) {
          publishJobProgress(jobId, 58, 'Animation code complete — validating...');
        }
      }

      logger.info({ projectId, output: text.slice(0, 500) }, 'Claude generator stdout');
    });

    subprocess.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stderr += text;
      logger.error({ projectId, stderr: text.slice(0, 1000) }, 'Claude generator stderr');
    });

    // Wait for completion with timeout
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
        reject(new Error(`Claude Agent generator timed out after ${config.claudeAgent.timeoutSeconds} seconds`));
      }, config.claudeAgent.timeoutSeconds * 1000);

      subprocess.on('close', (code) => {
        clearTimeout(timeoutId);
        clearInterval(progressTicker);
        runningProcesses.delete(jobId);
        unregisterCancelHandler(jobId);
        if (code === 0) {
          resolve();
        } else {
          // Include both stderr and last part of stdout for debugging
          const errorOutput = stderr || stdout.slice(-1000);
          // Non-zero exit = bad input/prompt, don't retry
          reject(new UnrecoverableError(`Claude Code generator exited with code ${code}: ${errorOutput}`));
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

    // Parse result from stdout
    let result: any;
    try {
      // Find JSON object at the end of output - look for the final result JSON
      // The Python script outputs: {"success": true, "bundleUrl": ..., "bundlePath": ...}
      // We need to find this specific JSON, not any random {} in logs

      // Method 1: Look for standalone { on a line (start of JSON object)
      const lines = stdout.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        // Look for a line that is just "{" or starts with '{"'
        if (line === '{' || line.startsWith('{"')) {
          // Collect lines until braces balance
          let jsonStr = '';
          let braceCount = 0;
          for (let j = i; j < lines.length; j++) {
            jsonStr += lines[j] + '\n';
            braceCount += (lines[j].match(/\{/g) || []).length;
            braceCount -= (lines[j].match(/\}/g) || []).length;
            if (braceCount === 0 && jsonStr.trim().length > 2) {
              break;
            }
          }
          try {
            const parsed = JSON.parse(jsonStr.trim());
            // Verify it's our expected result object
            if (parsed.success !== undefined && parsed.bundleUrl) {
              result = parsed;
              break;
            }
          } catch {
            // Not valid JSON, continue searching backwards
          }
        }
      }

      // Method 2: Fallback - look for JSON block in the last portion of output
      if (!result) {
        // Find the last occurrence of '{\n  "success"' pattern
        const lastJsonStart = stdout.lastIndexOf('{\n  "success"');
        if (lastJsonStart !== -1) {
          // Find the matching closing brace
          let braceCount = 0;
          let endIndex = lastJsonStart;
          for (let i = lastJsonStart; i < stdout.length; i++) {
            if (stdout[i] === '{') braceCount++;
            if (stdout[i] === '}') braceCount--;
            if (braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
          const jsonStr = stdout.slice(lastJsonStart, endIndex);
          try {
            result = JSON.parse(jsonStr);
          } catch {
            // Still failed
          }
        }
      }
    } catch (e) {
      logger.error({ projectId, error: e, stdoutTail: stdout.slice(-2000) }, 'Failed to parse Claude generator JSON output');
    }

    if (!result || !result.success) {
      logger.error({
        projectId,
        result,
        stdoutLength: stdout.length,
        stdoutTail: stdout.slice(-1000)
      }, 'Claude Code generator did not produce valid output');
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
