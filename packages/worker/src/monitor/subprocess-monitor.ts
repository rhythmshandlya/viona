// packages/worker/src/monitor/subprocess-monitor.ts

import { spawn, type ChildProcess } from 'child_process';
import type { ProgressState, CheckpointState, HealthState } from '@viona/shared';
import type { SubprocessMonitorConfig, SubprocessResult, HeartbeatEvent, FileChangeEvent } from './types.js';
import { ProcessWatcher } from './process-watcher.js';
import { HeartbeatTracker } from './heartbeat-tracker.js';
import { FileObserver } from './file-observer.js';
import { scanCheckpointFromDisk, writeCheckpoint } from './checkpoint.js';
import { logger } from '../logger.js';

/**
 * Core subprocess monitor — wraps a child process with three monitoring layers.
 *
 * Usage:
 *   const monitor = new SubprocessMonitor(config);
 *   const result = await monitor.run(command, args, spawnOptions);
 */
export class SubprocessMonitor {
  private readonly config: SubprocessMonitorConfig;
  private processWatcher: ProcessWatcher | null = null;
  private heartbeatTracker: HeartbeatTracker;
  private fileObserver: FileObserver;
  private retriesUsed = 0;
  private currentProcess: ChildProcess | null = null;
  private lastProgressState: Partial<ProgressState> = {};

  constructor(config: SubprocessMonitorConfig) {
    this.config = config;

    // Layer 1: ProcessWatcher is created per-run in runOnce() — not here

    // Layer 2: Heartbeat
    this.heartbeatTracker = new HeartbeatTracker({
      timeoutMs: config.heartbeatTimeoutSec * 1000,
      onHeartbeat: (event) => {
        this.onHeartbeat(event).catch((err) => {
          logger.warn({ err, jobId: config.jobId }, 'onHeartbeat callback error');
        });
      },
      onHung: () => {
        this.onHung().catch((err) => {
          logger.warn({ err, jobId: config.jobId }, 'onHung callback error');
        });
      },
    });

    // Layer 3: File Observer
    this.fileObserver = new FileObserver({
      workDir: config.workDir,
      debounceMs: 200,
      onChange: (events) => {
        this.onFileChange(events).catch((err) => {
          logger.warn({ err, jobId: config.jobId }, 'onFileChange callback error');
        });
      },
    });
  }

