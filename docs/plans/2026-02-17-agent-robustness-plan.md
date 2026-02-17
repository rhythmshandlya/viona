# Agent Robustness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix stuck states, inconsistent progress, and lack of user control in the Creative Director agent by adding worker lock extension, a cancel pipeline, progress consistency, SSE hardening, and frontend timeout UX.

**Architecture:** Five layers of changes — worker BullMQ config (lock extension, retry, stall detection), a cancel endpoint chain (API → Redis → worker subprocess kill), progress decomposition with asymptotic heartbeat for opaque phases, SSE stream hardening (backpressure, event IDs, reduced safety timeout), and frontend UX (stop button, tiered stall detection, step indicator, inline error recovery).

**Tech Stack:** BullMQ, Fastify SSE (PassThrough), Redis pub/sub, WebSocket, React (Next.js), AbortController

**Design doc:** `docs/plans/2026-02-17-agent-robustness-design.md`

---

## Task 1: Worker Config — Reduce stalledInterval and add maxStalledCount

**Files:**
- Modify: `packages/worker/src/index.ts:135-141` (generate-visuals worker)
- Modify: `packages/worker/src/index.ts:158-163` (plan-visuals worker)
- Modify: `packages/worker/src/index.ts:181-186` (edit-visuals worker)

**Step 1: Update generate-visuals worker config**

At line 135, change the worker options:

```typescript
{
  connection,
  concurrency: 1,
  lockDuration: 5 * 60 * 1000,    // 5 min (was 10 min — compensated by lock extension)
  stalledInterval: 30_000,          // 30s (was 5 min — detect stalls faster)
  maxStalledCount: 2,               // 2 stalls before permanent failure
}
```

**Step 2: Update plan-visuals worker config**

At line 158, same changes:

```typescript
{
  connection,
  concurrency: 1,
  lockDuration: 5 * 60 * 1000,
  stalledInterval: 30_000,
  maxStalledCount: 2,
}
```

**Step 3: Update edit-visuals worker config**

At line 181, same changes:

```typescript
{
  connection,
  concurrency: 1,
  lockDuration: 5 * 60 * 1000,
  stalledInterval: 30_000,
  maxStalledCount: 2,
}
```

**Step 4: Commit**

```bash
git add packages/worker/src/index.ts
git commit -m "fix: reduce stalledInterval to 30s and add maxStalledCount for visual workers"
```

---

## Task 2: Heartbeat Progress Utility

**Files:**
- Create: `packages/worker/src/utils/heartbeat-progress.ts`

**Step 1: Create the heartbeat progress utility**

```typescript
import { publishJobProgress } from '../services/redis.js';

/**
 * Emit synthetic progress during opaque subprocess phases using an exponential
 * decay curve. Progress approaches `ceilingPercent` but never reaches it —
 * the caller should emit the real value after the phase completes.
 */
export function startHeartbeatProgress(
  jobId: string,
  startPercent: number,
  ceilingPercent: number,
  estimatedMs: number,
) {
  const startTime = Date.now();

  const interval = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    // Exponential decay: 1 - e^(-t/τ) approaches 1 asymptotically
    const ratio = 1 - Math.exp(-elapsed / (estimatedMs * 0.7));
    // Approach ceiling - 2 so we never quite reach it
    const percent = Math.round(startPercent + ratio * (ceilingPercent - startPercent - 2));

    await publishJobProgress(jobId, percent, 'Processing...').catch(() => {});
  }, 5_000); // every 5 seconds

  return {
    stop: () => clearInterval(interval),
  };
}
```

**Step 2: Commit**

```bash
git add packages/worker/src/utils/heartbeat-progress.ts
git commit -m "feat: add asymptotic heartbeat progress utility for opaque job phases"
```

---

## Task 3: Lock Extension + Phase Decomposition in plan-visuals

