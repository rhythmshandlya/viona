# Resilient Agent Progress System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make agent progress always visible regardless of client disconnects/refreshes, support parallel agent task tracking.

**Architecture:** Sandbox orchestrator runs independently of SSE connections. State tracked in-memory, pushed to API via HTTP callbacks, cached in Redis. Frontend reads from Redis on mount, SSE for live updates. Multiple concurrent agent tasks tracked as an array, not a single overwritten value.

**Tech Stack:** Node.js/Express (sandbox), Fastify (API), React/Next.js (frontend), Redis, Claude Agent SDK

**Spec:** `docs/superpowers/specs/2026-03-18-resilient-progress-system-design.md`

---

## File Structure

### New Files
- `packages/sandbox/src/job-state.ts` — In-memory job state manager (activeTasks[], busy, plan, result). Pure logic, no I/O.
- `packages/sandbox/src/api-callback.ts` — Fire-and-forget HTTP callback to API with debouncing.
- `apps/web/src/features/editor-v2/components/ai-chat/ActiveTaskList.tsx` — Multi-task progress display component (replaces single ProgressIndicator).

### Modified Files
- `packages/sandbox/src/agent-server.ts` — Decouple orchestrator from SSE, use job-state, add /status, wire callbacks.
- `packages/sandbox/src/orchestrator.ts` — Emit task lifecycle events (started/updated/completed) instead of single progress. Skip history on resume.
- `packages/api/src/sandbox/proxy.ts` — Remove Redis writes from interceptor, simplify finally block.
- `packages/api/src/sandbox/routes.ts` — Add `/internal/sandbox/:id/agent-state` callback endpoint, update status response shape.
- `packages/api/src/agent/agent-router.ts` — Return `activeTasks[]` instead of `sandboxProgress`/`sandboxActivity` in getConversation.
- `apps/web/src/lib/api.ts` — Update type definitions for new response shapes.
- `apps/web/src/features/editor-v2/Editor.tsx` — Always-mount AIAssistantPanel.
- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — Consume activeTasks[], simplified recovery polling.
- `apps/web/src/features/editor-v2/components/ai-chat/ChatMessageList.tsx` — Use ActiveTaskList instead of ProgressIndicator.
- `apps/web/src/features/editor-v2/components/ai-chat/types.ts` — Add ActiveTask type, keep AGENT_STYLES.
- `apps/web/src/features/editor-v2/hooks/use-progress.ts` — Replace single activity with activeTasks[] management.

---

## Task 1: Extract Job State Manager (Sandbox)

**Spec:** R2.1–R2.8
**Files:**
- Create: `packages/sandbox/src/job-state.ts`

This is pure state logic with no I/O — the foundation everything else builds on.

- [ ] **Step 1: Create job-state.ts with types and state container**

```typescript
// packages/sandbox/src/job-state.ts

export interface ActiveTask {
  id: string;
  agent: string;
  action: string;
  target?: string;
  startedAt: number;
  status: 'active' | 'completed';
}

export interface JobState {
  isBusy: boolean;
  startedAt: number;
  activeTasks: ActiveTask[];
  plan: { title: string; tasks: unknown[] } | null;
  textBuffer: string;
  result: { sessionId?: string; cost?: number } | null;
  error: string | null;
}

let currentJob: JobState | null = null;

// Removal timers for completed tasks (fade-out delay)
const removalTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Listeners notified on every state change
const listeners: Array<(type: string, data: unknown) => void> = [];

let taskIdCounter = 0;
function nextTaskId(): string {
  return `task-${++taskIdCounter}`;
}

export function getJobState(): JobState | null {
  return currentJob;
}

export function isJobBusy(): boolean {
  return !!currentJob?.isBusy;
}

export function startJob(): void {
  // Clear any lingering removal timers
  for (const timer of removalTimers.values()) clearTimeout(timer);
  removalTimers.clear();
  taskIdCounter = 0;

  currentJob = {
    isBusy: true,
    startedAt: Date.now(),
    activeTasks: [],
    plan: null,
    textBuffer: '',
    result: null,
    error: null,
  };
}

export function addTask(agent: string, action: string, target?: string): string {
  if (!currentJob) return '';
  const id = nextTaskId();
  const task: ActiveTask = { id, agent, action, target, startedAt: Date.now(), status: 'active' };
  currentJob.activeTasks.push(task);
  notify('task_started', task);
  return id;
}

export function updateTask(id: string, action: string): void {
  if (!currentJob) return;
  const task = currentJob.activeTasks.find(t => t.id === id);
  if (task && task.status === 'active') {
    task.action = action;
    notify('task_updated', { id, action });
  }
}

export function completeTask(id: string): void {
  if (!currentJob) return;
  const task = currentJob.activeTasks.find(t => t.id === id);
  if (task) {
    task.status = 'completed';
    notify('task_completed', { id });
    // Remove after 3s delay (allows frontend fade-out)
    const timer = setTimeout(() => {
      if (currentJob) {
        currentJob.activeTasks = currentJob.activeTasks.filter(t => t.id !== id);
      }
      removalTimers.delete(id);
    }, 3000);
    removalTimers.set(id, timer);
  }
}

export function updatePlan(plan: { title: string; tasks: unknown[] }): void {
  if (!currentJob) return;
  currentJob.plan = plan;
  notify('plan', plan);
}

export function appendText(text: string): void {
  if (!currentJob) return;
  currentJob.textBuffer += text;
  notify('text', { text });
}

export function finishJob(result: { sessionId?: string; cost?: number }): void {
  if (!currentJob) return;
  currentJob.isBusy = false;
  currentJob.activeTasks = [];
  currentJob.result = result;
  for (const timer of removalTimers.values()) clearTimeout(timer);
  removalTimers.clear();
  notify('done', result);
}

export function failJob(error: string): void {
  if (!currentJob) return;
  currentJob.isBusy = false;
  currentJob.activeTasks = [];
  currentJob.error = error;
  for (const timer of removalTimers.values()) clearTimeout(timer);
  removalTimers.clear();
  notify('error', { message: error });
}

export function onStateChange(fn: (type: string, data: unknown) => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notify(type: string, data: unknown): void {
  for (const fn of listeners) {
    try { fn(type, data); } catch { /* listener errors don't break state */ }
  }
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors (compiles entire project to validate imports/types).

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/job-state.ts
git commit -m "feat(sandbox): add in-memory job state manager for multi-task tracking"
```

