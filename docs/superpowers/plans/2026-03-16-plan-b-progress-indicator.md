# Plan B: Minimal Progress Indicator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the over-designed progress bar with a minimal pulsing-dot indicator (like Claude Code's reasoning animation) and fix progress loss on page refresh for sandbox pipelines.

**Architecture:** Two changes: (1) Replace `ProgressBar.tsx` with a minimal `ActivityIndicator` component — animated orb + percentage + one-line status. Render it as a persistent element pinned above the chat message list, not inside chat bubbles. (2) Persist sandbox pipeline progress to a Redis key so the GET conversation endpoint can return it after refresh.

**Tech Stack:** React (frontend), Fastify (API), Redis (progress persistence)

**Spec Reference:** `docs/superpowers/plans/2026-03-16-pipeline-issues.md` — Issues 2, 3

---

## File Structure

### Files to create:
- `apps/web/src/features/editor-v2/components/ActivityIndicator.tsx` — Minimal pulsing-dot progress indicator

### Files to modify:
- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — Remove progress from messages, render ActivityIndicator above message list
- `packages/api/src/agent/agent-router.ts` — Persist sandbox progress to Redis, return it in GET endpoint
- `packages/api/src/sandbox/proxy.ts` — Write progress to Redis on each onProgress callback

### Files to delete (or gut):
- `apps/web/src/features/editor-v2/components/ProgressBar.tsx` — Replace entirely with ActivityIndicator

### Files NOT touched:
- `apps/web/src/features/editor-v2/hooks/use-progress.ts` — The hook is fine; it already manages SSE/WS/HTTP priority. We just change what renders the state.
- `packages/shared/src/progress-types.ts` — Types are fine as-is.

---

## Chunk 1: Build the minimal ActivityIndicator component

### Task 1: Create ActivityIndicator component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/ActivityIndicator.tsx`

**Context:** This replaces `ProgressBar.tsx`. It shows a small animated dot + percentage + one-line status text. When idle (no active pipeline), it's hidden. The design reference is Claude Code's pulsing/orbiting dot when it's reasoning.

- [ ] **Step 1: Create the ActivityIndicator component**

Create `apps/web/src/features/editor-v2/components/ActivityIndicator.tsx`:

```tsx
'use client';

import React from 'react';

interface ActivityIndicatorProps {
  percent: number;
  message?: string;
  isActive: boolean;
  error?: boolean;
}

export function ActivityIndicator({ percent, message, isActive, error }: ActivityIndicatorProps) {
  if (!isActive && percent === 0) return null;

  const isDone = percent >= 100 && !error;

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 border-b"
      style={{
        borderColor: 'var(--editor-border-default)',
        backgroundColor: 'var(--editor-bg-elevated)',
      }}
    >
      {/* Animated orb */}
      <div className="relative flex items-center justify-center" style={{ width: 16, height: 16 }}>
        {isActive && !isDone ? (
          <>
            {/* Pulsing core */}
            <div
              className="absolute rounded-full"
              style={{
                width: 8,
                height: 8,
                backgroundColor: error ? '#ef4444' : 'var(--editor-accent)',
                animation: 'activity-pulse 1.5s ease-in-out infinite',
              }}
            />
            {/* Orbiting ring */}
            <div
              className="absolute rounded-full"
              style={{
                width: 14,
                height: 14,
                border: `1.5px solid ${error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                animation: 'activity-orbit 2s linear infinite',
              }}
            />
          </>
        ) : (
          /* Static dot when done */
          <div
            className="rounded-full"
            style={{
              width: 8,
              height: 8,
              backgroundColor: isDone ? '#22c55e' : 'var(--editor-text-muted)',
            }}
          />
        )}
      </div>

      {/* Percentage */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: error ? '#ef4444' : isDone ? '#22c55e' : 'var(--editor-accent)',
          minWidth: 32,
        }}
      >
        {Math.round(percent)}%
      </span>

      {/* Status message */}
      {message && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--editor-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {message}
        </span>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes activity-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
        @keyframes activity-orbit {
          0% { transform: rotate(0deg); border-top-color: var(--editor-accent); }
          100% { transform: rotate(360deg); border-top-color: var(--editor-accent); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep ActivityIndicator`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ActivityIndicator.tsx
git commit -m "feat: add minimal ActivityIndicator component — pulsing dot + percentage (Issue 3)"
```

---

### Task 2: Wire ActivityIndicator into the chat panel

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`

**Context:** Currently, progress is rendered as a `ProgressBar` inside chat message bubbles (line 1764). We need to: (1) remove progress blocks from message rendering, and (2) render the `ActivityIndicator` as a persistent element pinned above the message list.

- [ ] **Step 1: Import ActivityIndicator**

At the top of `AIAssistantPanel.tsx` (around line 1, imports section), add:

```typescript
import { ActivityIndicator } from './ActivityIndicator';
```

Remove the ProgressBar import:

```typescript
// DELETE this line:
import { ProgressBar } from './ProgressBar';
```

- [ ] **Step 2: Render ActivityIndicator above the message list**

Find the message list container in the JSX. The chat panel renders messages inside a scrollable container. Add the `ActivityIndicator` pinned above it.

Look for the message list rendering area (the `div` that contains the mapped messages). It should be inside a scrollable container. Add the indicator BEFORE the scroll container:

```tsx
{/* Minimal progress indicator — pinned above messages */}
<ActivityIndicator
  percent={progressState.progress?.percent ?? 0}
  message={progressState.progress?.message}
  isActive={!!progressState.progress && progressState.progress.percent < 100}
  error={false}
/>
```

`progressState` is already available from the `useProgress` hook usage in the component.

- [ ] **Step 3: Remove ProgressBar from message rendering**

In the `renderBlock` function (around line 1708), find the `case 'progress'` block that renders `<ProgressBar .../>` (lines 1708-1783). Replace the entire case with a no-op that returns nothing visible:

```typescript
case 'progress':
  // Progress is now shown via ActivityIndicator above the message list
  return null;
```

This keeps the progress block data flowing (for persistence/restoration) but stops rendering it inside messages.

- [ ] **Step 4: Verify no TypeScript errors**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors. The old ProgressBar import is removed, and ProgressBar.tsx can be deleted later (or kept as dead code for now).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat: wire ActivityIndicator above chat, remove ProgressBar from messages (Issue 3)"
```

---

## Chunk 2: Persist sandbox progress for refresh recovery

### Task 3: Write sandbox progress to Redis on each update

**Files:**
- Modify: `packages/api/src/sandbox/proxy.ts:246`
- Modify: `packages/api/src/agent/agent-router.ts:406-431`

**Context:** The sandbox pipeline progress is purely in-memory — SSE events flow from sandbox → proxy → browser. On page refresh, it's all lost. The BullMQ worker pipeline stores progress in a DB job row, so the GET endpoint can return it. The sandbox pipeline needs similar persistence.

The simplest approach: write progress to a Redis key (with TTL) in the proxy's `onProgress` callback. The GET conversation endpoint reads it back. Redis is already available in the API server.

- [ ] **Step 1: Read the current proxy onProgress handling**

Open `packages/api/src/sandbox/proxy.ts` and confirm the progress event dispatch (around line 246):

```typescript
case 'progress':
  callbacks.onProgress?.(data);
  break;
```

- [ ] **Step 2: Add Redis progress persistence in proxy**

In `packages/api/src/sandbox/proxy.ts`, add a Redis write inside the `proxyPromptWithIntercept` function. The function already receives `projectId` (from the route context). Add a Redis import and write.

At the top of the file, add import:

```typescript
import { getRedis } from '../lib/redis.js';
```

In the `proxyPromptWithIntercept` function signature, ensure `projectId` is available (it should be passed from the route handler). If not, add it as a parameter.

Inside the `'progress'` case in the event dispatch (line 246), add Redis persistence:

```typescript
case 'progress': {
  callbacks.onProgress?.(data);
  // Persist to Redis for refresh recovery (TTL: 30 minutes)
  const redis = getRedis();
  if (redis && projectId) {
    const key = `sandbox:progress:${projectId}`;
    redis.set(key, JSON.stringify(data), 'EX', 1800).catch(() => {});
  }
  break;
}
```

On `'done'` event, clear the progress key:

```typescript
case 'done': {
  if (textBuffer) {
    callbacks.onText?.(textBuffer);
    textBuffer = '';
  }
  callbacks.onDone?.(data).catch(() => {});
  // Clear progress from Redis on completion
  const redis = getRedis();
  if (redis && projectId) {
    redis.del(`sandbox:progress:${projectId}`).catch(() => {});
  }
  break;
}
```

- [ ] **Step 3: Read sandbox progress in the GET conversation endpoint**

In `packages/api/src/agent/agent-router.ts`, find the GET endpoint (around line 390). After the existing `activeJob` check (lines 409-431), add a fallback that checks Redis for sandbox progress:

```typescript
// After the activeJob check (line 431), add:

// Fallback: check Redis for sandbox pipeline progress
let sandboxProgress = null;
if (!activeJobMeta) {
  const redis = getRedis();
  if (redis) {
    const key = `sandbox:progress:${projectId}`;
    const cached = await redis.get(key);
    if (cached) {
      try {
        sandboxProgress = JSON.parse(cached);
      } catch { /* ignore */ }
    }
  }
}
```

Then include it in the response (around line 435 where the response is built):

```typescript
// Add to response object:
sandboxProgress: sandboxProgress ?? undefined,
```

- [ ] **Step 4: Handle sandbox progress on the frontend**

In `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx`, in the conversation loading logic (around line 650), check for `sandboxProgress` in the GET response:

```typescript
// After loading history, check for sandbox progress
if (response.sandboxProgress) {
  progressState.onHTTPProgress({
    percent: response.sandboxProgress.percent,
    message: response.sandboxProgress.message,
    phase: response.sandboxProgress.phase,
    phaseName: response.sandboxProgress.phaseName,
  });
}
```

This feeds the restored progress into the existing `useProgress` hook, which the `ActivityIndicator` reads.

- [ ] **Step 5: Verify no TypeScript errors**

Run: `cd packages/api && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/sandbox/proxy.ts packages/api/src/agent/agent-router.ts apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat: persist sandbox progress to Redis for refresh recovery (Issue 2)"
```

---

## What This Achieves

| Issue | Fix | Risk |
|-------|-----|------|
| **Issue 2**: Progress lost on refresh | Redis persistence with 30-min TTL; GET endpoint reads it back | Low — Redis is already used; TTL prevents stale data |
| **Issue 3**: Progress inside chat bubble | ActivityIndicator pinned above messages; ProgressBar removed from renderBlock | Low — clean separation; old data model unchanged |
| **Issue 3B**: Over-designed progress widget | Minimal pulsing dot + percentage + status text | Low — purely visual change |

## Known Tradeoffs

- **Redis TTL (30 min):** If a pipeline takes > 30 min (shouldn't happen), the progress key expires. This is intentional — stale progress is worse than no progress.
- **No WebSocket fallback for sandbox progress:** The existing WS fallback (`use-progress.ts`) works for BullMQ jobs. Sandbox progress only comes via SSE or Redis-backed HTTP. This is fine because the sandbox SSE stream reconnects on refresh (the stream is still alive on the backend).
- **ProgressBar.tsx not deleted:** It's dead code after this plan. Can be deleted in a cleanup pass. Keeping it avoids import errors if anything else references it.