**Files:**
- Modify: `packages/worker/src/processors/plan-visuals.ts:60-65` (processor start)
- Modify: `packages/worker/src/processors/plan-visuals.ts:71-96` (progress calls)
- Modify: `packages/worker/src/processors/plan-visuals.ts:240-260` (subprocess spawning area)
- Modify: `packages/worker/src/processors/plan-visuals.ts:383-409` (finally block)

**Step 1: Add imports at the top of plan-visuals.ts**

Add to existing imports:

```typescript
import { startHeartbeatProgress } from '../utils/heartbeat-progress.js';
```

**Step 2: Add lock extension in the processor function**

After `setJobProjectId(jobId, projectId);` (line 62), before the try block (line 65), add:

```typescript
// Proactive lock extension — prevents BullMQ from marking 10-15 min jobs as stalled
const lockExtender = setInterval(async () => {
  try {
    await job.extendLock(job.token!, 120_000);
  } catch (err) {
    logger.error({ jobId, err }, 'Lock extension failed');
  }
}, 55_000);
```

**Step 3: Wrap the existing try/catch in a try/finally for lock cleanup**

Wrap the entire existing try/catch block:

```typescript
try {
  // ... existing try/catch code unchanged ...
} finally {
  clearInterval(lockExtender);
}
```

**Step 4: Add phase decomposition progress calls**

Replace the existing progress reporting around the subprocess run. Before spawning the subprocess (~line 240), add:

```typescript
await publishJobProgress(jobId, 20, 'Planning scenes — this may take a few minutes...');
const heartbeat = startHeartbeatProgress(jobId, 20, 88, 12 * 60 * 1000); // 12 min estimate
```

After the subprocess promise resolves (after the `await new Promise(...)` block, ~line 357), add:

```typescript
heartbeat.stop();
await publishJobProgress(jobId, 90, 'Parsing scene plan...');
```

**Step 5: Commit**

```bash
git add packages/worker/src/processors/plan-visuals.ts
git commit -m "feat: add lock extension and phase decomposition to plan-visuals processor"
```

---

## Task 4: Lock Extension + Cancel Handler + Phase Decomposition in edit-visuals

**Files:**
- Modify: `packages/worker/src/processors/edit-visuals.ts:259-270` (processor start)
- Modify: `packages/worker/src/processors/edit-visuals.ts:649-659` (subprocess spawning)
- Modify: `packages/worker/src/processors/edit-visuals.ts:668-689` (progress ticker)
- Modify: `packages/worker/src/processors/edit-visuals.ts:492-508` (catch block area)

**Step 1: Add imports at the top of edit-visuals.ts**

```typescript
import { registerCancelHandler, unregisterCancelHandler } from '../services/redis.js';
import { startHeartbeatProgress } from '../utils/heartbeat-progress.js';
```

Check if `registerCancelHandler` and `unregisterCancelHandler` are already imported — they may not be since edit-visuals currently doesn't use them.

**Step 2: Add lock extension after `setJobProjectId` (line 261)**

```typescript
const lockExtender = setInterval(async () => {
  try {
    await job.extendLock(job.token!, 120_000);
  } catch (err) {
    logger.error({ jobId, err }, 'Lock extension failed');
  }
}, 55_000);
```

**Step 3: Wrap existing try/catch in try/finally for lock cleanup**

After the catch block (line 508), add:

```typescript
} finally {
  clearInterval(lockExtender);
}
```

**Step 4: Add cancel handler and process tracking around subprocess spawn (line 649)**

After spawning the subprocess, add:

```typescript
// Track for cancellation (edit-visuals was missing this — plan-visuals and generate-visuals have it)
const runningProcesses = (globalThis as any).__editRunningProcesses ??= new Map<string, ChildProcess>();
runningProcesses.set(jobId, subprocess);

registerCancelHandler(jobId, () => {
  subprocess.kill('SIGTERM');
  setTimeout(() => {
    try { subprocess.kill('SIGKILL'); } catch {}
  }, 5_000);
});
```

