// packages/sandbox/src/checkpoint.ts
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, stat } from 'fs/promises';
import { watch, type FSWatcher } from 'fs';
import { join } from 'path';
import { createReadStream } from 'fs';
import { Client as MinioClient } from 'minio';
import pino from 'pino';

const execFileAsync = promisify(execFile);
const logger = pino({ name: 'checkpoint' });

const WORKSPACE = '/workspace';
const MANIFEST_PATH = join(WORKSPACE, 'manifest.json');
const BUNDLE_PATH = '/tmp/workspace.bundle';

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

let gitReady = false;
let checkpointInProgress = false;
let watcher: FSWatcher | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const DEBOUNCE_MS = 5000;

function getMinioClient(): MinioClient {
  return new MinioClient({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
  });
}

const GITIGNORE = `node_modules/
public/source.mp4
public/audio.aac
public/proxy-*
*.mp4
*.aac
*.wav
.staging/
`;

/**
 * Initialize git repo in workspace. Call after initWorkspace() completes.
 * Sets gitReady flag so checkpoint() knows it can proceed.
 */
export async function initGitRepo(): Promise<void> {
  try {
    await execFileAsync('git', ['init'], { cwd: WORKSPACE });
    await execFileAsync('git', ['config', 'user.email', 'sandbox@viona.ai'], { cwd: WORKSPACE });
    await execFileAsync('git', ['config', 'user.name', 'Viona Sandbox'], { cwd: WORKSPACE });
    await writeFile(join(WORKSPACE, '.gitignore'), GITIGNORE);
    await execFileAsync('git', ['add', '-A'], { cwd: WORKSPACE });
    await execFileAsync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: WORKSPACE });
    gitReady = true;
    logger.info('Git repo initialized in workspace');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize git repo');
  }
}

/**
 * Run a full checkpoint: git commit → bundle → MinIO upload → API POST.
 * Serialized via checkpointInProgress mutex — concurrent calls are skipped.
 * Can be called directly (phase boundary, SIGTERM) or via debounced watcher.
 */
export async function checkpoint(): Promise<void> {
  if (!gitReady) {
    logger.debug('Git not ready, skipping checkpoint');
    return;
  }
  if (checkpointInProgress) {
    logger.debug('Checkpoint already in progress, skipping');
    return;
  }

  checkpointInProgress = true;
  try {
    // 1. Stage all changes
    await execFileAsync('git', ['add', '-A'], { cwd: WORKSPACE });

    // 2. Check if there are changes to commit
    try {
      await execFileAsync('git', ['diff', '--cached', '--quiet'], { cwd: WORKSPACE });
      // No changes — skip bundle/upload
      logger.debug('No changes to checkpoint');
      return;
    } catch {
      // diff --cached --quiet exits non-zero when there ARE changes — proceed
    }

    // 3. Commit
    await execFileAsync('git', ['commit', '-m', `checkpoint ${new Date().toISOString()}`], { cwd: WORKSPACE });

    // 4. Create bundle
    await execFileAsync('git', ['bundle', 'create', BUNDLE_PATH, '--all'], { cwd: WORKSPACE });

    // 5. Upload bundle to MinIO (fire-and-forget errors)
    await uploadBundle().catch(err => {
      logger.error({ err }, 'Bundle upload to MinIO failed');
    });

    // 6. POST manifest to API for DB sync
    await postManifestToApi().catch(err => {
      logger.error({ err }, 'Manifest POST to API failed');
    });

    logger.info('Checkpoint complete');
  } catch (err) {
    logger.error({ err }, 'Checkpoint failed');
  } finally {
    checkpointInProgress = false;
  }
}

async function uploadBundle(): Promise<void> {
  const minio = getMinioClient();
  const bucket = process.env.MINIO_BUCKET || 'viona';
  const key = `checkpoints/${SANDBOX_ID}/workspace.bundle`;

  const bundleStat = await stat(BUNDLE_PATH);
  const stream = createReadStream(BUNDLE_PATH);

  await minio.putObject(bucket, key, stream, bundleStat.size, {
    'Content-Type': 'application/octet-stream',
  });
  logger.debug({ key, size: bundleStat.size }, 'Bundle uploaded to MinIO');
}

async function postManifestToApi(): Promise<void> {
  if (!API_CALLBACK_URL || !SANDBOX_ID) return;

  const manifestRaw = await readFile(MANIFEST_PATH, 'utf-8');
  const manifest = JSON.parse(manifestRaw);

  const res = await fetch(`${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/checkpoint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SANDBOX_SECRET}`,
    },
    body: JSON.stringify({ manifest }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    logger.error({ status: res.status }, 'API checkpoint POST failed');
  }
}

/**
 * Ensure git repo is ready for checkpointing.
 * On first boot: initGitRepo() handles this.
 * On resume (bundle restore): .git exists but gitReady flag is false and
 * user config may be missing (git clone doesn't copy local config).
 */
async function ensureGitReady(): Promise<void> {
  if (gitReady) return;

  try {
    // Check if .git directory exists (bundle restore case)
    await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: WORKSPACE });
    // Repo exists — ensure config is set (clone doesn't copy local config)
    await execFileAsync('git', ['config', 'user.email', 'sandbox@viona.ai'], { cwd: WORKSPACE });
    await execFileAsync('git', ['config', 'user.name', 'Viona Sandbox'], { cwd: WORKSPACE });
    gitReady = true;
    logger.info('Existing git repo detected and configured (resumed from bundle)');
  } catch {
    // No git repo — initGitRepo() will be called by workspace-init
  }
}

/**
 * Start watching manifest.json for changes. Debounces 5s then runs checkpoint().
 */
export function startCheckpointWatcher(): void {
  if (watcher) return; // Already watching

  // On resume, .git may exist from bundle restore but gitReady is false
  ensureGitReady().catch(err => logger.warn({ err }, 'ensureGitReady failed'));

  try {
    watcher = watch(MANIFEST_PATH, () => {
      // Reset debounce timer on each change
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        checkpoint().catch(err => {
          logger.error({ err }, 'Debounced checkpoint failed');
        });
      }, DEBOUNCE_MS);
    });

    logger.info('Checkpoint watcher started (5s debounce)');
  } catch (err) {
    logger.error({ err }, 'Failed to start checkpoint watcher');
  }
}

/**
 * Stop watching manifest.json.
 */
export function stopCheckpointWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
