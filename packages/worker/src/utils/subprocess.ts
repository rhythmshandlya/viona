import { spawn, type SpawnOptions } from 'child_process';
import { logger } from '../logger.js';

export interface SubprocessResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface SubprocessOptions {
  command: string;
  args: string[];
  spawnOptions?: SpawnOptions;
  /** Timeout in ms (default: 5 minutes) */
  timeoutMs?: number;
  /** Max bytes of stdout/stderr to buffer (default: 10MB) */
  maxOutputBytes?: number;
  /** Name for logging (e.g. "ffmpeg", "python") */
  name?: string;
  /** Callback for each stdout line (for progress parsing) */
  onStdoutLine?: (line: string) => void;
  /** Callback for each stderr line */
  onStderrLine?: (line: string) => void;
  /** AbortSignal for external cancellation */
  signal?: AbortSignal;
}

/**
 * Spawn a subprocess with timeout, graceful kill escalation, and output buffering.
 *
 * On timeout or abort:
 *   1. SIGTERM → wait 10s
 *   2. SIGKILL → wait 5s
 *   3. Log error if still alive
 */
export function runSubprocess(options: SubprocessOptions): Promise<SubprocessResult> {
  const {
    command,
    args,
    spawnOptions = {},
    timeoutMs = 5 * 60 * 1000,
    maxOutputBytes = 10 * 1024 * 1024,
    name = command,
    onStdoutLine,
    onStderrLine,
    signal,
  } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      ...spawnOptions,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let killed = false;
    let settled = false;

    const abortHandler = () => {
      if (!settled) killGracefully('abort signal');
    };
    signal?.addEventListener('abort', abortHandler, { once: true });

    const timer = setTimeout(() => {
      if (!settled) killGracefully(`timeout (${timeoutMs / 1000}s)`);
    }, timeoutMs);

    function killGracefully(reason: string) {
      if (killed) return;
      killed = true;
      logger.warn({ name, pid: proc.pid, reason }, `Killing subprocess: ${reason}`);

      proc.kill('SIGTERM');
      const termTimer = setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
          const killTimer = setTimeout(() => {
            if (!proc.killed) {
              logger.error({ name, pid: proc.pid }, 'Subprocess survived SIGKILL');
            }
          }, 5000);
          killTimer.unref();
        }
      }, 10_000);
      termTimer.unref();
    }

    proc.stdout?.on('data', (chunk: Buffer) => {
      const str = chunk.toString();
      if (stdoutBytes < maxOutputBytes) {
        stdout += str;
        stdoutBytes += chunk.length;
      }
      if (onStdoutLine) {
        for (const line of str.split('\n')) {
          if (line.trim()) onStdoutLine(line);
        }
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      const str = chunk.toString();
      if (stderrBytes < maxOutputBytes) {
        stderr += str;
        stderrBytes += chunk.length;
      }
      if (onStderrLine) {
        for (const line of str.split('\n')) {
          if (line.trim()) onStderrLine(line);
        }
      }
    });

    proc.on('error', (err) => {
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortHandler);
      reject(new Error(`${name} failed to spawn: ${err.message}`));
    });

    proc.on('close', (code) => {
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortHandler);

      const exitCode = code ?? 1;

      if (killed) {
        reject(new Error(`${name} was killed (${exitCode}): ${stderr.slice(-500)}`));
        return;
      }

      if (exitCode !== 0) {
        reject(new Error(`${name} exited with code ${exitCode}: ${stderr.slice(-500)}`));
        return;
      }

      resolve({ code: exitCode, stdout, stderr });
    });
  });
}
