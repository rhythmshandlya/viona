# Resilient Sandbox Infrastructure — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Goal:** Make the sandbox system industrial-grade — reliable at scale (100s–1000s of users), resilient to failures, and consistent across local Docker and production Railway.

**Context:** The resilient progress system (separate spec) decoupled the orchestrator from SSE and added multi-task tracking. This spec builds on that foundation and addresses the infrastructure layer: container lifecycle, resource management, health monitoring, data durability, and cleanup.

---

## Problem Statement

The current sandbox lifecycle manager (`routes.ts`, 797 lines) mixes HTTP routing with lifecycle orchestration, health monitoring, and proxying. It has:

1. **Race conditions in concurrent limits** — count-then-create pattern allows exceeding `maxConcurrent` under concurrent requests
2. **Silent data loss on stale recovery** — if a container dies and its volume is also gone, work is lost without user notification
3. **Non-durable checkpoints** — manifests checkpoint to the volume only; if the volume is lost, so is the checkpoint
4. **No proactive health monitoring** — health is only checked on-demand when a user hits the endpoint
5. **No zombie cleanup** — orphaned containers/services accumulate forever
6. **Non-atomic workspace init** — partial failures leave corrupted workspaces that return 200
7. **No graceful API shutdown** — deploying a new API version abandons active sandboxes
8. **Docker provider fragility** — shell-based `execFile`, fixed ports, no resource limits, no container labels

These issues affect both Railway (production) and Docker (local dev).

---

## Architecture

### SandboxManager

Extract lifecycle orchestration from `routes.ts` into a dedicated `SandboxManager` class. Routes become thin HTTP handlers (5–15 lines each). The manager sits above both providers and owns all cross-cutting concerns.

```
┌──────────────────────────────────────────────┐
│            Sandbox Routes (~300 lines)        │
│          (thin HTTP handlers + proxy)         │
└──────────────┬───────────────────────────────┘
               │
┌──────────────▼───────────────────────────────┐
│            SandboxManager                     │
│                                               │
│  acquire(projectId, userId, opts) → Sandbox   │
│  suspend(projectId, reason) → void            │
│  checkpoint(projectId, manifest) → void       │
│  getStatus(projectId) → SandboxStatus         │
│                                               │
│  startMonitoring() → void  (boot)             │
│  stopMonitoring() → void   (shutdown)         │
│                                               │
│  ┌──────────────────────────────────────┐     │
│  │ Atomic concurrent limits (DB-level)  │     │
│  │ Health monitoring loop (30s sweep)   │     │
│  │ Zombie GC loop (5min sweep)          │     │
│  │ Graceful shutdown coordinator        │     │
│  │ Atomic init with rollback            │     │
│  │ Durable checkpoints (volume + S3)    │     │
│  │ Stale recovery (no silent data loss) │     │
│  └──────────────────────────────────────┘     │
└──────┬──────────────────────────┬────────────┘
       │                          │
┌──────▼──────┐            ┌──────▼──────┐
│  Railway    │            │   Docker    │
│  Provider   │            │  Provider   │
│ (GraphQL)   │            │ (dockerode) │
└─────────────┘            └─────────────┘
```

**File:** `packages/api/src/sandbox/manager.ts`

### Provider Interface (unchanged)

The `SandboxProvider` interface stays the same. Both providers implement `create`, `destroy`, `backup`, `isReady`. The manager adds lifecycle guarantees above this interface.

---

## R1: SandboxManager — Lifecycle Methods

### R1.1: `acquire(projectId, userId, opts)`

The single entry point for getting a ready sandbox. Replaces the current ~250-line inline block in `routes.ts`.

**Return type:** `AcquireResult`:
```typescript
interface AcquireResult {
  sandbox: Sandbox;           // connection info (internalUrl, agentUrl, secret)
  initRequired: boolean;      // true if fresh init was performed
  recovery?: 'full' | 'partial' | 'lost';  // present only if stale recovery occurred
}
```

**Sequence:**
1. Acquire per-project mutex (existing pattern, moved into manager)
2. Check for existing `ready` session in DB
3. If found: health-check via `provider.isReady()`
   - If healthy: touch activity, return existing sandbox
   - If dead: attempt recovery (R3)
