# Progress & Streaming UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI assistant chat never feel stuck — show activity status during subagent work, split widgets out of bubbles, and make communication reliable.

**Architecture:** Bottom-up: shared types → sandbox backend (orchestrator activity detection) → API proxy layer (forwarding + Redis persistence) → frontend (ActivityBar + widget rendering). Each layer is independently testable.

**Tech Stack:** TypeScript, React, Fastify, Redis, Claude Agent SDK, SSE

**Spec:** `docs/superpowers/specs/2026-03-16-progress-streaming-redesign.md`

---

## Chunk 1: Shared Types + Backend Activity Detection

### Task 1: Add ActivityState type to shared package

**Files:**
- Modify: `packages/shared/src/progress-types.ts`
- Modify: `packages/shared/src/types/index.ts` (if ActivityState needs re-export)

- [ ] **Step 1: Add ActivityState interface**

Add after the existing `ActivityEvent` interface (line 35) in `packages/shared/src/progress-types.ts`:

```typescript
/** Current activity state — singleton, not a log. Used by sandbox pipeline ActivityBar. */
export interface ActivityState {
  /** Which agent is currently active, or null if idle */
  agent: string | null;
  /** Human-readable description of current work, or null if idle */
  action: string | null;
  /** Pipeline phase: planning, trimming, editing, generating, reviewing, assembling */
  phase?: string;
  /** Timestamp when this activity started (epoch ms) */
  startedAt?: number;
}
```

- [ ] **Step 2: Verify the export is accessible**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/progress-types.ts
git commit -m "feat: add ActivityState type for sandbox pipeline progress"
```

---

### Task 2: Detect subagent lifecycle in orchestrator processStream

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:30-56` (OrchestratorCallbacks interface)
- Modify: `packages/sandbox/src/orchestrator.ts:271-292` (processStream function)

- [ ] **Step 1: Add onActivity to OrchestratorCallbacks**

In `packages/sandbox/src/orchestrator.ts`, add to the `OrchestratorCallbacks` interface (after `onError` at ~line 54):

```typescript
onActivity?: (activity: {
  agent: string | null;
  action: string | null;
  phase?: string;
  startedAt?: number;
}) => void;
```

**Note:** `onActivity` is optional (`?`) so existing callers don't break before Task 3 wires it up.

- [ ] **Step 2: Rewrite processStream to detect Agent tool use**

Replace the `processStream` function (lines 271-292) with:

```typescript
async function processStream(iter: AsyncIterable<SDKMessage>): Promise<void> {
  // Track active Agent tool calls for activity detection
  let agentToolUseIndex: number | null = null;
  let agentToolInput = '';

  for await (const message of iter) {
    if (abortController.signal.aborted) break;

    // Capture session ID from the first message that carries one
    if (!capturedSessionId && message.session_id) {
      capturedSessionId = message.session_id;
    }

    if (message.type === 'stream_event') {
      const partial = message as SDKPartialAssistantMessage;
      // Only process orchestrator-level events (not subagent internals)
      if (partial.parent_tool_use_id) continue;

      const evt = partial.event as Record<string, unknown>;

      if (evt?.type === 'content_block_start') {
        const block = (evt as any).content_block;
        if (block?.type === 'tool_use' && block.name === 'Agent') {
          agentToolUseIndex = (evt as any).index;
          agentToolInput = '';
          // Emit initial activity — agent name will be refined from input
          callbacks.onActivity?.({
            agent: 'Agent',
            action: 'Working...',
            startedAt: Date.now(),
          });
        }
      }

      if (evt?.type === 'content_block_delta') {
        const delta = (evt as any).delta as { type: string; text?: string; partial_json?: string };
        const index = (evt as any).index;

        if (delta.type === 'text_delta' && delta.text) {
          callbacks.onText(delta.text);
        }

        // Accumulate Agent tool input to extract agent name
        if (delta.type === 'input_json_delta' && delta.partial_json && index === agentToolUseIndex) {
          agentToolInput += delta.partial_json;
          // Try to extract agent name early from partial JSON
          const nameMatch = agentToolInput.match(/"(?:prompt|description)":\s*"[^"]*?(planner|editor|animator|reviewer)/i);
          if (nameMatch) {
            const agentName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
            const phaseMap: Record<string, string> = {
              Planner: 'planning', Editor: 'editing', Animator: 'generating', Reviewer: 'reviewing',
            };
            callbacks.onActivity?.({
              agent: agentName,
              action: `${agentName} is working...`,
              phase: phaseMap[agentName],
              startedAt: Date.now(),
            });
          }
        }
      }

      if (evt?.type === 'content_block_stop') {
        const index = (evt as any).index;
        if (index === agentToolUseIndex) {
          // Subagent finished
          agentToolUseIndex = null;
          agentToolInput = '';
          callbacks.onActivity?.({ agent: null, action: null });
        }
      }
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: no errors (`onActivity` is optional so existing callers without it still compile)

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat: detect subagent lifecycle events in orchestrator processStream"
```

