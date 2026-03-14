# Code Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical, important, and applicable suggestion-level issues found during the comprehensive code review of the unified timeline architecture (Plans 1-8).

**Architecture:** Each fix is isolated and independently committable. Critical issues (data loss, security, resource leaks) come first, followed by important correctness issues, then suggestions. No new features — only hardening existing code.

**Tech Stack:** Drizzle ORM transactions, Redis Lua scripts, TypeScript, Zod validation

---

## File Map

| File | Action | Fix |
|---|---|---|
| `packages/api/src/workspace/workspace-service.ts` | Modify | Transaction in syncManifestToDb, N+1 query fix, orphan cleanup |
| `packages/api/src/workspace/bundler-service.ts` | Modify | Clear timeout on completion, process tree kill |
| `packages/api/src/workspace/workspace-routes.ts` | Modify | Lock check on PATCH, auth on bundle route |
| `packages/api/src/workspace/workspace-codegen.ts` | Modify | Sanitize font module name |
| `packages/worker/src/processors/render/types.ts` | Modify | Type `manifest` as `Manifest` |
| `packages/worker/src/processors/render/index.ts` | Modify | Remove `as any` casts |
| `packages/shared/src/manifest-ops.ts` | Modify | Use `nanoid()` for split IDs |
| `apps/web/src/features/editor-v2/store/editor-store.ts` | Modify | Surface manifest op errors |
| `apps/web/src/features/editor-v2/store/manifest-bridge.ts` | Modify | Fix `extractSceneId` regex |
| `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts` | Modify | Bundle integrity check |

---

## Chunk 1: Critical Fixes

### Task 1: Wrap syncManifestToDb in a database transaction

A crash between the DELETE and INSERT in `syncManifestToDb` loses all timeline data. Drizzle supports transactions via `db.transaction()`.

**Files:**
- Modify: `packages/api/src/workspace/workspace-service.ts:268-309`

- [ ] **Step 1: Read the current syncManifestToDb function**

Read `packages/api/src/workspace/workspace-service.ts` lines 268-309 to understand the current implementation.

- [ ] **Step 2: Wrap in transaction**

Replace the body of `syncManifestToDb` with a transactional version. Drizzle's `db.transaction()` provides an `tx` parameter that supports all the same query methods:

```typescript
async function syncManifestToDb(projectId: string, manifest: Manifest): Promise<void> {
  const { tracks: manifestTracks, items: manifestItems, videoSettings } = manifestToDb(manifest);

  await db.transaction(async (tx) => {
    // Update video settings on project
    await tx.update(projects)
      .set({
        videoSettings: videoSettings as any,
        durationMs: Math.round(manifest.durationMs),
      })
      .where(eq(projects.id, projectId));

    // Delete all existing tracks for this project (cascades to items via FK)
    await tx.delete(tracks).where(eq(tracks.projectId, projectId));

    for (const t of manifestTracks) {
      await tx.insert(tracks).values({
        id: t.id,
        projectId,
        type: t.type,
        name: t.name,
        position: t.position,
        locked: false,
        visible: true,
      });
    }

    // Insert items
    for (const item of manifestItems) {
      await tx.insert(timelineItems).values({
        id: item.id,
        trackId: item.trackId,
        type: item.type,
        startMs: item.startMs,
        endMs: item.endMs,
        data: item.data as any,
      });
    }
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/workspace/workspace-service.ts
git commit -m "fix(workspace): wrap syncManifestToDb in transaction to prevent data loss on crash"
```

---

### Task 2: Fix bundler timeout leaking timers and orphan processes

The `setTimeout` in `runRemotionBundle` and `compilePlayerCjs` is never cleared on normal completion, and `SIGTERM` doesn't kill child process trees on Windows.

**Files:**
- Modify: `packages/api/src/workspace/bundler-service.ts:116-205`

- [ ] **Step 1: Read the current bundler methods**

Read `packages/api/src/workspace/bundler-service.ts` lines 116-205.

- [ ] **Step 2: Fix runRemotionBundle — clear timeout on completion**

Replace the `runRemotionBundle` method. Store the timeout reference and clear it in `close`/`error` handlers:

