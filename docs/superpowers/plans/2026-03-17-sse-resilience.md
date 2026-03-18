# SSE Resilience Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SSE pipeline between sandbox, API proxy, and frontend resilient to disconnections so that in-progress work is never silently lost.

**Architecture:** Three layers need hardening: (1) sandbox catches socket errors and aborts cleanly instead of crashing, (2) API proxy detects broken streams and injects synthetic error events, (3) frontend detects stream loss mid-work and recovers via polling. A 30-second heartbeat round-trip from frontend to backend provides continuous connectivity proof.

**Tech Stack:** Express (sandbox), Fastify (API), React/Next.js (frontend), Redis (progress state), SSE (streaming)

---

## Failure Chain (what we're fixing)

```
Frontend disconnects / network drop / timeout
  → Fastify destroys PassThrough
  → Proxy passthrough.write() throws (writing to destroyed stream)
  → Error propagates, proxy abandons sandbox reader without cancelling
  → Sandbox keeps writing SSE → EPIPE on dead socket
  → Unhandled EPIPE crashes sandbox SSE response
  → claude subprocess survives as orphan, keeps working
  → Frontend thinks stream ended normally, goes idle
  → Work continues invisibly, output goes nowhere
```

## File Structure

| File | Responsibility |
|------|---------------|
| `packages/sandbox/src/agent-server.ts` | Sandbox SSE endpoints — catch socket errors, guard writes |
| `packages/api/src/sandbox/proxy.ts` | API proxy — track `done`, cancel sandbox reader on client disconnect, inject synthetic errors |
| `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` | Frontend — detect stream loss without `done`, poll for recovery, heartbeat |
| `apps/web/src/lib/api.ts` | API client — add `sandboxProgress` to conversation response type |

---

### Task 1: Sandbox EPIPE Resilience

**Files:**
- Modify: `packages/sandbox/src/agent-server.ts:78-155`

> Already partially done. This task verifies and completes the fix.

- [ ] **Step 1: Verify `sendSSE` is guarded with `connectionAlive` flag**

The `/prompt` and `/render` endpoints must both:
1. Track `connectionAlive = true` flag
2. Guard every `res.write()` with `if (!connectionAlive) return` + try/catch
3. Listen for `res.on('error')` and `res.on('close')` to set `connectionAlive = false` and abort

Verify this is in place for both endpoints. The `/prompt` endpoint should already have:

```typescript
let connectionAlive = true;
const sendSSE = (event: string, data: unknown) => {
  if (!connectionAlive) return;
  eventId++;
  try {
    res.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    connectionAlive = false;
  }
};

res.on('close', () => {
  connectionAlive = false;
  abortController.abort();
});
res.on('error', (err) => {
  logger.warn({ err: err.message }, 'SSE socket error, aborting orchestrator');
  connectionAlive = false;
  abortController.abort();
});
```

- [ ] **Step 2: Verify the `/render` endpoint has the same guards**

Same pattern as `/prompt`. Should have `connectionAlive`, guarded `sendSSE`, `res.on('close')`, `res.on('error')`.

- [ ] **Step 3: Test by manually killing the API while sandbox is streaming**

Run: Start sandbox, send a prompt, kill the API process mid-stream.
Expected: Sandbox logs `SSE socket error`, aborts orchestrator, no crash.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/agent-server.ts
git commit -m "fix(sandbox): handle EPIPE on SSE socket disconnect"
```

---

### Task 2: API Proxy Resilience

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts:158-354`

> Already partially done. This task verifies and completes the fix.

- [ ] **Step 1: Verify proxy tracks client disconnect and cancels sandbox reader**

The `proxyPromptWithIntercept` function must:
1. Create an `AbortController` and pass `signal` to `fetch()` so the sandbox connection is cancelled when frontend disconnects
2. Track `clientAlive` flag, set to `false` on `passthrough.on('close')` and `passthrough.on('error')`
3. Guard `writeSSE` with `if (!clientAlive || passthrough.destroyed) return`
4. Call `reader.cancel()` in the `finally` block

Verify this is in place. The function should have:

```typescript
const abortController = new AbortController();

const res = await fetch(url, {
  // ...
  signal: abortController.signal,
});

let clientAlive = true;
passthrough.on('close', () => {
  clientAlive = false;
  abortController.abort();
});
passthrough.on('error', (err) => {
  clientAlive = false;
  abortController.abort();
});

const writeSSE = (eventType: string, data: unknown) => {
  if (!clientAlive || passthrough.destroyed) return;
  try {
    passthrough.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    clientAlive = false;
    abortController.abort();
  }
};
```

And in the `finally`:
```typescript
try { reader.cancel(); } catch { /* already closed */ }
```

