export interface SSEEvent {
  event: string;
  data: unknown;
  id?: number;
}

export interface SSEParserOptions {
  /** Timeout in ms after which a stale stream is considered dead. Default: 45_000 (3x heartbeat) */
  inactivityTimeoutMs?: number;
  /** AbortSignal to cancel parsing */
  signal?: AbortSignal;
}

export class SSETimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`SSE stream inactive for ${timeoutMs / 1000}s — connection likely dropped`);
    this.name = 'SSETimeoutError';
  }
}

export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  options: SSEParserOptions = {},
): AsyncGenerator<SSEEvent> {
  const { inactivityTimeoutMs = 45_000, signal } = options;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  let currentData = '';
  let currentId: number | undefined;

  // Inactivity watchdog
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  function resetWatchdog() {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timedOut = true;
      // Cancel the reader so the while-loop exits
      reader.cancel().catch(() => {});
    }, inactivityTimeoutMs);
  }

  try {
    resetWatchdog();

    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      // We received data — reset the watchdog
      resetWatchdog();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let hasHeartbeat = false;
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData += (currentData ? '\n' : '') + line.slice(6).trim();
        } else if (line.startsWith('id: ')) {
          currentId = parseInt(line.slice(4).trim(), 10);
        } else if (line.startsWith(':')) {
          // SSE comment (heartbeat) — flag it so we can yield a synthetic event
          hasHeartbeat = true;
        } else if (line === '' && currentEvent && currentData) {
          try {
            yield { event: currentEvent, data: JSON.parse(currentData), id: currentId };
          } catch {
            yield { event: currentEvent, data: currentData, id: currentId };
          }
          currentEvent = '';
          currentData = '';
          currentId = undefined;
        }
      }

      // Yield heartbeat so the caller can reset its own timeouts
      if (hasHeartbeat) {
        yield { event: 'heartbeat', data: {} };
      }
    }

    // If the loop ended because of a timeout, throw so the caller can handle it
    if (timedOut) {
      throw new SSETimeoutError(inactivityTimeoutMs);
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    reader.releaseLock();
  }
}
