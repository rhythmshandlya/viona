# Plan 5: Event Delivery Reliability & Frontend Resilience

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate silent event loss across the SSE pipeline (sandbox → API → frontend), fix frontend data loss on page refresh, and harden all SSE write paths so disconnects are handled gracefully instead of silently swallowing events.

**Architecture:** Two tracks: (A) Backend event delivery — add retry to API callbacks, guard all SSE write paths with try-catch and connection checks, fix proxyFileRequest resource leak, reset monologue suppression per-turn. (B) Frontend resilience — persist widget responses in sessionStorage, reduce stuck-streaming timeout from 30 min to 5 min, remove dead Last-Event-ID infrastructure and unused refs.

**Tech Stack:** TypeScript, Express (sandbox), Fastify (API proxy), React/Next.js (frontend)

---

### Task 1: Add retry with backoff to API callbacks

**Files:**
- Modify: `packages/sandbox/src/api-callback.ts` (full rewrite of `send()`)

The `send()` function (line 63) is fire-and-forget: a single `fetch()` with `.catch()` that logs debug. If the API server hiccups for even 1 second, task state never syncs and the frontend shows stale "busy" indefinitely. Add exponential backoff with 3 retries.

- [ ] **Step 1: Replace `send()` with retry logic**

Replace lines 63-75:

```typescript
// BEFORE:
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

// AFTER:
const MAX_RETRIES = 3;
const RETRY_DELAYS = [500, 1500, 4000]; // exponential-ish backoff

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
```

- [ ] **Step 2: Verify the sandbox still compiles**

```bash
cd packages/sandbox && npx tsc --noEmit
```

Expected: only the pre-existing errors (if any), no new errors.

---

### Task 2: Guard all SSE write paths in agent-server

**Files:**
- Modify: `packages/sandbox/src/agent-server.ts:264-267` (render endpoint `sendSSE`)
- Modify: `packages/sandbox/src/agent-server.ts:133-139` (heartbeat)

Two problems: (1) The `/render` endpoint's `sendSSE` (line 264) has no try-catch — if the client disconnects mid-render, `res.write()` throws an unhandled error and leaks the heartbeat interval. (2) The `/prompt` heartbeat (line 133) keeps calling `sendSSE` after disconnect — harmless but wasteful.

- [ ] **Step 1: Guard the `/render` endpoint's sendSSE with try-catch and connection tracking**

Replace lines 252-301:

```typescript
  // Render endpoint — produces final MP4 from current workspace state
  app.post('/render', async (req, res) => {
    const { compositionId, crf, concurrency } = req.body || {};

    // SSE for progress
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    let eventId = 0;
    let connectionAlive = true;

    const sendSSE = (event: string, data: unknown) => {
      if (!connectionAlive) return;
      try {
        eventId++;
        res.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        connectionAlive = false;
      }
    };

    res.on('close', () => { connectionAlive = false; });
    res.on('error', () => { connectionAlive = false; });

    const heartbeat = setInterval(() => sendSSE('heartbeat', {}), 15000);

    try {
      sendSSE('progress', { phase: 'rendering', percent: 0, message: 'Starting Remotion render...' });

      const result = await renderVideo({
        compositionId,
        crf,
        concurrency,
        onProgress: (line) => {
          const renderMatch = line.match(/Rendering frames.*?(\d+)%/);
          const stitchMatch = line.match(/Stitching.*?(\d+)%/);
          if (renderMatch) {
            const pct = parseInt(renderMatch[1], 10);
            sendSSE('progress', { phase: 'rendering', percent: Math.round(pct * 0.8), message: `Rendering frames... ${pct}%` });
          } else if (stitchMatch) {
            const pct = parseInt(stitchMatch[1], 10);
            sendSSE('progress', { phase: 'stitching', percent: 80 + Math.round(pct * 0.2), message: `Encoding video... ${pct}%` });
          }
        },
      });

      sendSSE('done', {
        outputPath: result.outputPath,
        durationMs: result.durationMs,
      });
    } catch (err) {
      sendSSE('error', { message: err instanceof Error ? err.message : 'Render failed' });
    } finally {
      clearInterval(heartbeat);
      if (connectionAlive) {
        try { res.end(); } catch { /* already closed */ }
      }
    }
  });
```

- [ ] **Step 2: Verify compile**

```bash
cd packages/sandbox && npx tsc --noEmit
```

---

