# Plan 4: Frontend Resilience & Code Hygiene

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix frontend edge cases (widget response loss on refresh, stuck streaming state, dead Last-Event-ID infrastructure) and clean up sandbox code hygiene issues (manifest tool lock bypass, stale prompt references, dead widget-tools exports, outdated CLAUDE.md).

**Architecture:** Two independent tracks: (A) Frontend resilience — fix `useRef`-based widget response queuing that loses data on refresh, reduce the 30-minute recovery timeout, and remove dead `Last-Event-ID` tracking. (B) Sandbox hygiene — fix `updateManifestTool` missing lock and notification, remove stale "Healer" agent reference, sync `widget-tools.ts` with actual implementation, update CLAUDE.md file structure docs.

**Tech Stack:** TypeScript, React, Next.js (frontend), Express (sandbox)

---

### Task 1: Persist pending widget responses across page refresh

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:908-932`

Currently, widget responses during streaming are queued in `pendingWidgetResponseRef` (a React ref). If the user clicks a widget button while streaming and then refreshes, the queued response is lost.

- [ ] **Step 1: Use sessionStorage instead of useRef for pending widget responses**

Replace the `pendingWidgetResponseRef` pattern:

```typescript
// BEFORE (line ~125):
const pendingWidgetResponseRef = useRef<Array<{ widgetId: string; value: unknown }>>([]);

