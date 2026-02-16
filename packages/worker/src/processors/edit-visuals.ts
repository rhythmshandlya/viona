/**
 * Edit Visuals Processor
 *
 * Allows users to continue editing existing compositions by:
 * 1. Restoring source files from MinIO to workspace
 * 2. Running Claude with existing context + user's edit request
 * 3. Re-bundling the updated composition
 * 4. Uploading the new bundle and sources back to MinIO
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { readFile, readdir, stat, writeFile as writeFileAsync } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { spawn, ChildProcess, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { db, projects, jobs, visuals } from '../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { downloadSourceFromStorage, uploadFile, listObjects } from '../services/minio.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getWorkspacePath, createProjectDir } from '../workspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Extract assets from the composition.
 * Reads scenes.json and parses layout information to create a list of editable assets.
 */
async function extractAssets(projectDir: string): Promise<ExtractedAsset[]> {
  const assets: ExtractedAsset[] = [];
  const { writeFile } = await import('fs/promises');

  try {
    const scenesPath = join(projectDir, 'scenes.json');
    const scenesContent = await readFile(scenesPath, 'utf-8');
    const scenesData = JSON.parse(scenesContent);

    if (!scenesData.scenes || !Array.isArray(scenesData.scenes)) {
      return assets;
    }

    for (const scene of scenesData.scenes) {
      const sceneId = scene.id;
      const sceneName = scene.name || `Scene ${sceneId}`;

      if (scene.layout && typeof scene.layout === 'object') {
        for (const [key, value] of Object.entries(scene.layout as Record<string, any>)) {
          if (key === 'background') continue;

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
    }

    const assetsPath = join(projectDir, 'assets.json');
    await writeFile(assetsPath, JSON.stringify({ assets, extractedAt: new Date().toISOString() }, null, 2));
    logger.info({ projectDir, assetCount: assets.length }, 'Extracted assets from composition');

  } catch (error) {
    logger.warn({ projectDir, error }, 'Failed to extract assets');
  }

  return assets;
}

export interface EditVisualsJobData {
  projectId: string;
  jobId: string;
  compositionId: string;
  prompt: string;
  sceneId?: number;       // Optional: target a specific scene (1-indexed)
  elementName?: string;   // Optional: target a specific element within the scene
  transcript?: string;    // Full transcript text with timestamps for context
  scenePlan?: string;     // JSON scene plan so the agent understands the visual structure
}

/**
 * Upload bundle directory to S3 storage.
 */
async function uploadBundleToStorage(bundleDir: string, compositionId: string): Promise<void> {
  const files = await readdir(bundleDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(bundleDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      const s3Key = `bundles/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  logger.info({ compositionId, bundleDir }, 'Bundle uploaded to S3');
}

/**
 * Upload source project directory to S3 storage.
 */
async function uploadSourceToStorage(projectDir: string, compositionId: string): Promise<string> {
  const files = await readdir(projectDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(projectDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      const s3Key = `sources/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  const sourceUrl = `/api/sources/${compositionId}`;
  logger.info({ compositionId, projectDir, sourceUrl }, 'Source project files uploaded to S3');
  return sourceUrl;
}

/**
 * Compile composition source to CommonJS for dynamic frontend loading.
 * The frontend's DynamicVisualLoader expects a composition.cjs.js file.
 */
async function compileCjs(projectDir: string, bundleDir: string): Promise<void> {
  const indexTsx = join(projectDir, 'index.tsx');
  const cjsOutput = join(bundleDir, 'composition.cjs.js');
  const workspacePath = getWorkspacePath();

  logger.info({ indexTsx, cjsOutput }, 'Compiling composition to CJS');

  try {
    // Use CommonJS format for Node.js require() compatibility in render.ts
    // The DynamicVisualLoader provides a custom require() shim for browser preview
    // For SSR rendering, we need proper CJS that Node.js can load
    execSync([
      'npx', 'esbuild',
      indexTsx,
      '--bundle',
      '--format=cjs',
      '--platform=node',  // Node platform for SSR rendering
      '--target=es2020',
      '--external:react',
      '--external:react/jsx-runtime',
      '--external:react/jsx-dev-runtime',
      '--external:remotion',
      '--external:@remotion/noise',
      '--external:@remotion/shapes',
      '--external:@remotion/paths',
      '--external:@remotion/three',
      `--outfile=${cjsOutput}`,
    ].join(' '), {
      cwd: workspacePath,
      timeout: 60000,
      encoding: 'utf-8',
    });
    logger.info({ cjsOutput }, 'CJS compilation complete');
  } catch (error) {
    logger.error({ error }, 'CJS compilation failed');
    throw new Error(`Failed to compile composition to CJS: ${error}`);
  }
}

/**
 * Auto-fix common Remotion issues in all .tsx files within a project directory.
 * Fixes descending interpolate ranges that crash the Remotion player.
 */
async function autoFixProjectFiles(projectDir: string): Promise<void> {
  const entries = await readdir(projectDir, { recursive: true, withFileTypes: true });
  let fixedCount = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    const parentPath = (entry as any).parentPath ?? (entry as any).path ?? projectDir;
    const filePath = join(parentPath, entry.name);

    let content = await readFile(filePath, 'utf-8');
    const original = content;

    // Fix descending interpolate ranges by reversing both input and output
    content = content.replace(
      /interpolate\s*\(\s*([^,]+),\s*\[([^\]]+)\],\s*\[([^\]]+)\]/g,
      (match, input, inputRange, outputRange) => {
        const inputParts = inputRange.split(',').map((n: string) => n.trim());
        const outputParts = outputRange.split(',').map((n: string) => n.trim());
        const inputNums = inputParts.map((n: string) => parseFloat(n)).filter((n: number) => !isNaN(n));

        let isDescending = false;
        for (let i = 1; i < inputNums.length; i++) {
          if (inputNums[i] < inputNums[i - 1]) {
            isDescending = true;
            break;
          }
        }

        if (isDescending && inputNums.length === inputParts.length) {
          const fixedInputRange = [...inputParts].reverse().join(', ');
          const fixedOutputRange = [...outputParts].reverse().join(', ');
          return `interpolate(${input}, [${fixedInputRange}], [${fixedOutputRange}]`;
        }
        return match;
      }
    );

    if (content !== original) {
      await writeFileAsync(filePath, content);
      fixedCount++;
      logger.info({ filePath }, 'Auto-fixed descending interpolate ranges');
    }
  }

  if (fixedCount > 0) {
    logger.info({ projectDir, fixedCount }, 'Auto-fixed files with descending interpolate ranges');
  }
}

export async function processEditVisualsJob(job: Job<EditVisualsJobData>) {
  const { projectId, jobId, compositionId, prompt, sceneId, elementName, transcript, scenePlan } = job.data;

  // Convert compositionId format: proj-xxx-xxx -> proj_xxx_xxx for workspace
  const workspaceCompositionId = compositionId.replace(/-/g, '_');

  try {
    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading project...');

    // Load project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Load existing visual
    const visual = await db.query.visuals.findFirst({
      where: eq(visuals.projectId, projectId),
    });

    if (!visual) {
      throw new Error('No existing visuals found');
    }

    // Create project directory in workspace
    const workspacePath = getWorkspacePath();
    const projectDir = createProjectDir(workspaceCompositionId);

    // Check if source files already exist in workspace (skip download if present)
    const indexPath = join(projectDir, 'index.tsx');
    const scenesPath = join(projectDir, 'scenes.json');
    let downloadedFiles: string[] = [];

    if (existsSync(indexPath) && existsSync(scenesPath)) {
      // Files already exist - just list them instead of downloading
      logger.info({ projectId, compositionId }, 'Source files already in workspace, skipping download');
      // Skip past the restore phase (20+) so frontend shows "AI analyzing" immediately
      await publishJobProgress(jobId, 20, 'Source files ready, analyzing...');

      // List existing files in projectDir
      const listFilesRecursive = async (dir: string, base: string = ''): Promise<string[]> => {
        const entries = await readdir(dir, { withFileTypes: true });
        const files: string[] = [];
        for (const entry of entries) {
          const relativePath = base ? `${base}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            files.push(...await listFilesRecursive(join(dir, entry.name), relativePath));
          } else {
            files.push(relativePath);
          }
        }
        return files;
      };
      downloadedFiles = await listFilesRecursive(projectDir);
    } else {
      // Download source files from MinIO to workspace
      await publishJobProgress(jobId, 10, 'Restoring source files from storage...');
      // Sources are stored with dashes (proj-xxx-xxx), ensure we use that format
      const sourceCompositionId = compositionId.replace(/_/g, '-');
      downloadedFiles = await downloadSourceFromStorage(sourceCompositionId, projectDir);
      logger.info({ projectId, compositionId, fileCount: downloadedFiles.length }, 'Source files restored');
    }

    await publishJobProgress(jobId, 22, 'AI is editing your visuals...');

    // Run Claude to edit the composition
    const editResult = await runClaudeEditor({
      projectId: workspaceCompositionId,
      jobId,
      projectDir,
      prompt,
      existingFiles: downloadedFiles,
      targetSceneId: sceneId,
      targetElementName: elementName,
      transcript,
      scenePlan,
    });

    await publishJobProgress(jobId, 70, 'Reading updated metadata...');

    // Read updated metadata
    const metadataPath = join(projectDir, 'metadata.json');
    let metadata;
    try {
      const metadataContent = await readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);
    } catch {
      // Use existing metadata if not updated
      metadata = {
        compositionId: workspaceCompositionId,
        durationInFrames: visual.durationFrames,
        fps: visual.fps,
        width: visual.width,
        height: visual.height,
      };
    }

    // Auto-fix common issues in edited source files (descending interpolate ranges, etc.)
    await publishJobProgress(jobId, 73, 'Auto-fixing common issues...');
    await autoFixProjectFiles(projectDir);

    await publishJobProgress(jobId, 75, 'Verifying bundle...');

    // Verify bundle exists
    const bundleDir = join(config.remotion.bundleOutputDir, compositionId);
    const bundleIndex = join(bundleDir, 'index.html');

    try {
      await readFile(bundleIndex);
      logger.info({ projectId, bundleDir }, 'Bundle verified');
    } catch {
      throw new Error(`Bundle not found at ${bundleDir}. Editor may have failed to create it.`);
    }

    // Compile composition to CJS for dynamic frontend loading
    await publishJobProgress(jobId, 78, 'Compiling for preview...');
    await compileCjs(projectDir, bundleDir);

    // Upload updated bundle to S3
    await publishJobProgress(jobId, 80, 'Uploading updated bundle...');
    await uploadBundleToStorage(bundleDir, compositionId);

    // Upload updated source files to S3
    await publishJobProgress(jobId, 85, 'Uploading updated sources...');
    const sourceUrl = await uploadSourceToStorage(projectDir, compositionId);

    // Extract and upload assets
    await publishJobProgress(jobId, 88, 'Extracting assets...');
    const extractedAssets = await extractAssets(projectDir);
    try {
      const assetsPath = join(projectDir, 'assets.json');
      await uploadFile(assetsPath, 'sources', `${compositionId}/assets.json`);
      logger.info({ projectId, assetCount: extractedAssets.length }, 'Assets uploaded');
    } catch (err) {
      logger.warn({ projectId, error: err }, 'Failed to upload assets.json');
    }

    await publishJobProgress(jobId, 90, 'Updating database...');

    // Try to read scenes.json for detailed scene information (scenesPath already defined above)
    let timestamps: any[] | undefined;
    try {
      const scenesContent = await readFile(scenesPath, 'utf-8');
      const scenesData = JSON.parse(scenesContent);

      if (scenesData.scenes && Array.isArray(scenesData.scenes) && scenesData.scenes.length > 0) {
        // Convert scenes.json format to timestamps format for the database
        const sceneTimestamps = scenesData.scenes.map((scene: any) => {
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
            elements: elements.length > 0 ? elements : undefined,
          };
        });
        timestamps = sceneTimestamps;
        logger.info({ projectId, sceneCount: sceneTimestamps.length }, 'Loaded scenes from scenes.json');
      }
    } catch (scenesErr) {
      logger.warn({ projectId, error: scenesErr }, 'Could not read scenes.json, timestamps unchanged');
    }

    // Update visuals record
    await db.update(visuals)
      .set({
        durationFrames: metadata.durationInFrames || visual.durationFrames,
        fps: metadata.fps || visual.fps,
        width: metadata.width || visual.width,
        height: metadata.height || visual.height,
        sourceUrl,
        ...(timestamps && { timestamps }),
      })
      .where(eq(visuals.id, visual.id));

    // Update job and project status
    await db.update(jobs)
      .set({
        status: 'complete',
        progress: 100,
        completedAt: new Date(),
        metrics: {
          durationMs: editResult.durationMs,
          filesWritten: editResult.filesEdited,
        },
      })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'ready', outputKey: null, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId, compositionId, prompt: prompt.slice(0, 50) }, 'Edit visuals complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Edit visuals failed');

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

interface ClaudeEditorOptions {
  projectId: string;
  jobId: string;
  projectDir: string;
  prompt: string;
  existingFiles: string[];
  targetSceneId?: number;
  targetElementName?: string;
  transcript?: string;          // Timestamped transcript of what the speaker says
  scenePlan?: string;           // JSON scene plan describing what each scene visualizes
}

interface ClaudeEditorResult {
  filesEdited: number;
  durationMs: number;
}

/**
 * Run Claude to edit the existing composition.
 *
 * Gives Claude full project context and lets it decide what to change.
 * No pre-filtering or edit mode detection — the model is smarter than keyword heuristics.
 */
async function runClaudeEditor(options: ClaudeEditorOptions): Promise<ClaudeEditorResult> {
  const { projectId, jobId, projectDir, prompt, existingFiles, targetSceneId, targetElementName, transcript, scenePlan } = options;

  const workspacePath = getWorkspacePath();
  const bundleOutputDir = config.remotion.bundleOutputDir;

  logger.info({
    projectId,
    jobId,
    prompt: prompt.slice(0, 100),
    existingFiles: existingFiles.length,
    targetSceneId,
    targetElementName,
    hasTranscript: !!transcript,
    hasScenePlan: !!scenePlan,
  }, 'Starting Claude editor...');

  const startTime = Date.now();

  // Read ALL source files to give Claude full context
  const allFileContents: string[] = [];
  for (const file of existingFiles) {
    try {
      const content = await readFile(join(projectDir, file), 'utf-8');
      allFileContents.push(`=== ${file} ===\n${content}`);
    } catch {
      logger.warn({ projectId, file }, 'Could not read file');
    }
  }

  // Build target scene context if a specific scene was selected
  let targetSceneContext = '';
  if (targetSceneId) {
    try {
      const scenesRaw = await readFile(join(projectDir, 'scenes.json'), 'utf-8');
      const parsed = JSON.parse(scenesRaw);
      const scene = (parsed.scenes || []).find((s: any) => s.id === targetSceneId);
      if (scene) {
        targetSceneContext = `
USER-SELECTED TARGET:
- Scene ${scene.id}: "${scene.name}"
- File: scenes/Scene${scene.id}.tsx
- Frames: ${scene.frames[0]} to ${scene.frames[1]}
- Timestamp: ${scene.timestampRange[0]}s to ${scene.timestampRange[1]}s
- Description: ${scene.visual || scene.description || 'N/A'}`;
      } else {
        targetSceneContext = `\nUSER-SELECTED TARGET: Scene ${targetSceneId} (file: scenes/Scene${targetSceneId}.tsx)`;
      }
    } catch {
      targetSceneContext = `\nUSER-SELECTED TARGET: Scene ${targetSceneId} (file: scenes/Scene${targetSceneId}.tsx)`;
    }
  }

  const elementContext = targetElementName
    ? `\nTARGET ELEMENT: "${targetElementName}" — The user wants changes focused on this specific element.`
    : '';

  // Build transcript section
  const transcriptSection = transcript
    ? `\nVIDEO TRANSCRIPT (what the speaker is saying at each timestamp):
${transcript}

Use this to understand the CONTENT of the video. Visuals should illustrate what's being said.
If the user refers to "the part about X" or "when I talk about Y", match it to the transcript above.`
    : '';

  // Build scene plan section
  const scenePlanSection = scenePlan
    ? `\nSCENE PLAN (what each scene is supposed to visualize):
${scenePlan}

Each scene has a time range, description, and purpose. Use this to understand the visual structure.`
    : '';

  logger.info({
    projectId,
    fileCount: allFileContents.length,
    hasTargetScene: !!targetSceneId,
    hasTargetElement: !!targetElementName,
    transcriptLength: transcript?.length || 0,
  }, 'Edit context prepared');

  const editPrompt = `
You are editing a Remotion composition for a talking-head explainer video. You have the full project source, the video transcript (what the speaker says), and the scene plan (what each scene visualizes). Use ALL of this context to make smart edits.

PROJECT DIRECTORY: ${projectDir}
${targetSceneContext}${elementContext}
${transcriptSection}
${scenePlanSection}

USER'S REQUEST:
"${prompt}"

FULL PROJECT SOURCE:
${allFileContents.join('\n\n')}

YOUR JOB:
You understand what the speaker is saying, what the visuals currently show, and what the user wants changed. Make edits that result in visuals that accurately illustrate the spoken content.

- Read the transcript to understand WHAT is being explained at each point in time.
- Read the scene plan to understand the INTENT of each visual.
- Read the code to understand the CURRENT implementation.
- Then make changes that serve the user's request while keeping visuals aligned with the narration.

TECHNICAL GUIDELINES:
- You decide what files to modify and how much to change — small tweak or full rewrite.
- Use existing COLORS and SPRING_CONFIG from constants.ts when they exist.
- Keep frame ranges and component export names unchanged unless the request requires it.
- Remotion best practices: useCurrentFrame(), spring() with damping >= 20, interpolate() with extrapolateRight: 'clamp'.
- Do NOT modify files that aren't relevant to the request.
- After making changes, run: npx remotion bundle src/${projectId}/index.tsx --out-dir ${bundleOutputDir}/${projectId.replace(/_/g, '-')}
`.trim();

  // Run Claude CLI in the workspace, passing prompt via stdin to avoid shell escaping issues
  // NOTE: Do NOT use --print flag - it prevents Claude from executing tools (file edits)
  const subprocess = spawn('claude', [
    '--dangerously-skip-permissions',
  ], {
    cwd: workspacePath,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    env: {
      ...process.env,
      ANTHROPIC_MODEL: config.claudeAgent.model,
    },
  });

  // Write prompt to stdin and close it
  subprocess.stdin?.write(editPrompt);
  subprocess.stdin?.end();

  let stdout = '';
  let stderr = '';

  // Progress ticker — publish periodic updates so the polling loop (and frontend)
  // know the job is still alive. Without this, the agent's stall detector would
  // fire because the Claude subprocess can run for several minutes silently.
  const EDIT_PROGRESS_MESSAGES = [
    'AI is analyzing your composition...',
    'AI is planning the changes...',
    'AI is editing your visuals...',
    'AI is writing code changes...',
    'AI is still working on edits...',
    'Almost there, AI is finalizing...',
  ];
  let tickerIndex = 0;
  // Slowly increment from 25% to 60% during Claude's run
  let tickerPercent = 25;
  const progressTicker = setInterval(() => {
    const message = EDIT_PROGRESS_MESSAGES[Math.min(tickerIndex, EDIT_PROGRESS_MESSAGES.length - 1)];
    tickerPercent = Math.min(60, tickerPercent + 2);
    publishJobProgress(jobId, tickerPercent, message);
    // Also update the DB so the polling loop sees fresh progress
    db.update(jobs).set({ progress: tickerPercent, progressMessage: message }).where(eq(jobs.id, jobId)).catch(() => {});
    tickerIndex++;
  }, 15_000); // Every 15 seconds

  subprocess.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf-8');
    stdout += text;
    logger.debug({ projectId, output: text.slice(0, 200) }, 'Claude editor output');
  });

  subprocess.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf-8');
    stderr += text;
    if (text.includes('error') || text.includes('Error')) {
      logger.warn({ projectId, stderr: text.slice(0, 500) }, 'Claude editor stderr');
    }
  });

  // Wait for completion with timeout
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      clearInterval(progressTicker);
      subprocess.kill('SIGTERM');
      reject(new Error(`Claude editor timed out after ${config.claudeAgent.timeoutSeconds} seconds`));
    }, config.claudeAgent.timeoutSeconds * 1000);

    subprocess.on('close', (code) => {
      clearTimeout(timeoutId);
      clearInterval(progressTicker);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Claude editor exited with code ${code}: ${stderr || stdout.slice(-500)}`));
      }
    });

    subprocess.on('error', (err) => {
      clearTimeout(timeoutId);
      clearInterval(progressTicker);
      reject(err);
    });
  });

  const durationMs = Date.now() - startTime;

  // Count files that were potentially edited (simple heuristic based on stdout)
  const filesEdited = (stdout.match(/wrote|updated|modified|edited/gi) || []).length || 1;

  logger.info({
    projectId,
    durationMs,
    filesEdited,
  }, 'Claude editor completed');

  return {
    filesEdited,
    durationMs,
  };
}
