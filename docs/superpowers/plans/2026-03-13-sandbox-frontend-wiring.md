# Sandbox-First Editor Wiring — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the sandbox system into the frontend so that opening a project spins up a sandbox and all editing (preview, AI chat, manifest) flows through sandbox proxy routes instead of workspace routes.

**Architecture:** Dashboard triggers sandbox creation on project click, waits for ready via WebSocket, then navigates to editor. Editor loads manifest + bundle from sandbox proxy routes. AI chat goes through sandbox prompt proxy. Workspace system remains as dead code. DB stores only project metadata — no timeline data.

**Tech Stack:** Next.js (App Router), Zustand (immer), Fastify, WebSocket, Redis pub/sub, Express (sandbox agent server)

---

## File Structure

### Modified Files

| File | Responsibility |
|------|---------------|
| `apps/web/src/lib/api.ts` | Add sandbox API methods (`createSandbox`, `getSandboxStatus`, `readSandboxManifest`, `chatWithSandboxAgent`). Keep workspace methods as dead code. |
| `apps/web/src/features/editor-v2/store/editor-store.ts` | Rewrite `loadProject()` to use sandbox manifest instead of workspace. Add sandbox rehydration on refresh. |
| `apps/web/src/features/editor-v2/Editor.tsx` | Change workspace WS handlers to work with sandbox events. Change cleanup to suspend sandbox instead of tear down workspace. |
| `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` | Change `api.chatWithAgent()` → `api.chatWithSandboxAgent()` |
| `apps/web/src/app/(dashboard)/projects/page.tsx` | Add sandbox spin-up on project click, wait for ready, then navigate |
| `packages/api/src/sandbox/routes.ts` | Fix Redis channel format to match `project:{id}:{event}` pattern. Rename events. Stub checkpoint. |
| `packages/sandbox/src/agent-server.ts` | Fix SSE format to include `event:` field so frontend parser works |

---

## Chunk 1: Backend — Fix Redis Channel Format and Event Names

### Task 1: Fix sandbox Redis publishes to use correct channel format

**Critical:** The workspace system publishes to channels like `project:{id}:workspace:ready` (3-segment format) using `publishWorkspaceEvent()` from `packages/api/src/workspace/workspace-ws.ts`. The WS handler subscribes via `psubscribe('project:*:*')` which requires at least two colons. The sandbox currently publishes to `project:{id}` (flat, 1 colon) — these events **never reach WebSocket clients**.

**Files:**
- Modify: `packages/api/src/sandbox/routes.ts` — the `POST /internal/sandbox/:id/ready` handler, the `POST /internal/sandbox/:id/bundle-ready` handler, and the `suspendSandbox` function

- [ ] **Step 1: Import `emitWorkspaceReady`, `emitBundleReady`, `emitWorkspaceTeardown` from workspace-ws**

At the top of `packages/api/src/sandbox/routes.ts`, add:

```typescript
import { emitWorkspaceReady, emitBundleReady, emitWorkspaceTeardown } from '../workspace/workspace-ws.js';
```

- [ ] **Step 2: Replace `redis.publish` in the ready callback with `emitWorkspaceReady`**

In `POST /internal/sandbox/:id/ready` handler (around line 299), replace:

```typescript
// Before
await redis.publish(`project:${projectId}`, JSON.stringify({
  type: 'sandbox:ready',
  projectId,
}));

// After
const bundleBaseUrl = `/api/projects/${projectId}/sandbox/bundle`;
await emitWorkspaceReady(projectId, { bundleUrl: bundleBaseUrl });
```

- [ ] **Step 3: Replace `redis.publish` in the bundle-ready callback with `emitBundleReady`**

In `POST /internal/sandbox/:id/bundle-ready` handler (around line 312), replace:

```typescript
// Before
await redis.publish(`project:${projectId}`, JSON.stringify({
  type: 'bundle:ready',
  projectId,
  version,
}));

// After
const bundleBaseUrl = `/api/projects/${projectId}/sandbox/bundle`;
await emitBundleReady(projectId, { bundleUrl: bundleBaseUrl });
```