// AFTER:
// Helper to read/write pending widget responses from sessionStorage
const PENDING_WIDGET_KEY = `pending-widget-${projectId}`;
const getPendingWidgetResponses = (): Array<{ widgetId: string; value: unknown }> => {
  try {
    const stored = sessionStorage.getItem(PENDING_WIDGET_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};
const setPendingWidgetResponses = (responses: Array<{ widgetId: string; value: unknown }>) => {
  if (responses.length === 0) {
    sessionStorage.removeItem(PENDING_WIDGET_KEY);
  } else {
    sessionStorage.setItem(PENDING_WIDGET_KEY, JSON.stringify(responses));
  }
};
```

- [ ] **Step 2: Update handleWidgetResponse to use sessionStorage**

In the widget response handler (lines 908-923):

```typescript
const handleWidgetResponse = useCallback((widgetId: string, value: unknown) => {
  if (isStreaming) {
    // Queue for after streaming ends — persist to sessionStorage
    const pending = getPendingWidgetResponses();
    pending.push({ widgetId, value });
    setPendingWidgetResponses(pending);
    return;
  }
  // ... existing send logic
}, [isStreaming, ...]);
```

- [ ] **Step 3: Update the flush effect to use sessionStorage**

In the effect that flushes pending responses when streaming ends (lines 927-932):

```typescript
useEffect(() => {
  if (!isStreaming) {
    const pending = getPendingWidgetResponses();
    if (pending.length > 0) {
      const next = pending.shift()!;
      setPendingWidgetResponses(pending);
      handleWidgetResponse(next.widgetId, next.value);
    }
  }
}, [isStreaming]);
```

- [ ] **Step 4: Clear pending responses on conversation reset**

In the reset handler (line ~1027), add:

```typescript
sessionStorage.removeItem(PENDING_WIDGET_KEY);
```

---

### Task 2: Reduce stuck streaming state timeout

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:434-482` (recovery polling)

When the `done` event is lost, recovery polling starts with a 30-minute timeout. This is too long — the user sees a permanent loading state.

- [ ] **Step 1: Reduce max recovery time from 30 minutes to 5 minutes**

Find the constant (line ~445):

```typescript
// BEFORE:
const MAX_RECOVERY_MS = 30 * 60 * 1000; // 30 minutes

// AFTER:
const MAX_RECOVERY_MS = 5 * 60 * 1000; // 5 minutes
```

- [ ] **Step 2: Reduce polling interval from 5s to 3s**

The recovery polling interval (find the `setInterval` call):

```typescript
// BEFORE:
const interval = setInterval(checkStatus, 5000);

// AFTER:
const interval = setInterval(checkStatus, 3000);
```

- [ ] **Step 3: Add an early exit when sandbox reports not-busy**

In the recovery poll callback, if the sandbox status reports `busy: false`, immediately stop polling and reload messages instead of waiting for the next interval:

```typescript
// In the checkStatus callback:
if (!data.busy) {
  stopRecoveryPolling();
  setIsStreaming(false);
  // Reload the latest messages from the API
  await reloadMessages();
}
```

Verify this pattern already exists in the code — if so, just confirm the timeout reduction is sufficient.

---

### Task 3: Remove dead Last-Event-ID infrastructure

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` (remove `lastEventIdRef`)
- Modify: `apps/web/src/lib/api.ts:527-529` (remove `Last-Event-ID` header)

The frontend tracks `lastEventIdRef` and sends `Last-Event-ID` header, but the API never reads it. This is dead infrastructure from a prior design.

- [ ] **Step 1: Remove `lastEventIdRef` from AIAssistantPanel**

Find and remove:
```typescript
const lastEventIdRef = useRef<string | undefined>();
```

And any places it's set (in the SSE parsing loop).

- [ ] **Step 2: Remove `Last-Event-ID` header from api.ts**

In `chatWithAgent` (api.ts lines 527-529), remove the header:

```typescript
// BEFORE:
headers: {
  'Content-Type': 'application/json',
  'Last-Event-ID': lastEventId,
},

// AFTER:
headers: {
  'Content-Type': 'application/json',
},
```

Also remove the `lastEventId` parameter from the function signature if it exists.

---

### Task 4: Fix `updateManifestTool` — add write lock and notification

**Files:**
- Modify: `packages/sandbox/src/tools/manifest-ops.ts` (the `updateManifestTool` definition)

`updateManifestTool.execute()` bypasses `withManifestLock()` and doesn't call `notifyManifestUpdated()`, unlike all other write tools.

- [ ] **Step 1: Find the updateManifestTool execute function**

It's near the end of the file (~lines 507-518). It directly calls `writeFile()`.

- [ ] **Step 2: Wrap with `withManifestLock` and add notification**

```typescript
// BEFORE:
execute: async (input: { manifest: unknown }) => {
  await writeFile(MANIFEST_PATH, JSON.stringify(input.manifest, null, 2));
  triggerRebuild();
  return 'Manifest replaced';
}

// AFTER:
execute: async (input: { manifest: unknown }) => {
  return withManifestLock(async () => {
    await writeFile(MANIFEST_PATH, JSON.stringify(input.manifest, null, 2));
    await notifyManifestUpdated();
    triggerRebuild();
    return 'Manifest replaced';
  });
}
```

Where `withManifestLock` and `notifyManifestUpdated` are the existing helpers used by all other write tools in the same file.

---

### Task 5: Fix stale prompt references and CLAUDE.md

**Files:**
- Modify: `packages/sandbox/src/prompts/reviewer-system.md` (remove "Healer" reference)
- Modify: `packages/sandbox/template/.claude/CLAUDE.md:53-64` (update directory structure)

- [ ] **Step 1: Remove "Healer" reference from reviewer prompt**

Search the reviewer prompt for "Healer" and replace with the correct behavior. The memory file says "All agents self-heal compilation errors. No separate Healer agent."

Find the line (approximately line 244 of reviewer-system.md):
```markdown
Compilation errors route to the Healer.
```

Replace with:
```markdown
Compilation errors are self-healed by the Animator (max 2 retries).
```

- [ ] **Step 2: Update CLAUDE.md file structure**

Replace lines 53-64 of `packages/sandbox/template/.claude/CLAUDE.md`:

```markdown
## File Structure
```
src/proj_<id>/
├── index.tsx           # Main composition
├── constants.ts        # COLORS, TIMING, SPRING_CONFIG
├── metadata.json       # Composition metadata
├── components/         # Reusable components
│   ├── Background.tsx
│   └── ...
└── scenes/             # Individual scene components
    ├── Scene1.tsx
    └── ...
```
```

With the actual workspace structure:
```markdown
## File Structure
```
src/
├── PlayerComposition.tsx   # Main composition - imports scenes via registry
├── scenes/                 # Individual scene components (PascalCase)
│   ├── constants.ts        # COLORS, TIMING, SPRING_CONFIG shared across scenes
│   ├── Background.tsx      # Animated background component
│   ├── HookTitle.tsx       # Scene files — one per plan entry
│   ├── DataComparison.tsx
│   └── ...
└── scene-registry.ts       # Auto-generated — maps scene names to components
```
```

- [ ] **Step 3: Sync widget-tools.ts with actual implementation**

The `widget-tools.ts` file exports `allWidgetTools` with only 2 tools (`show_widget`, `report_progress`) but the MCP server in `mcp-servers.ts` has 3 (`show_widget`, `report_progress`, `report_plan`). Since `allWidgetTools` is dead code (never imported), either:

Option A: Delete the entire file if nothing imports from it.
Option B: Add `report_plan` to `allWidgetTools` and keep it as documentation.

Check imports first:
```bash
grep -r "widget-tools" packages/sandbox/src/ --include="*.ts"
```

If only `WidgetCallbacks` type is imported, keep the type and delete the dead `allWidgetTools` export.
