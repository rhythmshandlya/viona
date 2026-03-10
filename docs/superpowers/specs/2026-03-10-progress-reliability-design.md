# Industrial-Grade Job Progress System — Design Spec

> **Goal:** Replace the passive, failure-prone job progress system with an actively-monitored, multi-layer architecture that never shows false "stalled" messages, detects subprocess failures in seconds, auto-retries from checkpoints, and keeps the UI feeling alive at all times.

## Architecture Overview

Three monitoring layers feed a unified progress store, which delivers to the frontend via three redundant channels.

```
WORKER CONTAINER
┌─────────────────────────────────────────────────┐
│           SUBPROCESS MONITOR                     │
│                                                  │
│  Layer 1: Process Health                         │
│    - Liveness check every 5s                     │
│    - Exit detection (immediate)                  │
│    - Auto-retry with checkpoint resume (max 1)   │
│                                                  │
│  Layer 2: Heartbeat Protocol                     │
│    - Python background thread sends every 10s    │
│    - No heartbeat for 60s → hung → kill + retry  │
│    - Includes phase + detail                     │
│                                                  │
│  Layer 3: File System Observer                   │
│    - Watches workspace for file changes          │
│    - Derives progress from ground truth          │
│    - Reads IMPLEMENTATION_LOG.md for scene status │
│    - Writes .checkpoint.json for recovery        │
│                                                  │
├─────────────────────────────────────────────────┤
│           PROGRESS STORE                         │
│                                                  │
│  Redis HSET  → real-time state (live progress)   │
│  Redis PUBLISH → push to API container           │
│  DB checkpoint → phase transitions only          │
│  Local buffer → fallback if Redis down           │
└─────────────────────────────────────────────────┘

API CONTAINER
┌─────────────────────────────────────────────────┐
│           PROGRESS RELAY                         │
│                                                  │
│  Redis SUBSCRIBE → receives live updates         │
│  Fans out to:                                    │
│    - SSE stream (during agent chat)              │
│    - WebSocket (always, all connected clients)   │
│    - Event buffer (for SSE reconnection replay)  │
└─────────────────────────────────────────────────┘

FRONTEND
┌─────────────────────────────────────────────────┐
│  Three channels (priority: SSE > WS > HTTP)      │
│  Merged into single progress state               │
│                                                  │
│  Display:                                        │
│    - Smooth-interpolated progress bar + shimmer  │
│    - Phase timeline with active indicator        │
│    - Rotating contextual detail text             │
│    - Expandable activity log                     │
│    - Health status dot                           │
└─────────────────────────────────────────────────┘
```

## Shared Types (`@viona/shared`)

```typescript
interface ProgressState {
  percent: number;
  message: string;
  phase: string;            // 'plan' | 'animate' | 'verify' | 'bundle' | 'upload' | 'done' | 'error'
  phaseName: string;        // Human-readable: "Animating scenes"
  detail?: string;          // File-level: "Scene3.tsx written (245 lines)"
  updatedAt: number;        // Unix ms timestamp
  meta?: Record<string, unknown>;
}

interface HealthState {
  processAlive: boolean;
  lastHeartbeat: number;    // Unix ms
  lastFileChange: number;   // Unix ms
  lastRedisUpdate: number;  // Unix ms
  phase: string;
  retriesUsed: number;
  retriesMax: number;
}

interface ActivityEvent {
  timestamp: number;        // Unix ms
  type: 'file' | 'phase' | 'checkpoint' | 'health' | 'error';
  detail: string;           // "Scene3.tsx written (245 lines)"
  phase?: string;
}

interface CheckpointState {
  version: 1;
  jobId: string;
  updatedAt: number;
  phases: {
    plan: PhaseCheckpoint;
    animate: AnimatePhaseCheckpoint;
    verify: PhaseCheckpoint;
    bundle: PhaseCheckpoint;
  };
}

interface PhaseCheckpoint {
  status: 'pending' | 'running' | 'complete' | 'failed';
  completedAt?: number;
  artifacts: string[];      // File paths relative to project dir
}

interface AnimatePhaseCheckpoint extends PhaseCheckpoint {
  scenesTotal: number;
  scenesComplete: number[]; // Scene indices (1-indexed)
  scenesFailed: number[];
}
```