4. Atomic concurrent limit check (R2)
5. Per-user limit: if user has other active sandboxes, **schedule them for suspension after the transaction commits** (suspension requires its own mutex and cannot be nested — see R2.2)
6. Check for `suspended` session with `backupId`
7. `provider.create()` with or without backup
8. Atomic workspace init with rollback (R4)
9. Upsert DB record: status='ready', internalUrl, agentUrl, secret
10. Start activity tracking (existing health.ts)
11. Execute any deferred suspensions from step 5
12. Return `AcquireResult`

**Error handling:** If any step fails after provider.create(), attempt provider.destroy() to clean up the container, then re-throw the error. Never leave an orphaned container with no DB record.

### R1.2: `suspend(projectId, reason)`

**Sequence:**
1. Acquire per-project mutex
2. Update DB: status='suspending'
3. Durable checkpoint to S3 (R5)
4. `provider.backup()` → backupId
5. `provider.destroy()`
6. Update DB: status='suspended', backupId, clear internalUrl/serviceIds
7. Clear all Redis state for project — specific keys:
   - `sandbox:tasks:{projectId}`
   - `sandbox:busy:{projectId}`
   - `sandbox:progress:{projectId}`
   - `sandbox:activity:{projectId}`
   - `sandbox:plan:{projectId}`
8. Remove activity tracking
9. Emit workspace teardown event

**Error handling:** If backup fails, still destroy the container but log a warning and set `backupId` to the S3 checkpoint key if available. Never leave a container running after suspend is requested.

**`reason` parameter:** Stored in a new `suspendReason` column. Values: `'idle'`, `'user'`, `'health_failure'`, `'limit_exceeded'`, `'api_shutdown'`. Enables debugging and metrics.

### R1.3: `getStatus(projectId)`

Returns the combined status from DB + Redis + optional sandbox fallback poll. Same logic as current status endpoint but encapsulated.

### R1.4: `startMonitoring()` / `stopMonitoring()`

Called on API boot / shutdown. Starts the health loop (R6) and GC loop (R7). On shutdown, triggers graceful drain (R8).

---

## R2: Atomic Concurrent Limits

### R2.1: DB-Level Locking

Replace the current count-then-create pattern with `SELECT ... FOR UPDATE` inside a transaction:

```sql
BEGIN;
-- Lock the actual rows (not an aggregate) to prevent concurrent reads
SELECT id FROM sandbox_sessions
  WHERE status IN ('creating', 'ready')
  FOR UPDATE;
-- Count in application code after locking
-- Check count < maxConcurrent
-- Check per-user count < 1
INSERT INTO sandbox_sessions (status='creating', ...);
COMMIT;
```

**Important:** The `FOR UPDATE` must be on a row-returning query (`SELECT id`), not an aggregate (`SELECT count(*)`). PostgreSQL's `FOR UPDATE` locks the rows returned by the query — an aggregate collapses rows into one, so `count(*)` would not lock the underlying sandbox_sessions rows. By selecting `id`, we lock all active session rows, preventing concurrent transactions from inserting until this transaction commits.

### R2.2: Per-User Limit

Within the same transaction, count active sessions for the specific user. If at limit (1), identify the other session and schedule it for suspension after the transaction commits (suspension requires its own mutex and cannot be nested inside the creation transaction).

### R2.3: Drizzle Implementation

Drizzle supports raw SQL via `db.execute(sql\`...\`)` for the `FOR UPDATE` clause. The INSERT uses standard Drizzle `db.insert()`. Both run inside `db.transaction()`.

---

## R3: Stale Recovery Without Data Loss

### R3.1: Recovery Hierarchy

When a `ready` session fails its health check, attempt recovery in this order:

1. **Volume backup**: `provider.backup()` — saves the full workspace state
2. **S3 checkpoint**: Check `checkpoints/{projectId}/manifest.json` in S3
3. **Fresh init**: Last resort — user loses work

### R3.2: User Notification