Alternatively, add a module-level `runningProcesses` Map at the top of the file (like generate-visuals does at its line 26):

```typescript
const runningProcesses = new Map<string, ChildProcess>();
```

And after subprocess spawn:

```typescript
runningProcesses.set(jobId, subprocess);
registerCancelHandler(jobId, () => {
  subprocess.kill('SIGTERM');
});
```

**Step 5: Replace the linear progress ticker with asymptotic heartbeat**

Remove the existing ticker (lines 671-689) — the `EDIT_PROGRESS_MESSAGES` array, `tickerIndex`, `tickerPercent`, and the `setInterval`. Replace with:

```typescript
await publishJobProgress(jobId, 20, 'AI is editing your visuals...');
const heartbeat = startHeartbeatProgress(jobId, 20, 83, 8 * 60 * 1000); // 8 min estimate
```

Update the subprocess close/error handlers to stop the heartbeat:

```typescript
subprocess.on('close', (code) => {
  clearTimeout(timeoutId);
  heartbeat.stop();
  runningProcesses.delete(jobId);
  unregisterCancelHandler(jobId);
  // ... existing resolve/reject
});

subprocess.on('error', (err) => {
  clearTimeout(timeoutId);
  heartbeat.stop();
  runningProcesses.delete(jobId);
  unregisterCancelHandler(jobId);
  reject(err);
});
```

And after the subprocess promise resolves, before the bundle/upload steps:

```typescript
await publishJobProgress(jobId, 85, 'Validating changes...');
```

**Step 6: Commit**

```bash
git add packages/worker/src/processors/edit-visuals.ts
git commit -m "feat: add lock extension, cancel handler, and heartbeat progress to edit-visuals"
```

---

