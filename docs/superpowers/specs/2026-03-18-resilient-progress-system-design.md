# Resilient Agent Progress System — Design Spec

**Date:** 2026-03-18
**Status:** Draft — awaiting user review
**Scope:** Sandbox orchestrator lifecycle, multi-agent progress tracking, state resilience across disconnects/refreshes

---

## Problem Statement

The orchestrator's lifecycle is tied to the SSE connection chain (frontend → API proxy → sandbox). When any link breaks (page refresh, tab switch, network blip), the sandbox agent-server aborts the orchestrator via `abortController.abort()`. The running agent literally stops working.

Additionally, progress tracking uses a single `progress` + `activity` value that gets overwritten. When multiple agents work in parallel (3 Animators + Editor + Reviewer), only the last event is visible.

---

## Design Principles

- The sandbox orchestrator runs as an independent job. No client connection controls its lifecycle.
- State flows: Sandbox → API (via HTTP callback) → Redis → Any client.
- The frontend SSE stream is a real-time optimization, not the source of truth.
- Progress is a collection of concurrent tasks, not a single value.
- The system is designed so future clients (Slack, WhatsApp) can plug in by reading from the same API — no rearchitecting needed.

---

## Requirements

### R1: Orchestrator Lifecycle Independence

- [ ] **R1.1** When the SSE client disconnects (page refresh, tab close, network error), the orchestrator continues running to completion.
- [ ] **R1.2** The only way to stop a running orchestrator is an explicit `POST /cancel` request.
- [ ] **R1.3** `res.on('close')` in agent-server sets `connectionAlive = false` (stops writing to the closed socket) but does NOT call `abortController.abort()`.
- [ ] **R1.4** `res.on('error')` (EPIPE etc.) sets `connectionAlive = false` but does NOT abort.
- [ ] **R1.5** The orchestrator's AbortController is only triggered by `/cancel` endpoint.
- [ ] **R1.6** If a new `/prompt` arrives while the orchestrator is busy, respond with `409 Conflict` and `{ error: 'Agent is already busy', busy: true }`.

### R2: Sandbox State Tracking

- [ ] **R2.1** The agent-server maintains an in-memory `currentJob` object with: `{ isBusy, startedAt, activeTasks[], plan, result, error, textBuffer }`.
- [ ] **R2.2** `activeTasks` is an array of concurrent task objects: `{ id, agent, action, target, startedAt, status }`.
- [ ] **R2.3** When the orchestrator dispatches a subagent (Agent tool_use), a new task is added to `activeTasks` with `status: 'active'`.
- [ ] **R2.4** When a subagent completes (tool_result for Agent), the corresponding task is set to `status: 'completed'` and removed after 3 seconds (allows frontend fade-out).
- [ ] **R2.5** When an MCP tool is called, the active task for that agent updates its `action` field (e.g., "Writing scene-3.tsx", "Trimming transcript").
- [ ] **R2.6** When the orchestrator's first text chunk arrives, a task `{ agent: 'Viona', action: 'Responding...' }` is added.
- [ ] **R2.7** On orchestrator completion (`onDone`), all tasks are cleared, `isBusy` is set to `false`, `result` is stored.
- [ ] **R2.8** On orchestrator error (`onError`), `error` is stored. `isBusy` stays `true` only if the error is recoverable (orchestrator still running); otherwise `false`.

### R3: Sandbox → API State Push (HTTP Callbacks)

- [ ] **R3.1** On every meaningful state change (task started/updated/completed, plan updated, text chunk, done, error), the sandbox POSTs to `API_CALLBACK_URL/internal/sandbox/{SANDBOX_ID}/agent-state`.
- [ ] **R3.2** The callback payload is: `{ type: 'task_started'|'task_updated'|'task_completed'|'plan'|'text'|'done'|'error', data: {...}, timestamp: number }`.
- [ ] **R3.3** Callbacks are fire-and-forget: errors are logged but never block the orchestrator.
- [ ] **R3.4** Callbacks are debounced per-type: text chunks batch at 500ms, task updates at 200ms, done/error are immediate.
- [ ] **R3.5** The API callback endpoint writes state to Redis with keys: `sandbox:tasks:{projectId}` (JSON array of active tasks), `sandbox:plan:{projectId}`, `sandbox:busy:{projectId}` (boolean + startedAt).
- [ ] **R3.6** Redis keys use a 30-minute TTL. The sandbox refreshes the TTL on every callback.
- [ ] **R3.7** On `done` or `error` (terminal), Redis keys `sandbox:tasks` and `sandbox:busy` are deleted. `sandbox:plan` is preserved.

### R4: Sandbox `/status` Endpoint

- [ ] **R4.1** `GET /status` returns: `{ bundleVersion, busy, activeTasks[], plan, startedAt, result, error }`.
- [ ] **R4.2** This is the ground truth. If Redis and `/status` disagree, `/status` wins.
- [ ] **R4.3** The API queries `/status` when the frontend requests progress and no Redis data exists (fallback).

### R5: SSE Stream as Optimization

- [ ] **R5.1** When an SSE client is connected, events stream in real-time as today (text, widget, progress, activity, done, error, heartbeat).
- [ ] **R5.2** SSE events now include `activeTasks[]` instead of a single `progress`/`activity`. New event types: `task_started`, `task_updated`, `task_completed`.
- [ ] **R5.3** Heartbeat (every 15s) includes `{ activeTasks, busy }` snapshot so reconnecting clients can sync.
- [ ] **R5.4** The `progress` and `activity` SSE event types are deprecated but still emitted for backward compatibility during migration. They reflect the most recent task.

### R6: API Proxy Changes

