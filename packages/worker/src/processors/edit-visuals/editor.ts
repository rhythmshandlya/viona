/**
 * Claude subprocess interface for editing compositions.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { publishJobProgress, registerCancelHandler, unregisterCancelHandler } from '../../services/redis.js';
import { startHeartbeatProgress } from '../../utils/heartbeat-progress.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { getWorkspacePath } from '../../workspace.js';
import { buildLayoutContext } from './context.js';
import type { ClaudeEditorOptions, ClaudeEditorResult } from './types.js';

export const runningProcesses = new Map<string, ChildProcess>();

/**
 * Run Claude to edit the existing composition.
 *
 * Gives Claude full project context and lets it decide what to change.
 * No pre-filtering or edit mode detection — the model is smarter than keyword heuristics.
 */
export async function runClaudeEditor(options: ClaudeEditorOptions): Promise<ClaudeEditorResult> {
  const { projectId, jobId, projectDir, prompt, existingFiles, targetSceneId, targetSceneIds, targetElementName, transcript, scenePlan, canvasWidth, canvasHeight } = options;

  const workspacePath = getWorkspacePath();
  const bundleOutputDir = config.remotion.bundleOutputDir;

  // Normalize scene targeting: multi-scene array takes priority over single ID
  const allTargetIds = targetSceneIds || (targetSceneId ? [targetSceneId] : []);

  logger.info({
    projectId,
    jobId,
    prompt: prompt.slice(0, 100),
    existingFiles: existingFiles.length,
    targetSceneIds: allTargetIds.length > 0 ? allTargetIds : undefined,
    targetElementName,
    hasTranscript: !!transcript,
    hasScenePlan: !!scenePlan,
  }, 'Starting Claude editor...');

  const startTime = Date.now();

  // List source files for Claude to read on demand (don't embed contents — too large for prompt)
  const fileList = existingFiles.join('\n- ');
  let targetSceneContext = '';
  if (allTargetIds.length > 0) {
    try {
      const scenesRaw = await readFile(join(projectDir, 'scenes.json'), 'utf-8');
      const parsed = JSON.parse(scenesRaw);
      const allScenes = parsed.scenes || [];
      const parts: string[] = [];
      for (const id of allTargetIds) {
        const scene = allScenes.find((s: any) => s.id === id);
        if (scene) {
          parts.push(`- Scene ${scene.id}: "${scene.name}" · File: scenes/Scene${scene.id}.tsx · Frames: ${scene.frames[0]}–${scene.frames[1]} · ${scene.timestampRange[0]}s–${scene.timestampRange[1]}s · ${scene.visual || scene.description || 'N/A'}`);
        } else {
          parts.push(`- Scene ${id} (file: scenes/Scene${id}.tsx)`);
        }
      }
      targetSceneContext = `\nUSER-SELECTED TARGET${allTargetIds.length > 1 ? 'S' : ''}:\n${parts.join('\n')}`;
    } catch {
      targetSceneContext = `\nUSER-SELECTED TARGET${allTargetIds.length > 1 ? 'S' : ''}: ${allTargetIds.map(id => `Scene ${id} (scenes/Scene${id}.tsx)`).join(', ')}`;
    }
  }

  const elementContext = targetElementName
    ? `\nTARGET ELEMENT: "${targetElementName}" — The user wants changes focused on this specific element.`
    : '';

  // Build transcript section (truncate if very long to keep prompt within limits)
  const MAX_TRANSCRIPT_LENGTH = 6000;
  const truncatedTranscript = transcript && transcript.length > MAX_TRANSCRIPT_LENGTH
    ? transcript.slice(0, MAX_TRANSCRIPT_LENGTH) + '\n... [transcript truncated for length]'
    : transcript;
  const transcriptSection = truncatedTranscript
    ? `\nVIDEO TRANSCRIPT (what the speaker is saying at each timestamp):
${truncatedTranscript}

Use this to understand the CONTENT of the video. Visuals should illustrate what's being said.
If the user refers to "the part about X" or "when I talk about Y", match it to the transcript above.`
    : '';

  // Build scene plan section
  const scenePlanSection = scenePlan
    ? `\nSCENE PLAN (what each scene is supposed to visualize):
${scenePlan}

Each scene has a time range, description, and purpose. Use this to understand the visual structure.`
    : '';

  // Build user-provided assets section if any were uploaded
  let userAssetsSection = '';
  try {
    const userAssetsPath = join(projectDir, 'user_assets.json');
    const userAssetsRaw = await readFile(userAssetsPath, 'utf-8');
    const userAssetsData = JSON.parse(userAssetsRaw);
    if (userAssetsData.assets?.length > 0) {
      const assetLines = userAssetsData.assets.map((a: { label: string; remotionPath: string; contentType: string }) => {
        // Sanitize user-provided label to prevent prompt injection
        const safeLabel = (a.label || 'Untitled').replace(/[`*\[\]{}\\<>]/g, '').slice(0, 100);
        return `- ${safeLabel}: staticFile('${a.remotionPath}') (${a.contentType})`;
      });
      userAssetsSection = `
USER-PROVIDED ASSETS (uploaded by the user — YOU MUST USE THESE when the user references them):
${assetLines.join('\n')}

When the user's request contains [Attached: X], that refers to the asset labeled "X" above.
If the user says "use the X" or references an attached asset by name, you MUST use the corresponding staticFile() path.

Usage: <Img src={staticFile('assets/user/filename.ext')} style={{ width: 200 }} />
For SVGs needing color changes, read the SVG file from public/assets/user/ and inline its content in JSX.`;
    }
  } catch {
    // No user assets — that's fine
  }

  // Build layout & dimension context from scenes.json
  // For multi-scene edits, pass undefined to get all scenes' layout summary
  const layoutSceneId = allTargetIds.length === 1 ? allTargetIds[0] : undefined;
  const layoutContext = await buildLayoutContext(
    projectDir, layoutSceneId, canvasWidth ?? 1080, canvasHeight ?? 1920
  );

  logger.info({
    projectId,
    fileCount: existingFiles.length,
    targetSceneCount: allTargetIds.length,
    hasTargetElement: !!targetElementName,
    transcriptLength: transcript?.length || 0,
    hasUserAssets: userAssetsSection.length > 0,
    hasLayoutContext: layoutContext.length > 0,
  }, 'Edit context prepared');

  const editPrompt = `
You are editing a Remotion composition for a talking-head explainer video. You have the video transcript (what the speaker says) and the scene plan (what each scene visualizes). Use this context to make smart edits.

PROJECT DIRECTORY: ${projectDir}
${targetSceneContext}${elementContext}
${transcriptSection}
${scenePlanSection}
${layoutContext ? `\n${layoutContext}\n` : ''}${userAssetsSection}

USER'S REQUEST:
"${prompt}"

PROJECT FILES (read them from disk as needed — do NOT ask the user for file contents):
- ${fileList}

START by reading the files most relevant to the user's request. At minimum read scenes.json and index.tsx to understand the structure, then read specific scene files you need to edit.

YOUR JOB:
You understand what the speaker is saying, what the visuals currently show, and what the user wants changed. Make edits that result in visuals that accurately illustrate the spoken content.

- Read the transcript to understand WHAT is being explained at each point in time.
- Read the scene plan to understand the INTENT of each visual.
- Read the code to understand the CURRENT implementation.
- Then make changes that serve the user's request while keeping visuals aligned with the narration.

TECHNICAL GUIDELINES:
- Use existing COLORS and SPRING_CONFIG from constants.ts when they exist.
- Keep frame ranges and component export names unchanged unless the request requires it.
- Remotion best practices: useCurrentFrame(), spring() with damping >= 20, interpolate() with extrapolateRight: 'clamp'.
- Do NOT modify files that aren't relevant to the request.
- After making changes, run: npx remotion bundle src/${projectId}/index.tsx --out-dir ${bundleOutputDir}/${projectId.replace(/_/g, '-')}
${allTargetIds.length > 0 ? `
SCOPE RESTRICTION (MANDATORY):
- You MUST ONLY edit ${allTargetIds.map(id => `scenes/Scene${id}.tsx`).join(', ')} and their direct dependencies (components/ or constants.ts).
- Do NOT touch other scene files — they are NOT part of this edit.
- Do NOT modify index.tsx unless the user explicitly asks to change scene ordering/structure.
- If the edit requires changes to shared components, make them backward-compatible so other scenes still work.
- Apply the SAME edit to ALL listed scene files.
` : ''}
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

  // Register subprocess for cancellation support
  runningProcesses.set(jobId, subprocess);
  registerCancelHandler(jobId, () => {
    subprocess.kill('SIGTERM');
  });

  let stdout = '';
  let stderr = '';

  // Heartbeat progress — exponential decay curve from 20% to 83% over ~8 minutes
  await publishJobProgress(jobId, 20, 'AI is editing your visuals...');
  const heartbeat = startHeartbeatProgress(jobId, 20, 83, 8 * 60 * 1000);

  subprocess.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf-8');
    stdout += text;
    logger.debug({ projectId, output: text.slice(0, 200) }, 'Claude editor output');
  });

  // Track whether subprocess has been killed due to a fatal stderr error
  let fatalStderrDetected = false;

  subprocess.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf-8');
    stderr += text;
    if (text.includes('error') || text.includes('Error')) {
      logger.warn({ projectId, stderr: text.slice(0, 500) }, 'Claude editor stderr');
    }
    // Detect fatal crashes: unhandled rejections / uncaught exceptions mean the CLI is likely hung
    if (
      text.includes('unhandled') ||
      text.includes('UnhandledPromiseRejection') ||
      text.includes('rejecting a promise which was not handled') ||
      text.includes('uncaughtException')
    ) {
      logger.error({ projectId, stderr: text.slice(0, 500) }, 'Claude editor fatal error detected, killing subprocess');
      fatalStderrDetected = true;
      subprocess.kill('SIGTERM');
    }
  });

  // Wait for completion with timeout
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      heartbeat.stop();
      runningProcesses.delete(jobId);
      unregisterCancelHandler(jobId);
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
      }, 10_000);
      reject(new Error(`Claude editor timed out after ${config.claudeAgent.timeoutSeconds} seconds`));
    }, config.claudeAgent.timeoutSeconds * 1000);

    subprocess.on('close', (code) => {
      clearTimeout(timeoutId);
      heartbeat.stop();
      runningProcesses.delete(jobId);
      unregisterCancelHandler(jobId);
      if (fatalStderrDetected) {
        // OOM and other crashes — retryable (sources may be partially written)
        reject(new Error(`Claude editor crashed: ${stderr.slice(-500)}`));
      } else if (code === 0) {
        resolve();
      } else {
        // Non-zero exit — may be retryable (transient API errors, etc.)
        reject(new Error(`Claude editor exited with code ${code}: ${stderr || stdout.slice(-500)}`));
      }
    });

    subprocess.on('error', (err) => {
      clearTimeout(timeoutId);
      heartbeat.stop();
      runningProcesses.delete(jobId);
      unregisterCancelHandler(jobId);
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
