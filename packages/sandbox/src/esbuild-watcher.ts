import { build, type BuildResult } from 'esbuild';
import { watch } from 'chokidar';
import { join } from 'path';
import { access } from 'fs/promises';
import pino from 'pino';
import { generateSceneRegistry } from './scene-registry-generator.js';
import { syncAssets } from './asset-sync.js';

const logger = pino({ name: 'esbuild-watcher' });

const WORKSPACE = '/workspace';
const SRC_DIR = join(WORKSPACE, 'src');
const BUILD_DIR = join(WORKSPACE, '.build');
const OUTPUT_FILE = join(BUILD_DIR, 'player-composition.cjs.js');
const ENTRY_POINT = join(SRC_DIR, 'PlayerComposition.tsx');

let bundleVersion = 0;
let building = false;
let pendingRebuild = false;
let onBundleReady: ((version: number) => void) | null = null;

/**
 * Set callback for when a new bundle is ready.
 */
export function onBundle(cb: (version: number) => void): void {
  onBundleReady = cb;
}

/**
 * Get current bundle version.
 */
export function getBundleVersion(): number {
  return bundleVersion;
}

/**
 * Trigger a manual rebuild (called by agent tool).
 */
export function triggerRebuild(): void {
  scheduleBuild();
}

async function doBuild(): Promise<void> {
  // Check entry point exists before building
  try {
    await access(ENTRY_POINT);
  } catch {
    logger.warn('Entry point not found, skipping build: %s', ENTRY_POINT);
    return;
  }

  building = true;
  const start = Date.now();

  try {
    await syncAssets();
    await generateSceneRegistry();
    await build({
      entryPoints: [ENTRY_POINT],
      bundle: true,
      outfile: OUTPUT_FILE,
      format: 'cjs',
      platform: 'browser',
      target: 'es2020',
      jsx: 'automatic',
      loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css', '.json': 'json' },
      external: [
        'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime',
        'remotion', '@remotion/*',
        'three', '@react-three/*', '@react-spring/*',
      ],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      logLevel: 'warning',
    });

    bundleVersion++;
    const elapsed = Date.now() - start;
    logger.info({ version: bundleVersion, elapsed }, 'Bundle built');

    if (onBundleReady) onBundleReady(bundleVersion);
  } catch (err) {
    logger.error({ err }, 'Bundle build failed');
  } finally {
    building = false;
    if (pendingRebuild) {
      pendingRebuild = false;
      scheduleBuild();
    }
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBuild(): void {
  if (building) {
    pendingRebuild = true;
    return;
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    doBuild();
  }, 500);
}

/**
 * Start watching /workspace/src/ for changes and auto-rebuild CJS.
 * Performs an initial build immediately.
 */
export async function startWatcher(): Promise<void> {
  logger.info('Starting esbuild watcher on %s', SRC_DIR);

  // Initial build
  await doBuild();

  // Watch for changes
  const watcher = watch(SRC_DIR, {
    ignoreInitial: true,
    ignored: [/node_modules/, /scene-registry\.ts$/],
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });

  watcher.on('change', (path) => {
    logger.debug({ path }, 'File changed');
    scheduleBuild();
  });

  watcher.on('add', (path) => {
    logger.debug({ path }, 'File added');
    scheduleBuild();
  });

  watcher.on('unlink', (path) => {
    logger.debug({ path }, 'File removed');
    scheduleBuild();
  });
}
