// packages/sandbox/src/api-callback.ts

import pino from 'pino';

const logger = pino({ name: 'api-callback' });

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

// Debounce intervals per type (ms)
const DEBOUNCE: Record<string, number> = {
  text: 500,
  task_updated: 200,
};

// Per-type debounce state
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, unknown>();

// Generation counter — incremented on each flushCallbacks() call.
// Debounced sends that fire after a flush belong to a stale generation and are skipped.
let generation = 0;

/**
 * Push a state change to the API. Fire-and-forget with per-type debouncing.
 * text chunks batch at 500ms, task updates at 200ms, everything else is immediate.
 */
export function pushState(type: string, data: unknown): void {
  if (!API_CALLBACK_URL || !SANDBOX_ID) return;

  const debounceMs = DEBOUNCE[type] ?? 0;

  if (debounceMs === 0) {
    send(type, data);
    return;
  }

  // Debounced — store latest and schedule
  pending.set(type, data);
  const capturedGen = generation;

  if (!timers.has(type)) {
    timers.set(type, setTimeout(() => {
      timers.delete(type);
      // Skip if a flush happened since this timer was scheduled
      if (generation !== capturedGen) return;
      const payload = pending.get(type);
      pending.delete(type);
      if (payload !== undefined) send(type, payload);
    }, debounceMs));
  }
}

/** Flush all pending debounced callbacks immediately. Call on job completion. */
export function flushCallbacks(): void {
  generation++;
  for (const [, timer] of timers) {
    clearTimeout(timer);
  }
  for (const [type] of timers) {
    const payload = pending.get(type);
    if (payload !== undefined) send(type, payload);
  }
  timers.clear();
  pending.clear();
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [500, 1500, 4000];

function send(type: string, data: unknown): void {
  const url = `${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/agent-state`;
  const body = JSON.stringify({ type, data, timestamp: Date.now() });

  const attempt = (retryIndex: number) => {
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SANDBOX_SECRET}`,
      },
      body,
    }).then((res) => {
      // Retry on server errors (5xx) — the API may be restarting
      if (!res.ok && res.status >= 500 && retryIndex < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryIndex] ?? 4000;
        setTimeout(() => attempt(retryIndex + 1), delay);
      } else if (!res.ok) {
        logger.warn({ status: res.status, type }, 'API callback rejected');
      }
    }).catch((err) => {
      if (retryIndex < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryIndex] ?? 4000;
        setTimeout(() => attempt(retryIndex + 1), delay);
      } else {
        logger.warn({ err: err.message, type, retries: retryIndex }, 'API callback failed after retries');
      }
    });
  };

  attempt(0);
}