---

## Task 2: API Callback Client (Sandbox)

**Spec:** R3.1–R3.4
**Files:**
- Create: `packages/sandbox/src/api-callback.ts`

Fire-and-forget HTTP POSTs to the API with per-type debouncing. Never blocks the orchestrator.

- [ ] **Step 1: Create api-callback.ts**

```typescript
// packages/sandbox/src/api-callback.ts

import pino from 'pino';

const logger = pino({ name: 'api-callback' });

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const PROJECT_ID = process.env.PROJECT_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

// Debounce timers per event type
const timers = new Map<string, ReturnType<typeof setTimeout>>();
// Pending payloads — latest wins per type
const pending = new Map<string, unknown>();

// Debounce intervals per type (ms)
// NOTE: Debounced types use "latest-wins" — only the most recent payload is sent
// after the debounce window. This means intermediate text chunks are NOT accumulated
// into a single batch; only the latest chunk is forwarded. This is acceptable because
// the sandbox in-memory textBuffer (job-state) accumulates all text, and the API
// only needs the latest state for Redis, not every intermediate chunk.
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
  if (!API_CALLBACK_URL || !PROJECT_ID) return;

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
  for (const [type, timer] of timers) {
    clearTimeout(timer);
    const payload = pending.get(type);
    if (payload !== undefined) send(type, payload);
  }
  timers.clear();
  pending.clear();
}

function send(type: string, data: unknown): void {
  const url = `${API_CALLBACK_URL}/internal/sandbox/${PROJECT_ID}/agent-state`;
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
```

- [ ] **Step 2: Verify the module compiles**

Run: `cd packages/sandbox && npx tsc --noEmit src/api-callback.ts`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/api-callback.ts
git commit -m "feat(sandbox): add debounced fire-and-forget API callback client"
```

---

## Task 3: Rewrite Agent Server — Decouple Orchestrator from SSE

**Spec:** R1.1–R1.6, R4.1–R4.3, R5.1–R5.4
**Files:**
- Modify: `packages/sandbox/src/agent-server.ts`

This is the core change. The orchestrator runs independently of any SSE connection.

- [ ] **Step 1: Read the current agent-server.ts**

Read `packages/sandbox/src/agent-server.ts` in full to understand current state (may differ from what was read earlier if linter modified it).

- [ ] **Step 2: Rewrite the /prompt endpoint**

Key changes:
1. Import `job-state` and `api-callback` modules
2. Remove `currentAbortController` global — replace with job-state's abort
3. `res.on('close')` sets `connectionAlive = false` only — does NOT abort
4. `res.on('error')` sets `connectionAlive = false` only — does NOT abort
5. If job is already busy, return 409
6. Wire orchestrator callbacks to job-state mutations + SSE writes + API callbacks
7. Orchestrator runs via `await` — SSE stays open while connected, closes when orchestrator finishes

```typescript
// Key structural changes in /prompt handler:

import {
  startJob, addTask, updateTask, completeTask, updatePlan,
  appendText, finishJob, failJob, getJobState, isJobBusy, onStateChange,
} from './job-state.js';
import { pushState, flushCallbacks } from './api-callback.js';

// In /prompt handler:

// Reject if busy
if (isJobBusy()) {
  res.status(409).json({ error: 'Agent is already busy', busy: true });
  return;
}

// Start job
startJob();
const abortController = new AbortController();

// SSE connection tracking — disconnect does NOT abort orchestrator
let connectionAlive = true;
res.on('close', () => {
  connectionAlive = false;
  logger.info('SSE client disconnected — orchestrator continues');
});
res.on('error', (err) => {
  connectionAlive = false;
  logger.warn({ err: err.message }, 'SSE socket error — orchestrator continues');
});

