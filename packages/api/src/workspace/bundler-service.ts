import { resolve, join } from 'path';
import { createHash } from 'crypto';
import { readdir, readFile, mkdir } from 'fs/promises';
import { spawn } from 'child_process';
import { workspaceConfig, getWorkspacePath, getWorkspaceSrcPath } from './workspace-config.js';
import { emitBundleReady, emitBundleError } from './workspace-ws.js';

interface BuildRequest {
  projectId: string;
  priority: 'user' | 'background';
  resolve: (bundlePath: string) => void;
  reject: (error: Error) => void;
}

interface CacheEntry {
  bundlePath: string;
  hash: string;
  builtAt: number;
}

class BundlerService {
  private queue: BuildRequest[] = [];
  private processing = false;
  private cache = new Map<string, CacheEntry>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private bundleOutputDir: string;

  constructor() {
    const isProduction = !!process.env.RAILWAY_ENVIRONMENT;
    this.bundleOutputDir = resolve(
      process.env.BUNDLE_OUTPUT_DIR ||
      (isProduction ? '/tmp/bundles' : join(process.cwd(), '..', 'bundles'))
    );
  }

  /**
   * Enqueue a build for a project. Debounces rapid requests.
   * Returns the bundle output path when the build completes.
   */
  enqueueBuild(projectId: string, priority: 'user' | 'background' = 'background'): Promise<string> {
    return new Promise((resolve, reject) => {
      // Clear existing debounce timer for this project
      const existing = this.debounceTimers.get(projectId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        this.debounceTimers.delete(projectId);

        // Remove any existing queued build for this project
        this.queue = this.queue.filter(r => r.projectId !== projectId);

        const request: BuildRequest = { projectId, priority, resolve, reject };

        if (priority === 'user') {
          // User-triggered rebuilds go to front of queue
          this.queue.unshift(request);
        } else {
          this.queue.push(request);
        }

        this.processNext();
      }, workspaceConfig.bundlerDebounceMs);

      this.debounceTimers.set(projectId, timer);
    });
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const request = this.queue.shift()!;

    try {
      const bundlePath = await this.buildBundle(request.projectId);
      request.resolve(bundlePath);
      await emitBundleReady(request.projectId, { bundleUrl: `/api/workspace/${request.projectId}/bundle/` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown build error';
      request.reject(error instanceof Error ? error : new Error(message));
      await emitBundleError(request.projectId, { error: message });
    } finally {
      this.processing = false;
      this.processNext(); // Process next in queue
    }
  }

  private async buildBundle(projectId: string): Promise<string> {
    const workspacePath = getWorkspacePath(projectId);
    const srcPath = getWorkspaceSrcPath(projectId);
    const outDir = join(this.bundleOutputDir, projectId);

    // Compute hash of all source files
    const hash = await this.computeSourceHash(srcPath);
    const cached = this.cache.get(projectId);
    if (cached && cached.hash === hash) {
      return cached.bundlePath; // Skip rebuild
    }

    // Ensure output directory exists
    await mkdir(outDir, { recursive: true });

    // Run Remotion bundle
    const entryPoint = join(srcPath, 'index.tsx');
    await this.runRemotionBundle(entryPoint, outDir, workspacePath);

    // Update cache
    this.cache.set(projectId, { bundlePath: outDir, hash, builtAt: Date.now() });

    return outDir;
  }

  private runRemotionBundle(entryPoint: string, outDir: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        'remotion', 'bundle',
        entryPoint,
        '--out-dir', outDir,
        '--log', 'error',
      ];

      const proc = spawn('npx', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Remotion bundle failed (exit ${code}): ${stderr.slice(0, 500)}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn Remotion bundle: ${err.message}`));
      });

      // Timeout: 2 minutes max
      setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Remotion bundle timed out after 120s'));
      }, 120_000);
    });
  }

  private async computeSourceHash(srcDir: string): Promise<string> {
    const hash = createHash('sha256');

    try {
      await this.hashDir(srcDir, hash);
    } catch {
      // If dir doesn't exist, return empty hash
      return 'empty';
    }

    return hash.digest('hex').slice(0, 16);
  }

  private async hashDir(dir: string, hash: ReturnType<typeof createHash>): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    // Sort for deterministic hash
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules
        if (entry.name === 'node_modules') continue;
        await this.hashDir(fullPath, hash);
      } else if (entry.isFile() && /\.(tsx?|jsx?|css|json)$/.test(entry.name)) {
        const content = await readFile(fullPath);
        hash.update(entry.name);
        hash.update(content);
      }
    }
  }

  /**
   * Remove cached bundle for a project. Called on workspace teardown.
   */
  cleanup(projectId: string): void {
    this.cache.delete(projectId);
    const timer = this.debounceTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(projectId);
    }
    // Remove queued builds
    this.queue = this.queue.filter(r => r.projectId !== projectId);
  }

  /** Get the bundle output directory for a project (may not exist yet) */
  getBundlePath(projectId: string): string {
    return join(this.bundleOutputDir, projectId);
  }
}

// Singleton
export const bundlerService = new BundlerService();