## Progress Store

Single interface used by both worker and API. One implementation per container.

```typescript
interface ProgressStore {
  /** Write live progress — Redis HSET + PUBLISH. Called frequently. */
  set(jobId: string, state: ProgressState): Promise<void>;

  /** Read current progress — Redis HGET, falls back to DB. */
  get(jobId: string): Promise<ProgressState | null>;

  /** Save durable checkpoint — DB write. Called at phase transitions only (~10-15 per job). */
  checkpoint(jobId: string, state: ProgressState): Promise<void>;

  /** Subscribe to live updates — Redis SUBSCRIBE. Returns unsubscribe function. */
  subscribe(jobId: string, cb: (state: ProgressState) => void): () => void;

  /** Write health state — Redis HSET + PUBLISH. */
  setHealth(jobId: string, health: HealthState): Promise<void>;

  /** Append activity event — Redis RPUSH (capped list). */
  addActivity(jobId: string, event: ActivityEvent): Promise<void>;

  /** Read activity log — Redis LRANGE, falls back to checkpoint artifacts. */
  getActivity(jobId: string): Promise<ActivityEvent[]>;

  /** Clean up all Redis keys for a job — called on completion. */
  cleanup(jobId: string, ttlMs?: number): Promise<void>;
}
```

### Redis Key Layout

```
job:{id}:progress     → HASH {percent, message, phase, phaseName, detail, updatedAt}
job:{id}:health       → HASH {processAlive, lastHeartbeat, retriesUsed, lastFileChange}
job:{id}:activity     → LIST of JSON ActivityEvent objects (capped at 100)
```

All keys get TTL of 24 hours via `cleanup()` (called on job complete/fail). During active jobs, TTL is refreshed on each write.

### Worker-Side Implementation

- `set()`: `HSET` + `PUBLISH` + high-water mark (never regress percent)
- `checkpoint()`: DB `UPDATE jobs SET progress, progressMessage, progressMeta` + `set()` for Redis
- Local progress buffer: if Redis write fails, buffer events in memory. Flush on reconnect. Max 50 buffered events.

### API-Side Implementation

- `set()`: Not used (API is read-only for progress)
- `get()`: `HGETALL` from Redis. If empty, `SELECT` from DB.
- `subscribe()`: wraps `redis.subscribe(job:{id}:progress)` with JSON parse + callback
- `getActivity()`: `LRANGE job:{id}:activity 0 99`. If empty, reconstruct from DB checkpoint.

## Subprocess Monitor

Reusable class that wraps any child process with three monitoring layers.

### Configuration

```typescript
interface SubprocessMonitorConfig {
  jobId: string;
  workDir: string;                  // Workspace directory to watch
  progressStore: ProgressStore;     // Injected
  heartbeatTimeoutSec: number;      // Default: 60
  healthCheckIntervalSec: number;   // Default: 5
  maxRetries: number;               // Default: 1
  buildRetryArgs: (checkpoint: CheckpointState) => string[];
  progressMapper: ProgressMapper;   // Processor-specific
  signal?: AbortSignal;             // For external cancellation
}

interface ProgressMapper {
  /** Derive progress from observed file state */
  mapFilesToProgress(checkpoint: CheckpointState): Partial<ProgressState>;
  /** Derive progress from heartbeat */
  mapHeartbeatToProgress(phase: string, detail: string): Partial<ProgressState>;
  /** Derive progress from stdout PROGRESS line (backward compat) */
  mapStdoutToProgress(percent: number, message: string, meta?: Record<string, unknown>): Partial<ProgressState>;
}
```