// Safe SSE write — silently no-ops if connection is dead
const sendSSE = (event: string, data: unknown) => {
  if (!connectionAlive) return;
  eventId++;
  try {
    res.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch { connectionAlive = false; }
};

// Wire state changes to both SSE and API callbacks
// Also emit backward-compatible progress/activity events (R5.4)
const unsubscribe = onStateChange((type, data) => {
  sendSSE(type, data);
  pushState(type, data);
  // Backward compat: emit old-style progress/activity for any clients not yet migrated
  if (type === 'task_started' || type === 'task_updated') {
    const t = data as { agent?: string; action?: string };
    sendSSE('progress', { phase: 'running', percent: -1, message: `${t.agent}: ${t.action}` });
    sendSSE('activity', { agent: t.agent ?? null, action: t.action ?? null });
  }
});

// Heartbeat includes full activeTasks snapshot
const heartbeat = setInterval(() => {
  const job = getJobState();
  sendSSE('heartbeat', { activeTasks: job?.activeTasks ?? [], busy: job?.isBusy ?? false });
}, 15000);
```

Also in the `finally` block, guard `res.end()` against EPIPE on already-closed connections:

```typescript
} finally {
  clearInterval(heartbeat);
  unsubscribe();
  currentAbortController = null;
  // Guard against EPIPE if client already disconnected
  if (connectionAlive) {
    try { res.end(); } catch { /* already closed */ }
  }
}
```

- [ ] **Step 3: Rewrite the /cancel endpoint**

```typescript
// Store abortController in module scope alongside job state
let currentAbortController: AbortController | null = null;

app.post('/cancel', (_req, res) => {
  if (currentAbortController) {
    currentAbortController.abort();
    failJob('Cancelled by user');
    flushCallbacks();
    currentAbortController = null;
  }
  res.json({ ok: true });
});
```

- [ ] **Step 4: Rewrite the /status endpoint**

```typescript
app.get('/status', (_req, res) => {
  const job = getJobState();
  res.json({
    bundleVersion: getBundleVersion(),
    busy: job?.isBusy ?? false,
    activeTasks: job?.isBusy ? job.activeTasks.filter(t => t.status === 'active') : [],
    plan: job?.plan ?? null,
    startedAt: job?.isBusy ? job.startedAt : null,
    result: job && !job.isBusy ? job.result : null,
    error: job && !job.isBusy ? job.error : null,
  });
});
```

- [ ] **Step 5: Verify sandbox compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/agent-server.ts
git commit -m "feat(sandbox): decouple orchestrator lifecycle from SSE connection

Orchestrator continues running when client disconnects. State tracked
via job-state module, pushed to API via callbacks. /status endpoint
returns ground truth. /cancel is the only way to stop a running job."
```

---

## Task 4: Orchestrator — Multi-Task Events + Skip Duplicate History

**Spec:** R2.2–R2.6, R5.2, R12.1–R12.2
**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts`

Replace single `emitProgress`/`emitActivity` with job-state task lifecycle calls.

- [ ] **Step 1: Read current orchestrator.ts**

Read `packages/sandbox/src/orchestrator.ts` in full.

- [ ] **Step 2: Replace progress emitters with task lifecycle calls**

Import job-state functions. Replace the current emitProgress/emitActivity pattern:

```typescript
import {
  addTask, updateTask, completeTask, updatePlan, appendText,
  finishJob, failJob,
} from './job-state.js';
import { flushCallbacks } from './api-callback.js';
```

Key changes in `processStream`:

```typescript
// Track active task IDs by context
let vionaTaskId: string | null = null;
const subagentTaskIds = new Map<string, string>(); // tool_use_id → taskId

// On first text chunk:
if (textChunks === 1) {
  vionaTaskId = addTask('Viona', 'Responding...');
}
// On subsequent text:
appendText(delta.text);

// On tool_use:
if (toolName?.startsWith('mcp__')) {
  const parts = toolName.split('__');
  const server = parts[1];
  const tool = parts.slice(2).join('__');
  const displayAgent = MCP_SERVER_LABELS[server] ?? server;
  // Update Viona's task or the active subagent's task
  if (vionaTaskId) updateTask(vionaTaskId, tool);
} else if (toolName === 'Agent') {
  const input = msg.input as Record<string, unknown> | undefined;
  const subagentType = (input?.subagent_type ?? input?.description ?? '') as string;
  const label = SUBAGENT_LABELS[subagentType.toLowerCase()] ?? (subagentType || 'subagent');
  const taskId = addTask(label, `Starting...`, subagentType);
  // Track by tool_use_id so we can match the tool_result later
  const toolUseId = (msg as any).id ?? (msg as any).tool_use_id;
  if (toolUseId) subagentTaskIds.set(toolUseId, taskId);
}