---

### Task 3: Wire onActivity through agent-server with stateful heartbeats

**Files:**
- Modify: `packages/sandbox/src/agent-server.ts:78-133` (prompt endpoint)

- [ ] **Step 1: Add activity state tracking and wire onActivity**

In `packages/sandbox/src/agent-server.ts`, in the `/prompt` endpoint handler (starting ~line 79), add activity tracking and update the heartbeat. Replace the section from `let eventId = 0` through the `runOrchestrator` call:

```typescript
let eventId = 0;
const sendSSE = (event: string, data: unknown) => {
  eventId++;
  res.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

// Track current activity for stateful heartbeats
let currentActivity: { agent: string | null; action: string | null; phase?: string; startedAt?: number } | null = null;

// Heartbeat with activity snapshot
const heartbeat = setInterval(() => sendSSE('heartbeat', { activity: currentActivity }), 15000);
```

Then update the `runOrchestrator` callbacks to include `onActivity`:

```typescript
try {
  await runOrchestrator(body, {
    onText: (text) => sendSSE('text', { text }),
    onWidget: (widget) => sendSSE('widget', widget),
    onProgress: (progress) => sendSSE('progress', progress),
    onActivity: (activity) => {
      currentActivity = activity.agent ? activity : null;
      sendSSE('activity', activity);
    },
    onDone: async (result) => {
      currentActivity = null;
      sendSSE('done', result);
      await checkpoint();
    },
    onError: (error) => {
      currentActivity = null;
      sendSSE('error', { message: error });
    },
    signal: abortController.signal,
  }, mcpServers);
} catch (err) {
  currentActivity = null;
  sendSSE('error', { message: err instanceof Error ? err.message : 'Internal error' });
} finally {
  clearInterval(heartbeat);
  currentAbortController = null;
  res.end();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/agent-server.ts
git commit -m "feat: wire onActivity callback with stateful heartbeats in agent-server"
```

---

### Task 4: Forward activity events in API proxy + Redis persistence

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts:142-148` (InterceptCallbacks)
- Modify: `packages/api/src/sandbox/proxy.ts:248-307` (switch statement in proxyPromptWithIntercept)

- [ ] **Step 1: Add onActivity to InterceptCallbacks**

In `packages/api/src/sandbox/proxy.ts`, add to the `InterceptCallbacks` interface (~line 142):

```typescript
onActivity?: (activity: { agent: string | null; action: string | null; phase?: string; startedAt?: number }) => void;
```

- [ ] **Step 2: Add activity case to SSE switch + Redis persistence + cleanup on done/error**

In the switch statement inside `proxyPromptWithIntercept` (~line 248), add the `activity` case after the `progress` case:

```typescript
case 'activity': {
  writeSSE('activity', data);
  callbacks.onActivity?.(data);
  // Persist to Redis for refresh recovery (TTL: 30 minutes)
  if (projectId) {
    redis.set(`sandbox:activity:${projectId}`, JSON.stringify(data), 'EX', 1800).catch(() => {});
  }
  break;
}
```

Update the `done` case to also clear activity from Redis (after the existing `sandbox:progress` cleanup at ~line 277):

```typescript
if (projectId) {
  redis.del(`sandbox:progress:${projectId}`).catch(() => {});
  redis.del(`sandbox:activity:${projectId}`).catch(() => {});
}
```

Update the `error` case to clear activity too:

```typescript
case 'error':
  writeSSE('error', data);
  callbacks.onError?.(data.message ?? data.error ?? String(data));
  if (projectId) {
    redis.del(`sandbox:activity:${projectId}`).catch(() => {});
  }
  break;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/sandbox/proxy.ts