- [ ] **Step 4: Replace `redis.publish` in `suspendSandbox` with `emitWorkspaceTeardown`**

In the `suspendSandbox` function (around line 421), replace:

```typescript
// Before
await redis.publish(`project:${projectId}`, JSON.stringify({
  type: 'sandbox:destroyed',
  projectId,
}));

// After
await emitWorkspaceTeardown(projectId);
```

- [ ] **Step 5: Remove the `redis` import if no longer used directly**

Check if `redis` (the publish client) is still used anywhere in the file. If the only usages were the three publish calls we just replaced, remove the import. If it's still used elsewhere, keep it.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/sandbox/routes.ts
git commit -m "fix: use correct Redis channel format for sandbox events

Sandbox was publishing to flat 'project:{id}' channels, but the
WebSocket handler uses psubscribe('project:*:*') which requires
3-segment channels. Reuse workspace-ws emit helpers to get the
correct 'project:{id}:{event}' format."
```

---

## Chunk 2: Backend — Fix Sandbox SSE Format

### Task 2: Fix sandbox agent server SSE format to include `event:` field

**Critical:** The frontend SSE parser (`apps/web/src/lib/sse-parser.ts`, line 73) requires **both** an `event:` line and a `data:` line before yielding an event:
```typescript
} else if (line === '' && currentEvent && currentData) {
```
The sandbox agent server only sends `data:` lines without `event:` lines, so all events are silently discarded.

**Files:**
- Modify: `packages/sandbox/src/agent-server.ts` — the `/prompt` endpoint (around line 114)

- [ ] **Step 1: Update SSE writes to include `event:` field**

In the `/prompt` handler, change the SSE writes to include `event:` lines that match what `handleSSEEvent` expects (`text`, `progress`, `done`):

```typescript
// Before (lines 127-134)
res.write(`data: ${JSON.stringify({ type: 'agent:progress', message: 'Processing...' })}\n\n`);
await enqueuePrompt(prompt, conversationId);
res.write(`data: ${JSON.stringify({ type: 'agent:complete', filesChanged: [] })}\n\n`);
res.end();

// After
res.write(`event: text\ndata: ${JSON.stringify({ text: 'Processing your request...' })}\n\n`);
await enqueuePrompt(prompt, conversationId);
res.write(`event: done\ndata: ${JSON.stringify({})}\n\n`);
res.end();
```

This sends events in the exact format the frontend `parseSSEStream` + `handleSSEEvent` understand:
- `event: text` + `data: { text: "..." }` → appends text to the assistant message
- `event: done` + `data: {}` → signals stream completion

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/agent-server.ts
git commit -m "fix: sandbox SSE format must include event: field for frontend parser"
```

---

## Chunk 3: API Client — Sandbox Methods

### Task 3: Add sandbox methods to the frontend API client

**Files:**
- Modify: `apps/web/src/lib/api.ts` — add methods after the workspace methods section (around line 826)

- [ ] **Step 1: Add sandbox methods to the ApiClient class**

Add before the closing `}` of the `ApiClient` class:

```typescript
// ---- Sandbox ----

/** Spin up (or resume) a sandbox for this project */
async createSandbox(projectId: string): Promise<{ status: string; internalUrl: string }> {
  return this.request(`/api/projects/${projectId}/sandbox`, {
    method: 'POST',
  });
}

/** Get sandbox status */
async getSandboxStatus(projectId: string): Promise<{ status: string; previewUrl: string | null }> {
  return this.request(`/api/projects/${projectId}/sandbox/status`);
}

/** Suspend sandbox */
async suspendSandbox(projectId: string): Promise<{ status: string }> {
  return this.request(`/api/projects/${projectId}/sandbox`, {
    method: 'DELETE',
  });
}

/** Read manifest from active sandbox */
async readSandboxManifest(projectId: string): Promise<any> {
  return this.request(`/api/projects/${projectId}/sandbox/manifest`);
}

/** Apply manifest operation to sandbox */
async applySandboxManifestOp(projectId: string, op: Record<string, unknown>): Promise<any> {
  return this.request(`/api/projects/${projectId}/sandbox/manifest`, {
    method: 'PATCH',
    body: JSON.stringify(op),
  });
}

/** Get the base URL for sandbox bundle assets */
getSandboxBundleUrl(projectId: string): string {
  return `/api/projects/${projectId}/sandbox/bundle`;
}

/** Send prompt to sandbox agent — returns SSE stream.
 * Note: context/widgetResponse/lastEventId not yet supported by sandbox agent (Phase 2).
 */
async chatWithSandboxAgent(
  projectId: string,
  body: {
    prompt: string;
    conversationId?: string;
  },
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const url = `${this.baseUrl}/api/projects/${projectId}/sandbox/prompt`;
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  return response.body;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add sandbox API client methods"
```

---

## Chunk 4: Dashboard — Sandbox Spin-Up on Project Click

### Task 4: Intercept project click on dashboard to spin up sandbox before navigating

Currently, project cards are `<Link href="/project/{id}">` elements that navigate immediately. We need to intercept the click, create the sandbox, wait for ready, then navigate.

**Files:**
- Modify: `apps/web/src/app/(dashboard)/projects/page.tsx`

- [ ] **Step 1: Change `ProjectCard` from `<Link>` to a clickable div**

Find the `ProjectCard` component (the function that renders a single project card with the `<Link href={/project/${project.id}}>` wrapper around line 220).

Change the component to accept `onOpen` and `isBooting` props. Replace the `<Link>` with a `<div onClick>`:

```tsx
function ProjectCard({
  project,
  onOpen,
  isBooting,
  className,
}: {
  project: UserProject;  // Note: actual type is UserProject, not DashboardProject
  onOpen: (projectId: string) => void;
  isBooting: boolean;
  className?: string;
}) {
  const status = getStatusConfig(project.status);
  const projectName = project.title || project.videoKey?.split("/").pop() || `Project ${project.id.slice(0, 8)}`;

  return (
    <div
      onClick={() => !isBooting && onOpen(project.id)}
      className={`group block bg-white rounded-2xl shadow-card cursor-pointer overflow-hidden ${isBooting ? 'opacity-70' : ''} ${className || ""}`}
    >
```

Inside the thumbnail area (the `aspect-video` div), add a loading overlay:

```tsx
{/* Loading overlay when sandbox is booting */}
{isBooting && (
  <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
    <Loader2 className="w-8 h-8 text-white animate-spin" />
  </div>
)}
```

- [ ] **Step 2: Add sandbox boot handler in the parent component**

In the component that renders the grid of `ProjectCard` components, add state and the handler:

```tsx
const [bootingProjectId, setBootingProjectId] = useState<string | null>(null);

const handleOpenProject = useCallback(async (projectId: string) => {
  if (bootingProjectId) return;
  setBootingProjectId(projectId);

  try {
    const result = await api.createSandbox(projectId);

    if (result.status === 'ready') {
      router.push(`/project/${projectId}`);
      return;
    }

    // Poll for readiness
    for (let i = 0; i < 90; i++) {  // 3 minutes max (90 x 2s)
      await new Promise(r => setTimeout(r, 2000));
      const status = await api.getSandboxStatus(projectId);
      if (status.status === 'ready') {
        router.push(`/project/${projectId}`);
        return;
      }
    }

    throw new Error('Sandbox failed to start in time');
  } catch (err) {
    console.error('Failed to open project:', err);
    // Clear booting state so user can retry
  } finally {
    setBootingProjectId(null);
  }
}, [bootingProjectId, router]);
```

- [ ] **Step 3: Pass props to ProjectCard in the grid**

Update the grid rendering to pass the new props:

```tsx
<ProjectCard
  key={project.id}
  project={project}
  onOpen={handleOpenProject}
  isBooting={bootingProjectId === project.id}
/>
```

- [ ] **Step 4: Ensure `Loader2` is imported**

Check if `Loader2` is already imported from `lucide-react`. If not, add it to the import statement.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(dashboard)/projects/page.tsx"
git commit -m "feat: spin up sandbox on project open from dashboard"
```

---

## Chunk 5: Editor `loadProject` — Use Sandbox Instead of Workspace

### Task 5: Rewrite `loadProject` to fetch manifest and bundle from sandbox

The sandbox is already running when the editor mounts (dashboard waited for ready). `loadProject` fetches manifest from the sandbox and points the bundle URL at the sandbox proxy.

**Handles page refresh:** If `readSandboxManifest` fails (sandbox was suspended due to idle timeout or user bookmarked the URL), we call `createSandbox` first, wait for it, then retry.

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts` — the `loadProject` action (starts at the `// --- Workspace path` comment inside the try block)

- [ ] **Step 1: Replace the workspace spin-up block with sandbox logic**

Find the workspace path block (the `try` that calls `api.spinUpWorkspace(projectId)` and everything inside it, including the `catch (wsError)` fallback). Replace the entire block (from `// --- Workspace path` through `// --- End workspace path ---`) AND the legacy `convertApiProject` fallback below it, with:

```typescript
// --- Sandbox path (replaces workspace) ---
const loadFromSandbox = async (): Promise<any> => {
  try {
    return await api.readSandboxManifest(projectId);
  } catch (err) {
    // Sandbox may not be running (page refresh, idle timeout, bookmark).
    // Spin it up and retry.
    console.warn('Sandbox manifest not available, creating sandbox...', err);
    await api.createSandbox(projectId);
    // Poll until ready
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const status = await api.getSandboxStatus(projectId);
      if (status.status === 'ready') {
        return await api.readSandboxManifest(projectId);
      }
    }
    throw new Error('Sandbox failed to start');
  }
};

const manifest = await loadFromSandbox();
const bundleBaseUrl = api.getSandboxBundleUrl(projectId);

const bridgeResult = manifestToStore(manifest, {
  videoUrl,
  bundleUrl: bundleBaseUrl,
  compositionId: (apiProject as any).compositionId ?? '',
  visualMeta: (apiProject as any).visualMeta,
});

const project = {
  id: apiProject.id,
  title: apiProject.title,
  status: apiProject.status,
  projectType: apiProject.projectType,
  videoKey: apiProject.videoKey,
  audioKey: (apiProject as any).audioKey,
  videoUrl,
  audioUrl: (apiProject as any).audioPresignedUrl || null,
  outputKey: apiProject.outputKey,
  durationMs: bridgeResult.duration,
  fps: bridgeResult.fps,
  sourceWidth: apiProject.width,
  sourceHeight: apiProject.height,
  videoSettings: bridgeResult.videoSettings,
};

set((state) => {
  state.project = project;
  state.tracks = bridgeResult.tracks;
  state.items = bridgeResult.items;
  state.itemIds = bridgeResult.itemIds;
  state.duration = bridgeResult.duration;
  state.fps = bridgeResult.fps;
  state.isLoading = false;
  state.currentTimeMs = 0;
  state.selectedIds = [];
  state.layoutSettings = bridgeResult.layoutSettings;
  state.layoutPresetId = bridgeResult.layoutPresetId as LayoutPresetId;
  state.sandboxStatus = 'ready';
  state.sandboxPreviewUrl = `${bundleBaseUrl}/player-composition.cjs.js`;
  state.sandboxBundleVersion = 1;
  // Set workspace fields too — existing components (Player, useWorkspaceComposition) read these
  state.workspaceStatus = 'active';
  state.workspaceBundleUrl = bundleBaseUrl;
  state.workspaceBundleVersion = 1;
  state.workspaceBundleError = null;
  state.workspaceManifest = manifest as Record<string, unknown>;
  state.workspaceLockHolder = null;
  state.viewport = { zoom: DEFAULT_ZOOM, scrollX: 0, scrollY: 0 };
  state.history = [];
  state.historyIndex = -1;
  state.isDirty = false;
});

get().pushHistory();
cancelDebouncedSave();
set((state) => { state.isDirty = false; });

// Poll for bundle readiness (handles race where bundle:ready WS event fires
// before the frontend WebSocket connects)
{
  const pollBundle = async () => {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      if (get().workspaceBundleVersion > 1) return; // WS event arrived
      try {
        const res = await fetch(`${API_URL}${bundleBaseUrl}/player-composition.cjs.js`, {
          method: 'HEAD',
          credentials: 'include',
        });
        if (res.ok) {
          set((state) => { state.workspaceBundleVersion = 2; });
          return;
        }
      } catch { /* retry */ }
    }
  };
  // Always start polling — it exits early if bundle is already ready
  pollBundle();
}

// Auto-load caption fonts
const captionFonts = new Set<string>();
for (const id of bridgeResult.itemIds) {
  const item = bridgeResult.items[id];
  if (item?.type === 'caption') {
    const fontFamily = (item.data as CaptionItemData).style?.fontFamily;
    if (fontFamily) captionFonts.add(fontFamily.split(',')[0].trim());
  }
}
for (const family of captionFonts) {
  const entry = findFont(family);
  if (entry) loadFont(entry);
}
// --- End sandbox path ---
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat: loadProject uses sandbox manifest instead of workspace

Includes rehydration logic for page refresh (creates sandbox if not
running) and bundle polling fallback for WS race condition."
```

---

## Chunk 6: Editor WebSocket Handlers and Cleanup

### Task 6: Update Editor.tsx workspace WS handlers and cleanup

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx` — the `useWorkspaceWS` block and the cleanup `useEffect`

- [ ] **Step 1: Update `onManifestUpdated` to read from sandbox**

In the `useWorkspaceWS` call, change `api.readManifest(projectId)` to `api.readSandboxManifest(projectId)`:

```typescript
onManifestUpdated: async (data) => {
  if (data.source === 'ai' && projectId) {
    try {
      const manifest = await api.readSandboxManifest(projectId);
      useEditorStore.getState().applyRemoteManifestUpdate(manifest);
    } catch (err) {
      console.error('Failed to apply remote manifest update:', err);
    }
  }
},
```

- [ ] **Step 2: Keep `onBundleReady` as-is**

The existing handler already calls `s.incrementBundleVersion()` and optionally updates the bundle URL. This works correctly since the sandbox now publishes via `emitBundleReady` with the sandbox bundle URL. No change needed.

- [ ] **Step 3: Update cleanup on unmount to suspend sandbox**

Replace the workspace teardown `useEffect` (the one that calls `api.tearDownWorkspace`) with:

```typescript
// Sandbox cleanup on unmount
useEffect(() => {
  return () => {
    const state = useEditorStore.getState();
    if (state.project && state.sandboxStatus === 'ready') {
      api.suspendSandbox(state.project.id).catch((err: any) => {
        console.warn('Failed to suspend sandbox on unmount:', err);
      });
    }
  };
}, []);
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "feat: editor uses sandbox for manifest reads and cleanup"
```

---

## Chunk 7: AI Chat Through Sandbox

### Task 7: Route AI chat through sandbox prompt proxy

**Known Phase 1 limitations:**
- `context` (selected scene/element/time range) is not passed to sandbox agent yet
- `widgetResponse` (inline widget interactions) not supported
- `lastEventId` (SSE resumption) not supported
- These features will be wired when the sandbox agent gains full Agent SDK integration

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — the `_executeMessage` callback

- [ ] **Step 1: Replace `api.chatWithAgent` with `api.chatWithSandboxAgent`**

In `_executeMessage`, find the line that calls `api.chatWithAgent` (inside the inner `try` block). Replace:

```typescript
// Before
const stream = await api.chatWithAgent(projectId, {
  message: fullMessage,
  context: Object.keys(context).length > 0 ? context : undefined,
  widgetResponse,
}, controller.signal, lastEventIdRef.current);

// After
const stream = await api.chatWithSandboxAgent(projectId, {
  prompt: fullMessage,
}, controller.signal);
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat: AI chat routes through sandbox prompt proxy

Phase 1: context, widgetResponse, lastEventId not yet passed to
sandbox agent. Will be wired with full Agent SDK integration."
```

---

## Chunk 8: Disable DB Checkpoint Sync

### Task 8: Stub out the checkpoint route

The sandbox POSTs manifest checkpoints to `/internal/sandbox/:id/checkpoint` every 60 seconds. Since the DB should not store timeline data, accept but don't persist.

**Files:**
- Modify: `packages/api/src/sandbox/routes.ts` — the `POST /internal/sandbox/:id/checkpoint` handler

- [ ] **Step 1: Replace checkpoint handler body with no-op**

Replace the full checkpoint handler (the one that calls `manifestSchema.parse`, `manifestToDb`, and runs a DB transaction) with:

```typescript
// POST /internal/sandbox/:id/checkpoint — Accept but don't persist to DB
fastify.post('/internal/sandbox/:id/checkpoint', async (request, reply) => {
  const projectId = await validateInternalCallback(request, reply);
  if (!projectId) return;
  // Checkpoint data lives in sandbox volume only — no DB sync
  logger.debug({ projectId }, 'Checkpoint received (not persisted to DB)');
  return { ok: true };
});
```

- [ ] **Step 2: Clean up unused imports**

If the removed checkpoint logic was the only user of `manifestSchema`, `manifestToDb`, or the DB transaction imports, remove those imports.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/sandbox/routes.ts
git commit -m "refactor: disable DB checkpoint sync — sandbox volume is source of truth"
```

---

## Chunk 9: Integration Smoke Test

### Task 9: Manual integration test checklist

- [ ] **Step 1: Verify sandbox Docker image builds**

```bash
cd packages/sandbox && docker build -t viona-sandbox:latest .
```

Expected: Successful build

- [ ] **Step 2: Start the full stack locally**

```bash
pnpm dev
```

Verify API starts with `SANDBOX_PROVIDER=docker`, web app loads at `localhost:3000`.

- [ ] **Step 3: Test happy path**

1. Open `http://localhost:3000/projects`
2. Click a project card
3. Verify: Loading spinner appears on the card
4. Verify: After sandbox boots, browser navigates to `/project/{id}`
5. Verify: Timeline populates with items from sandbox manifest
6. Verify: Player renders the Remotion composition from sandbox bundle
7. Verify: AI chat sends messages through sandbox prompt proxy and receives response
8. Verify: Closing editor tab triggers sandbox suspension (check `docker ps`)

- [ ] **Step 4: Test page refresh**

1. While in editor, refresh the page (F5)
2. Verify: Editor loads without errors (sandbox should still be running)
3. Verify: If sandbox was idle-suspended, it auto-creates and loads

- [ ] **Step 5: Test project switching**

1. Open project A → sandbox A starts
2. Navigate back to dashboard, open project B
3. Verify: Sandbox A is suspended, sandbox B starts
4. Verify: Only one sandbox running at a time (`docker ps`)

---

## Summary of Changes

| Area | Before | After |
|------|--------|-------|
| Project open | `<Link>` navigates immediately, `loadProject` calls `spinUpWorkspace()` | Dashboard calls `createSandbox()`, waits for ready, then navigates |
| Manifest source | `api.spinUpWorkspace()` returns manifest from workspace | `api.readSandboxManifest()` reads from sandbox proxy |
| Bundle source | `/api/projects/:id/workspace/bundle/*` | `/api/projects/:id/sandbox/bundle/*` |
| AI chat | `api.chatWithAgent()` → `/agent/chat` | `api.chatWithSandboxAgent()` → `/sandbox/prompt` |
| Real-time events | Sandbox published to flat `project:{id}` channel (broken) | Uses `emitWorkspaceReady/emitBundleReady` for correct `project:{id}:{event}` format |
| SSE format | Sandbox sent bare `data:` lines (silently dropped by parser) | Now sends `event: text\ndata: ...` matching frontend expectations |
| Editor cleanup | `api.tearDownWorkspace()` | `api.suspendSandbox()` |
| Page refresh | No rehydration — would crash | Auto-creates sandbox if not running |
| DB timeline sync | Checkpoint every 60s to DB | Disabled — sandbox volume is source of truth |
| Workspace code | Active, primary path | Dead code, kept for now |

## Known Phase 1 Limitations

- AI chat does not pass `context` (selected scene/element), `widgetResponse`, or `lastEventId` to sandbox
- Sandbox agent is a stub (`TODO: Phase 1 — integrate Agent SDK here`) — returns placeholder text
- No `manifest:updated` event emitted after sandbox agent processes a prompt (will be added with Agent SDK integration)
- No error toast on dashboard if sandbox fails to boot
