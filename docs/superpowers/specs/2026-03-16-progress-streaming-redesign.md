# Progress & Streaming UX Redesign

**Date:** 2026-03-16
**Status:** Approved
**Issues:** [progress-streaming-issues.md](../issues/2026-03-16-progress-streaming-issues.md)

---

## Problem

The AI assistant chat feels dead during long-running operations. When the orchestrator dispatches subagents (Planner, Editor, Animator, Reviewer), the user sees nothing for minutes — no typing indicator, no progress, no status. Then everything arrives at once as a wall of text + widgets inside a single chat bubble. The progress system shows fake percentages that the LLM picks arbitrarily.

## Design

Five changes that work together to ensure the chat never feels stuck.

---

### 1. ActivityBar — Pinned Status Indicator

**Replaces:** `ActivityIndicator` + `ProgressBar` (two overlapping components)
**Location:** Pinned above the chat scroll area (same position as current `ActivityIndicator`)

```
┌─────────────────────────────────────────────────────────┐
│  ● (pulsing)  ◈ PLANNER  Analyzing transcript...   2m  │
└─────────────────────────────────────────────────────────┘
```

**Elements:**
- Pulsing dot (reuse existing orb animation from `ActivityIndicator`)
- Agent badge — color-coded pill: Editor (blue), Planner (purple), Animator (green), Reviewer (amber). Reuse `AGENT_STYLES` from current `ProgressBar`.
- Action text — human-readable description of what's happening
- Elapsed time — seconds/minutes since the current activity started. Honest metric, not a fake ETA.

**Behavior:**
- Appears when an `activity` or `progress` SSE event arrives with a non-null agent/action
- Disappears when the stream ends (`done` event) or an explicit clear (`activity` event with null agent)
- Updates in-place as new events arrive (agent changes, action text changes)
- Stateful heartbeats keep it alive — if the last heartbeat carried activity state, the bar stays visible

**Removed:**
- Numeric percentage display
- Progress bar fill
- Phase timeline dots (Trim → Plan → Cut → Animate → Review → Assemble)
- `useSmoothProgress` hook (auto-creep, interpolation)
- High-water mark logic in `use-progress.ts`
- ETA estimates
- Inline progress blocks in message content

---

### 2. Standalone Widgets in Chat

**Problem:** Widgets (scene plan, theme picker, etc.) render inside the assistant's message bubble, cramped and buried between text blocks.

**Change:** The message renderer splits widget blocks out of bubbles. Text before a widget → one bubble. Widget → standalone full-width block. Text after → separate bubble.

```
┌─ Viona (bubble) ──────────────────────┐
│ Planning your scenes...                │
└────────────────────────────────────────┘

┌─ Scene Plan (standalone, full-width) ──┐
│  6 scenes · 45s · you visible 76%      │
│  [Approve & Generate]    [Revise]      │
└────────────────────────────────────────┘

┌─ Viona (bubble) ──────────────────────┐
│ Ready when you are                     │
└────────────────────────────────────────┘
```

**Data model unchanged.** Widgets are still content blocks on the assistant message (`message.content[]`). Only the rendering logic changes — `AIAssistantPanel.tsx` groups consecutive text blocks into bubbles and renders widget blocks as standalone elements between them.

**Progress blocks removed from content.** The `ProgressBlock` type and all logic that adds/updates progress blocks in `message.content` is removed. The ActivityBar handles all progress display.

---

### 3. Orchestrator Prompt — Intent Signals

**Problem:** The prompt says "Output ZERO text before tool calls" which prevents the LLM from signaling intent before multi-minute subagent dispatches.

**Change the `STREAMING BEHAVIOR` section:**

Before:
> - Output ZERO text before tool calls. Call tools silently.
> - Use thinking for ALL reasoning. The user should only see your final, clean response AFTER all tools complete.

After:
> - Output ZERO text before short tool calls (file reads, manifest ops, renders). Call these silently.
> - Before dispatching a subagent (Agent tool), output ONE short sentence telling the user what's about to happen. Example: "Trimming the transcript..." or "Planning your scenes..."
> - After the subagent returns and you've processed the result, output your response text.
> - NEVER narrate individual tool calls by name. Say what you're doing, not how.

**Add inline progress instructions to Phases 2, 3, 4** telling the orchestrator to call `report_progress` before each subagent dispatch. Phases 5/6/7 already have these.

**Update `report_progress` tool usage guidance:**
- `percent` field becomes optional (ignored by frontend)
- `phase` and `message` are the important fields
- `agentName` is required for all calls

---

### 4. Programmatic Activity Events

**Problem:** Activity status depends on the LLM calling `report_progress`. This is unreliable — if the LLM forgets, the user sees nothing.