git commit -m "feat: forward activity SSE events with Redis persistence and cleanup"
```

---

### Task 5: Return sandboxActivity from GET /conversation + remove progress block writes

**Files:**
- Modify: `packages/api/src/agent/agent-router.ts:434-449` (GET /conversation response)
- Modify: `packages/api/src/agent/agent-router.ts:347-356` (onProgress callback)

- [ ] **Step 1: Add sandboxActivity to GET /conversation**

In `packages/api/src/agent/agent-router.ts`, in the GET `/conversation` handler, after the `sandboxProgress` fetch (~line 436), add:

```typescript
let sandboxActivity: Record<string, unknown> | null = null;
if (!activeJob) {
  try {
    const cachedActivity = await redis.get(`sandbox:activity:${projectId}`);
    if (cachedActivity) sandboxActivity = JSON.parse(cachedActivity);
  } catch { /* ignore */ }
}
```

Update the response to include it (~line 446 and 449):

```typescript
if (!data) {
  return reply.send({ conversationId: null, messages: [], activeJob: jobPayload, sandboxProgress: sandboxProgress ?? undefined, sandboxActivity: sandboxActivity ?? undefined });
}
return reply.send({ ...data, activeJob: jobPayload, sandboxProgress: sandboxProgress ?? undefined, sandboxActivity: sandboxActivity ?? undefined });
```

- [ ] **Step 2: Remove progress block writes from onProgress callback**

In the POST `/chat` handler, find the `onProgress` callback (~line 347). Replace:

```typescript
onProgress: (progress) => {
  flushText();
  if (progressBlockIdx >= 0) {
    contentBlocks[progressBlockIdx] = { type: 'progress', ...progress };
  } else {
    progressBlockIdx = contentBlocks.length;
    contentBlocks.push({ type: 'progress', ...progress });
  }
},
```

With:

```typescript
onProgress: () => {
  // Progress is now handled via ActivityBar + Redis, not stored in message content
},
```

Also remove the `let progressBlockIdx = -1;` variable (~line 292).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/agent/agent-router.ts
git commit -m "feat: serve sandboxActivity on conversation load, stop persisting progress blocks"
```

---

## Chunk 2: Orchestrator Prompt Changes

### Task 6: Update orchestrator prompt — streaming behavior + progress instructions

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md`

- [ ] **Step 1: Update STREAMING BEHAVIOR section**

Find the `STREAMING BEHAVIOR` section (~line 35) and replace these lines:

```
- Output ZERO text before tool calls. Call tools silently.
- If a tool returns an error, DO NOT tell the user. Adapt silently.
- NEVER mention internal details like plan IDs, job IDs, database records, tool names, or subagent dispatches.
- Use thinking for ALL reasoning. The user should only see your final, clean response AFTER all tools complete.
```

With:

```
- Output ZERO text before short tool calls (file reads, manifest ops, renders). Call these silently.
- Before dispatching a subagent (Agent tool), output ONE short sentence telling the user what's about to happen. Examples: "Trimming the transcript...", "Planning your scenes...", "Generating animations..."
- After the subagent returns and you've processed the result, output your response.
- NEVER narrate individual tool calls by name. Say what you're doing, not how.
- If a tool returns an error, DO NOT tell the user. Adapt silently.
- NEVER mention internal details like plan IDs, job IDs, database records, tool names, or subagent dispatches.
- Use thinking for ALL reasoning except for the one intent sentence before subagent dispatch.
```

- [ ] **Step 2: Add inline progress to Phase 2 (Trimming)**

Find `### Phase 2: Transcript Cleanup` and add before the first paragraph:

```
**Progress (before dispatch):** Call `mcp__widgets__report_progress` with `{ phase: "trimming", message: "Cleaning up transcript...", agentName: "Editor" }`.
```

Add after the "After trimming — Captions" paragraph:

```
**Progress (after captions):** Call `mcp__widgets__report_progress` with `{ phase: "trimming", message: "Transcript cleaned, captions added", agentName: "Editor" }`.
```

- [ ] **Step 3: Add inline progress to Phase 3 (Planning)**

Find `### Phase 3: Planning` and add before "Dispatch the **Planner**":

```
**Progress (before dispatch):** Call `mcp__widgets__report_progress` with `{ phase: "planning", message: "Planning scenes...", agentName: "Planner" }`.
```

Add before "**After the Planner returns:**":

```
**Progress (after Planner returns):** Call `mcp__widgets__report_progress` with `{ phase: "planning", message: "Validating scene plan...", agentName: "Planner" }`.
```

- [ ] **Step 4: Add inline progress to Phase 4 (Rough Cut)**

Find `### Phase 4: Editor Pass 1` and add before "Dispatch the **Editor**":

```
**Progress (before dispatch):** Call `mcp__widgets__report_progress` with `{ phase: "editing", message: "Building rough cut...", agentName: "Editor" }`.
```

Add before "**Incremental preview:**":

```
**Progress (after rough cut):** Call `mcp__widgets__report_progress` with `{ phase: "editing", message: "Rough cut ready", agentName: "Editor" }`.
```

- [ ] **Step 5: Replace percent checkpoint table with phase-only table**

Find the `## PROGRESS TRACKING` section and replace the entire checkpoint table and surrounding text. Replace:

```
Report progress after each major step using `mcp__widgets__report_progress`. Every progress event includes:
```

With:

```
**CRITICAL:** Call `mcp__widgets__report_progress` BEFORE every subagent dispatch and after every phase completion. The user sees nothing without these events.

Every progress event includes:
```

Replace the JSON example to remove percent:

```json
{
  "phase": "trimming" | "planning" | "editing" | "generating" | "reviewing" | "assembling" | "complete" | "error",
  "message": "Human-readable status",
  "agentName": "Editor" | "Planner" | "Animator" | "Reviewer",
  "trackName": "Timeline" | "Visuals" | "Captions" | null
}
```

Remove the entire "Progress checkpoints" table (the one with percent values). It is replaced by the inline **Progress** instructions in each phase.

- [ ] **Step 6: Make percent optional in report_progress tool schema**

In `packages/sandbox/src/mcp-servers.ts`, find the `report_progress` tool (~line 126) and change:

```typescript
percent: z.number().describe('Progress percentage 0-100'),
```

To:

```typescript
percent: z.number().optional().describe('Optional progress percentage (ignored by frontend)'),
```

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md packages/sandbox/src/mcp-servers.ts
git commit -m "feat: orchestrator prompt — intent signals before subagents, inline progress instructions"
```

---

## Chunk 3: Frontend — ActivityBar + Widget Rendering

### Task 7: Create ActivityBar component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ActivityBar.tsx`

- [ ] **Step 1: Write ActivityBar component**

Create `apps/web/src/features/editor-v2/components/ActivityBar.tsx`:

```tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ActivityBarProps {
  agent: string | null;
  action: string | null;
  startedAt: number | null;
  isStreaming: boolean;
  error?: string | null;
}

/** Agent display config — color accent per agent role */
const AGENT_STYLES: Record<string, { color: string; icon: string }> = {
  Editor:   { color: '#60a5fa', icon: '✂' },
  Planner:  { color: '#a78bfa', icon: '◈' },
  Animator: { color: '#34d399', icon: '◆' },
  Reviewer: { color: '#fbbf24', icon: '◉' },
};

const DEFAULT_AGENT_STYLE = { color: 'var(--editor-text-muted)', icon: '●' };

function formatElapsed(startedAt: number): string {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function ActivityBar({ agent, action, startedAt, isStreaming, error }: ActivityBarProps) {
  const [elapsed, setElapsed] = useState('');
  const [showError, setShowError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (startedAt && agent) {
      setElapsed(formatElapsed(startedAt));
      intervalRef.current = setInterval(() => {
        setElapsed(formatElapsed(startedAt));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt, agent]);

  // Show error state briefly (3s) then disappear
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
    setShowError(false);
  }, [error]);

  // Show if: active agent + streaming, OR error flash
  if (showError) {
    return (
      <div
        className="flex items-center gap-2.5 px-3 py-2 border-b"
        style={{ borderColor: '#ef4444', backgroundColor: 'var(--editor-bg-elevated)' }}
      >
        <div className="relative flex items-center justify-center" style={{ width: 16, height: 16 }}>
          <div className="absolute rounded-full" style={{ width: 8, height: 8, backgroundColor: '#ef4444', animation: 'activity-pulse 1.5s ease-in-out infinite' }} />
        </div>
        <span style={{ flex: 1, fontSize: 12, color: '#ef4444' }}>{error}</span>
      </div>
    );
  }

  if (!agent || !isStreaming) return null;

  const style = AGENT_STYLES[agent] || DEFAULT_AGENT_STYLE;

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 border-b"
      style={{
        borderColor: 'var(--editor-border-default)',
        backgroundColor: 'var(--editor-bg-elevated)',
      }}
    >
      {/* Pulsing dot */}
      <div className="relative flex items-center justify-center" style={{ width: 16, height: 16 }}>
        <div
          className="absolute rounded-full"
          style={{
            width: 8, height: 8,
            backgroundColor: style.color,
            animation: 'activity-pulse 1.5s ease-in-out infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 14, height: 14,
            border: `1.5px solid color-mix(in srgb, ${style.color} 30%, transparent)`,
            animation: 'activity-orbit 2s linear infinite',
          }}
        />
      </div>

      {/* Agent badge */}
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 4,
          fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
          color: style.color,
          backgroundColor: `color-mix(in srgb, ${style.color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${style.color} 25%, transparent)`,
          textTransform: 'uppercase' as const,
        }}
      >
        <span style={{ fontSize: 9 }}>{style.icon}</span>
        {agent}
      </span>

      {/* Action text */}
      <span
        style={{
          flex: 1, fontSize: 12, color: 'var(--editor-text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
        }}
      >
        {action || 'Working...'}
      </span>

      {/* Elapsed time */}
      {elapsed && (
        <span style={{
          fontSize: 11, color: 'var(--editor-text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {elapsed}
        </span>
      )}

      <style>{`
        @keyframes activity-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
        @keyframes activity-orbit {
          0% { transform: rotate(0deg); border-top-color: currentColor; }
          100% { transform: rotate(360deg); border-top-color: currentColor; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ActivityBar.tsx
git commit -m "feat: create ActivityBar component — pulsing dot + agent badge + action text + elapsed"
```

---

### Task 8: Simplify use-progress hook

**Files:**
- Modify: `apps/web/src/features/editor-v2/hooks/use-progress.ts`
- Delete: `apps/web/src/features/editor-v2/hooks/use-smooth-progress.ts`

- [ ] **Step 1: Rewrite use-progress.ts to track ActivityState**

Replace the entire file `apps/web/src/features/editor-v2/hooks/use-progress.ts` with:

```typescript
import { useState, useCallback, useRef } from 'react';
import type { ActivityState } from '@viona/shared';

interface UseActivityResult {
  /** Current activity state (agent working, or null) */
  activity: ActivityState | null;
  /** Update from an SSE 'activity' event */
  onActivity: (data: Record<string, unknown>) => void;
  /** Update from an SSE 'progress' event (overrides action text only) */
  onProgress: (data: Record<string, unknown>) => void;
  /** Update from a stateful heartbeat */
  onHeartbeat: (data: Record<string, unknown>) => void;
  /** Clear all state */
  reset: () => void;
}

const DEBOUNCE_MS = 2000;

export function useActivity(): UseActivityResult {
  const [activity, setActivity] = useState<ActivityState | null>(null);
  // Use ref for debounce timestamp to avoid stale closures in setActivity updater
  const lastAgentChangeRef = useRef(0);

  const onActivity = useCallback((data: Record<string, unknown>) => {
    const agent = (data.agent as string) || null;
    const action = (data.action as string) || null;

    if (!agent) {
      // Explicit clear
      setActivity(null);
      lastAgentChangeRef.current = 0;
      return;
    }

    setActivity((prev) => {
      // Debounce rapid agent changes (Phase 5-6 interleaving)
      const now = Date.now();
      if (prev?.agent && prev.agent !== agent && (now - lastAgentChangeRef.current) < DEBOUNCE_MS) {
        return prev;
      }
      lastAgentChangeRef.current = now;
      return {
        agent,
        action,
        phase: (data.phase as string) || undefined,
        startedAt: (data.startedAt as number) || Date.now(),
      };
    });
  }, []);

  const onProgress = useCallback((data: Record<string, unknown>) => {
    // Progress overrides action text only — agent badge comes from activity events
    const message = data.message as string;
    if (!message) return;

    setActivity((prev) => {
      if (!prev) {
        // No active activity — create one from progress (LLM-only path)
        return {
          agent: (data.agentName as string) || null,
          action: message,
          phase: (data.phase as string) || undefined,
          startedAt: Date.now(),
        };
      }
      return { ...prev, action: message };
    });
  }, []);

  const onHeartbeat = useCallback((data: Record<string, unknown>) => {
    const heartbeatActivity = data.activity as ActivityState | null;
    if (heartbeatActivity?.agent) {
      setActivity((prev) => {
        // Only restore from heartbeat if we have no current state
        // (missed the original activity event)
        if (!prev) return heartbeatActivity;
        return prev;
      });
    }
  }, []);

  const reset = useCallback(() => {
    setActivity(null);
    lastAgentChangeRef.current = 0;
  }, []);

  return { activity, onActivity, onProgress, onHeartbeat, reset };
}
```

- [ ] **Step 2: Delete use-smooth-progress.ts**

Delete file: `apps/web/src/features/editor-v2/hooks/use-smooth-progress.ts`

- [ ] **Step 3: Verify no other files import use-smooth-progress**

Run: `grep -r "use-smooth-progress\|useSmoothProgress" apps/web/src/ --include="*.ts" --include="*.tsx" -l`

Expected: only `ProgressBar.tsx` (which will be deleted in Task 10). If others import it, update them.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/hooks/use-progress.ts
git rm apps/web/src/features/editor-v2/hooks/use-smooth-progress.ts
git commit -m "feat: rewrite use-progress as useActivity — track ActivityState, drop percentages"
```

---

### Task 9: Rewrite AIAssistantPanel — wire ActivityBar, split widgets, fix typing indicator

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

This is the largest change. Three sub-steps: wire the ActivityBar, change the message renderer to split widgets out of bubbles, and fix the typing indicator.

- [ ] **Step 1: Update imports**

In `AIAssistantPanel.tsx`, replace the progress-related imports (~lines 18-20):

```typescript
import { useProgress } from '../hooks/use-progress';
import { ProgressBar } from './ProgressBar';
import { ActivityIndicator } from './ActivityIndicator';
```

With:

```typescript
import { useActivity } from '../hooks/use-progress';
import { ActivityBar } from './ActivityBar';
```

- [ ] **Step 2: Replace progressState with activityState**

Find `const progressState = useProgress();` (~line 267) and replace with:

```typescript
const activityState = useActivity();
```

Remove the `progressSourceRef` variable (~line 255):
```typescript
const progressSourceRef = useRef<'sse' | 'ws' | 'http' | null>(null);
```

Remove the `httpHighWaterRef` (~line 273):
```typescript
const httpHighWaterRef = useRef(0);
```

Remove the `etaInfoRef` and `etaSamplesRef` (~lines 275-279).

**Keep the stall detection system** (`stallState`, `setStallState`, `lastProgressTimeRef`, `onProgressReceived`, and the stall check interval at ~line 562). The stall detection still serves a purpose — it tells the user when the connection is truly dead. Per the spec (section 5E), stateful heartbeats count as meaningful events. The existing stall reset on line 736 already includes `heartbeat` and `activity` in the list, so no change is needed there. The stall timer resets on any meaningful SSE event; it only fires when heartbeats themselves stop arriving.

- [ ] **Step 3: Update SSE event handlers**

In the `handleSSEEvent` callback, find the `case 'progress'` block (~line 771). Replace the entire case with:

```typescript
case 'progress': {
  const progressData = data as { message?: string; phase?: string; agentName?: string };
  activityState.onProgress(progressData as Record<string, unknown>);
  break;
}
```

Add a new case for `'activity'` right after:

```typescript
case 'activity': {
  activityState.onActivity(data as Record<string, unknown>);
  break;
}
```

Update the `'heartbeat'` handling to include activity:

```typescript
case 'heartbeat': {
  activityState.onHeartbeat(data as Record<string, unknown>);
  break;
}
```

In the `'done'` handler (outside `setMessages`, at ~line 876), remove `progressSourceRef.current = null` and progress block completion logic. Replace with:

```typescript
activityState.reset();
```

Keep the `setIsStreaming(false)` and conversation ID handling — only remove progress-specific logic (ETA, progressSource, progress block marking as 100%).

In the `'error'` handler, replace progress block error marking with appending an error text block:

```typescript
case 'error': {
  const errData = data as { message?: string; error?: string };
  const errMsg = sanitizeErrorMessage(errData.message || errData.error || 'Something went wrong');
  // Append error as a styled text block
  blocks.push({ type: 'text', text: `⚠ ${errMsg}` });
  break;
}
```

And outside `setMessages`, in the `error` handling section, reset activity:

```typescript
if (eventType === 'error') {
  activityState.reset();
}
```

**Keep `onProgressReceived()`** in the `'progress'` case — it resets the stall timer. The updated progress case should be:

```typescript
case 'progress': {
  onProgressReceived(); // Reset stall timer
  const progressData = data as { message?: string; phase?: string; agentName?: string };
  activityState.onProgress(progressData as Record<string, unknown>);
  break;
}
```

- [ ] **Step 4: Remove progress block creation but keep type for DB backward compat**

Search for `type: 'progress'` and `ProgressBlock` in the file. Changes:

**Keep:** The `ProgressBlock` interface definition and `'progress'` in the `MessageBlock` union type — messages already in the DB have progress blocks, and the union must remain type-safe for loaded data.

**Remove:**
- All code that **creates/updates** progress blocks in `message.content` (the inline progress block creation in the `case 'progress'` SSE handler — the blocks array push/update at ~line 816-838)
- Progress block rendering in the `renderBlock` function (the case that renders `<ProgressBar>`)
- Progress-related width class: `message.content.some((b) => b.type === 'progress') ? 'w-full' : 'max-w-[90%]'`
- The `case 'done'` logic that marks progress blocks as 100% (~line 886-899)
- ETA-related refs and state (`etaInfoRef`, `etaSamplesRef`, `etaSeconds`, `setEtaSeconds`, `computeTimeBasedEta`)

The `segmentContent` helper in Step 5 will filter out `type === 'progress'` blocks from historical messages during rendering.

- [ ] **Step 5: Split widget rendering out of message bubbles**

Find the message rendering section (~line 1872). Currently each message renders as a single `<div>` bubble containing all content blocks. Change: group content blocks into segments (consecutive text blocks → bubble, widget block → standalone).

Replace the inner message rendering with a segment-based approach. Add this helper function before the return statement:

```typescript
/** Split message content into segments: consecutive text blocks group into a bubble,
 *  widget blocks render standalone. Progress blocks are filtered out (legacy). */
function segmentContent(content: MessageBlock[]): Array<{ type: 'bubble'; blocks: MessageBlock[] } | { type: 'widget'; block: WidgetBlock }> {
  const segments: Array<{ type: 'bubble'; blocks: MessageBlock[] } | { type: 'widget'; block: WidgetBlock }> = [];
  let currentTextBlocks: MessageBlock[] = [];

  for (const block of content) {
    if (block.type === 'progress') continue; // Skip legacy progress blocks
    if (block.type === 'widget') {
      // Flush accumulated text blocks as a bubble
      if (currentTextBlocks.length > 0) {
        segments.push({ type: 'bubble', blocks: [...currentTextBlocks] });
        currentTextBlocks = [];
      }
      segments.push({ type: 'widget', block: block as WidgetBlock });
    } else {
      currentTextBlocks.push(block);
    }
  }
  // Flush remaining text
  if (currentTextBlocks.length > 0) {
    segments.push({ type: 'bubble', blocks: currentTextBlocks });
  }
  return segments;
}
```

Then update the message rendering to use segments. For each assistant message, instead of one wrapping bubble div, render segments:

```tsx
{message.role === 'assistant' ? (
  // Segmented rendering — widgets break out of bubbles
  <div className="flex flex-col gap-2 w-full">
    {segmentContent(message.content).map((segment, si) =>
      segment.type === 'widget' ? (
        <div key={si} className="w-full">
          {renderBlock(segment.block, si)}
        </div>
      ) : (
        <div key={si} className="max-w-[90%] bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)] rounded-2xl rounded-bl-md px-4 py-2.5">
          {segment.blocks.map((block, bi) => renderBlock(block, bi))}
        </div>
      )
    )}
    {message.content.length === 0 && isStreaming && (
      <div className="max-w-[90%] bg-[var(--editor-bg-hover)] rounded-2xl rounded-bl-md px-4 py-2.5">
        <div className="flex gap-1 py-1">
          <span className="w-2 h-2 bg-[var(--editor-accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-[var(--editor-accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-[var(--editor-accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    )}
  </div>
) : (
  // User messages — unchanged single bubble
  <div className="max-w-[90%] bg-[var(--editor-accent-soft)] border border-[var(--editor-accent)]/20 text-[var(--editor-text-primary)] rounded-2xl rounded-br-md px-4 py-2.5">
    {message.content.map((block, i) => renderBlock(block, i))}
  </div>
)}
```

- [ ] **Step 6: Fix typing indicator for mid-stream pauses**

The spec (section 6, "Typing indicator for non-subagent turns") requires: show a pulsing dot at the end of the last text block while `isStreaming` is true AND no new text has arrived in the last 500ms.

Add a `lastTextTimeRef` and a `showTypingDot` state near other refs:

```typescript
const lastTextTimeRef = useRef(Date.now());
const [showTypingDot, setShowTypingDot] = useState(false);
```

In the `case 'text'` SSE handler, update the ref:
```typescript
lastTextTimeRef.current = Date.now();
```

Add an effect to compute `showTypingDot`:
```typescript
useEffect(() => {
  if (!isStreaming) { setShowTypingDot(false); return; }
  const check = setInterval(() => {
    const idle = Date.now() - lastTextTimeRef.current > 500;
    setShowTypingDot(idle);
  }, 200);
  return () => clearInterval(check);
}, [isStreaming]);
```

In the message rendering (Step 5's segmented output), after the segments but still inside the assistant message div, add:

```tsx
{isStreaming && showTypingDot && message.content.length > 0 && (
  <div className="flex items-center gap-1 px-4 py-1">
    <div className="w-1.5 h-1.5 rounded-full bg-[var(--editor-text-muted)]" style={{ animation: 'activity-pulse 1.5s ease-in-out infinite' }} />
  </div>
)}
```

This handles both cases: the `message.content.length === 0` bouncing dots (already in Step 5) for initial streaming, and the pulsing dot for mid-stream pauses when text is already present.

- [ ] **Step 7: Replace ActivityIndicator with ActivityBar in JSX**

Find the `{/* Minimal progress indicator */}` section (~line 1821) and replace:

```tsx
<ActivityIndicator
  percent={progressState.progress?.percent ?? 0}
  message={progressState.progress?.message}
  isActive={!!progressState.progress && progressState.progress.percent < 100}
  error={false}
/>
```

With:

```tsx
<ActivityBar
  agent={activityState.activity?.agent ?? null}
  action={activityState.activity?.action ?? null}
  startedAt={activityState.activity?.startedAt ?? null}
  isStreaming={isStreaming}
  error={lastError}
/>
```

Add a `lastError` state to track the most recent error for the ActivityBar flash:
```typescript
const [lastError, setLastError] = useState<string | null>(null);
```

In the `'error'` handler, set it:
```typescript
setLastError(errMsg);
```

In the `'done'` handler, clear it:
```typescript
setLastError(null);
```

- [ ] **Step 8: Restore activity on conversation load**

In the conversation load effect (where `sandboxProgress` is restored), add:

```typescript
// Restore sandbox activity state (Redis-backed, survives page refresh)
if (data.sandboxActivity?.agent) {
  activityState.onActivity(data.sandboxActivity as Record<string, unknown>);
}
```

- [ ] **Step 9: Update handleCancel**

Find the `handleCancel` function. Replace `progressSourceRef.current = null` and `progressState.reset()` with:

```typescript
activityState.reset();
setLastError(null);
```

Keep abort logic and `setIsStreaming(false)` unchanged.

- [ ] **Step 10: Remove all remaining progressState references**

Search for `progressState` in the file and remove/replace all remaining references:
- Remove `progressState` from `useCallback` dependency arrays (e.g., `handleSSEEvent` ~line 923)
- Replace `progressState.onSSEProgress(...)` calls (should already be gone from Step 3)
- Replace `progressState.onSSEActivity(...)` with `activityState.onActivity(...)` (in the `case 'activity'` handler)
- Replace `progressState.onSSEHealth(...)` — remove the health handler entirely if it only fed progress state, or keep if it has other uses
- Remove `progressState.reset()` calls — replaced by `activityState.reset()`

- [ ] **Step 11: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat: wire ActivityBar, split widgets out of bubbles, remove progress blocks"
```

---

### Task 10: Delete old progress components

**Files:**
- Delete: `apps/web/src/features/editor-v2/components/ProgressBar.tsx`
- Delete: `apps/web/src/features/editor-v2/components/ActivityIndicator.tsx`

- [ ] **Step 1: Verify no other files import these**

Run: `grep -r "ProgressBar\|ActivityIndicator" apps/web/src/ --include="*.ts" --include="*.tsx" -l`

Expected: only `AIAssistantPanel.tsx` (already updated in Task 9). If others import them, update those first.

- [ ] **Step 2: Delete the files**

```bash
git rm apps/web/src/features/editor-v2/components/ProgressBar.tsx
git rm apps/web/src/features/editor-v2/components/ActivityIndicator.tsx
```

- [ ] **Step 3: Verify the app compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete ProgressBar and ActivityIndicator — replaced by ActivityBar"
```

---

### Task 11: Update ActivityState export in shared types

**Files:**
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Verify ActivityState is exported from shared**

Check if `packages/shared/src/types/index.ts` re-exports from `progress-types.ts`. If not, add the re-export.

Run: `grep "progress-types" packages/shared/src/types/index.ts`

If not found, add:

```typescript
export type { ActivityState } from '../progress-types.js';
```

- [ ] **Step 2: Commit if changed**

```bash
git add packages/shared/src/types/index.ts
git commit -m "chore: export ActivityState from shared types"
```

---

## Chunk 4: Cleanup + Verification

### Task 12: Remove stale HTTP polling and WebSocket progress logic

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

- [ ] **Step 1: Remove HTTP polling progress logic**

Find the HTTP polling section (~line 424, comment "Polls every 3s as a tertiary progress channel"). The polling logic that fetches job progress and creates/updates inline progress blocks is no longer needed for sandbox pipeline jobs. Remove or simplify the polling to only handle legacy BullMQ worker jobs (if those still exist).

Keep the polling only for `activeJob` restoration on page load — remove the progress block creation/update logic within it.

- [ ] **Step 2: Simplify WebSocket progress handler**

The WebSocket handler (~line 309) that creates inline progress blocks should be simplified. It should only feed into `activityState` for legacy worker jobs, not create progress blocks in message content.

- [ ] **Step 3: Verify the app compiles and renders**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "chore: remove stale HTTP polling and WS progress block logic for sandbox pipeline"
```

---

### Task 13: End-to-end verification

- [ ] **Step 1: Start the dev environment**

Run: `pnpm dev` (or whatever the project's dev command is)

- [ ] **Step 2: Open the editor with a project that has a transcript**

Navigate to a project in the browser.

- [ ] **Step 3: Send a message to Viona asking to create visuals**

Verify:
1. Viona sends intent text ("Planning your scenes...") BEFORE dispatching the Planner
2. The ActivityBar appears pinned above chat with pulsing dot + agent badge + action text
3. The ActivityBar updates as different subagents are dispatched
4. The scene plan widget renders as a standalone block (not inside a bubble)
5. Text before and after the widget renders in separate bubbles
6. No percentage numbers appear anywhere
7. The ActivityBar shows elapsed time that ticks up
8. The ActivityBar disappears when the stream ends

- [ ] **Step 4: Test page refresh during active work**

While a subagent is running:
1. Refresh the page
2. Verify the ActivityBar restores from `sandboxActivity` (Redis-backed)
3. Verify the conversation history loads correctly

- [ ] **Step 5: Test cancellation**

While a subagent is running:
1. Click cancel
2. Verify the ActivityBar disappears
3. Refresh the page — verify no ghost ActivityBar appears (Redis cleaned up)

- [ ] **Step 6: Commit any fixes from verification**

```bash
git add -A
git commit -m "fix: end-to-end verification fixes for progress streaming redesign"
```
