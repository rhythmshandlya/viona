# Agent Robustness Design

**Date**: 2026-02-17
**Status**: Approved
**Approach**: Defensive Plumbing (fix underlying timeout/recovery/cancel infrastructure)

## Problem

The Creative Director agent gets stuck for users across all phases (planning, generation, editing). Symptoms include frozen progress bars, infinite spinners, completed-but-stale UI, and no way to recover without refreshing. Progress is inconsistent — jumps 0% to 100% for some job types, and SSE + WebSocket channels can race.

## Context

Real-world job durations:
- **Plan generation**: 10-15 minutes
- **Visual generation**: up to 30 minutes
- **Visual editing**: 5-10 minutes

Current architecture: Fastify SSE streaming (PassThrough + `reply.send`) for agent chat, BullMQ workers for background jobs, Redis pub/sub + WebSocket for job progress, PostgreSQL for conversation persistence.

## Sections

### 1. Worker Robustness

**Problem**: Jobs silently stall because BullMQ lock expires, no retry config exists, and deployments can create orphans.

**Current state**:
- `lockDuration: 10min`, `stalledInterval: 5min` on visual workers — but no proactive lock extension
- No `attempts` or `backoff` configured (uses BullMQ defaults)
- No `UnrecoverableError` usage — all failures retried identically
- Graceful shutdown exists (`worker.close()` on SIGTERM)
- No `maxStalledCount` set

**Changes**:

#### Worker config (`packages/worker/src/index.ts`)

All visual workers (generate-visuals, plan-visuals, edit-visuals):

```typescript
{
  lockDuration: 5 * 60 * 1000,      // 5 min (reduced from 10, compensated by lock extension)
  stalledInterval: 30_000,           // 30s (reduced from 5 min — detect stalls faster)
  maxStalledCount: 2,                // 2 stalls before permanent failure
}
```

#### Proactive lock extension (all visual processors)

```typescript
const lockExtender = setInterval(async () => {
  try {
    await job.extendLock(token!, 120_000);
  } catch (err) {
    logger.error(`Lock extension failed for job ${job.id}`, err);
  }
}, 55_000); // every 55s, well before 5min expiry

try {
  // ... existing processing logic
} finally {
  clearInterval(lockExtender);
}
```

Critical for 30-min generation jobs — without this, the lock expires and BullMQ marks the job stalled.

#### Job retry config (where jobs are queued)

```typescript
await queue.add('generate-visuals', jobData, {
  attempts: 2,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: { count: 50 },
  removeOnFail: false,    // keep failures for debugging
});
```

#### UnrecoverableError for permanent failures (processors)

```typescript
import { UnrecoverableError } from 'bullmq';

if (error.message.includes('content_policy') || error.message.includes('invalid prompt')) {
  throw new UnrecoverableError(error.message);  // don't retry
}
```

---

### 2. Cancel Pipeline

**Problem**: Users have zero control when things get stuck. No cancel button, no abort forwarding to worker. Users close the tab.

**Current state**:
- Frontend has `AbortController` but only for unmount / safety timeout — no user-facing stop button
- Backend listens to `request.raw.on('close')` and aborts SDK query
- Worker already has `registerCancelHandler` + Redis `job:cancel` channel + subprocess SIGTERM — **cancel infra exists but is never triggered from the API**

**Chain**: Stop button → API endpoint → Redis publish → Worker kills subprocess → SSE sends cancellation event

#### Cancel endpoint (`packages/api/src/agent/agent-router.ts`)

```typescript
// POST /projects/:id/agent/cancel
fastify.post('/projects/:id/agent/cancel', { preHandler: [authenticate] }, async (request, reply) => {
  const projectId = request.params.id;

  const activeJob = await db.query.jobs.findFirst({
    where: and(
      eq(jobs.projectId, projectId),
      or(eq(jobs.status, 'pending'), eq(jobs.status, 'processing')),
    ),
  });

  if (activeJob) {
    await redis.publish('job:cancel', JSON.stringify({ jobId: activeJob.id }));
    await db.update(jobs).set({ status: 'failed', error: 'Cancelled by user' }).where(eq(jobs.id, activeJob.id));
    await publishJobError(activeJob.id, 'Cancelled by user');
  }

  reply.send({ ok: true, cancelledJobId: activeJob?.id ?? null });
});
```

#### Worker cancellation detection (processors)

After subprocess exits, detect cancellation and prevent retry:

```typescript
if (wasCancelled) {
  throw new UnrecoverableError('Cancelled by user');
}
```

No other worker changes needed — existing `registerCancelHandler` / Redis subscriber pattern already handles SIGTERM.

#### Frontend Stop button (`apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`)

```tsx
{isStreaming && (
  <button onClick={handleCancel}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg">
    <Square className="w-3 h-3" />
    Stop
  </button>
)}
```

Cancel handler:

```typescript
const handleCancel = useCallback(async () => {
  abortRef.current?.abort();                    // instant UI feedback
  try { await api.cancelAgent(projectId); } catch {} // best-effort backend kill
  setIsStreaming(false);
  setActiveJobId(null);
  // append "Generation stopped." to last assistant message
}, [projectId]);
```