### Layer 1: Process Watcher

```
Responsibilities:
  - Hold reference to ChildProcess
  - Check process.exitCode every healthCheckIntervalSec
  - On 'exit' event:
    → exit code 0: resolve normally
    → exit code non-zero:
      1. Read checkpoint from disk via checkpoint.ts
      2. If retries < maxRetries:
         - Update health: {processAlive: false, retriesUsed: N}
         - Add activity: "Process crashed, retrying from checkpoint"
         - Call buildRetryArgs(checkpoint) → spawn new process
         - Wire up all three layers to new process
         - Increment retry count
      3. If retries exhausted:
         - Update health: {processAlive: false, retriesExhausted: true}
         - checkpoint() with error phase
         - Reject with detailed error

  - On 'error' event (spawn failure):
    → Same as non-zero exit
```

### Layer 2: Heartbeat Tracker

```
Parses stdout lines matching: HEARTBEAT:{unix_ms}:{phase}:{detail}

On parse:
  - Update lastHeartbeatTime
  - progressStore.set() with phase + detail via progressMapper
  - progressStore.setHealth() with updated lastHeartbeat

Hung detection (runs on same healthCheckIntervalSec timer):
  - now - lastHeartbeatTime > heartbeatTimeoutSec * 1000:
    → SIGTERM the process
    → Wait 10s
    → SIGKILL if still alive
    → Process watcher (Layer 1) handles the exit → retry logic

Note: PROGRESS lines also reset lastHeartbeatTime (they prove the process is alive).
```

### Layer 3: File Observer

```
Uses fs.watch (or chokidar for cross-platform reliability) on workDir.

On file create/modify:
  1. Debounce (100ms) to batch rapid writes
  2. Scan directory → build CheckpointState
  3. Write .checkpoint.json to disk
  4. Call progressMapper.mapFilesToProgress(checkpoint)
  5. progressStore.set() with derived progress
  6. progressStore.addActivity() with file detail

Checkpoint state derivation (reads directory):
  - SCENE_PLAN.md exists → plan phase started/complete
  - scenes.json exists → plan phase complete
  - constants.ts exists → animate phase started
  - scenes/Scene{N}.tsx → count completed scenes
  - index.tsx exists → animate phase complete
  - metadata.json exists → verify/bundle phase
  - .checkpoint.json → read previous state for comparison
```

### Visual Generation Progress Mapper

```typescript
// packages/worker/src/processors/generate-visuals/progress-mapper.ts

const PHASE_WEIGHTS = {
  plan: { start: 15, end: 35 },       // 20% of bar
  animate: { start: 35, end: 65 },     // 30% of bar
  verify: { start: 65, end: 75 },      // 10% of bar
  bundle: { start: 75, end: 85 },      // 10% of bar
  upload: { start: 85, end: 100 },     // 15% of bar
};

mapFilesToProgress(checkpoint):
  if plan.status === 'complete' && animate.status === 'running':
    scenePct = scenesComplete.length / scenesTotal
    percent = lerp(PHASE_WEIGHTS.animate.start, PHASE_WEIGHTS.animate.end, scenePct)
    return { percent, phase: 'animate', phaseName: 'Animating scenes',
             detail: `Scene ${scenesComplete.length}/${scenesTotal}` }

mapHeartbeatToProgress(phase, detail):
  // Use heartbeat phase to confirm current phase
  // Detail provides human-readable status
  return { phase, phaseName: PHASE_NAMES[phase], detail }

mapStdoutToProgress(percent, message, meta):
  // Backward compat — use percent directly (already calibrated by Python)
  return { percent, message, phase: meta?.phase, phaseName: meta?.phaseName }
```

## Heartbeat Protocol (Python)

