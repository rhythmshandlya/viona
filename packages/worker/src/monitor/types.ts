// packages/worker/src/monitor/types.ts

import type { ChildProcess } from 'child_process';
import type { ProgressState, CheckpointState } from '@viona/shared';
import type { progressStore } from '../progress/progress-store.js';

/** Configuration for SubprocessMonitor */
export interface SubprocessMonitorConfig {
  jobId: string;
  workDir: string;
  progressStore: typeof progressStore;
  heartbeatTimeoutSec: number;
  healthCheckIntervalSec: number;
  maxRetries: number;
  buildRetryArgs: (checkpoint: CheckpointState) => string[];
  progressMapper: ProgressMapper;
  signal?: AbortSignal;
}

/** Processor-specific progress mapping */
export interface ProgressMapper {
  mapFilesToProgress(checkpoint: CheckpointState): Partial<ProgressState>;
  mapHeartbeatToProgress(phase: string, detail: string): Partial<ProgressState>;
  mapStdoutToProgress(percent: number, message: string, meta?: Record<string, unknown>): Partial<ProgressState>;
}

/** Result from SubprocessMonitor.run() */
export interface SubprocessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  checkpoint: CheckpointState;
  retriesUsed: number;
}

/** Parsed heartbeat from Python stdout */
export interface HeartbeatEvent {
  timestamp: number;
  phase: string;
  detail: string;
}

/** File change event from observer */
export interface FileChangeEvent {
  type: 'create' | 'modify' | 'delete';
  path: string;
  relativePath: string;
  timestamp: number;
}