#### API client

```typescript
cancelAgent(projectId: string): Promise<{ ok: boolean }> {
  return this.post(`/projects/${projectId}/agent/cancel`);
}
```

---

### 3. Progress Consistency

**Problem**: Progress jumps 0% → 100% during opaque phases. SSE and WebSocket can race. Different job types report differently.

**Current state**:
- `generate-visuals.ts` parses `PROGRESS:XX:message` from Python stdout — decent granularity
- `plan-visuals.ts` only reports 0% and 100%
- `edit-visuals.ts` — same 0%/100% pattern
- Frontend can receive the same update from both SSE and WebSocket

#### Phase decomposition (`plan-visuals.ts`)

```typescript
await publishJobProgress(jobId, 5, 'Loading project and transcript...');
await publishJobProgress(jobId, 15, 'Preparing prompt for scene planning...');
await publishJobProgress(jobId, 20, 'Planning scenes — this may take a few minutes...');
// ... Director phase (opaque) ...
await publishJobProgress(jobId, 90, 'Parsing scene plan...');
await publishJobProgress(jobId, 100, 'Plan complete');
```

#### Phase decomposition (`edit-visuals.ts`)

```typescript
await publishJobProgress(jobId, 5, 'Loading scene and transcript...');
await publishJobProgress(jobId, 15, 'Analyzing edit request...');
await publishJobProgress(jobId, 20, 'Editing visual — this may take a few minutes...');
// ... Claude edit (opaque) ...
await publishJobProgress(jobId, 85, 'Validating updated code...');
await publishJobProgress(jobId, 95, 'Uploading result...');
await publishJobProgress(jobId, 100, 'Edit complete');
```

Narrows the opaque gap from 0-100% to 20-85%.

#### Asymptotic heartbeat progress (`packages/worker/src/utils/heartbeat-progress.ts`)

New utility for smooth progress during opaque phases:

```typescript
export function startHeartbeatProgress(
  jobId: string,
  startPercent: number,
  ceilingPercent: number,
  estimatedMs: number,
) {
  const startTime = Date.now();
  const interval = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    const ratio = 1 - Math.exp(-elapsed / (estimatedMs * 0.7));
    const percent = Math.round(startPercent + ratio * (ceilingPercent - startPercent - 2));
    await publishJobProgress(jobId, percent, 'Processing...').catch(() => {});
  }, 5_000);

  return { stop: () => clearInterval(interval) };
}
```

Usage with real-world estimates:

```typescript
// plan-visuals (10-15 min estimated):
const heartbeat = startHeartbeatProgress(jobId, 20, 88, 12 * 60 * 1000);

// generate-visuals (30 min, but has its own PROGRESS parsing — heartbeat fills gaps):
const heartbeat = startHeartbeatProgress(jobId, 20, 83, 25 * 60 * 1000);

// edit-visuals (5-10 min estimated):
const heartbeat = startHeartbeatProgress(jobId, 20, 83, 8 * 60 * 1000);
```

Bar moves smoothly via exponential decay, slowing as it approaches the ceiling, then snaps to real value when phase completes.

#### SSE/WebSocket dedup (`AIAssistantPanel.tsx`)

```typescript
const progressSourceRef = useRef<'sse' | 'ws' | null>(null);

// SSE handler: progressSourceRef.current = 'sse';
// WebSocket handler: skip if progressSourceRef.current === 'sse' && isStreaming
// Reset to null when streaming ends
```

SSE takes priority during active streaming. WebSocket is the fallback after SSE drops.

#### Normalized progress messages (`agent-tools.ts`)

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
```

---

### 4. SSE Streaming Hardening

**Problem**: Streams can silently die. The 5-minute safety timeout is the only backstop.

**Current state**:
- Headers include `X-Accel-Buffering: no` — good
- 15s heartbeat — good
- No `stream.write()` return value checking
- No event IDs
- 45s inactivity timeout in SSE parser — good

#### Backpressure awareness (`agent-router.ts`)

```typescript
let draining = true;
sseStream.on('drain', () => { draining = true; });

