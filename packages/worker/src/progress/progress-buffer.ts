// packages/worker/src/progress/progress-buffer.ts

import type { ProgressState } from '@viona/shared';

/**
 * Ring buffer for progress events when Redis is unreachable.
 * Stores up to `capacity` events. Oldest events are dropped when full.
 * Flush drains all buffered events in order.
 */
export class ProgressBuffer {
  private buffer: Array<{ jobId: string; state: ProgressState }> = [];
  private readonly capacity: number;

  constructor(capacity: number = 50) {
    this.capacity = capacity;
  }

  push(jobId: string, state: ProgressState): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push({ jobId, state });
  }

  flush(): Array<{ jobId: string; state: ProgressState }> {
    const events = [...this.buffer];
    this.buffer = [];
    return events;
  }

  get size(): number {
    return this.buffer.length;
  }
}