### Task 3: Fix proxyFileRequest — add reader cleanup and destroyed check

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts:52-65` (proxyFileRequest stream loop)

The file proxy lacks client disconnect detection. No `reader.cancel()`, no `passthrough.destroyed` check. A user closing a video preview tab keeps draining the full response from the sandbox.

- [ ] **Step 1: Add passthrough.destroyed check and reader.cancel() to proxyFileRequest**

Replace lines 52-65:

```typescript
    // Stream response body via PassThrough
    if (res.body) {
      const passthrough = new PassThrough();
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      // Stop reading from sandbox if client disconnects
      passthrough.on('close', () => {
        if (reader) { reader.cancel().catch(() => {}); reader = null; }
      });
      passthrough.on('error', () => {
        if (reader) { reader.cancel().catch(() => {}); reader = null; }
      });

      reply.status(res.status).send(passthrough);

      reader = (res.body as ReadableStream).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (passthrough.destroyed) break;
          passthrough.write(value);
        }
      } finally {
        if (reader) { reader.cancel().catch(() => {}); }
        if (!passthrough.destroyed) { try { passthrough.end(); } catch { /* already ended */ } }
      }
    } else {
      reply.status(res.status).send('');
    }
```

- [ ] **Step 2: Verify compile**

```bash
cd packages/api && npx tsc --noEmit
```

---

### Task 4: Reset monologue suppression per-turn in SSE proxy

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts:288` (add reset on `done` event)

`toolsUsedInTurn` is set `true` on any tool event and never reset. After a tool call, legitimate text within 5 seconds is suppressed even if it's real user-facing content.

- [ ] **Step 1: Reset monologue suppression state on `done` event**

In the switch statement, find the `case 'done':` handler (around line 373) and add resets after `flushTextBuffer()`:

```typescript
case 'done': {
  receivedDone = true;
  flushTextBuffer();
  // Reset monologue suppression for next turn
  toolsUsedInTurn = false;
  lastToolEventTime = 0;
  writeSSE('done', data, eventId);
  try {
    await callbacks.onDone?.(data);
  } catch (err) {
    logger.error({ err }, 'InterceptCallbacks.onDone failed');
  }
  break;
}
```

- [ ] **Step 2: Verify compile**

```bash
cd packages/api && npx tsc --noEmit
```

---