- [ ] **Step 2: Verify proxy tracks `receivedDone` and injects synthetic error**

When the sandbox stream ends without a `done` event, the proxy must inject a synthetic `error` event so the frontend knows the stream was interrupted (not cleanly finished):

```typescript
if (!receivedDone && clientAlive) {
  logger.warn({ ...logCtx, eventCount }, 'Proxy: sandbox stream ended without done event');
  writeSSE('error', {
    message: 'Connection to sandbox was interrupted. Your work may still be in progress.',
    recoverable: true,
  });
}
```

- [ ] **Step 3: Verify proxy has lifecycle logging**

Log at these points:
- `Proxy: connecting to sandbox` — when fetch starts
- `Proxy: client disconnected` — on passthrough close
- `Proxy: sandbox stream ended without done event` — if no `done` received
- `Proxy: stream ended` — with `{ eventCount, receivedDone, clientAlive }` context

- [ ] **Step 4: Verify the raw-event fallback catch also guards passthrough writes**

The inner catch that forwards non-JSON events must also guard:
```typescript
catch {
  if (clientAlive && !passthrough.destroyed) {
    try { passthrough.write(raw + '\n\n'); } catch { clientAlive = false; }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/sandbox/proxy.ts
git commit -m "fix(api): make SSE proxy resilient to client/sandbox disconnects"
```

---

### Task 3: Frontend Heartbeat

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

The frontend should verify backend connectivity every 30 seconds while streaming. If the heartbeat fails, it means the SSE connection is stale and the frontend should attempt recovery.

- [ ] **Step 1: Add heartbeat polling effect**

After the stall detection effect (around line 298), add a new effect that pings the backend every 30 seconds while streaming:

```typescript
// Backend connectivity heartbeat — ping every 30s while streaming
useEffect(() => {
  if (!isStreaming) return;
  const check = async () => {
    try {
      const status = await api.getSandboxStatus(projectId);
      if (status.status !== 'ready') {
        console.warn('Heartbeat: sandbox not ready, status:', status.status);
      }
    } catch (err) {
      console.warn('Heartbeat: backend unreachable', err);
    }
  };
  const interval = setInterval(check, 30_000);
  return () => clearInterval(interval);
}, [isStreaming, projectId]);
```