If recovery falls to level 2 (S3 checkpoint), the sandbox resumes but the user gets a warning: `"Your workspace was recovered from a checkpoint. Some recent changes may be lost."`

If recovery falls to level 3 (fresh init), return an error status that the frontend displays: `"Your previous work session couldn't be recovered. Starting fresh."` Do not silently pretend everything is fine.

### R3.3: Implementation

```
recoverStaleSession(session):
  1. Try provider.backup(session) → backupId
     - Railway: volume persists independently of service, so backup usually succeeds
       even if the service is dead. This is the common production recovery path.
     - Docker: backup requires the bind-mount directory to still exist. If the host
       directory was cleaned up (e.g., by a previous destroy), backup will fail.
     - Success: suspend with backupId, fall through to normal resume
     - Failure: continue to step 2
  2. Check S3 for checkpoint: s3.headObject('checkpoints/{projectId}/manifest.json')
     - Exists: suspend with s3CheckpointKey, set recovery='partial'
     - Not found: continue to step 3
  3. Suspend with no backup, set recovery='lost'
  4. Return { recovered: boolean, level: 'full'|'partial'|'lost' }
```

The `recovery` status is passed back through `acquire()` so the route handler can include it in the response to the frontend.

---

## R4: Atomic Workspace Init with Rollback

### R4.1: Staging Pattern

Instead of writing directly to `/workspace/`, init writes to `/workspace/.staging/`:

1. Download video → `/workspace/.staging/public/video.mp4`
2. Extract audio → `/workspace/.staging/public/audio.wav`
3. Write manifest → `/workspace/.staging/manifest.json`
4. Write transcript → `/workspace/.staging/docs/transcript.json`
5. Write brief → `/workspace/.staging/docs/user-brief.md`
6. Write all other init artifacts (scene-registry.ts, generation-progress.json, speaker-grid.json, template files, shared prompt modules, theme files) → `.staging/`
7. **Atomic promotion**: Move all files from `.staging/` to workspace root
8. Recreate symlinks required by Remotion (e.g., `public/manifest.json → ../manifest.json`) — these break during move and must be re-established after promotion
9. Delete `.staging/`

**Note:** The file list above is illustrative, not exhaustive. The current `workspace-init.ts` writes ~15 different file types. The staging pattern wraps ALL writes — the key invariant is that nothing touches the workspace root until all artifacts are ready.

### R4.2: Rollback on Failure

If any step (1–5) fails:
- Delete `/workspace/.staging/` entirely
- Return error response (not 200) from the `/init` endpoint
- The agent-server returns the error to the API
- The API returns the error to the frontend

### R4.3: Init Status in API Response

The `acquire()` method now distinguishes between:
- `{ status: 'ready', initRequired: false }` — resumed from backup, workspace already initialized
- `{ status: 'ready', initRequired: true }` — fresh sandbox, init was sent and succeeded
- Error thrown — init failed, container cleaned up

The current pattern of returning 200 even when init fails is eliminated. The API route handler catches the error and returns 500 with a message.

---

## R5: Durable Checkpoints

### R5.1: Dual-Write Strategy

On checkpoint (every 60s from sandbox):
1. Write manifest to volume (fast, local) — already done
2. Upload manifest to S3: `PUT checkpoints/{projectId}/manifest.json` — new

The S3 upload is fire-and-forget from the sandbox's perspective (non-blocking). If it fails, the next checkpoint will retry.

### R5.2: Checkpoint Endpoint Change

The API's `/internal/sandbox/:id/checkpoint` endpoint currently accepts the manifest but doesn't persist it. Change it to:
1. Accept manifest JSON
2. Upload to S3: `checkpoints/{projectId}/manifest.json`
3. Return 200

This keeps the checkpoint logic on the API side (where S3 credentials live) rather than requiring S3 access inside the sandbox.

### R5.3: S3 Lifecycle Rule

Add a 7-day expiration rule on the `checkpoints/` prefix to prevent accumulation. Active sandboxes overwrite their checkpoint every 60s, so only the latest is kept. After 7 days of inactivity, the checkpoint is deleted.

### R5.4: Recovery from S3 Checkpoint

