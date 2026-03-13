// packages/worker/src/monitor/process-watcher.ts

import type { ChildProcess } from 'child_process';
import { logger } from '../logger.js';

export interface ProcessWatcherConfig {
  healthCheckIntervalMs: number;
  onExit: (code: number | null, signal: string | null) => void;
  onHealthCheck: () => void;
}

export class ProcessWatcher {
  private process: ChildProcess | null = null;
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private readonly config: ProcessWatcherConfig;
  private stopped = false;

  constructor(config: ProcessWatcherConfig) {
    this.config = config;
  }

  attach(proc: ChildProcess): void {
    this.process = proc;
    this.stopped = false;

    proc.on('exit', (code, signal) => {
      this.stopHealthCheck();
      if (!this.stopped) {
        this.config.onExit(code, signal);
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'Subprocess spawn error');
      this.stopHealthCheck();
      if (!this.stopped) {
        this.config.onExit(-1, null);
      }
    });

    this.startHealthCheck();
  }

  async kill(reason: string): Promise<void> {
    if (!this.process || this.process.exitCode !== null) return;

    logger.info({ reason, pid: this.process.pid }, 'Killing subprocess');
    this.process.kill('SIGTERM');

    const killed = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 10_000);
      this.process!.once('exit', () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });

    if (!killed && this.process.exitCode === null) {
      logger.warn({ pid: this.process.pid }, 'SIGTERM failed, sending SIGKILL');
      this.process.kill('SIGKILL');
    }
  }

  detach(): void {
    this.stopped = true;
    this.stopHealthCheck();
  }

  get isAlive(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  private startHealthCheck(): void {
    this.healthInterval = setInterval(() => {
      this.config.onHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private stopHealthCheck(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }
}
