// packages/sandbox/src/api-callback.ts

import pino from 'pino';

const logger = pino({ name: 'api-callback' });

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

// Debounce timers per event type
const timers = new Map<string, ReturnType<typeof setTimeout>>();
// Pending payloads — latest wins per type
const pending = new Map<string, unknown>();

// Debounce intervals per type (ms)
// Debounced types use "latest-wins" — only the most recent payload is sent
// after the debounce window.
const DEBOUNCE: Record<string, number> = {
  text: 500,
  task_updated: 200,
  // All other types: immediate (0)
};

/**
 * Push a state change to the API. Fire-and-forget with per-type debouncing.
 * text chunks batch at 500ms, task updates at 200ms, everything else is immediate.
 */
export function pushState(type: string, data: unknown): void {
  if (!API_CALLBACK_URL || !SANDBOX_ID) return;

  const debounceMs = DEBOUNCE[type] ?? 0;

  if (debounceMs === 0) {
    // Immediate — send now
    send(type, data);
    return;
  }

  // Debounced — store latest and schedule
  pending.set(type, data);
  if (!timers.has(type)) {
    timers.set(type, setTimeout(() => {
      timers.delete(type);
      const payload = pending.get(type);
      pending.delete(type);
      if (payload !== undefined) send(type, payload);
    }, debounceMs));
  }
}

/** Flush all pending debounced callbacks immediately. Call on job completion. */
export function flushCallbacks(): void {
  timers.forEach((timer, type) => {
    clearTimeout(timer);
    const payload = pending.get(type);
    if (payload !== undefined) send(type, payload);
  });
  timers.clear();
  pending.clear();
}

function send(type: string, data: unknown): void {
  const url = `${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/agent-state`;
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SANDBOX_SECRET}`,
    },
    body: JSON.stringify({ type, data, timestamp: Date.now() }),
  }).catch((err) => {
    logger.debug({ err: err.message, type }, 'API callback failed (non-blocking)');
  });
}