**Change:** The orchestrator code itself detects subagent lifecycle events from the SDK stream and emits `activity` SSE events programmatically.

#### SDK event detection in `orchestrator.ts`

The SDK streams events including tool use start/stop. In `processStream()`, detect when an `Agent` tool is invoked (subagent dispatch) and when it completes:

**Validated:** The SDK streams `SDKPartialAssistantMessage` with `event: BetaRawMessageStreamEvent`. This includes `content_block_start` events with `type: 'tool_use'` when tools are called. Each event also carries `parent_tool_use_id` which identifies which subagent the event belongs to.

Detection logic in `processStream()`:

```typescript
if (evt?.type === 'content_block_start') {
  const block = (evt as any).content_block;
  if (block?.type === 'tool_use' && block.name === 'Agent') {
    // Subagent dispatch detected — extract agent name from input as it streams
    callbacks.onActivity({ agent: block.name, action: 'Working...', startedAt: Date.now() });
  }
}
// Agent name comes from input_json_delta — accumulate the tool input to extract
// the agent name (e.g. "planner", "editor") and update the activity action text.

if (evt?.type === 'content_block_stop' && currentAgentToolUseActive) {
  // Subagent returned
  callbacks.onActivity({ agent: null, action: null });
}
```

The `parent_tool_use_id` field on `SDKPartialAssistantMessage` is `null` for orchestrator-level events and set for subagent events. This allows distinguishing orchestrator text from subagent internals.

#### New callback: `onActivity`

Add to `OrchestratorCallbacks`:
```typescript
onActivity: (activity: {
  agent: string | null;
  action: string | null;
  phase?: string;
  startedAt?: number;
}) => void;
```

#### SSE event flow

```
orchestrator.ts  →  agent-server.ts  →  proxy.ts  →  frontend
  onActivity()      sendSSE('activity')   forward      ActivityBar updates
```

#### Dual source priority

The ActivityBar accepts events from two sources:
1. `activity` SSE events — programmatic, always emitted, reliable backbone
2. `progress` SSE events — LLM-driven via `report_progress`, richer action text when available

Priority per field:

| Field | `activity` (programmatic) | `progress` (LLM) | Winner |
|-------|---------------------------|-------------------|--------|
| Agent name/badge | Always set on dispatch | Optional | `activity` always wins — it's deterministic |
| Action text | Generic ("Working...") | Rich ("Analyzing transcript...") | `progress` wins when present, falls back to `activity` |
| Phase | Set from agent name mapping | Set by LLM | `activity` wins — derived from known pipeline state |
| Elapsed time | Computed from `startedAt` | N/A | Always from `activity` |

---

### 5. Communication Reliability

**Problem:** The SSE stream is a single fragile channel. During subagent execution only empty heartbeats flow. Page refresh loses all state.

#### A) Stateful heartbeats

Change `agent-server.ts` heartbeat from:
```typescript
const heartbeat = setInterval(() => sendSSE('heartbeat', {}), 15000);
```

To:
```typescript
let currentActivity: ActivityState | null = null;

const heartbeat = setInterval(() => {
  sendSSE('heartbeat', { activity: currentActivity });
}, 15000);
```

Every 15 seconds the frontend gets a full activity snapshot. If a prior `activity` event was missed due to a network blip, the next heartbeat recovers it. The ActivityBar can render from heartbeat data alone.

#### B) Redis-backed activity state

When the API proxy (`proxy.ts`) forwards an `activity` event, it also persists to Redis:
```typescript
case 'activity':
  writeSSE('activity', data);
  if (projectId) {
    redis.set(`sandbox:activity:${projectId}`, JSON.stringify(data), 'EX', 1800).catch(() => {});
  }
  break;
```

Same pattern already used for `sandbox:progress` on line 290 of `proxy.ts`.

#### C) Restore on page load

The GET `/conversation` endpoint (`agent-router.ts`) already returns `sandboxProgress`. Add `sandboxActivity`:
```typescript
let sandboxActivity = null;
try {
  const cached = await redis.get(`sandbox:activity:${projectId}`);
  if (cached) sandboxActivity = JSON.parse(cached);
} catch {}

return reply.send({ ...data, activeJob: jobPayload, sandboxProgress, sandboxActivity });
```

Frontend reads `sandboxActivity` on conversation load and initializes the ActivityBar.

#### D) Event buffer for replay

The `createSSEWriter` event buffer in `agent-router.ts` already buffers events for `Last-Event-ID` replay. Ensure `activity` events are included in the buffer (they pass through `writeSSE` which writes to the buffer by default — no change needed).

#### E) Stall detection

Current stall detection resets on any meaningful SSE event. Update: stateful heartbeats count as meaningful (they carry activity state). Only trigger a stall warning when heartbeats themselves stop arriving — that means the connection is truly dead.