```python
# Background thread — keeps beating even if main thread hangs on API call

class HeartbeatEmitter:
    def __init__(self, interval_sec=10):
        self.phase = "starting"
        self.detail = ""
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._interval = interval_sec
        self._thread.start()

    def _run(self):
        while not self._stop.is_set():
            ts = int(time.time() * 1000)
            # flush=True is critical — Python buffers stdout by default
            print(f"HEARTBEAT:{ts}:{self.phase}:{self.detail}", flush=True)
            self._stop.wait(self._interval)

    def update(self, phase: str, detail: str = ""):
        self.phase = phase
        self.detail = detail

    def stop(self):
        self._stop.set()
        self._thread.join(timeout=2)
```

Integration points in `claude_visual_generator.py`:
- Create `HeartbeatEmitter()` at start of `main()`
- `heartbeat.update('plan', 'Director analyzing transcript')` before Director phase
- `heartbeat.update('animate', f'Scene {n}/{total}')` before each scene agent
- `heartbeat.update('verify', 'Type-checking')` before tsc
- `heartbeat.update('bundle', 'Remotion bundling')` before bundle
- `heartbeat.stop()` in finally block

## API: Progress Relay

Replaces the `pollJobProgress` while-loop with a Redis subscription.

```typescript
// packages/api/src/progress/progress-relay.ts

interface ProgressRelayConfig {
  jobId: string;
  ctx: ToolContext;            // Has sendSSE()
  progressStore: ProgressStore;
  timeoutMs: number;           // Safety net: 50 min
}

function createProgressRelay(config: ProgressRelayConfig): Promise<JobResult> {
  return new Promise((resolve) => {
    const { jobId, ctx, progressStore, timeoutMs } = config;

    // Subscribe to live progress from Redis
    const unsubProgress = progressStore.subscribe(jobId, (state) => {
      ctx.sendSSE('progress', {
        percent: state.percent,
        message: state.message,
        phase: state.phase,
        phaseName: state.phaseName,
        jobId,
      });

      if (state.detail) {
        ctx.sendSSE('activity', {
          timestamp: state.updatedAt,
          detail: state.detail,
          type: 'file',
          phase: state.phase,
        });
      }

      if (state.phase === 'done') {
        cleanup();
        resolve({ status: 'complete' });
      }
      if (state.phase === 'error') {
        cleanup();
        resolve({ status: 'failed' });
      }
    });

    // Subscribe to health updates
    // (health is published on same Redis channel with type prefix)
    const unsubHealth = progressStore.subscribe(`${jobId}:health`, (health) => {
      ctx.sendSSE('health', health);

      if (!health.processAlive && health.retriesUsed >= health.retriesMax) {
        cleanup();
        resolve({ status: 'failed' });
      }
    });

    // Safety timeout
    const timer = setTimeout(() => {
      cleanup();
      resolve({ status: 'timeout' });
    }, timeoutMs);

    function cleanup() {
      unsubProgress();
      unsubHealth();
      clearTimeout(timer);
    }

    // Abort support
    ctx.signal?.addEventListener('abort', () => {
      cleanup();
      resolve({ status: 'aborted' });
    });
  });
}
```

## API: SSE Heartbeat Enhancement

```typescript
// agent-router.ts — replace comment heartbeat with proper event

// OLD: sseStream.write(':\n\n');
// NEW:
const heartbeat = setInterval(() => {
  if (!sseStream.destroyed) {
    sendSSE('heartbeat', { ts: Date.now() });
  }
}, 10_000);
```

Frontend already handles `heartbeat` event type in stall detection reset.

## API: New Activity Endpoint

```
GET /api/jobs/:id/activity
Response: { activity: ActivityEvent[], checkpoint: ProgressState | null }
```

Used by frontend on page refresh to reconstruct the activity log. Reads from Redis `LRANGE`, falls back to reconstructing from DB checkpoint data.

## WebSocket Handler Updates

