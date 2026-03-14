import pino from 'pino';
import { isInitialized, ensureNodeModulesSymlink } from './workspace-init.js';
import { startFileServer } from './file-server.js';
import { startWatcher, onBundle } from './esbuild-watcher.js';
import { startCheckpointing, checkpoint } from './manifest-checkpoint.js';

const logger = pino({ name: 'sandbox' });

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL_MS || '60000', 10);

async function notifyApi(event: string, payload: Record<string, unknown> = {}): Promise<void> {
  if (!API_CALLBACK_URL || !SANDBOX_ID) return;

  try {
    await fetch(`${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/${event}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SANDBOX_SECRET}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logger.error({ err, event }, 'Failed to notify API');
  }
}

async function main(): Promise<void> {
  logger.info('Sandbox starting');

  // 1. Check if workspace is initialized (restored from backup vs first boot)
  const initialized = await isInitialized();

  if (!initialized) {
    logger.info('First boot — waiting for init from API');
  } else {
    logger.info('Workspace already initialized (resumed from backup)');
  }

  // 2. Ensure node_modules symlink
  await ensureNodeModulesSymlink();

  // 3. Start file server (port 8080)
  startFileServer(8080);

  // 4. Start agent server (port 8081) — imports dynamically to avoid circular deps
  const { startAgentServer } = await import('./agent-server.js');
  startAgentServer(8081);

  // 5. Start esbuild watcher (only if initialized — no src/ to watch on first boot)
  if (initialized) {
    onBundle((version) => {
      notifyApi('bundle-ready', { version });
    });
    await startWatcher();
    startCheckpointing(CHECKPOINT_INTERVAL);

    // Only notify ready after workspace is initialized and watcher is running.
    await notifyApi('ready');
    logger.info('Sandbox ready (resumed from backup)');
  } else {
    logger.info('Sandbox servers started — waiting for /init from API');
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await checkpoint(); // Final checkpoint
  process.exit(0);
});

main().catch((err) => {
  logger.fatal({ err }, 'Sandbox failed to start');
  process.exit(1);
});
