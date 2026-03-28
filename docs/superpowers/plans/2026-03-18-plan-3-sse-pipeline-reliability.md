# Plan 3: SSE Pipeline Reliability

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the SSE event pipeline from sandbox → API proxy → frontend so event IDs propagate correctly, multi-line data parses safely, monologue suppression doesn't leak text, and tool events from the sandbox are properly forwarded to the frontend for activity display.

**Architecture:** The SSE flow is: Sandbox `agent-server.ts` emits SSE with `id:` fields → API `proxy.ts` parses events and re-serializes them → Frontend `sse-parser.ts` yields parsed events to `AIAssistantPanel.tsx`. Currently the proxy strips event IDs during re-serialization, the multi-line data parser concatenates without separators, and tool_use/tool_result events from the sandbox (which the sandbox's `onStateChange` emits as `task_started`/`task_updated`/`task_completed`) need to correctly flow through.

**Tech Stack:** TypeScript, Fastify, Express, SSE protocol

---

### Task 1: Propagate event IDs through the proxy

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts:254-262` (the `writeSSE` function)
- Modify: `packages/api/src/sandbox/proxy.ts:308-320` (the SSE parser)

The sandbox writes `id: N\nevent: TYPE\ndata: JSON\n\n` (agent-server.ts:116), but the proxy's `writeSSE` function re-serializes without the `id:` field.

- [ ] **Step 1: Parse the `id:` field from incoming SSE events**

In the SSE parser loop (lines 308-320), the code parses `event:` and `data:` lines. Add `id:` parsing:

```typescript
let eventType = 'message';
let dataStr = '';
let eventId = '';

for (const line of raw.split('\n')) {
  if (line.startsWith('event:')) {
    eventType = line.slice(6).trim();
  } else if (line.startsWith('data:')) {
    // Use newline separator for multi-line data (SSE spec)
    dataStr += (dataStr ? '\n' : '') + line.slice(5).trim();
  } else if (line.startsWith('id:')) {
    eventId = line.slice(3).trim();
  }
}
```

Note: this also fixes the multi-line data concatenation bug (Task 2 below).

- [ ] **Step 2: Include `id:` in the re-serialized SSE output**

Change the `writeSSE` function (line 254-262):

```typescript
const writeSSE = (eventType: string, data: unknown, id?: string) => {
  if (!clientAlive || passthrough.destroyed) return;
  try {
    let sse = '';
    if (id) sse += `id: ${id}\n`;
    sse += `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    passthrough.write(sse);
  } catch {
    clientAlive = false;
    safeAbort();
  }
};
```

- [ ] **Step 3: Pass event ID through all writeSSE calls**

In the switch statement (lines 326-405), pass `eventId` as the third argument to `writeSSE`:

```typescript
case 'text':
  // ... dedup and monologue logic stays the same
  writeSSE('text', data, eventId);
  break;
case 'done':
  writeSSE('done', data, eventId);
  break;
// ... same for all other cases
```

For the monologue suppression path where `textBuffer + text` is sent, use the latest event ID:

```typescript
if (textBuffer) {
  writeSSE('text', { text: textBuffer + text }, eventId);
  // ...
}
```

---

### Task 2: Fix multi-line SSE data parsing

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts:317-318`

Already addressed in Task 1 Step 1 above. The current code:
```typescript
dataStr += line.slice(5).trim();
```

Must become:
```typescript
dataStr += (dataStr ? '\n' : '') + line.slice(5).trim();
```

This matches the SSE spec where multiple `data:` lines are joined with newlines before parsing. In practice, the sandbox always sends single-line JSON, but this makes the parser spec-compliant and prevents future bugs.

- [ ] **Step 1: Verify the fix is included in Task 1 Step 1**

This is a single-line change embedded in the parser rewrite above. Confirm it's there.

---

### Task 3: Forward tool_use and tool_result events with metadata

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts:382-387` (the tool_use/tool_result case)

Currently these events are forwarded raw and only used for monologue suppression timing. Now that Plan 1 fixes tool detection in the sandbox (so actual tool events will flow), the proxy should also pass them to callbacks for activity tracking.

- [ ] **Step 1: Add `onToolUse` and `onToolResult` to InterceptCallbacks**

In the `InterceptCallbacks` interface (line 163-171), these already exist implicitly via the `default:` case forwarding. But for explicit tracking, enhance the tool_use/tool_result handler:

```typescript
case 'tool_use':
case 'tool_result':
  lastToolEventTime = Date.now();
  toolsUsedInTurn = true;
  writeSSE(eventType, data, eventId);
  // Activity tracking: emit activity for tool calls
  if (eventType === 'tool_use' && data.tool) {
    callbacks.onActivity?.({
      agent: data.agent ?? 'Viona',
      action: data.tool,
      phase: 'working',
      startedAt: Date.now(),
    });
  }
  break;
```

Note: This depends on the sandbox emitting tool_use/tool_result SSE events. Currently the sandbox only emits these via `onStateChange` as `task_started`/`task_updated` — those already flow through the `default:` case. No change needed if Plan 1's stream processor correctly emits these events. If Plan 1 adds explicit `sendSSE('tool_use', ...)` calls in the agent-server, then this handler will pick them up.

---

### Task 4: Clean up dead SSE infrastructure in agent-router

**Files:**
- Modify: `packages/api/src/agent/agent-router.ts`

The `createSSEWriter`, `projectEventBuffers` Map, and the sweep interval (lines 21-83) are fully built but only used in the "sandbox unavailable" error path. The `formatConversationHistory` function (lines 89-119) is defined but never called. Remove both to reduce confusion.

- [ ] **Step 1: Remove `createSSEWriter` and `projectEventBuffers`**

Delete lines 21-83 (the `createSSEWriter` function, `projectEventBuffers` Map, and sweep interval).

- [ ] **Step 2: Remove `formatConversationHistory`**

Delete lines 89-119.

- [ ] **Step 3: Replace `createSSEWriter` usage in the error path**

Find where `createSSEWriter` was called (in the "sandbox unavailable" error branch). Replace with a simple inline SSE write:

```typescript
// Instead of createSSEWriter(reply, projectId):
const errorStream = new PassThrough();
reply
  .header('Content-Type', 'text/event-stream')
  .header('Cache-Control', 'no-cache')
  .header('Connection', 'keep-alive')
  .send(errorStream);
errorStream.write(`event: error\ndata: ${JSON.stringify({ message: 'Sandbox not available', recoverable: true })}\n\n`);
errorStream.end();
```

---

### Task 5: Handle sandbox 409 (busy) gracefully

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts:213-216`
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` (error handling)

When the sandbox returns 409 (already busy), the proxy sends a JSON error. The frontend throws a generic error. Users should see "Agent is busy, please wait."

- [ ] **Step 1: Convert 409 to an SSE error event in the proxy**

Replace lines 213-216:
```typescript
if (!res.ok) {
  logger.warn({ ...logCtx, status: res.status }, 'Proxy: sandbox returned non-OK');
  reply.status(res.status).send({ error: `Agent returned ${res.status}` });
  return;
}
```

With:
```typescript
if (!res.ok) {
  logger.warn({ ...logCtx, status: res.status }, 'Proxy: sandbox returned non-OK');

  if (res.status === 409) {
    // Agent busy — send as SSE error so frontend can show a friendly message
    const errorStream = new PassThrough();
    reply
      .header('Content-Type', 'text/event-stream')
      .header('Cache-Control', 'no-cache')
      .send(errorStream);
    errorStream.write(`event: error\ndata: ${JSON.stringify({ message: 'Agent is busy processing another request. Please wait.', busy: true, recoverable: true })}\n\n`);
    errorStream.end();
    return;
  }

  reply.status(res.status).send({ error: `Agent returned ${res.status}` });
  return;
}
```

- [ ] **Step 2: Handle busy error in frontend**

In `AIAssistantPanel.tsx`, the error handler (lines 602-607) appends the error message to chat. For busy errors, the `recoverable: true` + `busy: true` flags should trigger recovery polling (which already checks sandbox status). No frontend change needed — the existing recovery polling handles it. But update the error sanitizer (lines 43-64) to map busy errors to a friendly message:

```typescript
// In sanitizeErrorMessage:
if (msg.includes('busy') || msg.includes('another request')) {
  return 'Viona is still working on the previous request. Please wait a moment.';
}
```