  /**
   * Run a subprocess with full monitoring.
   * Returns when process exits (or all retries exhausted).
   */
  async run(
    command: string,
    args: string[],
    spawnOptions: Parameters<typeof spawn>[2] = {},
  ): Promise<SubprocessResult> {
    let stdout = '';
    let stderr = '';

    // Start file observer
    await this.fileObserver.start();

    // Publish initial health
    await this.publishHealth(true);

    const runOnce = (cmd: string, a: string[]): Promise<{ code: number | null; signal: string | null }> => {
      return new Promise((resolve) => {
        const proc = spawn(cmd, a, {
          stdio: ['ignore', 'pipe', 'pipe'],
          ...spawnOptions,
        });

        this.currentProcess = proc;
        this.heartbeatTracker.reset();

        // Detach previous watcher before creating a new one
        this.processWatcher?.detach();

        // Wire Layer 1
        this.processWatcher = new ProcessWatcher({
          healthCheckIntervalMs: this.config.healthCheckIntervalSec * 1000,
          onExit: (code, signal) => resolve({ code, signal }),
          onHealthCheck: () => this.onHealthCheck(),
        });
        this.processWatcher.attach(proc);

        // Wire stdout to Layer 2 (heartbeat) + PROGRESS parsing
        proc.stdout?.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          stdout += text;
          logger.info({ jobId: this.config.jobId, output: text.slice(0, 500) }, 'Subprocess stdout');

          for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Layer 2: try heartbeat parse first
            const wasHeartbeat = this.heartbeatTracker.parseLine(trimmed);
            if (wasHeartbeat) continue;

            // PROGRESS line — backward compat
            const match = trimmed.match(/^PROGRESS:(\d+):(.+?)(?:\|(.+))?$/);
            if (match) {
              const percent = parseInt(match[1], 10);
              const message = match[2];
              let meta: Record<string, unknown> | undefined;
              if (match[3]) {
                try { meta = JSON.parse(match[3]); } catch { /* ignore */ }
              }
              const partial = this.config.progressMapper.mapStdoutToProgress(percent, message, meta);
              this.emitProgress(partial);
            }
          }
        });

        proc.stderr?.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          stderr += text;
          if (text.trim()) {
            logger.error({ jobId: this.config.jobId, stderr: text.slice(0, 500) }, 'Subprocess stderr');
          }
        });

        // Abort signal support
        if (this.config.signal) {
          const onAbort = () => {
            this.processWatcher?.kill('User cancelled');
          };
          this.config.signal.addEventListener('abort', onAbort, { once: true });
          proc.on('exit', () => {
            this.config.signal?.removeEventListener('abort', onAbort);
          });
        }
      });
    };

    try {
      // First attempt
      let result = await runOnce(command, args);

      // Retry logic
      while (result.code !== 0 && this.retriesUsed < this.config.maxRetries) {
        this.retriesUsed++;
        logger.info(
          { jobId: this.config.jobId, retry: this.retriesUsed, maxRetries: this.config.maxRetries, exitCode: result.code },
          'Subprocess crashed — retrying from checkpoint',
        );

        await this.publishHealth(false);

        // Read checkpoint and build retry args
        const checkpoint = await scanCheckpointFromDisk(this.config.workDir, this.config.jobId);
        await writeCheckpoint(this.config.workDir, checkpoint);

        const retryArgs = this.config.buildRetryArgs(checkpoint);
        await this.config.progressStore.addActivity(this.config.jobId, {
          timestamp: Date.now(),
          type: 'health',
          detail: `Process crashed (exit ${result.code}), retrying from checkpoint (attempt ${this.retriesUsed})`,
          phase: checkpoint.phases.animate.status === 'running' ? 'animate' : 'plan',
        });

        // Reset trackers for new process
        this.heartbeatTracker.reset();
        stdout = '';
        stderr = '';

        await this.publishHealth(true);
        result = await runOnce(command, retryArgs);
      }

      // Final checkpoint
      const checkpoint = await scanCheckpointFromDisk(this.config.workDir, this.config.jobId);
      await writeCheckpoint(this.config.workDir, checkpoint);

      if (result.code !== 0) {
        await this.publishHealth(false);
      }

      return {
        exitCode: result.code ?? -1,
        stdout,
        stderr,
        checkpoint,
        retriesUsed: this.retriesUsed,
      };

    } finally {
      this.fileObserver.stop();
      this.processWatcher?.detach();
    }
  }

  /** Periodic health check — called by ProcessWatcher timer */
  private onHealthCheck(): void {
    this.heartbeatTracker.checkHung();
  }

  /** Layer 2: heartbeat received */
  private async onHeartbeat(event: HeartbeatEvent): Promise<void> {
    const partial = this.config.progressMapper.mapHeartbeatToProgress(event.phase, event.detail);
    await this.emitProgress(partial);
    await this.publishHealth(true);
  }

  /** Layer 2: process appears hung */
  private async onHung(): Promise<void> {
    logger.warn({ jobId: this.config.jobId }, 'Subprocess heartbeat timeout — killing process');
    await this.config.progressStore.addActivity(this.config.jobId, {
      timestamp: Date.now(),
      type: 'health',
      detail: `No heartbeat for ${this.config.heartbeatTimeoutSec}s — process appears hung`,
    });
    await this.processWatcher?.kill('heartbeat timeout');
  }

  /** Layer 3: file changes detected */
  private async onFileChange(events: FileChangeEvent[]): Promise<void> {
    const checkpoint = await scanCheckpointFromDisk(this.config.workDir, this.config.jobId);
    await writeCheckpoint(this.config.workDir, checkpoint);

    const partial = this.config.progressMapper.mapFilesToProgress(checkpoint);
    await this.emitProgress(partial);

    for (const event of events) {
      const file = event.relativePath;
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.json') || file.endsWith('.md')) {
        if (file === '.checkpoint.json') continue;
        await this.config.progressStore.addActivity(this.config.jobId, {
          timestamp: event.timestamp,
          type: 'file',
          detail: `${file} ${event.type === 'create' ? 'created' : 'modified'}`,
          phase: partial.phase,
        });
      }
    }

    await this.publishHealth(true);
  }

  /** Emit a progress update (merges with last known state) */
  private async emitProgress(partial: Partial<ProgressState>): Promise<void> {
    this.lastProgressState = { ...this.lastProgressState, ...partial };
    const state: ProgressState = {
      percent: this.lastProgressState.percent ?? 0,
      message: this.lastProgressState.message ?? 'Processing...',
      phase: this.lastProgressState.phase ?? 'unknown',
      phaseName: this.lastProgressState.phaseName ?? 'Processing',
      detail: this.lastProgressState.detail,
      updatedAt: Date.now(),
      meta: this.lastProgressState.meta,
    };
    // Use checkpoint() to write to both Redis AND DB — the frontend HTTP
    // polling reads from DB, so set() alone (Redis-only) leaves it stale.
    await this.config.progressStore.checkpoint(this.config.jobId, state);
  }

  /** Publish health state */
  private async publishHealth(alive: boolean): Promise<void> {
    const health: HealthState = {
      processAlive: alive,
      lastHeartbeat: this.heartbeatTracker.lastSeen,
      lastFileChange: Date.now(),
      lastRedisUpdate: Date.now(),
      phase: this.lastProgressState.phase ?? 'unknown',
      retriesUsed: this.retriesUsed,
      retriesMax: this.config.maxRetries,
    };
    await this.config.progressStore.setHealth(this.config.jobId, health);
  }
}
