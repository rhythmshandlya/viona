# Sandbox Reliability & Robustness — Design Spec

**Date:** 2026-03-18
**Status:** Draft — awaiting user review
**Scope:** Container lifecycle, data durability, init robustness, resource safety, graceful shutdown
**Related:** `2026-03-18-resilient-progress-system-design.md` (progress tracking — separate spec, separate implementation)

---

## Problem Statement

The sandbox container infrastructure has 10 critical reliability issues that can cause silent data loss, resource exhaustion, zombie containers, and broken user experiences. These are independent of the progress tracking system (covered in the sibling spec) but affect the same sandbox layer.

---

## Requirements

### R1: Lost Work on Stale Recovery

**Problem:** When a sandbox container dies but the DB still says `ready`, the recovery path tries to back up the Docker volume. If the volume is gone too, `backupId` stays `undefined` and the session falls through to a fresh init. User's work is silently lost.

- [ ] **R1.1** Before attempting volume backup during recovery, verify the volume exists (`docker volume inspect`). If it doesn't exist, mark the session as `failed` — not `initializing`.
- [ ] **R1.2** If backup fails or volume is missing, return an error to the frontend: `"Your workspace could not be recovered. Last checkpoint: {timestamp}"`. Never silently re-init.
- [ ] **R1.3** Periodic external backup: every checkpoint (60s interval), upload a tarball of `/workspace` to S3/MinIO under `backups/{projectId}/{timestamp}.tar.gz`. Keep last 3.
- [ ] **R1.4** Recovery priority order: (1) existing volume, (2) latest S3 backup, (3) error — never silent fresh init.
- [ ] **R1.5** Add `lastCheckpointAt` timestamp to the sandbox session DB row. Surface it in the API status response so the frontend can show "Last saved: 2 min ago".

### R2: Init Failure Returns 200

**Problem:** If `POST /init` to the agent server fails, the API still returns 200 to the frontend.

- [ ] **R2.1** After calling `POST /init` on the sandbox, check the response status. If non-2xx, set session status to `failed` and return the error to the frontend.
- [ ] **R2.2** Add a health-check poll after init: call `GET /health` up to 5 times (1s interval). Only mark `ready` when health returns `{ initialized: true }`.
- [ ] **R2.3** If init or health-check fails, return `{ status: 'failed', error: '...' }` to the frontend with the actual error message from the sandbox.

### R3: No Resource Limits on Containers

**Problem:** No `--memory`, `--cpus`, or `--pids-limit` flags. A runaway Remotion render or ffmpeg can OOM the host.

- [ ] **R3.1** Add resource limits to `docker run`: `--memory=4g --memory-swap=4g --cpus=2 --pids-limit=256`.
- [ ] **R3.2** Make limits configurable via environment variables: `SANDBOX_MEMORY_LIMIT`, `SANDBOX_CPU_LIMIT`, `SANDBOX_PID_LIMIT` with the above defaults.
- [ ] **R3.3** Add `--oom-kill-disable=false` (default) so the kernel kills the container on OOM rather than freezing it.
- [ ] **R3.4** On container OOM kill, the API detects this via `docker inspect` (exit code 137), marks the session as `crashed`, and triggers the recovery flow (R1).

### R4: No --init Flag

**Problem:** Without tini/dumb-init, Node.js runs as PID 1. SIGTERM is ignored by default. Signals don't propagate to child processes.

- [ ] **R4.1** Add `--init` flag to `docker run` command. This uses Docker's built-in tini as PID 1.
- [ ] **R4.2** Remove any manual signal handling that was working around the PID 1 problem (if any).
- [ ] **R4.3** Verify that SIGTERM propagates correctly to: the Node.js main process, esbuild watcher, MCP server child processes, and any spawned ffmpeg/remotion processes.

### R5: No Graceful Drain on SIGTERM

**Problem:** SIGTERM handler calls `checkpoint()` and exits immediately. Active prompts/renders are killed mid-stream.

- [ ] **R5.1** On SIGTERM, enter a drain phase: stop accepting new requests (respond 503 to new `/prompt` and `/render`), let the current orchestrator run complete (up to a configurable drain timeout, default 30s).
- [ ] **R5.2** After the drain timeout, force-abort the orchestrator if still running, checkpoint, then exit.
- [ ] **R5.3** During drain, push a `draining` state via the HTTP callback so the API knows the sandbox is shutting down.
- [ ] **R5.4** The API, on receiving `draining` state, marks the sandbox session as `draining` and stops routing new requests to it. Frontend shows "Sandbox is shutting down, please wait...".
- [ ] **R5.5** After the sandbox exits, the API triggers the backup flow (R1.3) and marks the session as `suspended`.

### R6: Checkpoint Not Durable

**Problem:** `/checkpoint` writes to the Docker volume only. If the container crashes, the checkpoint is lost.

