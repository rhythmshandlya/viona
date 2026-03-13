// packages/worker/src/monitor/heartbeat-tracker.ts

import type { HeartbeatEvent } from './types.js';
import { logger } from '../logger.js';

export interface HeartbeatTrackerConfig {
  timeoutMs: number;
  onHeartbeat: (event: HeartbeatEvent) => void;
  onHung: () => void;
}

export class HeartbeatTracker {
  private lastHeartbeatTime: number = Date.now();
  private readonly config: HeartbeatTrackerConfig;

  private static readonly HEARTBEAT_RE = /^HEARTBEAT:(\d+):(\w+):(.*)$/;
  private static readonly PROGRESS_RE = /^PROGRESS:(\d+):(.+?)(?:\|(.+))?$/;

  constructor(config: HeartbeatTrackerConfig) {
    this.config = config;
  }

  parseLine(line: string): boolean {
    const hbMatch = line.match(HeartbeatTracker.HEARTBEAT_RE);
    if (hbMatch) {
      this.lastHeartbeatTime = Date.now();
      this.config.onHeartbeat({
        timestamp: parseInt(hbMatch[1], 10),
        phase: hbMatch[2],
        detail: hbMatch[3],
      });
      return true;
    }

    const progMatch = line.match(HeartbeatTracker.PROGRESS_RE);
    if (progMatch) {
      this.lastHeartbeatTime = Date.now();
      return false;
    }

    return false;
  }

  checkHung(): boolean {
    const elapsed = Date.now() - this.lastHeartbeatTime;
    if (elapsed > this.config.timeoutMs) {
      logger.warn(
        { elapsedMs: elapsed, timeoutMs: this.config.timeoutMs },
        'Subprocess heartbeat timeout — process appears hung',
      );
      this.config.onHung();
      return true;
    }
    return false;
  }

  reset(): void {
    this.lastHeartbeatTime = Date.now();
  }

  get lastSeen(): number {
    return this.lastHeartbeatTime;
  }

  get msSinceLastHeartbeat(): number {
    return Date.now() - this.lastHeartbeatTime;
  }
}