```typescript
// ws/handler.ts — handle richer payload types

// Existing: job:progress, job:complete, job:error
// New additions: job:health, job:activity

// The handler doesn't change structurally — it already forwards
// whatever Redis publishes. The new event types flow through
// automatically because we publish them on the same channel pattern.
```

## Frontend Components

### ProgressBar.tsx

```
Responsibilities:
  - Smooth interpolation between progress values (800ms ease-out)
  - Slow creep between updates (0.1%/sec, capped at next expected checkpoint)
  - Shimmer animation on leading edge (CSS gradient pulse)
  - Displays: percent, phase name, detail text, ETA

Props:
  percent: number
  phase: string
  phaseName: string
  detail?: string
  isActive: boolean
```

### PhaseTimeline.tsx

```
Horizontal phase indicator:

  ✓ Plan    ● Animate    ○ Verify    ○ Bundle    ○ Upload

  - Completed phases: checkmark + green
  - Current phase: filled dot + pulse animation
  - Pending phases: hollow dot + dimmed

Props:
  currentPhase: string
  completedPhases: string[]
```

### ActivityLog.tsx

```
Expandable accordion below progress bar.

  ▼ Activity Log
    ✓ 13:25:01  Workspace prepared
    ✓ 13:25:15  Director started planning
    ✓ 13:26:41  Scene plan written (9 scenes)
    ● 13:28:47  Scene 3 animating...

Props:
  events: ActivityEvent[]
  isExpanded: boolean
  onToggle: () => void
```

### HealthIndicator.tsx

```
Small status dot, always visible.

  ● Connected — Agent working           (green)
  ● Waiting on AI response              (yellow, no heartbeat 30s)
  ● Reconnecting...                     (orange, connection lost)
  ● Restarting from Scene 5...          (orange, auto-retry)
  ● Failed during Scene 6. [Retry]      (red, retries exhausted)

Props:
  health: HealthState
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected'
```

### use-progress.ts Hook

```
Merges SSE + WebSocket + HTTP poll into single state.

Returns:
  progress: ProgressState
  health: HealthState
  activity: ActivityEvent[]
  connectionStatus: string

Priority: SSE > WebSocket > HTTP
Automatic failover when higher-priority channel goes silent.
High-water mark: progress never regresses.
```

### use-smooth-progress.ts Hook

```
Takes raw percent, returns animated values.

- Smooth interpolation via requestAnimationFrame
- Creep between updates (0.1%/sec)
- Shimmer phase offset for CSS animation

Returns:
  displayPercent: number       // Smoothed value for bar width
  isCreeping: boolean          // True when between real updates
  shimmerOffset: number        // For CSS gradient animation
```

## Migration Strategy

### Phase 1: Parallel Deployment (Zero Risk)

Deploy new system alongside old. Both paths fire simultaneously.

- Worker: SubprocessMonitor wraps existing subprocess.ts logic. Still calls old `publishJobProgress` AND new `progressStore.set()`.
- API: `pollJobProgress` still runs. New `ProgressRelay` also runs. Frontend receives from both (deduplication via high-water mark).
- Frontend: New components added but hidden behind feature flag. Old progress display still works.

### Phase 2: Validate (1-2 Days)

- Log discrepancies between old DB polling and new Redis subscription
- Verify heartbeat protocol works across Railway containers
- Verify file observer detects all expected file changes
- Verify auto-retry works on simulated crashes
- Enable new frontend for internal testing

### Phase 3: Cut Over

- Remove old `publishJobProgress` from both packages
- Remove `heartbeat-progress.ts`
- Remove `pollJobProgress` (replaced by `subscribeJobProgress`)
- Remove old progress display components
- Remove feature flag

## Error Handling Summary