- [ ] **R6.1** The proxy `proxyPromptWithIntercept` no longer writes to Redis directly. Redis is populated by the sandbox HTTP callbacks (R3).
- [ ] **R6.2** The proxy's `finally` block does NOT clear Redis keys (the sandbox owns this via `done`/`error` callbacks).
- [ ] **R6.3** The proxy still forwards SSE events to the frontend as a passthrough.
- [ ] **R6.4** If the proxy SSE connection to the sandbox breaks, it sends a `{ recoverable: true }` error to the frontend. The sandbox continues running.

### R7: API Status Endpoints

- [ ] **R7.1** `GET /projects/:id/sandbox/status` returns `{ status, previewUrl, busy, activeTasks[], plan }` from Redis.
- [ ] **R7.2** `GET /projects/:id/agent/conversation` returns `{ messages, conversationId, activeTasks[], plan }` — `activeTasks` replaces `sandboxProgress`/`sandboxActivity`.
- [ ] **R7.3** If Redis has no data but sandbox is `status: 'ready'`, the API queries the sandbox `/status` endpoint as fallback and caches the result.

### R8: Frontend — Always-Mounted Panel

- [ ] **R8.1** `AIAssistantPanel` is always mounted in the DOM (not conditionally rendered). It is visually hidden via `width: 0` + `overflow: hidden` when another sidebar tab is active.
- [ ] **R8.2** The SSE connection, message state, and progress state survive sidebar tab switches.
- [ ] **R8.3** The icon rail shows an activity dot on the Chat tab when `activeTasks.length > 0` and the chat panel is not visible.

### R9: Frontend — Multi-Task Progress Display

- [ ] **R9.1** Replace the single `ProgressIndicator` with a `TaskList` component that renders all `activeTasks`.
- [ ] **R9.2** Each task row shows: agent badge (icon + color from AGENT_STYLES), action text, target (if set), elapsed timer.
- [ ] **R9.3** Agent styles: Viona (pink ✦), Editor (blue ✂), Planner (purple ◈), Animator (green ◆), Reviewer (yellow ◉), Renderer (orange ▶).
- [ ] **R9.4** Completed tasks fade out over 2 seconds (opacity transition).
- [ ] **R9.5** When `activeTasks` is empty and `busy` is true, show a single "Viona: Working..." fallback.
- [ ] **R9.6** When `busy` is false, the task list is hidden entirely.

### R10: Frontend — State Restore on Refresh

- [ ] **R10.1** On mount, `AIAssistantPanel` calls `api.getConversation(projectId)`.
- [ ] **R10.2** If `activeTasks.length > 0`, render the task list and set `isStreaming = true`.
- [ ] **R10.3** If `busy: true` but `activeTasks` is empty, show "Viona: Working..." fallback.
- [ ] **R10.4** Optionally reconnect to the live SSE stream for real-time updates (via a new proxy endpoint that tails the sandbox SSE).

### R11: Frontend — Recovery Simplification

- [ ] **R11.1** Remove the complex 5-minute recovery polling loop.
- [ ] **R11.2** Replace with: on SSE disconnect, poll `api.getSandboxStatus()` every 5 seconds. If `busy: true`, update task list from response. If `busy: false`, reload messages from API.
- [ ] **R11.3** Max poll duration: 30 minutes (matches Redis TTL). After that, show "Connection lost" error.

### R12: Orchestrator — Skip Duplicate History on Resume

- [ ] **R12.1** When `resume: sessionId` is used, do NOT inject `<conversation_history>` into the prompt. The SDK already loads the full conversation from the persisted session.
- [ ] **R12.2** `<conversation_history>` is only injected for fresh sessions (no `sessionId`).

---

## Non-Requirements (Explicitly Out of Scope)

- **Steering queue / mid-run message injection**: Users steer by watching the live preview and sending the next message after the run completes. No mid-run message queue.
- **WhatsApp/Slack integration**: Future phase. The API is designed so these clients can read `activeTasks` from the same endpoints.
- **Sandbox suspend/resume during active work**: Sandbox is only destroyed when idle. Active orchestrator runs are not interrupted by infrastructure.
- **Event replay on reconnect**: Not in this phase. Reconnecting clients get current state from Redis, not a replay of past events.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ SANDBOX                                                      │
│                                                              │
│  Orchestrator ──► In-memory currentJob (activeTasks[])       │
│       │                     │                                │
│       │ SSE (if connected)  │ HTTP callback (always)         │
│       ▼                     ▼                                │
│  /prompt response    POST /internal/sandbox/{id}/agent-state │
└───────┬─────────────────────┬────────────────────────────────┘
        │                     │
        ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│ API                                                          │
│                                                              │
│  Proxy (SSE passthrough)    Callback handler → Redis         │
│       │                          │                           │
│       │                     ┌────┴────┐                      │
│       │                     │  Redis  │                      │
│       │                     │ tasks[] │                      │
│       │                     │ plan    │                      │
│       │                     │ busy    │                      │
│       │                     └────┬────┘                      │
│       │                          │                           │
│       ▼                          ▼                           │
│  GET /sandbox/status    GET /agent/conversation               │
└───────┬──────────────────────────┬───────────────────────────┘
        │                          │
        ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│ CLIENTS                                                      │
│                                                              │
│  Frontend (SSE live + poll fallback)                         │
│  Future: Slack bot, WhatsApp bot (poll API)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Migration Path

1. **Phase 1**: Sandbox changes (R1, R2, R3, R4, R12) — orchestrator independence + state tracking + callbacks
2. **Phase 2**: API changes (R6, R7) — callback endpoint + updated status responses
3. **Phase 3**: Frontend changes (R8, R9, R10, R11) — always-mounted panel + multi-task display + simplified recovery
4. **Phase 4**: Deprecate old `progress`/`activity` single-value events (R5.4)

Each phase is independently deployable and backward-compatible with the previous state.