```typescript
private runRemotionBundle(entryPoint: string, outDir: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      'remotion', 'bundle',
      entryPoint,
      '--out-dir', outDir,
      '--log', 'error',
    ];

    const proc = spawn('npx', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let stderr = '';
    let settled = false;
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      this.killProcessTree(proc);
      reject(new Error('Remotion bundle timed out after 120s'));
    }, 120_000);

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Remotion bundle failed (exit ${code}): ${stderr.slice(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn Remotion bundle: ${err.message}`));
    });
  });
}
```

- [ ] **Step 3: Fix compilePlayerCjs — same pattern**

Apply the same fix to `compilePlayerCjs`: store timeout reference, clear on completion, use `settled` flag, call `this.killProcessTree(proc)` on timeout.

```typescript
private compilePlayerCjs(srcPath: string, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const entryPoint = join(srcPath, 'PlayerComposition.tsx');
    const cjsOutput = join(outDir, 'player-composition.cjs.js');

    const args = [
      'esbuild',
      entryPoint,
      '--bundle',
      '--format=cjs',
      '--platform=browser',
      '--target=es2020',
      '--external:react',
      '--external:react/jsx-runtime',
      '--external:react/jsx-dev-runtime',
      '--external:remotion',
      '--external:@remotion/noise',
      '--external:@remotion/shapes',
      '--external:@remotion/paths',
      '--external:@remotion/three',
      '--external:@remotion/google-fonts/*',
      '--external:remotion/no-react',
      `--outfile=${cjsOutput}`,
    ];

    const proc = spawn('npx', args, {
      cwd: join(srcPath, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let stderr = '';
    let settled = false;
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      this.killProcessTree(proc);
      reject(new Error('CJS compilation timed out after 60s'));
    }, 60_000);

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`CJS compilation failed (exit ${code}): ${stderr.slice(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn esbuild: ${err.message}`));
    });
  });
}
```

- [ ] **Step 4: Add killProcessTree helper**

Add a private method to `BundlerService` that kills the process tree. On Windows, `taskkill /T /F` kills the tree. On Unix, kill the process group:

```typescript
private killProcessTree(proc: import('child_process').ChildProcess): void {
  if (!proc.pid) return;

  try {
    if (process.platform === 'win32') {
      // /T = kill tree, /F = force
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      // Kill process group (negative PID)
      process.kill(-proc.pid, 'SIGTERM');
    }
  } catch {
    // Best effort — process may already be dead
    try { proc.kill('SIGKILL'); } catch { /* ignore */ }
  }
}
```

Note: For the Unix process group kill to work, the spawn must use `detached: true` and `proc.unref()` is NOT called. However, since we're on Windows primarily and the `shell: true` flag is already used, the `taskkill /T` approach is the reliable one. For Unix, fallback to `proc.kill('SIGTERM')` then `SIGKILL`.

Simplified cross-platform version:

```typescript
private killProcessTree(proc: import('child_process').ChildProcess): void {
  if (!proc.pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      proc.kill('SIGTERM');
    }
  } catch {
    // Process may already be dead
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/workspace/bundler-service.ts
git commit -m "fix(bundler): clear timeout on completion, kill process tree on timeout"
```

---

### Task 3: Add bundle content-type validation before CJS eval

Add a basic check that the fetched bundle content is JavaScript before executing it via `new Function()`.

**Files:**
- Modify: `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts:200-225`

- [ ] **Step 1: Read the current code**

Read `apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts` lines 200-230.

- [ ] **Step 2: Add content-type and basic validation**

Before the `new Function()` call, add validation:

```typescript
// Validate response before eval
const contentType = response.headers.get('content-type') || '';
if (!contentType.includes('javascript') && !contentType.includes('text/plain')) {
  throw new Error(`Unexpected content-type for bundle: ${contentType}`);
}

// Basic sanity check — CJS bundles should start with common patterns
const trimmed = code.trimStart();
if (!trimmed.startsWith('"use strict"') &&
    !trimmed.startsWith("'use strict'") &&
    !trimmed.startsWith('var ') &&
    !trimmed.startsWith('Object.defineProperty') &&
    !trimmed.startsWith('(function') &&
    !trimmed.startsWith('module.exports')) {
  throw new Error('Bundle content does not look like valid CJS JavaScript');
}
```

Insert this between `const code = await response.text();` and `const moduleObj = { exports: {} };`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/player/useWorkspaceComposition.ts
git commit -m "fix(player): validate bundle content-type and structure before CJS eval"
```

---

## Chunk 2: Important Fixes

### Task 4: Fix N+1 query in spinUpWorkspace

Replace the per-track item query loop with a single `inArray` query.

**Files:**
- Modify: `packages/api/src/workspace/workspace-service.ts:49-54`

- [ ] **Step 1: Add inArray import**

At the top of `workspace-service.ts`, check the drizzle-orm import. Add `inArray` if not present:

```typescript
import { eq, inArray } from 'drizzle-orm';
```

- [ ] **Step 2: Replace the N+1 loop**

Replace lines 49-54:

```typescript
// OLD:
const allItems = [];
for (const track of projectTracks) {
  const items = await db.select().from(timelineItems).where(eq(timelineItems.trackId, track.id));
  allItems.push(...items);
}

// NEW:
const trackIds = projectTracks.map(t => t.id);
const allItems = trackIds.length > 0
  ? await db.select().from(timelineItems).where(inArray(timelineItems.trackId, trackIds))
  : [];
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/workspace/workspace-service.ts
git commit -m "perf(workspace): replace N+1 item query loop with single inArray query"
```

---

### Task 5: Add lock check to PATCH manifest route

The HTTP PATCH route for manifest operations doesn't check the edit lock. If the AI holds the lock, user edits should be rejected.

**Files:**
- Modify: `packages/api/src/workspace/workspace-routes.ts:88-109`

- [ ] **Step 1: Add lock check before applying operation**

In the PATCH handler, after validating the op but before applying it, check the lock:

```typescript
/** Apply a manifest operation */
fastify.patch('/projects/:id/workspace/manifest', { preHandler: authMiddleware }, async (request, reply) => {
  const { id } = request.params as { id: string };

  if (!(await isWorkspaceActive(id))) {
    return reply.status(404).send({ error: 'No active workspace' });
  }

  // Check if AI holds the lock — reject user edits during AI editing
  const lockInfo = await getLockInfo(id);
  if (lockInfo && lockInfo.holder === 'ai') {
    return reply.status(409).send({ error: 'AI is currently editing', holder: 'ai' });
  }

  // Validate the operation
  const parseResult = manifestOpSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({ error: 'Invalid operation', details: parseResult.error.issues });
  }

  try {
    const updated = await applyManifestOperation(id, parseResult.data);
    await emitManifestUpdated(id, { source: 'user', ops: [parseResult.data] });
    return reply.send(updated);
  } catch (error: any) {
    return reply.status(400).send({ error: error.message });
  }
});
```

`getLockInfo` is already imported at line 14 of workspace-routes.ts.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/workspace/workspace-routes.ts
git commit -m "fix(workspace): reject manifest PATCH when AI holds the edit lock"
```

---

### Task 6: Add auth middleware to bundle serving route

The bundle serving route has no authentication — anyone with a project ID can download bundle files.

**Files:**
- Modify: `packages/api/src/workspace/workspace-routes.ts:172`

- [ ] **Step 1: Add preHandler to bundle route**

Change line 172 from:

```typescript
fastify.get('/projects/:id/workspace/bundle/*', async (request, reply) => {
```

To:

```typescript
fastify.get('/projects/:id/workspace/bundle/*', { preHandler: authMiddleware }, async (request, reply) => {
```

`authMiddleware` is already imported at line 17.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/workspace/workspace-routes.ts
git commit -m "fix(workspace): add auth middleware to bundle serving route"
```

---

### Task 7: Sanitize font module name in codegen

The font module name is derived from user input (manifest's `captionStyle.fontFamily`). Sanitize to prevent injection in generated TypeScript.

**Files:**
- Modify: `packages/api/src/workspace/workspace-codegen.ts:74`

- [ ] **Step 1: Add alphanumeric sanitization**

Replace line 74:

```typescript
// OLD:
const fontModuleName = captionFontFamily.replace(/\s+/g, '');

// NEW: Only allow alphanumeric characters (matches @remotion/google-fonts module naming)
const fontModuleName = captionFontFamily.replace(/[^a-zA-Z0-9]/g, '');
```

This strips spaces, quotes, slashes, dots, and any other characters that could create path traversal or injection in the generated import statement.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/workspace/workspace-codegen.ts
git commit -m "fix(codegen): sanitize font module name to prevent injection in generated imports"
```

---

### Task 8: Type `manifest` as `Manifest` in RenderJobData

Replace `unknown` with the proper `Manifest` type from `@viona/shared` and remove `as any` casts.

**Files:**
- Modify: `packages/worker/src/processors/render/types.ts`
- Modify: `packages/worker/src/processors/render/index.ts`

- [ ] **Step 1: Update the type**

In `packages/worker/src/processors/render/types.ts`, add the import and change the field:

```typescript
import type { Manifest } from '@viona/shared';
// ...
export interface RenderJobData {
  // ... existing fields ...
  /** Workspace manifest snapshot */
  manifest?: Manifest;
  // ...
}
```

- [ ] **Step 2: Update render/index.ts to remove casts**

In `packages/worker/src/processors/render/index.ts`, the `renderFromManifest` function casts `manifest as any` when accessing `.items`. With the proper type, replace:

```typescript
// OLD:
const allItems = (manifest as any).items || [];

// NEW:
const allItems = manifest.items || [];
```

The `Manifest` type propagates through `RenderJobData` — no separate import is needed in `index.ts`. After the truthiness guard (`if (!manifest || !bundlePath) return false`), TypeScript narrows `manifest` to `Manifest` automatically.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit --pretty false`

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/processors/render/types.ts packages/worker/src/processors/render/index.ts
git commit -m "fix(render): type manifest as Manifest instead of unknown"
```

---

### Task 9: Surface manifest op errors to the user

`dispatchManifestOp` silently swallows errors — the user gets no feedback when edits fail to persist.

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts:66-78`
- Modify: `apps/web/src/features/editor-v2/store/types.ts` (if `manifestSyncError` not already in state)

- [ ] **Step 1: Add error state field**

In `apps/web/src/features/editor-v2/store/types.ts`, check if there's a `manifestSyncError` field on `EditorState`. If not, add one:

```typescript
/** Error from last failed manifest operation dispatch */
manifestSyncError: string | null;
```

- [ ] **Step 2: Add initial state value**

In `editor-store.ts`, add to `initialState`:

```typescript
manifestSyncError: null,
```

- [ ] **Step 3: Update dispatchManifestOp to set error state**

Replace the `dispatchManifestOp` function:

```typescript
const dispatchManifestOp = async (op: StoreManifestOp): Promise<void> => {
  const state = useEditorStore.getState();
  if (state.workspaceStatus !== 'active' || !state.project) {
    return;
  }

  try {
    await api.applyManifestOp(state.project.id, op as any);
    // Clear any previous sync error on success
    if (useEditorStore.getState().manifestSyncError) {
      useEditorStore.setState({ manifestSyncError: null });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync edit';
    console.error('Failed to apply manifest op:', err);
    useEditorStore.setState({ manifestSyncError: message });
  }
};
```

- [ ] **Step 4: Add selector**

In `apps/web/src/features/editor-v2/store/use-editor-store.ts`, add:

```typescript
export const useManifestSyncError = () => useEditorStore((s) => s.manifestSyncError);
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts apps/web/src/features/editor-v2/store/editor-store.ts apps/web/src/features/editor-v2/store/use-editor-store.ts
git commit -m "fix(store): surface manifest op dispatch errors instead of swallowing silently"
```

---

### Task 10: Fix extractSceneId to handle workspace-remapped paths

After workspace scene remapping, scene files look like `scenes/comp_abc123/index.tsx` instead of `scenes/Scene3.tsx`. The regex needs to handle both formats.

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts:137-140`

- [ ] **Step 1: Update the function**

Replace:

```typescript
export function extractSceneId(sceneFile: string): number | undefined {
  const match = sceneFile.match(/Scene(\d+)\.tsx$/);
  return match ? parseInt(match[1], 10) : undefined;
}
```

With:

```typescript
/**
 * Extract a scene identifier from a scene file path.
 * Handles both formats:
 * - Legacy: "scenes/Scene3.tsx" → 3
 * - Workspace: "scenes/comp_abc123/index.tsx" → undefined (compositionId used instead)
 */
export function extractSceneId(sceneFile: string): number | undefined {
  // Legacy format: scenes/Scene3.tsx
  const legacyMatch = sceneFile.match(/Scene(\d+)\.tsx$/);
  if (legacyMatch) return parseInt(legacyMatch[1], 10);
  return undefined;
}

/**
 * Extract compositionId from a workspace-remapped scene file path.
 * "scenes/comp_abc123/index.tsx" → "comp_abc123"
 */
export function extractCompositionId(sceneFile: string): string | undefined {
  const match = sceneFile.match(/^scenes\/([^/]+)\/index\.tsx$/);
  return match ? match[1] : undefined;
}
```

- [ ] **Step 2: Verify no consumer changes needed**

`extractSceneId` already returns `undefined` for workspace paths, and all call sites handle `undefined` gracefully. The new `extractCompositionId` is exported for future use by the visual item editor when it needs to resolve composition IDs from workspace-remapped paths. No existing consumer needs updating.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty false`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/store/manifest-bridge.ts
git commit -m "fix(store): handle workspace-remapped scene paths in extractSceneId"
```

---

## Chunk 3: Suggestions

### Task 11: Use nanoid for split item IDs

Replace `Date.now().toString(36)` with `nanoid()` for collision-safe IDs.

**Files:**
- Modify: `packages/shared/src/manifest-ops.ts:143`

- [ ] **Step 1: Add nanoid import**

At the top of `packages/shared/src/manifest-ops.ts`, add:

```typescript
import { nanoid } from 'nanoid';
```

`nanoid` is not currently a dependency of `@viona/shared`. Install it:

```bash
cd packages/shared && npm install nanoid
```

- [ ] **Step 2: Replace the ID generation**

Change line 143:

```typescript
// OLD:
const newId = `${item.id}-${Date.now().toString(36)}`;

// NEW:
const newId = `split_${nanoid(10)}`;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/shared && npx tsc --noEmit --pretty false`

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/manifest-ops.ts packages/shared/package.json
git commit -m "fix(shared): use nanoid for split item IDs instead of Date.now()"
```

---

### Task 12: Add orphan workspace cleanup on API startup

After a process restart, workspace directories may exist on disk but the in-memory `activeWorkspaces` Map is empty. These orphaned workspaces will never be cleaned up.

**Files:**
- Modify: `packages/api/src/workspace/workspace-service.ts`

- [ ] **Step 1: Add cleanup function**

Add a new exported function at the bottom of `workspace-service.ts`:

```typescript
/**
 * Clean up orphaned workspace directories on startup.
 * Scans the workspace root for directories and tears them down
 * since they can't have valid in-memory state after a restart.
 */
export async function cleanupOrphanedWorkspaces(): Promise<void> {
  const rootDir = workspaceConfig.rootDir;
  try {
    await access(rootDir);
  } catch {
    return; // Root doesn't exist — nothing to clean
  }

  const { readdir } = await import('fs/promises');
  const entries = await readdir(rootDir);

  for (const entry of entries) {
    // Each subdirectory is a projectId
    try {
      console.log(`[workspace] Cleaning up orphaned workspace: ${entry}`);
      await db.update(projects)
        .set({ workspaceStatus: 'inactive' })
        .where(eq(projects.id, entry));
      await rm(join(rootDir, entry), { recursive: true, force: true });
      await forceReleaseLock(entry);
    } catch (err) {
      console.warn(`[workspace] Failed to clean up orphaned workspace ${entry}:`, err);
    }
  }
}
```

Make sure `access`, `rm`, and `join` are already imported (they should be).

- [ ] **Step 2: Call on API startup**

In `packages/api/src/index.ts`, add the import at the top and call after `fastify.listen()` (line 340):

```typescript
import { cleanupOrphanedWorkspaces } from './workspace/workspace-service.js';

// After line 340 (await fastify.listen({ port: config.port, host: '0.0.0.0' })):
cleanupOrphanedWorkspaces().catch((err) => {
  console.error('[startup] Failed to clean up orphaned workspaces:', err);
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit --pretty false`

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/workspace/workspace-service.ts packages/api/src/index.ts
git commit -m "fix(workspace): clean up orphaned workspace directories on API startup"
```

---

## Summary

| # | Severity | Fix | Lines Changed |
|---|---|---|---|
| 1 | Critical | Transaction in syncManifestToDb | ~5 |
| 2 | Critical | Bundler timeout cleanup + process tree kill | ~60 |
| 3 | Critical | Bundle content validation before eval | ~15 |
| 4 | Important | N+1 query → single inArray | ~5 |
| 5 | Important | Lock check on PATCH manifest | ~5 |
| 6 | Important | Auth on bundle serving route | ~1 |
| 7 | Important | Sanitize font module name | ~1 |
| 8 | Important | Type manifest as Manifest | ~5 |
| 9 | Important | Surface manifest op errors | ~15 |
| 10 | Important | Fix extractSceneId for workspace paths | ~15 |
| 11 | Suggestion | nanoid for split IDs | ~3 |
| 12 | Suggestion | Orphan workspace cleanup on startup | ~25 |

**Total: ~155 lines changed across 12 tasks**
