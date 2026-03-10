/**
 * Claude Code subprocess management for visual generation
 */

import { writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { publishJobProgress, registerCancelHandler, unregisterCancelHandler } from '../../services/redis.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { getWorkspacePath } from '../../workspace.js';
import type { ClaudeCodeOptions, ClaudeCodeResult } from './types.js';

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

/**
 * Run the Claude Code visual generator.
 *
 * Uses Claude Agent SDK with OAuth authentication from Claude Pro/Max subscription.
 * No API key costs - included in subscription.
 */
export async function runClaudeCodeGenerator(
  options: ClaudeCodeOptions
): Promise<ClaudeCodeResult> {
  const { projectId, jobId, transcript, words, durationFrames, fps, width, height, stylePreset, layoutMode, styleGuide, planJobId, pipWidth, pipHeight, safePlacement, onProgress } = options;

  const pythonPath = config.pythonPath;
  const agentScript = join(__dirname, '..', '..', 'agents', 'claude_visual_generator.py');
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

    // Add pip effective dimensions for per-scene dimension-aware generation
    if (pipWidth && pipHeight) {
      args.push('--pip-width', String(pipWidth));
      args.push('--pip-height', String(pipHeight));
    }

    // Pass speaker safe-placement zones for Director overlay awareness
    if (safePlacement && safePlacement.length > 0) {
      args.push('--safe-placement', JSON.stringify(safePlacement));
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

    subprocess.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stdout += text;

      const lines = text.split('\n');
      for (const line of lines) {
        // Parse PROGRESS:XX:message or PROGRESS:XX:message|{json_metadata}
        const progressMatch = line.match(/^PROGRESS:(\d+):(.+?)(?:\|(.+))?$/);
        if (progressMatch) {
          const percent = parseInt(progressMatch[1], 10);
          const message = progressMatch[2];
          const metaJson = progressMatch[3];
          let meta: Record<string, unknown> | undefined;
          if (metaJson) {
            try { meta = JSON.parse(metaJson); } catch { /* ignore malformed meta */ }
          }
          // Raise heartbeat water mark so it doesn't regress below this checkpoint
          onProgress?.(percent);
          publishJobProgress(jobId, percent, message, meta ? { meta } : undefined);
          logger.info({ projectId, percent, message, meta }, 'Claude generator progress');
          continue;
        }
      }

      logger.info({ projectId, output: text.slice(0, 500) }, 'Claude generator stdout');
    });

    let fatalStderrDetected = false;

    subprocess.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stderr += text;
      logger.error({ projectId, stderr: text.slice(0, 1000) }, 'Claude generator stderr');
      // Detect fatal crashes: unhandled rejections mean the CLI is likely hung
      if (
        text.includes('unhandled') ||
        text.includes('UnhandledPromiseRejection') ||
        text.includes('rejecting a promise which was not handled') ||
        text.includes('uncaughtException')
      ) {
        logger.error({ projectId, stderr: text.slice(0, 500) }, 'Claude generator fatal error detected, killing subprocess');
        fatalStderrDetected = true;
        subprocess.kill('SIGTERM');
      }
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
        runningProcesses.delete(jobId);
        unregisterCancelHandler(jobId);
        if (fatalStderrDetected) {
          // OOM and other crashes — retryable (sources may be partially written)
          reject(new Error(`Claude generator crashed: ${stderr.slice(-500)}`));
        } else if (code === 0) {
          resolve();
        } else {
          // Non-zero exit — may be retryable (transient API errors, etc.)
          const errorOutput = stderr || stdout.slice(-1000);
          reject(new Error(`Claude Code generator exited with code ${code}: ${errorOutput}`));
        }
      });

      subprocess.on('error', (err) => {
        clearTimeout(timeoutId);
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