## Task 5: Lock Extension in generate-visuals

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals.ts` (processor function start)

**Step 1: Add lock extension**

Find the processor function (`processGenerateVisualsJob`). After `setJobProjectId(jobId, projectId);`, add the same lock extension pattern:

```typescript
const lockExtender = setInterval(async () => {
  try {
    await job.extendLock(job.token!, 120_000);
  } catch (err) {
    logger.error({ jobId, err }, 'Lock extension failed');
  }
}, 55_000);
```

Wrap the existing try/catch in try/finally:

```typescript
} finally {
  clearInterval(lockExtender);
}
```

Note: generate-visuals already has good progress reporting from stdout parsing (`PROGRESS:XX:message`), so no heartbeat changes needed.

**Step 2: Commit**

```bash
git add packages/worker/src/processors/generate-visuals.ts
git commit -m "feat: add lock extension to generate-visuals processor"
```

---

## Task 6: Cancel API Endpoint

**Files:**
- Modify: `packages/api/src/agent/agent-router.ts` (add new route after existing routes)

**Step 1: Add cancel route**

After the GET `/projects/:id/agent/conversation` route (after line 384), add:

```typescript
// Cancel active agent job
fastify.post<{ Params: { id: string } }>(
  '/projects/:id/agent/cancel',
  { preHandler: [authenticate] },
  async (request, reply) => {
    const projectId = request.params.id;

    // Find active job for this project
    const activeJob = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.projectId, projectId),
        or(eq(jobs.status, 'pending'), eq(jobs.status, 'processing')),
      ),
    });

    if (activeJob) {
      // Publish cancel to Redis — worker picks this up via registerCancelHandler
      await redis.publish('job:cancel', JSON.stringify({ jobId: activeJob.id }));

      // Mark job as failed in DB
      await db.update(jobs)
        .set({ status: 'failed', error: 'Cancelled by user' })
        .where(eq(jobs.id, activeJob.id));

      // Notify WebSocket clients
      await publishJobError(activeJob.id, 'Cancelled by user');
    }

    reply.send({ ok: true, cancelledJobId: activeJob?.id ?? null });
  }
);
```

Make sure `redis` is imported from the appropriate module. Check the existing imports — if `redis` isn't available, import `publishJobError` from the worker's redis service or use the API's own Redis connection. The `publishJobError` function may need to be duplicated or extracted to a shared package.

If `publishJobError` isn't available in the API package, use raw Redis publish:

```typescript
const redisClient = fastify.redis; // or however Redis is accessed in the API
await redisClient.publish(`job:${activeJob.id}:error`, JSON.stringify({
  jobId: activeJob.id,
  error: 'Cancelled by user',
}));
```

**Step 2: Commit**

```bash
git add packages/api/src/agent/agent-router.ts
git commit -m "feat: add POST /agent/cancel endpoint for user-initiated job cancellation"
```

---

## Task 7: Add jobType to pollJobProgress + Normalize Messages

**Files:**
- Modify: `packages/api/src/agent/agent-tools.ts:31-34` (pollJobProgress signature)
- Modify: `packages/api/src/agent/agent-tools.ts:77-81` (progress SSE call)
- Modify: `packages/api/src/agent/agent-tools.ts:543` (plan_visuals call)
- Modify: `packages/api/src/agent/agent-tools.ts:669` (start_generation call)
- Modify: `packages/api/src/agent/agent-tools.ts:764` (edit_visuals call)

**Step 1: Add normalizeProgressMessage function**

Before `pollJobProgress` (before line 31), add:

```typescript
function normalizeProgressMessage(jobType: string, percent: number, rawMessage?: string): string {
  if (rawMessage && !rawMessage.startsWith('Processing')) return rawMessage;

  if (jobType === 'plan-visuals') {
    if (percent < 20) return 'Setting up scene planning...';
    if (percent < 85) return 'Planning your scenes...';
    return 'Finalizing plan...';
  }
  if (jobType === 'generate-visuals') {
    if (percent < 15) return 'Preparing generation pipeline...';
    if (percent < 80) return `Generating visuals (${percent}%)...`;
    return 'Finishing up...';
  }
  if (jobType === 'edit-visuals') {
    if (percent < 20) return 'Analyzing edit request...';
    if (percent < 85) return 'Editing visual...';
    return 'Validating changes...';
  }
  return rawMessage || `Processing (${percent}%)...`;
}

function derivePhase(jobType: string, percent: number): string {
  if (jobType === 'plan-visuals') {
    if (percent < 20) return 'preparing';
    if (percent < 88) return 'planning';
    return 'finalizing';
  }
  if (jobType === 'generate-visuals') {
    if (percent < 15) return 'preparing';
    if (percent < 85) return 'generating';
    if (percent < 95) return 'validating';
    return 'uploading';
  }
  if (jobType === 'edit-visuals') {
    if (percent < 20) return 'preparing';
    if (percent < 85) return 'editing';
    return 'validating';
  }
  return 'processing';
}
```

**Step 2: Add jobType parameter to pollJobProgress**

Change the signature (line 31-34) to:

```typescript
async function pollJobProgress(
  jobId: string,
  ctx: ToolContext,
  options?: { suppressJobId?: boolean; jobType?: string },
): Promise<{ status: 'complete' | 'failed' | 'timeout' | 'aborted' | 'not_found' }>
```

**Step 3: Update the progress SSE call (line 77-81)**

```typescript
const jobType = options?.jobType || 'unknown';

ctx.sendSSE('progress', {
  percent: job.progress,
  message: normalizeProgressMessage(jobType, job.progress, job.progressMessage || undefined),
  jobId: sendJobId,
  phase: derivePhase(jobType, job.progress),
  jobType,
});
```

**Step 4: Update all three call sites**

Line 543 (plan_visuals):
```typescript
await pollJobProgress(job.id, ctx, { suppressJobId: true, jobType: 'plan-visuals' });
```

Line 669 (start_generation):
```typescript
await pollJobProgress(job.id, ctx, { jobType: 'generate-visuals' });
```

Line 764 (edit_visuals):
```typescript
await pollJobProgress(job.id, ctx, { jobType: 'edit-visuals' });
```

**Step 5: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts
git commit -m "feat: add jobType and phase to progress events, normalize progress messages"
```