| Failure | Detection | Recovery | User Impact |
|---------|-----------|----------|-------------|
| Python crashes | Layer 1: exit event, immediate | Auto-retry from .checkpoint.json | Orange dot, "Restarting..." bar continues |
| Python hangs | Layer 2: no heartbeat 60s | SIGTERM+SIGKILL → retry | Yellow → Orange, auto-restart |
| Python OOM | Layer 1: exit code 137 | Retry once | Orange dot, restart |
| Retry fails | Layer 1: retries exhausted | Error to user with detail | Red dot, [Retry] button |
| Redis down | set() try/catch | Local buffer, flush on reconnect. DB checkpoints continue | Slightly delayed updates |
| Redis restarts | ioredis auto-reconnect | get() falls back to DB during gap | 1-3s gap then resumes |
| DB checkpoint fails | checkpoint() try/catch | Retry next phase transition. Redis still live | No visible impact |
| SSE drops | Frontend EventSource error | WebSocket takes over instantly | Seamless |
| WebSocket drops | onclose event | Exponential backoff reconnect + HTTP poll | "Reconnecting..." dot |
| All channels dead | 3 failed HTTP polls | "Connection lost, job still running" | Reconnect message |
| Worker container restarts | BullMQ auto-retry | Read .checkpoint.json, resume | "Restarting from Scene N" |
| Page refresh | N/A | DB checkpoint + WebSocket subscribe | Immediate state recovery |

## File Structure

```
packages/shared/
├── package.json                          # @viona/shared
├── tsconfig.json
└── src/
    └── progress-types.ts                 # ProgressState, HealthState, ActivityEvent, CheckpointState

packages/worker/src/
├── monitor/
│   ├── subprocess-monitor.ts             # Core class — wraps child_process with 3 layers
│   ├── process-watcher.ts                # Layer 1 — liveness, exit detection, retry
│   ├── heartbeat-tracker.ts              # Layer 2 — parse HEARTBEAT, hung detection
│   ├── file-observer.ts                  # Layer 3 — fs.watch, checkpoint state reader
│   ├── checkpoint.ts                     # Read/write .checkpoint.json
│   └── progress-mapper.ts                # Interface for processor-specific mapping
│
├── progress/
│   ├── progress-store.ts                 # Worker-side ProgressStore (HSET + PUBLISH + DB)
│   └── progress-buffer.ts               # Local buffer for Redis-down fallback
│
├── processors/generate-visuals/
│   ├── progress-mapper.ts                # NEW — maps files/heartbeats to percent
│   ├── subprocess.ts                     # UPDATED — uses SubprocessMonitor
│   └── index.ts                          # UPDATED — uses ProgressStore
│
├── utils/
│   └── heartbeat-progress.ts             # DELETED in Phase 3

packages/api/src/
├── progress/
│   ├── progress-relay.ts                 # NEW — Redis subscribe → SSE + WebSocket fan-out
│   └── progress-store.ts                 # NEW — API-side ProgressStore (read-only + subscribe)
│
├── agent/
│   ├── agent-tools.ts                    # UPDATED — pollJobProgress → subscribeJobProgress
│   └── agent-router.ts                   # UPDATED — proper heartbeat events
│
├── routes/
│   └── jobs.ts                           # UPDATED — new GET /api/jobs/:id/activity endpoint

packages/worker/src/agents/
├── claude_visual_generator.py            # UPDATED — HeartbeatEmitter integration

apps/web/src/features/editor-v2/
├── components/
│   ├── ProgressBar.tsx                   # NEW — smooth interpolation + shimmer
│   ├── PhaseTimeline.tsx                 # NEW — horizontal phase indicator
│   ├── ActivityLog.tsx                   # NEW — expandable file-level log
│   ├── HealthIndicator.tsx              # NEW — status dot
│   └── AIAssistantPanel.tsx              # UPDATED — integrates new components
│
├── hooks/
│   ├── use-progress.ts                   # NEW — merges SSE + WS + HTTP
│   ├── use-smooth-progress.ts            # NEW — interpolation + creep animation
│   └── use-job-websocket.ts              # UPDATED — handles health + activity events
```