// On tool_result:
if (msg.type === 'tool_result') {
  const toolUseId = (msg as any).tool_use_id;
  if (toolUseId && subagentTaskIds.has(toolUseId)) {
    completeTask(subagentTaskIds.get(toolUseId)!);
    subagentTaskIds.delete(toolUseId);
  }
}
```

- [ ] **Step 3: Wire onDone/onError to job-state**

In the execute section, replace direct `callbacks.onDone` / `callbacks.onError` with job-state calls. The callbacks still exist for SSE emission (handled by the `onStateChange` listener in agent-server).

```typescript
// In the orchestrator callbacks passed to runOrchestrator:
onDone: async (result) => {
  if (vionaTaskId) { completeTask(vionaTaskId); vionaTaskId = null; }
  finishJob(result);
  flushCallbacks();
  callbacks.onDone(result);
},
onError: (error) => {
  failJob(error);
  flushCallbacks();
  callbacks.onError(error);
},
```

- [ ] **Step 4: Verify R12 skip duplicate history (already applied)**

This fix was applied in a prior session. Verify the guard exists in `runOrchestrator`:

```typescript
// Should already be present — verify, do NOT rewrite:
if (!request.sessionId && request.conversationHistory.length > 0) {
  const historyText = request.conversationHistory
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');
  userMessage = `<conversation_history>\n${historyText}\n</conversation_history>\n\n${userMessage}`;
}
```

If the guard is present, move on. If missing, add it.

- [ ] **Step 5: Verify sandbox compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Build sandbox Docker image and verify startup**

Run: `cd /c/Users/armaa/Documents/cllipify && docker build -t viona-sandbox:latest -f packages/sandbox/Dockerfile .`
Expected: Build succeeds.

Run a quick container to verify it starts:
```bash
docker run --rm -e SANDBOX_SECRET=test -e PROJECT_ID=test viona-sandbox:latest &
# Wait 5 seconds, then check health
curl http://localhost:8081/health
# Expected: {"status":"ok","initialized":false,"busy":false}
docker stop <container>
```

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat(sandbox): emit multi-task lifecycle events, skip duplicate history on resume

Orchestrator now emits task_started/task_updated/task_completed instead
of single progress/activity. Subagent dispatches tracked by tool_use_id.
Conversation history no longer duplicated when resuming SDK session."
```

---

## Task 5: API — Agent State Callback Endpoint

**Spec:** R3.5–R3.7, R7.1–R7.3
**Files:**
- Modify: `packages/api/src/sandbox/routes.ts`

Add the internal callback endpoint that receives state pushes from the sandbox and writes to Redis.

- [ ] **Step 1: Read current routes.ts**

Read `packages/api/src/sandbox/routes.ts` to find the internal endpoints section and the status endpoint.

- [ ] **Step 2: Add the agent-state callback endpoint**

Add near the other internal endpoints:

```typescript
// Internal callback from sandbox — receives agent state pushes
// POST /internal/sandbox/:projectId/agent-state
// Uses the same validateInternalCallback pattern as bundle-ready
fastify.post('/internal/sandbox/:projectId/agent-state', async (request, reply) => {
  const projectId = await validateInternalCallback(request, reply);
  if (!projectId) return; // 401/403 already sent

  const { type, data, timestamp } = request.body as {
    type: string;
    data: unknown;
    timestamp: number;
  };
  const TTL = 1800; // 30 minutes

  switch (type) {
    case 'task_started':
    case 'task_updated':
    case 'task_completed': {
      // Read current tasks, apply mutation, write back
      const raw = await redis.get(`sandbox:tasks:${projectId}`).catch(() => null);
      let tasks: unknown[] = raw ? JSON.parse(raw) : [];

      if (type === 'task_started') {
        tasks.push(data);
      } else if (type === 'task_updated') {
        const { id: taskId, action } = data as { id: string; action: string };
        tasks = tasks.map((t: any) => t.id === taskId ? { ...t, action } : t);
      } else if (type === 'task_completed') {
        const { id: taskId } = data as { id: string };
        tasks = tasks.filter((t: any) => t.id !== taskId);
      }

      await redis.set(`sandbox:tasks:${projectId}`, JSON.stringify(tasks), 'EX', TTL);
      await redis.set(`sandbox:busy:${projectId}`, JSON.stringify({ busy: true, startedAt: timestamp }), 'EX', TTL);
      break;
    }
    case 'plan':
      await redis.set(`sandbox:plan:${projectId}`, JSON.stringify(data), 'EX', TTL);
      break;
    case 'done':
      await redis.del(`sandbox:tasks:${projectId}`);
      await redis.del(`sandbox:busy:${projectId}`);
      // Plan persists
      break;
    case 'error':
      await redis.del(`sandbox:tasks:${projectId}`);
      await redis.del(`sandbox:busy:${projectId}`);
      break;
    default:
      // text and other types — just refresh TTL on busy key
      await redis.expire(`sandbox:busy:${projectId}`, TTL).catch(() => {});
      break;
  }

  reply.send({ ok: true });
});
```

- [ ] **Step 3: Update the status endpoint response**

Change the existing `GET /projects/:id/sandbox/status` to read the new Redis keys:

```typescript
// Replace the old agentProgress/agentActivity reads with:
const [tasksRaw, busyRaw, planRaw] = await Promise.all([
  redis.get(`sandbox:tasks:${projectId}`).catch(() => null),
  redis.get(`sandbox:busy:${projectId}`).catch(() => null),
  redis.get(`sandbox:plan:${projectId}`).catch(() => null),
]);

let activeTasks: unknown[] = [];
let busy = false;
let startedAt: number | null = null;

if (tasksRaw) try { activeTasks = JSON.parse(tasksRaw); } catch {}
if (busyRaw) try {
  const b = JSON.parse(busyRaw);
  busy = b.busy;
  startedAt = b.startedAt;
} catch {}
let agentPlan = null;
if (planRaw) try { agentPlan = JSON.parse(planRaw); } catch {}

// If Redis has no data but sandbox is ready, query sandbox /status as fallback
if (!busy && session.status === 'ready') {
  try {
    const sbStatus = await fetch(`${agentUrl}/status`, {
      headers: { 'Authorization': `Bearer ${session.secret}` },
    }).then(r => r.json());
    if (sbStatus.busy) {
      busy = true;
      activeTasks = sbStatus.activeTasks ?? [];
      startedAt = sbStatus.startedAt;
      agentPlan = sbStatus.plan ?? agentPlan;
    }
  } catch { /* sandbox unreachable — ignore */ }
}

// Return updated shape
return reply.send({
  status: session.status,
  previewUrl,
  busy,
  activeTasks,
  plan: agentPlan,
  startedAt,
});
```

- [ ] **Step 4: Verify API compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/sandbox/routes.ts
git commit -m "feat(api): add agent-state callback endpoint, update status to return activeTasks[]

Sandbox pushes state via POST /internal/sandbox/:id/agent-state.
Status endpoint reads from new Redis keys (sandbox:tasks, sandbox:busy).
Falls back to sandbox /status if Redis is empty."
```

---

## Task 6: API — Simplify Proxy, Update Agent Router

**Spec:** R6.1–R6.4, R7.2
**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts`
- Modify: `packages/api/src/agent/agent-router.ts`

Remove Redis writes from the proxy interceptor — sandbox callbacks now own Redis. Update getConversation response shape.

- [ ] **Step 1: Read proxy.ts intercept function**

Read `packages/api/src/sandbox/proxy.ts` in full (focus on `proxyPromptWithIntercept`).

- [ ] **Step 2: Remove Redis writes from proxy intercept**

In `proxyPromptWithIntercept`, remove ALL Redis read/write operations:
- `redis.set('sandbox:progress:...')` on progress event
- `redis.set('sandbox:activity:...')` on activity event
- `redis.set('sandbox:plan:...')` on agent_plan event
- `redis.del(...)` on done event
- `redis.del(...)` on error event
- Redis cleanup in the finally block

Keep the SSE forwarding (`writeSSE`) and the callback hooks (`callbacks.onText`, etc.) — those still work for DB persistence in the agent router.

- [ ] **Step 3: Forward new event types through proxy + handle SSE break (R6.4)**

Add handling for `task_started`, `task_updated`, `task_completed` in the event switch:

```typescript
case 'task_started':
case 'task_updated':
case 'task_completed':
  writeSSE(eventType, data);
  break;
```

When the proxy's SSE connection to the sandbox breaks (network error, sandbox restart), send a `recoverable: true` error to the frontend instead of a terminal error. The sandbox continues running — the frontend should start polling:

```typescript
// In the proxy's catch/error handler for the sandbox SSE connection:
writeSSE('error', { message: 'Connection to sandbox lost', recoverable: true });
```

- [ ] **Step 4: Update agent router getConversation**

Read `packages/api/src/agent/agent-router.ts` and update the getConversation endpoint to return `activeTasks` and `busy` instead of `sandboxProgress`/`sandboxActivity`:

```typescript
// Replace sandboxProgress/sandboxActivity reads with:
const [tasksRaw, busyRaw, planRaw] = await Promise.all([
  redis.get(`sandbox:tasks:${projectId}`).catch(() => null),
  redis.get(`sandbox:busy:${projectId}`).catch(() => null),
  redis.get(`sandbox:plan:${projectId}`).catch(() => null),
]);

let activeTasks: unknown[] = [];
let busy = false;
if (tasksRaw) try { activeTasks = JSON.parse(tasksRaw); } catch {}
if (busyRaw) try { busy = JSON.parse(busyRaw).busy; } catch {}
let sandboxPlan = null;
if (planRaw) try { sandboxPlan = JSON.parse(planRaw); } catch {}

// In response object, replace sandboxProgress/sandboxActivity with:
// activeTasks, busy, sandboxPlan
```

- [ ] **Step 5: Verify API compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/sandbox/proxy.ts packages/api/src/agent/agent-router.ts
git commit -m "feat(api): remove Redis writes from proxy, return activeTasks from getConversation

Redis is now populated by sandbox HTTP callbacks, not proxy interception.
Proxy simplified to pure SSE passthrough. getConversation returns
activeTasks[] and busy instead of sandboxProgress/sandboxActivity."
```

---

## Task 7: Frontend — Types and API Client Updates

**Spec:** R9.3 (types), R7.1–R7.2 (API shapes)
**Files:**
- Modify: `apps/web/src/features/editor-v2/components/ai-chat/types.ts`
- Modify: `apps/web/src/lib/api.ts`

Update TypeScript types and API response shapes before touching components.

- [ ] **Step 1: Add ActiveTask type to types.ts**

```typescript
// Add to types.ts alongside ProgressState:

export interface ActiveTask {
  id: string;
  agent: string;
  action: string;
  target?: string;
  startedAt: number;
  status: 'active' | 'completed';
}
```

Keep `ProgressState` and `AGENT_STYLES` — they're still used by `ActiveTaskList`.

- [ ] **Step 2: Update API client types**

In `apps/web/src/lib/api.ts`, update `getSandboxStatus` and `getConversation` return types:

```typescript
// getSandboxStatus return type — replace agentProgress/agentActivity with:
{
  status: string;
  previewUrl: string | null;
  busy: boolean;
  activeTasks: Array<{ id: string; agent: string; action: string; target?: string; startedAt: number; status: string }>;
  plan: { title: string; tasks: unknown[] } | null;
  startedAt: number | null;
}

// getConversation return type — replace sandboxProgress/sandboxActivity with:
{
  conversationId: string | null;
  messages: Array<...>;
  activeJob: ... | null;
  activeTasks: Array<{ id: string; agent: string; action: string; target?: string; startedAt: number; status: string }>;
  busy: boolean;
  sandboxPlan: ... | null;
}
```

- [ ] **Step 3: Verify frontend compiles (expect errors in components — that's fine)**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: Type errors in AIAssistantPanel and other consumers (they still reference old types). That's expected — we'll fix those next.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/types.ts apps/web/src/lib/api.ts
git commit -m "feat(web): add ActiveTask type, update API client for activeTasks[] responses"
```

---

## Task 8: Frontend — ActiveTaskList Component

**Spec:** R9.1–R9.6
**Files:**
- Create: `apps/web/src/features/editor-v2/components/ai-chat/ActiveTaskList.tsx`

New component that replaces the single ProgressIndicator with a stacked list of concurrent tasks.

- [ ] **Step 1: Create ActiveTaskList.tsx**

```tsx
'use client';

import React, { memo, useState, useEffect } from 'react';
import type { ActiveTask } from './types';
import { AGENT_STYLES } from './types';

interface ActiveTaskListProps {
  tasks: ActiveTask[];
  busy: boolean;
  isVisible: boolean;
}

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  return <span className="text-[10px] tabular-nums opacity-60">{min > 0 ? `${min}m ${sec}s` : `${sec}s`}</span>;
}

function TaskRow({ task }: { task: ActiveTask }) {
  const style = AGENT_STYLES[task.agent] ?? { color: '#94a3b8', icon: '●' };
  const isCompleted = task.status === 'completed';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 transition-opacity duration-[2000ms] ${isCompleted ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Pulsing dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCompleted ? '' : 'animate-pulse'}`}
        style={{ backgroundColor: style.color }}
      />
      {/* Agent badge */}
      <span
        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: `${style.color}20`, color: style.color }}
      >
        {style.icon} {task.agent}
      </span>
      {/* Action text */}
      <span className="text-xs text-[var(--editor-text-secondary)] truncate flex-1">
        {task.action}
      </span>
      {/* Target (e.g., scene name) */}
      {task.target && (
        <span className="text-[10px] text-[var(--editor-text-muted)] flex-shrink-0">
          {task.target}
        </span>
      )}
      {/* Elapsed time */}
      <ElapsedTime startedAt={task.startedAt} />
    </div>
  );
}

