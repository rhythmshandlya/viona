import { readFile } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';

const logger = pino({ name: 'manifest-checkpoint' });

const MANIFEST_PATH = join('/workspace', 'manifest.json');
const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

let intervalTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Send current manifest to API for DB checkpoint.
 */
export async function checkpoint(): Promise<void> {
  if (!API_CALLBACK_URL || !SANDBOX_ID) {
    logger.warn('API_CALLBACK_URL or SANDBOX_ID not set, skipping checkpoint');
    return;
  }

  try {
    const manifest = await readFile(MANIFEST_PATH, 'utf-8');

    const res = await fetch(`${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/checkpoint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SANDBOX_SECRET}`,
      },
      body: JSON.stringify({ manifest: JSON.parse(manifest) }),
    });

    if (!res.ok) {
      logger.error({ status: res.status }, 'Checkpoint failed');
    } else {
      logger.debug('Checkpoint synced');
    }
  } catch (err) {
    logger.error({ err }, 'Checkpoint error');
  }
}

/**
 * Start periodic checkpointing.
 */
export function startCheckpointing(intervalMs: number): void {
  logger.info({ intervalMs }, 'Starting manifest checkpoint');
  intervalTimer = setInterval(checkpoint, intervalMs);
}

/**
 * Stop periodic checkpointing.
 */
export function stopCheckpointing(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