When `acquire()` finds a suspended session with no `backupId` but an S3 checkpoint exists:
1. Create fresh sandbox (no volume backup)
2. Download checkpoint manifest from S3
3. Send modified `/init` with the recovered manifest instead of the DB manifest
4. Mark recovery as `'partial'` — workspace files (video, audio) come from DB/S3, but manifest reflects the last checkpoint

---

## R6: Health Monitoring Loop

### R6.1: Sweep Pattern

A background interval (every 30s) that health-checks all active sandboxes:

```
healthSweep():
  sessions = SELECT * FROM sandbox_sessions WHERE status = 'ready'
  for each session:
    if session was checked < 15s ago: skip (debounce)
    healthy = provider.isReady(session.internalUrl)
    if healthy:
      resetFailureCount(session.id)
    else:
      incrementFailureCount(session.id)
      if failureCount >= 3:
        log.warn('Sandbox unhealthy, suspending', { projectId, failures })
        suspend(session.projectId, 'health_failure')
```

### R6.2: Failure Tracking

In-memory `Map<sessionId, { failures: number, lastCheck: number }>`. Reset on successful health check. This avoids DB writes on every health check cycle.

### R6.3: Per-Session Skip Window

The sweep runs every 30s globally. For sessions that fail health checks, apply a per-session skip window that doubles on each consecutive failure: skip for 30s → 60s → 120s → 240s (cap). This is separate from the global sweep interval — it determines whether a specific session is checked during a given sweep. On successful health check, reset to no skip. This prevents the sweep from wasting time on containers that are clearly down while still checking healthy ones every 30s.

### R6.4: Scale Consideration

At 1000 active sandboxes with 30s intervals, the sweep makes ~33 health checks per second. Each is a single HTTP GET with a 3s timeout. This is well within capacity for a single API server. If needed, the sweep can be staggered (check N sessions per tick instead of all at once).

---

## R7: Zombie / Orphan GC

### R7.1: GC Loop

A background interval (every 5 minutes) that reconciles actual provider state against the DB:

**Railway:**
```
gcSweep():
  // 1. Find Railway services not in DB
  // Note: Railway has no global "list services by name" API. Query via project:
  //   query { project(id: "...") { services { edges { node { id name } } } } }
  // Then filter by name prefix 'sandbox-' client-side.
  railwayServices = Railway API: query project services, filter name.startsWith('sandbox-')
  dbServiceIds = SELECT railwayServiceId FROM sandbox_sessions WHERE status IN ('creating','ready')
  orphans = railwayServices.filter(s => !dbServiceIds.includes(s.id))
  for each orphan:
    log.warn('Orphaned Railway service found', { serviceId })
    Railway API: delete service
    Railway API: delete associated volume (if any)

  // 2. Find DB sessions stuck in transitional states
  stuckCreating = SELECT * FROM sandbox_sessions
    WHERE status = 'creating' AND createdAt < now() - interval '10 minutes'
  for each stuck:
    log.warn('Session stuck in creating', { projectId })
    UPDATE status = 'suspended'

  stuckSuspending = SELECT * FROM sandbox_sessions
    WHERE status = 'suspending' AND lastActivityAt < now() - interval '5 minutes'
  for each stuck:
    log.warn('Session stuck in suspending', { projectId })
    try: provider.destroy(stuck)
    UPDATE status = 'suspended'
```

**Docker:**
```
gcSweep():
  // 1. Find Docker containers not in DB
  containers = docker ps --filter label=viona.sandbox=true
  dbProjectIds = SELECT projectId FROM sandbox_sessions WHERE status IN ('creating','ready')
  orphans = containers.filter(c => !dbProjectIds.includes(c.labels['viona.projectId']))
  for each orphan:
    log.warn('Orphaned Docker container found', { containerId })
    docker rm -f containerId

  // 2. Same stuck-state cleanup as Railway
```

### R7.2: Railway Volume Cleanup