### Task 5: Persist pending widget responses in sessionStorage

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:150` (replace useRef)
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:908-932` (widget handler + flush effect)
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:1014` (reset handler)

`pendingWidgetResponseRef` uses `useRef` which dies on page refresh. If a user clicks a widget button during streaming and refreshes, the queued response is permanently lost.

- [ ] **Step 1: Add sessionStorage helpers above the component**

After the component imports (before line 120), add:

```typescript
// -- Widget response persistence (survives page refresh) --
const PENDING_WIDGET_KEY_PREFIX = 'viona:pendingWidgets:';
function getPendingWidgetResponses(projectId: string): Array<{ widgetId: string; value: unknown }> {
  try {
    const stored = sessionStorage.getItem(`${PENDING_WIDGET_KEY_PREFIX}${projectId}`);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}
function setPendingWidgetResponses(projectId: string, responses: Array<{ widgetId: string; value: unknown }>) {
  try {
    if (responses.length === 0) {
      sessionStorage.removeItem(`${PENDING_WIDGET_KEY_PREFIX}${projectId}`);
    } else {
      sessionStorage.setItem(`${PENDING_WIDGET_KEY_PREFIX}${projectId}`, JSON.stringify(responses));
    }
  } catch { /* storage full — non-critical */ }
}
```

- [ ] **Step 2: Remove the useRef declaration**

Remove line 150:

```typescript
// REMOVE:
const pendingWidgetResponseRef = useRef<Array<{ widgetId: string; value: unknown }>>([]);
```

- [ ] **Step 3: Update handleWidgetResponse to use sessionStorage**

Replace lines 908-923:

```typescript
const handleWidgetResponse = useCallback(
  (widgetId: string, value: unknown) => {
    if (isStreaming) {
      const pending = getPendingWidgetResponses(projectId);
      pending.push({ widgetId, value });
      setPendingWidgetResponses(projectId, pending);
      return;
    }
    setMessages((prev) => prev.map((m) => ({
      ...m,
      content: m.content.map((block) => {
        if (block.type === 'widget' && block.widget.id === widgetId) return { ...block, response: value };
        return block;
      }),
    })));
    sendMessage('', { widgetId, value });
  },
  [sendMessage, isStreaming, projectId]
);
```

- [ ] **Step 4: Update the flush effect to use sessionStorage**

Replace lines 927-932:

```typescript
useEffect(() => {
  if (!isStreaming) {
    const pending = getPendingWidgetResponses(projectId);
    if (pending.length > 0) {
      const next = pending.shift()!;
      setPendingWidgetResponses(projectId, pending);
      handleWidgetResponse(next.widgetId, next.value);
    }
  }
}, [isStreaming, handleWidgetResponse, projectId]);
```

- [ ] **Step 5: Update the queued message flush to use sessionStorage**

On line 936, replace `pendingWidgetResponseRef.current.length === 0` with:

```typescript
useEffect(() => {
  if (!isStreaming && getPendingWidgetResponses(projectId).length === 0 && messageQueueRef.current.length > 0) {
    const next = messageQueueRef.current.shift()!;
    setQueueSize(messageQueueRef.current.length);
    _executeMessage({ messageText: next.text, fullMessage: next.fullMessage, existingUserMsgId: next.id, snapshotContext: next.context });
  }
}, [isStreaming, _executeMessage, projectId]);
```

- [ ] **Step 6: Clear sessionStorage in the reset handler**

At line 1014 (after `sessionStorage.removeItem(`viona:activeJobId:${projectId}`);`), add:

```typescript
sessionStorage.removeItem(`${PENDING_WIDGET_KEY_PREFIX}${projectId}`);
```

Note: `PENDING_WIDGET_KEY_PREFIX` is defined outside the component, so it's accessible here.

---

### Task 6: Reduce stuck streaming timeout and polling interval

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:436-437`

When the `done` event is lost, recovery polling starts with `MAX_POLL_MS = 30 * 60 * 1000` (30 minutes) and `POLL_INTERVAL = 5000` (5 seconds). The user sees a permanent loading state for up to 30 minutes. Reduce to 5 minutes max with 3-second polling.

- [ ] **Step 1: Change the timeout and interval constants**

Replace lines 436-437:

```typescript
// BEFORE:
const MAX_POLL_MS = 30 * 60 * 1000; // 30 min
const POLL_INTERVAL = 5000;

// AFTER:
const MAX_POLL_MS = 5 * 60 * 1000; // 5 min — don't trap user in loading state
const POLL_INTERVAL = 3000;
```

---

### Task 7: Remove dead Last-Event-ID infrastructure and unused refs

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:151` (remove `lastEventIdRef`)
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:155` (remove `lastProgressTimeRef`)
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:705` (remove `lastEventIdRef.current` from chatWithAgent call)
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:710` (remove `lastEventIdRef.current = event.id`)
- Modify: `apps/web/src/lib/api.ts:517,527-529` (remove `lastEventId` parameter and header)

The frontend tracks `lastEventIdRef` and sends `Last-Event-ID` header, but the API never reads it. `lastProgressTimeRef` is updated in 6 places but never read for any decision.

- [ ] **Step 1: Remove `lastEventIdRef` declaration**

Remove line 151:

```typescript
// REMOVE:
const lastEventIdRef = useRef<number | undefined>(undefined);
```

- [ ] **Step 2: Remove `lastProgressTimeRef` declaration**

Remove line 155:

```typescript
// REMOVE:
const lastProgressTimeRef = useRef(Date.now());
```

- [ ] **Step 3: Remove all `lastProgressTimeRef.current = Date.now()` assignments**

Search for `lastProgressTimeRef.current` and remove every assignment. These appear at approximately lines 177, 254, 290, 456, 497. Remove each line entirely.

- [ ] **Step 4: Remove `lastEventIdRef.current` from chatWithAgent call**

On line 705, remove the last argument:

```typescript
// BEFORE:
}, controller.signal, lastEventIdRef.current ?? undefined);

// AFTER:
}, controller.signal);
```

- [ ] **Step 5: Remove `lastEventIdRef.current = event.id` in SSE loop**

Remove line 710:

```typescript
// REMOVE:
if (event.id !== undefined) lastEventIdRef.current = event.id;
```

- [ ] **Step 6: Remove `lastEventId` parameter and header from api.ts**

In `apps/web/src/lib/api.ts`, update the function signature (line 517) and remove the header (lines 527-529):

```typescript
// BEFORE (line 517):
  lastEventId?: number,

// AFTER:
// (remove the parameter entirely)

// BEFORE (lines 527-529):
    if (lastEventId !== undefined) {
      headers['Last-Event-ID'] = String(lastEventId);
    }

// AFTER:
// (remove these 3 lines entirely)
```

- [ ] **Step 7: Verify frontend compiles**

```bash
cd apps/web && npx next build --no-lint 2>&1 | head -20
```

Or use tsc:

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

---

### Task 8: Isolate debounce timers per request

**Files:**
- Modify: `packages/sandbox/src/api-callback.ts` (scope timers per flush-group)

The global `timers` and `pending` maps are shared across all concurrent requests. If Request B finishes and calls `flushCallbacks()` while Request A's `task_updated` is still queued, A's event gets flushed prematurely or lost. Fix by scoping debounce per flush-group.

- [ ] **Step 1: Add a generation counter to isolate flushes**

Since the sandbox only processes one orchestrator request at a time (enforced by `isJobBusy()`), the real race is between `flushCallbacks()` and pending timers. The simplest fix is to make `flushCallbacks()` only flush events from the current job generation:

Replace the full file contents:

```typescript
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
  for (const [type, timer] of timers) {
    clearTimeout(timer);
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
```

Note: This combines Task 1 (retry) and Task 8 (isolation) into a single clean file. If Task 1 was already applied, this is the final version that includes both fixes.

- [ ] **Step 2: Verify compile**

```bash
cd packages/sandbox && npx tsc --noEmit
```