export const ActiveTaskList = memo(function ActiveTaskList({ tasks, busy, isVisible }: ActiveTaskListProps) {
  // Stable fallback timestamp — avoids creating new Date.now() on every render
  const fallbackStartRef = React.useRef(Date.now());

  if (!isVisible || !busy) return null;

  // If busy but no tasks, show fallback
  const activeTasks = tasks.length > 0 ? tasks : [
    { id: 'fallback', agent: 'Viona', action: 'Working...', startedAt: fallbackStartRef.current, status: 'active' as const },
  ];

  return (
    <div className="rounded-xl border border-[var(--chat-bubble-assistant-border)] bg-[var(--chat-bubble-assistant-bg)] backdrop-blur-xl overflow-hidden">
      {activeTasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </div>
  );
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit src/features/editor-v2/components/ai-chat/ActiveTaskList.tsx 2>&1`
Expected: No errors (or only errors from missing CSS vars which are runtime-only).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/ActiveTaskList.tsx
git commit -m "feat(web): add ActiveTaskList component for multi-agent progress display"
```

---

## Task 9: Frontend — Always-Mount Panel + Wire ActiveTaskList

**Spec:** R8.1–R8.3, R10.1–R10.3, R11.1–R11.3
**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`
- Modify: `apps/web/src/features/editor-v2/components/ai-chat/ChatMessageList.tsx`
- Modify: `apps/web/src/features/editor-v2/hooks/use-progress.ts`

This is the largest frontend task. Always-mount the panel, consume activeTasks[], simplify recovery.

- [ ] **Step 1: Read all four files**

Read Editor.tsx (focus on the sidebar panel rendering section), AIAssistantPanel.tsx (full), ChatMessageList.tsx (full), use-progress.ts (full).

- [ ] **Step 2: Editor.tsx — Verify always-mount AIAssistantPanel (already applied)**

This change was applied in a prior session. Verify the AIAssistantPanel is always-mounted with CSS visibility (not conditional AnimatePresence). Expected pattern:

```tsx
{/* AI Assistant Panel — always mounted to preserve SSE + state */}
<div
  className="flex-shrink-0 overflow-hidden editor-panel transition-all duration-150 ease-out"
  style={{
    width: leftSidebarOpen && leftSidebarTab === 'agent' ? 488 : 0,
    opacity: leftSidebarOpen && leftSidebarTab === 'agent' ? 1 : 0,
    pointerEvents: leftSidebarOpen && leftSidebarTab === 'agent' ? 'auto' : 'none',
  }}
>
  <ErrorBoundary name="AI Assistant">
    <Suspense fallback={...}>
      <AIAssistantPanel projectId={project.id} onEditComplete={...} className="w-[488px]" />
    </Suspense>
  </ErrorBoundary>
</div>

{/* Other sidebar panels — still use AnimatePresence */}
<AnimatePresence mode="wait">
  {leftSidebarOpen && leftSidebarTab !== 'agent' && (
    ...existing other panel code...
  )}
</AnimatePresence>
```

Add an activity dot on the Chat sidebar icon when agents are working but the panel isn't visible. Use the editor store (Zustand) to track `agentBusy: boolean` — set it from `useActiveTasks().busy` in the AIAssistantPanel, read it in the sidebar icon rail. Example:

```tsx
// In Editor.tsx sidebar icon rail:
const agentBusy = useEditorStore(s => s.agentBusy);

<button onClick={() => setLeftSidebarTab('agent')}>
  <ChatIcon />
  {agentBusy && leftSidebarTab !== 'agent' && (
    <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
  )}
</button>
```

Add `agentBusy: boolean` and `setAgentBusy: (busy: boolean) => void` to the editor store.

- [ ] **Step 3: AIAssistantPanel.tsx — Consume activeTasks[], simplify recovery**

Key changes:
1. Replace `currentProgress: ProgressState | null` state with `activeTasks: ActiveTask[]` and `isBusy: boolean`.
2. In `loadHistory` useEffect: read `data.activeTasks` and `data.busy` instead of `data.sandboxProgress`.
3. In `handleSSEEvent`: handle `task_started`, `task_updated`, `task_completed` events to mutate `activeTasks` state.
4. Replace `pollForRecovery` with simplified polling (R11.1–R11.3):

```typescript
// Replace the complex 5-minute recovery polling with:
function startRecoveryPolling() {
  const MAX_POLL_MS = 30 * 60 * 1000; // 30 minutes (matches Redis TTL)
  const POLL_INTERVAL = 5000; // 5 seconds
  const startedAt = Date.now();

  const pollTimer = setInterval(async () => {
    // Stop after 30 minutes
    if (Date.now() - startedAt > MAX_POLL_MS) {
      clearInterval(pollTimer);
      setError('Connection lost — please refresh');
      return;
    }

    try {
      const status = await api.getSandboxStatus(projectId);
      if (status.busy) {
        // Update task list from API (state restore)
        restoreFromApi(status.activeTasks ?? [], true);
      } else {
        // Job finished while we were disconnected — reload messages
        clearInterval(pollTimer);
        restoreFromApi([], false);
        await loadMessages();
      }
    } catch { /* network error — keep polling */ }
  }, POLL_INTERVAL);

  return () => clearInterval(pollTimer);
}

// Call startRecoveryPolling() when SSE disconnects unexpectedly
// (i.e., error event with recoverable: true, or connection drops while busy)
```

5. Pass `activeTasks` and `isBusy` down to `ChatMessageList` instead of `currentProgress`.
6. Sync `agentBusy` to editor store: `useEffect(() => { setAgentBusy(isBusy); }, [isBusy]);`

- [ ] **Step 4: ChatMessageList.tsx — Use ActiveTaskList**

Replace `ProgressIndicator` with `ActiveTaskList`:

```tsx
import { ActiveTaskList } from './ActiveTaskList';

// In ChatMessageList props: replace currentProgress with activeTasks + busy
interface ChatMessageListProps {
  messages: Message[];
  isStreaming: boolean;
  isTextActive: boolean;
  activeTasks: ActiveTask[];
  busy: boolean;
  onWidgetResponse: ...;
  onEditScene?: ...;
  onScenesUpdate?: ...;
}

// At the bottom of the render, replace ProgressIndicator with:
<ActiveTaskList
  tasks={activeTasks}
  busy={busy}
  isVisible={isStreaming}
/>
```

Remove the `streamStartRef` and `defaultProgress` logic — the fallback is now inside `ActiveTaskList` (R9.5).

- [ ] **Step 5: use-progress.ts — Track activeTasks instead of single activity**

Rewrite the hook to manage an array:

```typescript
export function useActiveTasks() {
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [busy, setBusy] = useState(false);

  const onTaskStarted = useCallback((task: ActiveTask) => {
    setTasks(prev => [...prev, task]);
    setBusy(true);
  }, []);

  const onTaskUpdated = useCallback((id: string, action: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, action } : t));
  }, []);

  const onTaskCompleted = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' } : t));
    // Remove after fade-out delay
    setTimeout(() => {
      setTasks(prev => prev.filter(t => t.id !== id));
    }, 2500);
  }, []);

  const onDone = useCallback(() => {
    setTasks([]);
    setBusy(false);
  }, []);

  const restoreFromApi = useCallback((apiTasks: ActiveTask[], apiBusy: boolean) => {
    setTasks(apiTasks);
    setBusy(apiBusy);
  }, []);

  return { tasks, busy, onTaskStarted, onTaskUpdated, onTaskCompleted, onDone, restoreFromApi };
}
```

- [ ] **Step 6: Verify frontend compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Test in browser**

1. Start the dev server: `cd apps/web && pnpm dev`
2. Open the editor for a project
3. Send a message to the agent
4. Verify: task list appears with agent badges as the orchestrator works
5. Switch to another sidebar tab → switch back → verify task list is still showing
6. Refresh the page while agent is working → verify task list restores from API

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx \
  apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx \
  apps/web/src/features/editor-v2/components/ai-chat/ChatMessageList.tsx \
  apps/web/src/features/editor-v2/hooks/use-progress.ts
git commit -m "feat(web): always-mount chat panel, multi-task display, simplified recovery

AIAssistantPanel stays mounted across tab switches. Progress shows
concurrent activeTasks[] from all agents. Recovery simplified to
5s status polling. Page refresh restores from Redis via API."
```