Railway volumes persist independently of services. The GC also checks for orphaned volumes:
```
// Query volumes via project-scoped API (same approach as services):
//   query { project(id: "...") { volumes { edges { node { id name } } } } }
volumes = Railway API: query project volumes, filter name.startsWith('workspace-')
dbVolumeIds = SELECT railwayVolumeId FROM sandbox_sessions WHERE railwayVolumeId IS NOT NULL
orphans = volumes.filter(v => !dbVolumeIds.includes(v.id))
// Delete orphans older than 1 hour (grace period for in-progress creates)
```

### R7.3: Backup Retention

Railway volume backups accumulate. The GC trims old backups:
- Keep only the most recent backup per project
- Delete backups for projects that no longer exist in DB
- Delete backups older than 30 days

---

## R8: Graceful API Shutdown

### R8.1: Shutdown Sequence

On SIGTERM/SIGINT of the API process:

1. Set `manager.shuttingDown = true` — new `acquire()` calls return 503
2. Stop health and GC loops
3. For each active `ready` session (in parallel, max 10 concurrent):
   a. Attempt durable checkpoint (S3)
   b. Attempt `provider.backup()`
   c. Mark DB as `suspended` with backupId
4. Total timeout: 30 seconds. After timeout, exit regardless.
5. Log summary: `"Shutdown complete: {n} sandboxes backed up, {m} failed"`

### R8.2: Railway Specifics

On Railway, the API process gets SIGTERM during deploys. The containers (sandbox services) continue running independently — they're separate Railway services. The backup ensures we can reconnect to them (or restore from backup) after the new API version boots.

### R8.3: Rehydration on Boot

The existing `rehydrateActiveSandboxes()` function already handles API restarts. It health-checks all `ready` sessions and cleans up interrupted transitions. The manager calls this during `startMonitoring()`.

---

## R9: Docker Provider Hardening

### R9.1: dockerode

Replace `execFile('docker', [...])` with the `dockerode` library:

```typescript
import Docker from 'dockerode';
const docker = new Docker();

// Create container
const container = await docker.createContainer({
  name: `sandbox-${projectId}`,
  Image: config.sandbox.image,
  Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
  Labels: {
    'viona.sandbox': 'true',
    'viona.projectId': projectId,
    'viona.createdAt': String(Date.now()),
  },
  HostConfig: {
    Init: true,           // tini for signal forwarding
    Memory: 4 * 1024 ** 3,  // 4GB
    MemorySwap: 4 * 1024 ** 3,  // no swap
    NanoCpus: 2e9,        // 2 CPUs
    PidsLimit: 512,
    Binds: [`${workspacePath}:/workspace`],
    PortBindings: {
      '8080/tcp': [{ HostPort: '0' }],  // dynamic port
      '8081/tcp': [{ HostPort: '0' }],  // dynamic port
    },
  },
  ExposedPorts: { '8080/tcp': {}, '8081/tcp': {} },
});

await container.start();

// Read dynamic ports
const info = await container.inspect();
const filePort = info.NetworkSettings.Ports['8080/tcp'][0].HostPort;
const agentPort = info.NetworkSettings.Ports['8081/tcp'][0].HostPort;
```

### R9.2: Benefits

- Structured error handling (no stderr parsing)
- TypeScript types for all Docker API responses
- Dynamic port allocation (no more fixed 18080/18081)
- Container labels for GC
- Resource limits as first-class config
- `Init: true` for proper signal forwarding

### R9.3: HEALTHCHECK in Dockerfile

Add to the sandbox Dockerfile:

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
```

The `--start-period=60s` gives the sandbox time to install deps and compile the Remotion bundle before health checks count against it.

---

## R10: Init Failure Handling

### R10.1: Current Problem

The `/init` POST to the sandbox may fail, but `routes.ts` returns 200 to the frontend regardless. The client thinks the sandbox is ready.

### R10.2: Fix

In `acquire()`, after calling the init endpoint:

```typescript
const initResponse = await fetch(`${sandbox.agentUrl}/init`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${sandbox.secret}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(initData),
});