---

## Task 8: SSE Hardening — Backpressure, Event IDs, Safety Timeout

**Files:**
- Modify: `packages/api/src/agent/agent-router.ts:20-23` (sendSSE function)
- Modify: `packages/api/src/agent/agent-router.ts:217-219` (heartbeat)

**Step 1: Update sendSSE to include event IDs and backpressure awareness**

Replace the `sendSSE` helper (lines 20-23) with:

```typescript
function createSSEWriter(stream: NodeJS.WritableStream) {
  let eventId = 0;
  let draining = true;
  stream.on('drain', () => { draining = true; });

  return function sendSSE(event: string, data: unknown) {
    if ((stream as any).destroyed) return;
    eventId++;
    const ok = (stream as any).write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (!ok) draining = false;
  };
}
```

Then in the POST handler, replace `sendSSE(sseStream, ...)` usage. Currently `sendSSE` is a standalone function called as `sendSSE(sseStream, event, data)`. Change it to:

```typescript
const sendSSE = createSSEWriter(sseStream);
// Now call as: sendSSE('text', { text: delta.text })
// Instead of: sendSSE(sseStream, 'text', { text: delta.text })
```

Update all `sendSSE(sseStream, ...)` calls in the handler to `sendSSE(...)` (remove the `sseStream` first argument). There are approximately 8-10 call sites within the POST handler.

**Step 2: Commit**

```bash
git add packages/api/src/agent/agent-router.ts
git commit -m "feat: add event IDs and backpressure awareness to SSE writer"
```

---

## Task 9: Frontend — Cancel API Method

**Files:**
- Modify: `apps/web/src/lib/api.ts` (after `clearConversation` method, ~line 543)

**Step 1: Add cancelAgent method**

After `clearConversation` (line 543):

```typescript
async cancelAgent(projectId: string): Promise<{ ok: boolean; cancelledJobId: string | null }> {
  return this.request(`/api/projects/${projectId}/agent/cancel`, {
    method: 'POST',
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add cancelAgent API method"
```

---

## Task 10: Frontend — Stop Button + Cancel Handler

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

**Step 1: Add Square icon import**

At the imports section (top of file), add `Square` to the lucide-react import:

```typescript
import { ..., Square } from 'lucide-react';
```

**Step 2: Add handleCancel callback**

After the `handleRetry` function (~line 629), add:

```typescript
const handleCancel = useCallback(async () => {
  // 1. Abort the SSE stream immediately (instant UI feedback)
  abortRef.current?.abort();

  // 2. Tell the backend to kill the worker job
  try {
    await api.cancelAgent(projectId);
  } catch {
    // Best-effort — SSE abort already stopped the frontend
  }

  // 3. Update UI state
  setIsStreaming(false);
  setActiveJobId(null);

  // 4. Replace progress block with cancellation message
  setMessages(prev => {
    const last = prev[prev.length - 1];
    if (last?.role === 'assistant') {
      return [...prev.slice(0, -1), {
        ...last,
        content: [
          ...last.content.filter((b: any) => b.type !== 'progress'),
          { type: 'text' as const, text: '\n\n*Generation stopped.*' },
        ],
      }];
    }
    return prev;
  });
}, [projectId]);
```

**Step 3: Add Stop button to the UI**

Find where the input area / send button is rendered (look for the input form at the bottom of the component). Add the Stop button next to it, shown only during streaming:

```tsx
{isStreaming && (
  <button
    onClick={handleCancel}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
               text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
  >
    <Square className="w-3 h-3 fill-current" />
    Stop
  </button>
)}
```

