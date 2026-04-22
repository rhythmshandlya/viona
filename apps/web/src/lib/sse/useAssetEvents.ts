import { useEffect, useRef } from 'react';
import { getSessionToken } from '../auth';

export interface AssetEvent {
  id: string;
  assetId: string;
  userId: string;
  projectId: string | null;
  type:
    | 'created'
    | 'ready'
    | 'metadata_ready'
    | 'transcript_ready'
    | 'linked'
    | 'unlinked'
    | 'renamed'
    | 'deleted'
    | 'failed';
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface UseAssetEventsOptions {
  enabled: boolean;
  apiBaseUrl?: string;
  onEvent: (event: AssetEvent) => void;
}

/**
 * Subscribes to user-scoped /asset-events SSE stream.
 *
 * The backend (packages/api/src/routes/asset-events-sse.ts) emits plain
 * `data: <json>\n\n` frames with no `event:` line, plus `: connected\n\n`
 * heartbeat-style comments. Per the SSE spec, frames without an `event:` line
 * default to the `message` event — we surface those as AssetEvent.
 *
 * The shared `parseSSEStream` helper (lib/sse-parser.ts) only yields when both
 * `currentEvent` AND `currentData` are set, so it would silently drop these
 * frames; that's why this hook does its own minimal parse.
 *
 * Reconnects on mount/unmount only — no automatic reconnect on transport
 * failure (Task 7's AssetsPanelV2 will fall back to its initial fetch).
 */
export function useAssetEvents(options: UseAssetEventsOptions): void {
  const { enabled, apiBaseUrl, onEvent } = options;

  // Stash the onEvent callback in a ref so the SSE effect can call the
  // latest version without needing to re-subscribe every render. Including
  // `onEvent` in the effect's deps caused a reconnect loop: callers that
  // passed an inline arrow function (the common case) created a new identity
  // each render, the effect cleanup aborted the in-flight SSE, and the
  // effect re-ran — opening a fresh request against `/asset-events`. On a
  // chatty editor page this showed up as a stream of ERR_ABORTED entries in
  // the network log.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const baseUrl = apiBaseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? '';
    const token = getSessionToken();

    (async () => {
      try {
        const res = await fetch(`${baseUrl}/asset-events`, {
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok || !res.body) return;

        const reader = (res.body as ReadableStream<Uint8Array>).getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let dataLines: string[] = [];

        try {
          while (true) {
            if (controller.signal.aborted) break;
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const rawLine of lines) {
              const line = rawLine.replace(/\r$/, '');
              if (line === '') {
                if (dataLines.length === 0) continue;
                const dataStr = dataLines.join('\n');
                dataLines = [];
                try {
                  const parsed = JSON.parse(dataStr) as AssetEvent;
                  onEventRef.current(parsed);
                } catch {
                  // Skip malformed payloads rather than tearing the stream down.
                }
                continue;
              }
              if (line.startsWith(':')) continue; // SSE comment / heartbeat
              if (line.startsWith('data: ')) {
                dataLines.push(line.slice(6));
              } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5));
              }
              // Ignore `event:`, `id:`, `retry:` — backend doesn't use them
              // for asset events, and the schema is fully captured in `data:`.
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[useAssetEvents]', err);
        }
      }
    })();

    return () => controller.abort();
  }, [enabled, apiBaseUrl]);
}