---

### 6. Edge Cases

#### Cancellation cleanup

When the user cancels mid-pipeline or the stream ends (`done`/`error`):
- Clear Redis: `redis.del(`sandbox:activity:${projectId}`)` alongside the existing `sandbox:progress` cleanup
- The `done` handler in `proxy.ts` already clears `sandbox:progress` (line 277). Add `sandbox:activity` to the same path.
- The `error` handler must also clear activity state. Otherwise a stale ActivityBar persists after errors.
- On the frontend, the `done` and `error` SSE event handlers clear the ActivityBar state.

#### Error display

With `ProgressBlock` removed from message content, generation errors need a new display path:
- The `error` SSE event handler in `AIAssistantPanel.tsx` currently marks progress blocks as errored. Change: append a text block with the error message styled as an error (red text, error icon). This is simpler and more natural in a chat UI.
- The ActivityBar shows error state briefly (red pulsing dot + error text) then disappears.

#### Historical ProgressBlock data

Messages already in the DB with `{ type: 'progress', ... }` blocks:
- The renderer filters them out — `type === 'progress'` blocks are skipped during rendering.
- No migration needed. They're inert data that doesn't display.

#### Typing indicator for non-subagent turns

The bouncing dots bug (Issue 1, root cause A) — dots vanish when `content.length > 0`:
- Fix: show a pulsing dot at the end of the last text block while `isStreaming` is true AND no new text has arrived in the last 500ms. This handles both empty-message and mid-stream pauses.
- This is separate from the ActivityBar — the ActivityBar shows agent activity, the typing indicator shows that text is still being generated.

#### Rapid agent changes during Phases 5-6

When Animators and Reviewers interleave, the ActivityBar badge could flip rapidly. Apply a 2-second debounce: don't switch the displayed agent if the current one has been active for less than 2 seconds, unless the new event is an explicit clear (null agent).

#### `onProgress` in agent-router.ts

The `onProgress` intercept callback in `agent-router.ts` (lines 347-356) currently writes progress blocks into `contentBlocks[]` for DB persistence. Change: stop writing progress into content blocks. The `onProgress` callback becomes a no-op for content persistence — progress is only persisted via Redis activity state.

#### Legacy `ActivityEvent` vs new `ActivityState`

`progress-types.ts` has an existing `ActivityEvent` type (log entry array) used by the legacy worker pipeline. Keep it alongside the new `ActivityState` (current-state singleton). `use-progress.ts` keeps both: `activity: ActivityEvent[]` for legacy, `activityState: ActivityState | null` for the new system.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/.../ActivityIndicator.tsx` | Rewrite → `ActivityBar.tsx` |
| `apps/web/.../ProgressBar.tsx` | Delete |
| `apps/web/.../hooks/use-smooth-progress.ts` | Delete |
| `apps/web/.../hooks/use-progress.ts` | Simplify — track `ActivityState`, drop percent/high-water/smoothing. Keep legacy `ActivityEvent[]` for worker jobs. |
| `apps/web/.../AIAssistantPanel.tsx` | Split widget rendering out of bubbles, remove progress blocks from content, wire ActivityBar, restore activity on load, fix typing indicator, error display as text blocks |
| `packages/sandbox/src/orchestrator.ts` | Detect subagent start/stop via `content_block_start`/`content_block_stop` events, add `onActivity` callback |
| `packages/sandbox/src/agent-server.ts` | Wire `onActivity`, stateful heartbeats with current activity snapshot |
| `packages/api/src/sandbox/proxy.ts` | Forward `activity` events, persist to Redis, clear on `done`/`error`, add `onActivity` to `InterceptCallbacks` |
| `packages/api/src/agent/agent-router.ts` | Return `sandboxActivity` from GET /conversation, remove progress block writes from `onProgress` callback |
| `packages/sandbox/src/prompts/orchestrator-system.md` | Streaming behavior (allow intent text before subagent dispatch), inline progress instructions for Phases 2/3/4, remove percent checkpoint table |
| `packages/sandbox/src/mcp-servers.ts` | `percent` optional in `report_progress` schema |
| `packages/shared/src/progress-types.ts` | Add `ActivityState` type, keep `ProgressState` and `ActivityEvent` for backward compat |

## Not Changed

- `report_progress` MCP tool — kept for richer LLM-driven status text. Percent field becomes optional.
- `use-job-websocket.ts` — BullMQ job progress for legacy worker jobs stays as-is.
- Scene plan widget content/logic (`ScenePlanCard.tsx`) — only its rendering wrapper changes.
- Conversation data model — widgets stay in `message.content[]`. Only rendering splits them out.