This is a lightweight check. It uses the existing `getSandboxStatus` endpoint (already exists in `api.ts`) which is a simple GET. If it fails, we log it — the stall detection + timeout will handle the actual recovery.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat(web): add 30s backend heartbeat during streaming"
```

---

### Task 4: Frontend Recovery on Stream Loss

**Files:**
- Modify: `apps/web/src/lib/api.ts:526-555` (update `getConversation` response type)
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

When the SSE stream ends without a `done` event (either via the synthetic `recoverable` error from Task 2, or via clean stream termination), the frontend should poll the conversation endpoint to recover sandbox progress from Redis.

- [ ] **Step 1: Update `getConversation` return type in api.ts**

The API already returns `sandboxProgress`, `sandboxActivity`, and `sandboxPlan` from Redis but the client type doesn't declare them. Add to the return type:

```typescript
async getConversation(projectId: string): Promise<{
  conversationId: string | null;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: unknown;
    createdAt: string;
  }>;
  activeJob?: {
    id: string;
    type: string;
    progress: number;
    message: string | null;
    phase?: string;
    phaseName?: string;
    jobType?: string;
    progressMeta?: {
      phase?: string;
      phaseName?: string;
      scene?: number;
      totalScenes?: number;
      iteration?: number;
      maxIterations?: number;
      score?: number;
      detail?: string;
    } | null;
  } | null;
  sandboxProgress?: {
    phase?: string;
    message?: string;
    agentName?: string;
    percent?: number;
  } | null;
  sandboxActivity?: {
    agent?: string;
    action?: string;
    phase?: string;
    startedAt?: number;
  } | null;
}> {
  return this.request(`/api/projects/${projectId}/agent/conversation`);
}
```

- [ ] **Step 2: Handle `recoverable` error events in `handleSSEEvent`**

In `AIAssistantPanel.tsx`, modify the `error` case in `handleSSEEvent` (around line 487):

```typescript
if (eventType === 'error') {
  const errorData = data as { message?: string; error?: string; recoverable?: boolean };
  if (errorData.recoverable) {
    // Stream interrupted but work may be in progress — poll for recovery
    pollForRecovery(assistantMessageId);
    return;
  }
  setIsStreaming(false);
  setActiveJobId(null);
  setCurrentProgress(null);
  setLastError(sanitizeErrorMessage(errorData.message || errorData.error || 'Something went wrong'));
  activityState.reset();
}
```

- [ ] **Step 3: Add `pollForRecovery` function**

Add a new function before `handleSSEEvent`:

```typescript
const pollForRecovery = useCallback(async (assistantMessageId: string) => {
  // Poll conversation endpoint every 5s to check if sandbox is still working
  const MAX_POLLS = 60; // 5 minutes max
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const data = await api.getConversation(projectId);

      // Check if sandbox is still working (progress in Redis)
      if (data.sandboxProgress) {
        setCurrentProgress({
          phase: data.sandboxProgress.phase || 'working',
          message: data.sandboxProgress.message || 'Working...',
          agentName: data.sandboxProgress.agentName,
          startedAt: Date.now(),
        });
        lastProgressTimeRef.current = Date.now();
        setStallState('ok');
        continue; // Still working, keep polling
      }

      // No progress in Redis — work either finished or failed
      // Reload messages from server (they were persisted in onDone callback)
      if (data.messages && data.messages.length > 0) {
        const loaded: Message[] = data.messages.map((m) => ({
          id: m.id, role: m.role, content: normalizeContent(m.content), createdAt: m.createdAt,
        }));
        setMessages(loaded);
        if (data.conversationId) setConversationId(data.conversationId);
      }

      // Check for active jobs
      if (data.activeJob) {
        if (data.activeJob.jobType !== 'plan-visuals') setActiveJobId(data.activeJob.id);
        activityState.onProgress({ message: data.activeJob.message || 'Processing...', phase: data.activeJob.phase });
      }

      // Done recovering
      setIsStreaming(false);
      setCurrentProgress(null);
      activityState.reset();
      clearCompositionCache();
      if (reloadVisuals) reloadVisuals(projectId);
      return;
    } catch {
      // Network error during poll — continue trying
      continue;
    }
  }
  // Exceeded max polls
  setIsStreaming(false);
  setCurrentProgress(null);
  activityState.reset();
  setLastError('Lost connection to the sandbox. Please try sending another message.');
}, [projectId, reloadVisuals, activityState]);
```

- [ ] **Step 4: Handle clean stream end without `done`**

In `_executeMessage`, after the for-await loop at line 553, check if `done` was received:

```typescript
// Track whether we received a done event
const receivedDoneRef = { current: false };
const originalHandleSSEEvent = handleSSEEvent;
const wrappedHandleSSEEvent = (event: { event: string; data: unknown }, assistantId: string) => {
  if (event.event === 'done') receivedDoneRef.current = true;
  originalHandleSSEEvent(event, assistantId);
};

// In the for-await loop:
for await (const event of parseSSEStream(stream, { ... })) {
  resetSafetyTimeout();
  if (event.id !== undefined) lastEventIdRef.current = event.id;
  wrappedHandleSSEEvent(event, assistantId);
}

// After loop — if no done, try recovery
if (!receivedDoneRef.current) {
  console.warn('SSE stream ended without done event — attempting recovery');
  pollForRecovery(assistantId);
} else {
  setIsStreaming(false);
}
```

Note: Since `handleSSEEvent` already handles the `done` event by calling `setIsStreaming(false)`, the `else` branch here is a safety fallback for cases where `done` was received but the handler didn't fire (shouldn't happen, but defensive).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat(web): recover from SSE stream loss via conversation polling"
```

---

### Task 5: Verify End-to-End

- [ ] **Step 1: Restart the sandbox and API**

Rebuild the sandbox container with the EPIPE fix:
```bash
cd packages/sandbox && docker build -t viona-sandbox:latest .
```

Restart the API to pick up proxy changes.

- [ ] **Step 2: Test normal flow**

1. Open editor, send a message
2. Wait for response
3. Verify: `done` event received, cursor disappears, no errors in console

- [ ] **Step 3: Test frontend disconnect**

1. Send a message that triggers visual generation (approve a scene plan)
2. While sandbox is working, close the browser tab
3. Verify in sandbox logs: `SSE socket error, aborting orchestrator` (not EPIPE crash)
4. Verify in API logs: `Proxy: client disconnected`

- [ ] **Step 4: Test sandbox disconnect**

1. Send a message that triggers visual generation
2. While sandbox is working, `docker stop` the sandbox container
3. Verify in API logs: `Proxy: sandbox stream ended without done event`
4. Verify frontend: shows recoverable error, starts polling
5. Restart sandbox, send another message — should work normally

- [ ] **Step 5: Test network interruption**

1. Send a message
2. While streaming, disable network briefly (airplane mode or kill proxy)
3. Verify: SSE parser timeout fires (90s), frontend enters recovery flow
4. Re-enable network
5. Verify: frontend polls conversation endpoint and recovers

- [ ] **Step 6: Commit test results**

Document any issues found and fixes applied.