Place this where it's visible during streaming — likely near the chat input or replacing the send button when `isStreaming` is true.

**Step 4: Reduce safety timeout from 5 min to 2 min**

At line 508-510, change:

```typescript
const safetyTimeout = setTimeout(() => {
  controller.abort();
}, 2 * 60 * 1000); // was 5 * 60 * 1000
```

**Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat: add Stop button and cancel handler to AI assistant"
```

---

## Task 11: Frontend — SSE/WebSocket Progress Dedup

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

**Step 1: Add progress source tracking ref**

Near the other refs (~line 119), add:

```typescript
const progressSourceRef = useRef<'sse' | 'ws' | null>(null);
```

**Step 2: Set source in SSE progress handler**

In the SSE event handler where `event.event === 'progress'` is processed (~line 350), add at the top of that block:

```typescript
progressSourceRef.current = 'sse';
```

**Step 3: Guard WebSocket progress handler**

In the `onProgress` WebSocket callback (~line 130), add at the top:

```typescript
// SSE takes priority while stream is active — prevents duplicate updates
if (progressSourceRef.current === 'sse' && isStreaming) return;
progressSourceRef.current = 'ws';
```

**Step 4: Reset on stream end**

Where `setIsStreaming(false)` is called after the SSE loop completes (~line 524), add:

```typescript
progressSourceRef.current = null;
```

**Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat: deduplicate SSE and WebSocket progress updates"
```

---

## Task 12: Frontend — Tiered Stall Detection

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

**Step 1: Add stall detection state and ref**

Near the other state declarations:

```typescript
const [stallState, setStallState] = useState<'ok' | 'slow' | 'stuck'>('ok');
const lastProgressTimeRef = useRef(Date.now());
```

**Step 2: Add onProgressReceived helper**

```typescript
const onProgressReceived = useCallback(() => {
  lastProgressTimeRef.current = Date.now();
  setStallState('ok');
}, []);
```

Call `onProgressReceived()` inside both the SSE progress handler and the WebSocket `onProgress` callback.

**Step 3: Add stall check interval**

```typescript
useEffect(() => {
  if (!isStreaming) {
    setStallState('ok');
    return;
  }

  const check = setInterval(() => {
    const elapsed = Date.now() - lastProgressTimeRef.current;
    // Longer thresholds during active job processing (progress events arrive every 5s)
    const slowThreshold = activeJobId ? 60_000 : 15_000;
    const stuckThreshold = activeJobId ? 120_000 : 45_000;

    if (elapsed > stuckThreshold) setStallState('stuck');
    else if (elapsed > slowThreshold) setStallState('slow');
    else setStallState('ok');
  }, 3_000);

  return () => clearInterval(check);
}, [isStreaming, activeJobId]);
```

**Step 4: Add stall feedback UI**

Add the `Clock` and `AlertCircle` imports from lucide-react. Render the stall indicators near the progress bar area:

```tsx
{stallState === 'slow' && isStreaming && (
  <div className="flex items-center gap-1.5 text-xs text-amber-500 px-3 py-1">
    <Clock className="w-3 h-3" />
    Taking longer than usual...
  </div>
)}

{stallState === 'stuck' && isStreaming && (
  <div className="flex items-center gap-2 text-xs text-red-500 px-3 py-1">
    <AlertCircle className="w-3 h-3" />
    This seems stuck.
    <button onClick={handleCancel} className="underline hover:no-underline">
      Stop & retry
    </button>
  </div>
)}
```

**Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat: add tiered stall detection with amber/red feedback"
```

---

## Task 13: Frontend — Vertical Step Indicator

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

**Step 1: Add phase steps config**

Near the top of the file (after imports, before the component):

```typescript
const PHASE_STEPS: Record<string, string[]> = {
  'plan-visuals': ['Loading project', 'Planning scenes', 'Finalizing plan'],
  'generate-visuals': ['Preparing pipeline', 'Generating visuals', 'Validating code', 'Uploading assets'],
  'edit-visuals': ['Analyzing request', 'Editing visual', 'Validating changes'],
};

