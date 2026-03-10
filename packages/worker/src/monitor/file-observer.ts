// packages/worker/src/monitor/file-observer.ts

import { watch, type FSWatcher } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import type { FileChangeEvent } from './types.js';
import { logger } from '../logger.js';

export interface FileObserverConfig {
  workDir: string;
  debounceMs: number;
  onChange: (events: FileChangeEvent[]) => void;
}

export class FileObserver {
  private watchers: FSWatcher[] = [];
  private pending: FileChangeEvent[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly config: FileObserverConfig;
  private stopped = false;

  constructor(config: FileObserverConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    this.stopped = false;

    try {
      const watcher = watch(
        this.config.workDir,
        { recursive: true },
        (eventType, filename) => {
          if (this.stopped || !filename) return;
          this.handleEvent(eventType, filename);
        },
      );

      watcher.on('error', (err) => {
        logger.warn({ err, workDir: this.config.workDir }, 'File watcher error');
      });

      this.watchers.push(watcher);
    } catch (err) {
      logger.info({ workDir: this.config.workDir }, 'Recursive watch unavailable, watching subdirs');
      await this.watchSubdirs();
    }
  }

  stop(): void {
    this.stopped = true;
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
    this.flushPending();
  }

  private handleEvent(eventType: string, filename: string): void {
    if (filename.startsWith('.') && filename !== '.checkpoint.json') return;
    if (filename.includes('node_modules') || filename.includes('.git')) return;

    const event: FileChangeEvent = {
      type: eventType === 'rename' ? 'create' : 'modify',
      path: join(this.config.workDir, filename),
      relativePath: filename,
      timestamp: Date.now(),
    };

    this.pending.push(event);
    this.scheduleBatch();
  }

  private scheduleBatch(): void {
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.flushPending();
    }, this.config.debounceMs);
  }

  private flushPending(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pending.length > 0) {
      const events = [...this.pending];
      this.pending = [];
      this.config.onChange(events);
    }
  }

  private async watchSubdirs(): Promise<void> {
    const dirs = [this.config.workDir];
    try {
      const scenesDir = join(this.config.workDir, 'scenes');
      await stat(scenesDir);
      dirs.push(scenesDir);
    } catch {}
    try {
      const componentsDir = join(this.config.workDir, 'components');
      await stat(componentsDir);
      dirs.push(componentsDir);
    } catch {}

    for (const dir of dirs) {
      try {
        const watcher = watch(dir, (eventType, filename) => {
          if (this.stopped || !filename) return;
          const relPath = relative(this.config.workDir, join(dir, filename));
          this.handleEvent(eventType, relPath);
        });
        watcher.on('error', () => {});
        this.watchers.push(watcher);
      } catch {}
    }
  }
}