function sendSSE(stream: PassThrough, event: string, data: unknown) {
  if (stream.destroyed) return;
  const ok = stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (!ok) draining = false;
}
```

Lightweight logging — SSE payloads are small enough that full pause/resume is unnecessary.

#### Event IDs (`agent-router.ts`)

```typescript
let eventId = 0;
function sendSSE(stream: PassThrough, event: string, data: unknown) {
  if (stream.destroyed) return;
  eventId++;
  stream.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
```

Foundation for future replay-on-reconnect. Current recovery path (reload from DB + WebSocket handoff) is sufficient — text is persisted every 2s, widgets immediately, jobs continue independently.

#### Reduced safety timeout (`AIAssistantPanel.tsx`)

Reduce from 5 min to 2 min:

```typescript
const safetyTimeout = setTimeout(() => {
  controller.abort();
}, 2 * 60 * 1000);
```

**No max connection lifetime.** SSE stays open for the entire `pollJobProgress` loop, which can be 30+ minutes for generation jobs. The layered timeouts handle zombie detection:
- 45s SSE parser inactivity timeout catches dead streams
- 2-min safety timeout catches heartbeat-only zombies
- Stop button gives users manual control
- Stream naturally closes when agent tool returns

---

### 5. Frontend Timeout UX

**Problem**: Users see an infinite spinner with no explanation and no options. Only escape is closing the tab.

**Current state**:
- Progress bar: simple gradient fill with percentage
- Error: single text message appended to chat
- Retry: button on failed messages
- No tiered timeout feedback
- No step indicator

#### Tiered stall detection (`AIAssistantPanel.tsx`)

```typescript
const [stallState, setStallState] = useState<'ok' | 'slow' | 'stuck'>('ok');
const lastProgressTime = useRef(Date.now());

function onProgressReceived() {
  lastProgressTime.current = Date.now();
  setStallState('ok');
}

useEffect(() => {
  if (!isStreaming) { setStallState('ok'); return; }
  const check = setInterval(() => {
    const elapsed = Date.now() - lastProgressTime.current;
    const slowThreshold = activeJobId ? 60_000 : 15_000;
    const stuckThreshold = activeJobId ? 120_000 : 45_000;
    if (elapsed > stuckThreshold) setStallState('stuck');
    else if (elapsed > slowThreshold) setStallState('slow');
    else setStallState('ok');
  }, 3_000);
  return () => clearInterval(check);
}, [isStreaming, activeJobId]);
```

Thresholds adapt: during active jobs (where progress events arrive every 5s), 60s silence = amber, 2 min = red. During normal chat, 15s/45s.

UI:
- **ok**: No indicator
- **slow**: Amber "Taking longer than usual..."
- **stuck**: Red "This seems stuck." with inline "Stop & retry" link

#### Vertical step indicator

Extended progress block:

```typescript
interface ProgressBlock {
  type: 'progress';
  percent: number;
  message: string;
  error?: boolean;
  phase?: string;    // 'preparing' | 'planning' | 'generating' | 'validating' | 'uploading'
  jobType?: string;  // 'plan-visuals' | 'generate-visuals' | 'edit-visuals'
}
```

Phase steps config:

```typescript
const PHASE_STEPS: Record<string, { label: string }[]> = {
  'plan-visuals': [
    { label: 'Loading project' },
    { label: 'Planning scenes' },
    { label: 'Finalizing plan' },
  ],
  'generate-visuals': [
    { label: 'Preparing pipeline' },
    { label: 'Generating visuals' },
    { label: 'Validating code' },
    { label: 'Uploading assets' },
  ],
  'edit-visuals': [
    { label: 'Analyzing request' },
    { label: 'Editing visual' },
    { label: 'Validating changes' },
  ],
};
```

Renders as vertical stepper with check/spinner/circle icons per step. Replaces bare progress bar for known multi-phase jobs.

#### Inline error recovery

When a job fails, render an action card instead of a dead-end text message:

```tsx
<div className="rounded-lg border border-red-200 bg-red-50 p-3">
  <XCircle /> {block.message}
  <button>Retry</button>
  <button onClick={() => sendMessage('Try a different approach')}>Try different approach</button>
</div>
```

Three recovery paths: Retry (resend payload), Try different approach (ask agent), Stop (cancel button).

#### Backend: pass phase and jobType in progress events (`agent-tools.ts`)

Thread `jobType` from each tool function into `pollJobProgress`, include `phase` derived from progress message or percent range. Frontend uses this to select the right stepper.

---

## Files Modified

| File | Section | Changes |
|------|---------|---------|
| `packages/worker/src/index.ts` | 1 | Worker config: stalledInterval, maxStalledCount |
| `packages/worker/src/processors/generate-visuals.ts` | 1, 3 | Lock extension, phase decomposition, heartbeat progress |
| `packages/worker/src/processors/plan-visuals.ts` | 1, 3 | Lock extension, phase decomposition, heartbeat progress |
| `packages/worker/src/processors/edit-visuals.ts` | 1, 3 | Lock extension, phase decomposition, heartbeat progress |
| `packages/worker/src/utils/heartbeat-progress.ts` | 3 | New file: asymptotic progress utility |
| `packages/api/src/agent/agent-router.ts` | 2, 4 | Cancel endpoint, backpressure, event IDs |
| `packages/api/src/agent/agent-tools.ts` | 3 | Normalized messages, phase/jobType in progress events |
| `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` | 2, 3, 4, 5 | Stop button, SSE/WS dedup, stall detection, step indicator, error recovery |
| `apps/web/src/lib/api.ts` (or equivalent) | 2 | `cancelAgent()` method |

## Non-Goals

- Full event replay on SSE reconnect (DB persistence + WebSocket fallback is sufficient)
- Redis `noeviction` policy change (operational concern, not code)
- Long conversation pagination/archival (not causing stuck states)
- Cost/time budget controls (future enterprise feature)
