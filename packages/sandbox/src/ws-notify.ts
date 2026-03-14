import pino from 'pino';

const logger = pino({ name: 'ws-notify' });

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

export async function notifyManifestUpdated(): Promise<void> {
  if (!API_CALLBACK_URL || !SANDBOX_ID) return;
  try {
    await fetch(`${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/manifest-updated`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SANDBOX_SECRET}`,
      },
      body: JSON.stringify({}),
    });
  } catch (err) {
    logger.debug({ err }, 'manifest-updated notification failed (best-effort)');
  }
}
