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
import { readFile, readdir, stat } from 'fs/promises';
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
  sceneId?: number;  // Optional: target a specific scene (1-indexed)
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

export async function processEditVisualsJob(job: Job<EditVisualsJobData>) {
  const { projectId, jobId, compositionId, prompt, sceneId } = job.data;

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
      await publishJobProgress(jobId, 10, 'Using cached source files...');

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
      await publishJobProgress(jobId, 10, 'Restoring source files...');
      // Sources are stored with dashes (proj-xxx-xxx), ensure we use that format
      const sourceCompositionId = compositionId.replace(/_/g, '-');
      downloadedFiles = await downloadSourceFromStorage(sourceCompositionId, projectDir);
      logger.info({ projectId, compositionId, fileCount: downloadedFiles.length }, 'Source files restored');
    }

    await publishJobProgress(jobId, 15, 'Analyzing which scene to edit...');

    // Run Claude to edit the composition (includes scene detection)
    const editResult = await runClaudeEditor({
      projectId: workspaceCompositionId,
      jobId,
      projectDir,
      prompt,
      existingFiles: downloadedFiles,
      targetSceneId: sceneId,  // Pass user-selected scene ID
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
      .set({ status: 'ready', updatedAt: new Date() })
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
  targetSceneId?: number;  // Optional user-selected scene ID (1-indexed)
}

interface ClaudeEditorResult {
  filesEdited: number;
  durationMs: number;
}

interface SceneInfo {
  id: number;
  name: string;
  file: string;
  description: string;
  frames: [number, number];
  timestampRange: [number, number];
}

type EditMode = 'simple' | 'regenerate';

/**
 * Determine if the edit request requires a full scene regeneration
 * or just a simple surgical edit.
 */
function detectEditMode(prompt: string): EditMode {
  const promptLower = prompt.toLowerCase();

  // Keywords that suggest a simple edit (just change values)
  const simpleKeywords = [
    'bigger', 'smaller', 'larger', 'size',
    'faster', 'slower', 'speed',
    'color', 'colour', 'change to', 'make it',
    'more', 'less', 'increase', 'decrease',
    'brighter', 'darker', 'opacity', 'transparent',
    'move', 'position', 'left', 'right', 'up', 'down',
    'scale', 'rotate', 'angle',
  ];

  // Keywords that suggest regeneration (structural changes)
  const regenerateKeywords = [
    'add a', 'add an', 'add new', 'create a', 'create new',
    'remove', 'delete', 'get rid of',
    'replace with', 'change to a', 'turn into',
    'completely', 'redesign', 'redo', 'regenerate',
    'different style', 'new animation', 'new effect',
    'instead of', 'swap', 'switch to',
  ];

  // Check for regeneration keywords first (they take priority)
  for (const keyword of regenerateKeywords) {
    if (promptLower.includes(keyword)) {
      return 'regenerate';
    }
  }

  // Check for simple edit keywords
  for (const keyword of simpleKeywords) {
    if (promptLower.includes(keyword)) {
      return 'simple';
    }
  }

  // Default to simple edit for short prompts, regenerate for complex ones
  return prompt.split(' ').length > 15 ? 'regenerate' : 'simple';
}

/**
 * Phase 1: Analyze the user's request to identify which scene(s) need changes.
 * This is a fast operation that reads scenes.json and determines the target.
 */
async function detectTargetScenes(
  projectDir: string,
  prompt: string,
  existingFiles: string[]
): Promise<{ targetScenes: SceneInfo[]; targetFiles: string[]; analysisReason: string }> {
  // Read scenes.json to understand scene structure
  let scenes: any[] = [];
  let scenesJson = '';
  try {
    scenesJson = await readFile(join(projectDir, 'scenes.json'), 'utf-8');
    const parsed = JSON.parse(scenesJson);
    scenes = parsed.scenes || [];
  } catch {
    // No scenes.json - return all scene files
    const sceneFiles = existingFiles.filter(f => f.startsWith('scenes/'));
    return {
      targetScenes: [],
      targetFiles: sceneFiles.length > 0 ? sceneFiles : existingFiles,
      analysisReason: 'No scenes.json found, targeting all files',
    };
  }

  // Build scene info with file mappings
  const sceneInfos: SceneInfo[] = scenes.map((s: any) => ({
    id: s.id,
    name: s.name,
    file: `scenes/Scene${s.id}.tsx`,
    description: s.visual || s.description || '',
    frames: s.frames || [0, 0],
    timestampRange: s.timestampRange || [0, 0],
  }));

  // Quick keyword matching for common edit patterns
  const promptLower = prompt.toLowerCase();

  // Check for global changes that affect all scenes or shared components
  const globalKeywords = ['background', 'color scheme', 'all scenes', 'everywhere', 'global', 'constants'];
  const isGlobalChange = globalKeywords.some(k => promptLower.includes(k));

  if (isGlobalChange) {
    // For global changes, target constants.ts and potentially Background.tsx
    const targetFiles: string[] = [];
    if (promptLower.includes('background')) {
      targetFiles.push('components/Background.tsx');
    }
    if (promptLower.includes('color')) {
      targetFiles.push('constants.ts');
    }
    if (targetFiles.length === 0) {
      targetFiles.push('constants.ts');
    }
    return {
      targetScenes: [],
      targetFiles,
      analysisReason: `Global change detected, targeting: ${targetFiles.join(', ')}`,
    };
  }

  // Check for specific scene mentions
  for (const scene of sceneInfos) {
    const sceneName = scene.name.toLowerCase();
    const sceneNum = `scene ${scene.id}`;
    const sceneNumAlt = `scene${scene.id}`;

    if (promptLower.includes(sceneName) ||
        promptLower.includes(sceneNum) ||
        promptLower.includes(sceneNumAlt)) {
      return {
        targetScenes: [scene],
        targetFiles: [scene.file],
        analysisReason: `User mentioned "${scene.name}" directly`,
      };
    }
  }

  // Check for element-based matching (particles, orb, graph, etc.)
  const elementKeywords: Record<string, string[]> = {
    'particle': ['particle', 'particles', 'dust', 'sparkle'],
    'orb': ['orb', 'sphere', 'ball', 'circle', 'glow'],
    'graph': ['graph', 'chart', 'stonks', 'line'],
    'text': ['text', 'title', 'label', 'word'],
  };

  for (const [element, keywords] of Object.entries(elementKeywords)) {
    if (keywords.some(k => promptLower.includes(k))) {
      // Find scenes that mention this element
      const matchingScenes = sceneInfos.filter(s =>
        s.description.toLowerCase().includes(element)
      );

      if (matchingScenes.length > 0) {
        // Also check components
        const componentFile = existingFiles.find(f =>
          f.toLowerCase().includes(element) && f.startsWith('components/')
        );

        const targetFiles = matchingScenes.map(s => s.file);
        if (componentFile) {
          targetFiles.unshift(componentFile); // Component first
        }

        return {
          targetScenes: matchingScenes,
          targetFiles,
          analysisReason: `Element "${element}" found in: ${matchingScenes.map(s => s.name).join(', ')}`,
        };
      }

      // Check if there's a component for this element
      const componentFile = existingFiles.find(f =>
        f.toLowerCase().includes(element) && f.startsWith('components/')
      );
      if (componentFile) {
        return {
          targetScenes: [],
          targetFiles: [componentFile],
          analysisReason: `Element "${element}" likely in component: ${componentFile}`,
        };
      }
    }
  }

  // Default: if we can't determine, target the first scene (most common edit target)
  if (sceneInfos.length > 0) {
    return {
      targetScenes: [sceneInfos[0]],
      targetFiles: [sceneInfos[0].file],
      analysisReason: 'Could not determine specific target, defaulting to Scene 1',
    };
  }

  // Fallback: all scene files
  const sceneFiles = existingFiles.filter(f => f.startsWith('scenes/'));
  return {
    targetScenes: [],
    targetFiles: sceneFiles.length > 0 ? sceneFiles : existingFiles,
    analysisReason: 'Fallback: targeting all scene files',
  };
}

/**
 * Run Claude to edit the existing composition.
 *
 * Smart editing approach:
 * 1. First analyze which scene(s) need changes based on user's request
 * 2. Only read and modify the affected scene files
 * 3. Keep all other files untouched
 * 4. Re-bundle only if necessary
 */
async function runClaudeEditor(options: ClaudeEditorOptions): Promise<ClaudeEditorResult> {
  const { projectId, jobId, projectDir, prompt, existingFiles, targetSceneId } = options;

  const workspacePath = getWorkspacePath();
  const bundleOutputDir = config.remotion.bundleOutputDir;

  logger.info({
    projectId,
    jobId,
    prompt: prompt.slice(0, 100),
    existingFiles: existingFiles.length,
    targetSceneId,
  }, 'Starting Claude editor...');

  const startTime = Date.now();

  // PHASE 1: Detect edit mode and which files need to be edited
  const editMode = detectEditMode(prompt);
  let detection: { targetScenes: SceneInfo[]; targetFiles: string[]; analysisReason: string };

  // If user selected a specific scene, use that directly instead of auto-detection
  if (targetSceneId) {
    // Read scenes.json to get scene info
    let scenes: any[] = [];
    try {
      const scenesJson = await readFile(join(projectDir, 'scenes.json'), 'utf-8');
      const parsed = JSON.parse(scenesJson);
      scenes = parsed.scenes || [];
    } catch {
      // No scenes.json - fallback to scene file
    }

    const sceneInfo = scenes.find((s: any) => s.id === targetSceneId);
    const sceneFile = `scenes/Scene${targetSceneId}.tsx`;

    if (sceneInfo) {
      detection = {
        targetScenes: [{
          id: sceneInfo.id,
          name: sceneInfo.name || `Scene ${targetSceneId}`,
          file: sceneFile,
          description: sceneInfo.visual || sceneInfo.description || '',
          frames: sceneInfo.frames || [0, 0],
          timestampRange: sceneInfo.timestampRange || [0, 0],
        }],
        targetFiles: [sceneFile],
        analysisReason: `User selected Scene ${targetSceneId} from UI`,
      };
    } else {
      // Scene not found in scenes.json, but still target the file
      detection = {
        targetScenes: [{
          id: targetSceneId,
          name: `Scene ${targetSceneId}`,
          file: sceneFile,
          description: '',
          frames: [0, 0],
          timestampRange: [0, 0],
        }],
        targetFiles: [sceneFile],
        analysisReason: `User selected Scene ${targetSceneId} from UI (no metadata)`,
      };
    }

    logger.info({
      projectId,
      targetSceneId,
      sceneFile,
    }, 'Using user-selected scene');
  } else {
    // Auto-detect target scenes based on prompt
    detection = await detectTargetScenes(projectDir, prompt, existingFiles);
  }

  logger.info({
    projectId,
    editMode,
    targetFiles: detection.targetFiles,
    targetScenes: detection.targetScenes.map(s => s.name),
    analysisReason: detection.analysisReason,
  }, 'Edit analysis complete');

  // Read the content of target files to provide to Claude
  const targetFileContents: string[] = [];
  for (const file of detection.targetFiles) {
    try {
      const content = await readFile(join(projectDir, file), 'utf-8');
      targetFileContents.push(`=== ${file} ===\n${content}`);
    } catch {
      logger.warn({ projectId, file }, 'Could not read target file');
    }
  }

  // Read constants.ts for context (colors, timing, etc.)
  let constantsContent = '';
  try {
    constantsContent = await readFile(join(projectDir, 'constants.ts'), 'utf-8');
  } catch {
    // constants.ts might not exist
  }

  // Read scenes.json for full context
  let scenesJson = '';
  try {
    scenesJson = await readFile(join(projectDir, 'scenes.json'), 'utf-8');
  } catch {
    // scenes.json might not exist
  }

  let editPrompt: string;

  if (editMode === 'regenerate' && detection.targetScenes.length > 0) {
    // REGENERATION MODE: Regenerate the specific scene(s) completely
    const targetScene = detection.targetScenes[0]; // Focus on first matching scene

    logger.info({
      projectId,
      sceneId: targetScene.id,
      sceneName: targetScene.name,
      frames: targetScene.frames,
    }, 'Regenerating scene');

    editPrompt = `
You are regenerating a SPECIFIC SCENE in a Remotion composition.

PROJECT DIRECTORY: ${projectDir}

SCENE TO REGENERATE:
- Scene ${targetScene.id}: "${targetScene.name}"
- File: ${targetScene.file}
- Frames: ${targetScene.frames[0]} to ${targetScene.frames[1]}
- Timestamp: ${targetScene.timestampRange[0]}s to ${targetScene.timestampRange[1]}s
- Original Description: ${targetScene.description}

USER'S REQUEST:
"${prompt}"

CONSTANTS (use these colors and timing):
${constantsContent}

CURRENT SCENE CODE:
${targetFileContents.join('\n\n')}

INSTRUCTIONS:
1. REWRITE the scene file (${targetScene.file}) to match the user's request
2. Keep the same frame range (${targetScene.frames[0]} to ${targetScene.frames[1]})
3. Use the existing COLORS and SPRING_CONFIG from constants.ts
4. Export the component with the same name (Scene${targetScene.id})
5. Follow Remotion best practices:
   - Use useCurrentFrame() and useVideoConfig()
   - Use spring() with damping >= 20
   - Use interpolate() with extrapolateRight: 'clamp'
6. After regenerating, run: npx remotion bundle src/${projectId}/index.tsx --out-dir ${bundleOutputDir}/${projectId.replace(/_/g, '-')}

IMPORTANT: Only modify ${targetScene.file} - do NOT touch other scene files or index.tsx.
`.trim();

  } else {
    // SIMPLE EDIT MODE: Make surgical changes
    editPrompt = `
You are making a QUICK EDIT to a Remotion composition.

PROJECT DIRECTORY: ${projectDir}

ANALYSIS: ${detection.analysisReason}

TARGET FILE(S) TO EDIT:
${detection.targetFiles.map(f => `- ${f}`).join('\n')}

CURRENT CONTENT:
${targetFileContents.join('\n\n')}

USER'S EDIT REQUEST:
"${prompt}"

INSTRUCTIONS:
1. Make ONLY the minimal changes needed - change a value, not the whole file
2. Edit ONLY the file(s) listed above
3. Common edits:
   - Size: change width/height/scale numbers
   - Color: update hex values or COLORS references
   - Speed: adjust spring damping or duration values
   - Position: modify x/y/translateX/translateY values
4. After editing, run: npx remotion bundle src/${projectId}/index.tsx --out-dir ${bundleOutputDir}/${projectId.replace(/_/g, '-')}

This should be a 1-5 line change. Do not rewrite files.
`.trim();
  }

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
      subprocess.kill('SIGTERM');
      reject(new Error(`Claude editor timed out after ${config.claudeAgent.timeoutSeconds} seconds`));
    }, config.claudeAgent.timeoutSeconds * 1000);

    subprocess.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Claude editor exited with code ${code}: ${stderr || stdout.slice(-500)}`));
      }
    });

    subprocess.on('error', (err) => {
      clearTimeout(timeoutId);
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