const PHASE_ORDER: Record<string, string[]> = {
  'plan-visuals': ['preparing', 'planning', 'finalizing'],
  'generate-visuals': ['preparing', 'generating', 'validating', 'uploading'],
  'edit-visuals': ['preparing', 'editing', 'validating'],
};

function getStepStatus(currentPhase: string | undefined, jobType: string, stepIndex: number): 'done' | 'active' | 'pending' {
  const phases = PHASE_ORDER[jobType];
  if (!phases || !currentPhase) return stepIndex === 0 ? 'active' : 'pending';
  const currentIdx = phases.indexOf(currentPhase);
  if (currentIdx === -1) return 'pending';
  if (stepIndex < currentIdx) return 'done';
  if (stepIndex === currentIdx) return 'active';
  return 'pending';
}
```

**Step 2: Update progress block rendering**

Find where progress blocks are rendered (look for `block.type === 'progress'` in the JSX, ~line 805-825). Add the step indicator above or replacing the bare progress bar when `jobType` is present:

```tsx
{block.jobType && PHASE_STEPS[block.jobType] && (
  <div className="flex flex-col gap-1.5 my-2">
    {PHASE_STEPS[block.jobType]!.map((label, i) => {
      const status = getStepStatus(block.phase, block.jobType!, i);
      return (
        <div key={i} className="flex items-center gap-2 text-xs">
          {status === 'done' && <Check className="w-3 h-3 text-green-500" />}
          {status === 'active' && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
          {status === 'pending' && <Circle className="w-3 h-3 text-muted-foreground/30" />}
          <span className={status === 'active' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
            {label}
          </span>
        </div>
      );
    })}
  </div>
)}
```

Add `Check`, `Circle`, `Loader2` to the lucide-react imports if not already present.

**Step 3: Ensure ProgressBlock type includes new fields**

Update the ProgressBlock interface (~line 58-63):

```typescript
interface ProgressBlock {
  type: 'progress';
  percent: number;
  message: string;
  error?: boolean;
  phase?: string;
  jobType?: string;
}
```

**Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat: add vertical step indicator for multi-phase agent operations"
```

---

## Task 14: Frontend — Inline Error Recovery

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

**Step 1: Add XCircle to imports**

```typescript
import { ..., XCircle } from 'lucide-react';
```

**Step 2: Replace error progress rendering**

Find where error progress blocks are rendered. When `block.error` is true, replace the simple red bar with an action card:

```tsx
{block.type === 'progress' && block.error && (
  <div className="rounded-lg border border-red-200 bg-red-50 p-3 my-2">
    <div className="flex items-start gap-2">
      <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-red-700">
          {block.message || 'Something went wrong'}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleRetry}
            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
          <button
            onClick={() => sendMessage('Try a different approach for this')}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
          >
            Try different approach
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

**Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat: add inline error recovery with retry and alternative approach buttons"
```

---

## Task 15: Verification

**Step 1: Build worker**

```bash
pnpm --filter worker build
```

Expected: 0 errors

**Step 2: Build API**

```bash
pnpm --filter api build
```

Expected: 0 errors

**Step 3: Build web**

```bash
pnpm --filter web build
```

Expected: Compiles successfully (the existing PageNotFoundError warnings are pre-existing and unrelated)

**Step 4: Grep for remaining hardcoded orange references in agent code**

```bash
grep -rn "F97316\|rgba(249" packages/api/src/agent/ packages/worker/src/
```

Expected: No results (all brand colors should use CSS variables or theme values)

**Step 5: Final commit**

If any fixes were needed:

```bash
git add -A
git commit -m "fix: address build issues from agent robustness implementation"
```