---

## Task 10: Integration Test — End-to-End Verification

**Spec:** All requirements
**Files:** No new files — manual verification against running system

- [ ] **Step 1: Build and deploy sandbox**

```bash
cd /c/Users/armaa/Documents/cllipify
docker build -t viona-sandbox:latest -f packages/sandbox/Dockerfile .
```

- [ ] **Step 2: Start sandbox container for the test project**

```bash
docker run -d --name sandbox-test \
  -p 18080:8080 -p 18081:8081 \
  -e SANDBOX_SECRET=dev-secret \
  -e PROJECT_ID=9ff85a26-cf76-41ae-8e22-75163a9da94c \
  -e API_CALLBACK_URL=http://host.docker.internal:3001 \
  -e MINIO_ENDPOINT=host.docker.internal \
  -e MINIO_PORT=9000 \
  -e MINIO_ACCESS_KEY=minioadmin \
  -e MINIO_SECRET_KEY=minioadmin \
  -e MINIO_BUCKET=viona-assets \
  -v viona-sandbox-9ff85a26:/workspace \
  viona-sandbox:latest
```

- [ ] **Step 3: Verify R1 — Orchestrator survives disconnect**

1. Send a prompt to the sandbox
2. While streaming, kill the API proxy connection (or close browser tab)
3. Check `docker logs sandbox-test` — should see "SSE client disconnected — orchestrator continues"
4. Check `curl http://localhost:18081/status` — should show `busy: true`
5. Wait for completion — check `/status` shows `busy: false` with result

- [ ] **Step 4: Verify R2 — Multi-task tracking**

1. Send a prompt that triggers parallel subagents (e.g., "create a 3-scene video")
2. Check `curl http://localhost:18081/status` repeatedly — should see multiple entries in `activeTasks[]`
3. As subagents complete, tasks should disappear from the list

- [ ] **Step 5: Verify R3 — API callback populates Redis**

1. While sandbox is working, check Redis:
```bash
docker exec <redis-container> redis-cli GET "sandbox:tasks:9ff85a26-cf76-41ae-8e22-75163a9da94c"
docker exec <redis-container> redis-cli GET "sandbox:busy:9ff85a26-cf76-41ae-8e22-75163a9da94c"
```
Expected: JSON arrays/objects with current state.

2. After completion, check Redis keys are deleted:
```bash
docker exec <redis-container> redis-cli EXISTS "sandbox:tasks:9ff85a26-cf76-41ae-8e22-75163a9da94c"
docker exec <redis-container> redis-cli EXISTS "sandbox:busy:9ff85a26-cf76-41ae-8e22-75163a9da94c"
```
Expected: 0 (deleted).

- [ ] **Step 6: Verify R8 + R10 — Tab switch + page refresh**

1. Open editor, start a prompt
2. Switch to "Assets" tab → wait 5s → switch back to "Chat"
3. Task list should still be showing (panel was never unmounted)
4. Refresh the browser page
5. Task list should restore within 2 seconds (from API/Redis)

- [ ] **Step 7: Verify R12 — No duplicate history on resume**

1. Send 2-3 messages to build up conversation
2. Check sandbox logs for the 3rd message:
   - Should NOT contain `<conversation_history>` in the prompt
   - Should see `Resuming session` in logs
   - Should see `toolUses: >0` (not the previous 0 bug)

- [ ] **Step 8: Clean up**

```bash
docker stop sandbox-test && docker rm sandbox-test
```