if (!initResponse.ok) {
  const error = await initResponse.text();
  // Clean up the container we just created
  await provider.destroy(sandbox);
  throw new Error(`Workspace initialization failed: ${error}`);
}
```

The route handler catches this and returns 500 to the frontend with a clear error message.

### R10.3: Sandbox-Side

The `/init` endpoint in `agent-server.ts` already returns errors on failure. The issue is on the API side where the error is swallowed. No sandbox-side changes needed beyond the atomic staging pattern (R4).

---

## File Changes Summary

### New Files
- `packages/api/src/sandbox/manager.ts` — SandboxManager class (~400-500 lines, includes lifecycle, health loop, GC loop, debouncedSync)

### Modified Files
- `packages/api/src/sandbox/routes.ts` — Shrink from ~800 to ~300 lines, delegate to manager. Proxy routes (bundle, public, manifest, ops, prompt) remain as thin handlers. The `debouncedSync` mechanism (currently inline in routes.ts) moves into the manager.
- `packages/api/src/sandbox/docker.ts` — Rewrite with dockerode, dynamic ports, resource limits, labels. Use dynamic `import('dockerode')` (same pattern as `railway.ts` in `getProvider()`) so the module is never loaded on Railway where it's not installed.
- `packages/api/src/sandbox/provider.ts` — Add optional `listContainers?()` method for GC
- `packages/api/src/sandbox/health.ts` — Add `suspendReason` to suspend callback signature
- `packages/api/src/db/schema.ts` — Add `suspendReason` column to sandboxSessions. Promote `agentUrl` from `metadata` JSONB to a first-class column (currently accessed via `(session.metadata as any)?.agentUrl` casts in 6+ places in routes.ts). Remove unused `sandboxPort` column.
- `packages/sandbox/Dockerfile` — Add HEALTHCHECK instruction
- `packages/sandbox/src/workspace-init.ts` — Staging directory pattern for atomic init, symlink re-creation after promotion
- `packages/sandbox/src/manifest-checkpoint.ts` — No change (S3 upload handled API-side)

### New Dependencies
- `dockerode` + `@types/dockerode` — Docker API client (API package only, dynamically imported so it's never loaded on Railway)

### Unchanged Files
- `packages/api/src/sandbox/railway.ts` — Already solid, no changes needed
- `packages/api/src/sandbox/proxy.ts` — Already simplified by progress system
- `packages/api/src/sandbox/mutex.ts` — Moved into manager but logic unchanged
- `packages/api/src/sandbox/sync.ts` — Unchanged
- `packages/sandbox/src/agent-server.ts` — Already updated by progress system
- `packages/sandbox/src/orchestrator.ts` — Already updated by progress system
- `packages/sandbox/src/entry.ts` — Minor: SIGTERM handler extended for drain
- `packages/sandbox/src/file-server.ts` — Unchanged
- `packages/sandbox/entrypoint.sh` — Unchanged

---

## Non-Goals

- **Kubernetes migration** — Railway handles orchestration in prod; Docker is sufficient for dev
- **Multi-node API** — Single API server is sufficient for 1000s of users since sandboxes are independent services
- **Custom seccomp profiles** — Railway handles container security; Docker dev doesn't need it
- **Read-only filesystem** — The sandbox workspace is inherently writable; applying --read-only would require extensive tmpfs configuration for no practical benefit in this context
- **WebSocket health probes** — HTTP health checks are sufficient

---

## Testing Strategy

1. **Unit tests** for SandboxManager: mock provider, verify acquire/suspend sequences, concurrent limit enforcement, recovery hierarchy
2. **Integration tests** (Docker): spin real containers, verify dynamic ports, resource limits, health check cycle, GC cleanup
3. **Manual Railway test**: deploy, verify health monitoring catches a killed service, verify backup/restore cycle
4. **Load test**: simulate 100 concurrent `acquire()` calls to verify atomic limits hold

---

## Migration Plan

1. Add `dockerode` dependency
2. Create `manager.ts` with full lifecycle logic
3. Rewrite `docker.ts` to use dockerode
4. Update `routes.ts` to delegate to manager (one route at a time, behind feature flag if needed)
5. Add HEALTHCHECK to Dockerfile
6. Add atomic init to workspace-init.ts
7. Add durable checkpoints to checkpoint endpoint
8. Enable health loop and GC loop
9. Add graceful shutdown handler
10. Remove old inline logic from routes.ts