- [ ] **R6.1** Checkpoint writes to the volume AND uploads to S3/MinIO (same as R1.3 — they share the backup mechanism).
- [ ] **R6.2** The manifest checkpoint (60s interval) is the primary backup trigger. Each checkpoint: write `manifest.json` to volume, then upload workspace tarball to S3.
- [ ] **R6.3** S3 upload runs in the background — never blocks the checkpoint response or the orchestrator.
- [ ] **R6.4** If S3 upload fails, log a warning and retry on the next checkpoint cycle. Don't fail the checkpoint itself.
- [ ] **R6.5** Track `lastExternalBackupAt` in the sandbox session. If this is >5 minutes stale, the API health-check should flag it.

### R7: Port Allocation

**Problem:** Fixed port mapping blocks running multiple sandboxes concurrently.

- [ ] **R7.1** Use dynamic port allocation: `docker run -p 0:8080 -p 0:8081` lets Docker assign random host ports.
- [ ] **R7.2** After container start, query assigned ports via `docker port {containerId}` and store them in the sandbox session DB row.
- [ ] **R7.3** The API uses the stored ports when proxying requests to the sandbox.
- [ ] **R7.4** Remove any hardcoded port references from the Docker provider code.
- [ ] **R7.5** For dev convenience, allow an optional `SANDBOX_PORT_OFFSET` env var that allocates ports sequentially (e.g., project 1 gets 18080/18081, project 2 gets 18082/18083).

### R8: Concurrent Limits Race Condition

**Problem:** `maxConcurrent` check counts active sandboxes then creates — but between count and creation, another request can slip through. The mutex is per-project only.

- [ ] **R8.1** Add a global mutex (not per-project) around the "count active + create" operation. Use a Redis `INCR`/`DECR` atomic counter: `sandbox:active_count`.
- [ ] **R8.2** `INCR` before container creation. If result > `maxConcurrent`, `DECR` and reject with 429.
- [ ] **R8.3** `DECR` on container stop/destroy/crash.
- [ ] **R8.4** Add a periodic reconciliation (every 60s): count actual running containers, reconcile with the Redis counter to fix drift from missed decrements.

### R9: Zombie Containers

**Problem:** No GC process. No labels. If the API crashes, orphaned containers run forever.

- [ ] **R9.1** Add Docker labels to all sandbox containers: `viona.sandbox=true`, `viona.project={projectId}`, `viona.created={timestamp}`.
- [ ] **R9.2** Add a GC process that runs every 5 minutes: list containers with `viona.sandbox=true`, cross-reference with active sandbox sessions in DB, kill any container without a matching active session.
- [ ] **R9.3** Add a max-age limit: containers older than 2 hours are killed regardless (configurable via `SANDBOX_MAX_AGE_MS`).
- [ ] **R9.4** On API startup, run the GC immediately to clean up orphans from a previous crash.
- [ ] **R9.5** GC logs every action: `{ containerId, projectId, reason: 'orphan'|'expired'|'stale' }`.

### R10: Workspace Init Not Atomic

**Problem:** If init fails mid-way (video downloaded but audio extraction fails), you get a partially initialized workspace with no rollback.

- [ ] **R10.1** Init writes to a temporary directory (`/workspace/.init-staging/`) first. Only after ALL steps succeed, atomically move contents to `/workspace/`.
- [ ] **R10.2** If any step fails, delete the staging directory and return the error. The workspace remains in its pre-init state (empty or previous state).
- [ ] **R10.3** Add an `initialized` marker file (`/workspace/.initialized`) that is written last. The `isInitialized()` check reads this file — guarantees the workspace is fully set up.
- [ ] **R10.4** If the container starts and finds a staging directory but no `.initialized` marker, clean up the staging directory (incomplete previous init).

---

## Implementation Priority

These should be implemented in this order based on risk:

1. **Critical (data loss / host safety):** R1 (lost work), R3 (resource limits), R4 (--init flag)
2. **High (operational reliability):** R5 (graceful drain), R6 (durable checkpoints), R9 (zombie GC)
3. **Medium (correctness):** R2 (init returns 200), R8 (race condition), R10 (atomic init)
4. **Low (scaling prep):** R7 (port allocation)

---

## Interaction with Progress Resilience Spec

These two specs are **independent but complementary:**

- **This spec** makes the sandbox container reliable: it starts correctly, doesn't lose data, shuts down gracefully, and cleans up after itself.
- **The progress spec** makes agent work visible: the orchestrator runs independently of clients, multiple agents show concurrent progress, state survives disconnects.

They can be implemented in parallel by separate agents. The only dependency: R5 (graceful drain) in this spec must coordinate with R1 (orchestrator lifecycle) in the progress spec — both affect how the orchestrator handles signals.

**Implementation order:** This spec first (R1, R3, R4 are critical safety fixes), then the progress spec.
