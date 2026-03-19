# Agent Pipeline Issues — 2026-03-19

Issues discovered during live testing of project `a6fe2cfd` (Swimming Coach Promo, 64s video, 11 scenes).

---

## 1. Orchestrator Skips Subagent Dispatch (Critical)

**Problem**: Viona does all work herself instead of dispatching the 6 subagents (Trim Editor, Planner, Setup Agent, Layout Editor, Animator, Final Editor). She manually:
- Added 12 caption items (should be Trim Editor)
- Wrote SCENE_PLAN.md (should be Planner)
- Created constants.ts + Background.tsx (should be Setup Agent)
- Added scene items to manifest (should be Layout Editor)
- Wrote all 11 scene .tsx files (should be Animators in parallel)

**Impact**:
- Single-context execution: 9,344 messages, 64 turns, $3.05 total across 3 sessions
- No parallelism — scenes written sequentially instead of 11 parallel Animator dispatches
- Context pollution — orchestrator holds all scene code in memory
- The entire pipeline redesign (7-agent architecture) is bypassed

**Root Cause**: The `agents` config is passed to the SDK and the `Agent` tool is in `allowedTools`, but the model chooses to use `Write` / MCP tools directly rather than dispatching subagents. Per [Claude Agent SDK docs](https://platform.claude.com/docs/en/agent-sdk/subagents), subagents require the `Agent` tool in `allowedTools` — but having _other_ execution tools alongside it lets the model bypass delegation entirely. The [SDK best practices](https://skywork.ai/blog/claude-agent-sdk-best-practices-ai-agents-2025/) confirm: "By limiting the orchestrator's tools to just reading and routing (excluding execution tools), you force it to delegate actual work to subagents."

**Fix** (researched):
1. **Remove execution tools from orchestrator's `allowedTools`**: Keep only `Read`, `Glob`, `Grep`, `Agent`, and MCP tools for manifest reading / widgets / analysis. Remove `Write`, `Edit`, `Bash`, and all scene MCP tools (`mcp__scenes__*`). The orchestrator can read but not write — forcing delegation.
2. **Set `permissionMode: "dontAsk"`** on the orchestrator: Per [SDK permissions docs](https://platform.claude.com/docs/en/agent-sdk/permissions), this denies any tool not in `allowedTools` outright instead of prompting. The model physically cannot use `Write` even if it wants to.
3. **Explicit tool call examples in prompt**: Per SDK docs, "mention the subagent by name in your prompt" — add concrete `Agent` tool call examples showing how to dispatch each subagent type.
4. **Never include `Agent` in a subagent's own tools**: Subagents can't spawn their own subagents — this prevents recursion.

---

## 2. Manifest `data.src` vs `data.sceneFile` Mismatch (Critical)

**Problem**: The orchestrator creates scene items with `data: { src: "SceneName.tsx" }` but the player's `SceneItem.tsx` reads `data.sceneFile`. Result: "Scene not found" in preview.

**Root Cause**: The `add_item` tool accepts `data: object` with zero type-specific validation. The Zod schema at `manifest-v2.ts:88-90` defines `sceneItemDataV2Schema = z.object({ sceneFile: z.string() })`, but this schema is never enforced at write time. The agent uses the field name `src` (which is what video/audio items use), and the tool happily stores it.

**Locations**:
- Schema: `packages/shared/src/manifest-v2.ts:88-90`
- Player lookup: `packages/sandbox/template/src/items/SceneItem.tsx:25-27`
- Manifest tool: `packages/sandbox/src/tools/manifest-ops.ts` (`add_item`)

**Fix** (researched):
1. **Validate with Zod `safeParse` at write time**: Use Zod's [discriminated union](https://zod.dev/api#discriminated-unions) — the existing `manifestItemV2Schema` already discriminates on `type`. In `add_item`, call `safeParse` against the type-specific data schema and return a clear error with field-level issues if validation fails. The agent gets feedback like `"Invalid data for scene item: sceneFile is required"` and can self-correct.
2. **Defensive fallback in `SceneItem.tsx`**: `const sceneFile = data.sceneFile || (data as any).src` — catches the mismatch at render time as a safety net.
3. **Document field names in tool description**: Update `add_item`'s description to list required fields per type (e.g., `scene: { sceneFile: string }`, `caption: { words: CaptionWord[] }`).

---

## 3. Chokidar File Watcher Broken on Docker Desktop Windows (Medium)

**Problem**: The esbuild watcher uses chokidar with `inotify` to detect file changes in `/workspace/src/`. On Docker Desktop for Windows, `inotify` events are NOT propagated through the 9P/grpcfuse filesystem layer for bind-mounted volumes.

**Impact**: After writing scene files, the bundle is never automatically rebuilt. The agent must manually call `trigger_rebuild` via MCP tool.

**Evidence**:
- Only 1 automatic build at startup (version 1)
- 13+ files written (constants.ts, Background.tsx, 11 scenes) — zero automatic rebuilds
- Agent self-healed by calling `trigger_rebuild` (version 2), but only after noticing stale render stills

**Root Cause** (researched): This is a [well-known Docker Desktop limitation](https://github.com/docker/for-win/issues/8479). Per Docker's [WSL2 best practices](https://docs.docker.com/desktop/features/wsl/best-practices/): "Linux containers only receive inotify events if the original files are stored in the Linux filesystem." Bind-mounted Windows paths (`/mnt/c/...`) go through 9P/grpcfuse which doesn't propagate inotify. [The standard workaround](https://syntackle.com/blog/the-issue-of-watching-file-changes-in-docker/) is to enable polling via `CHOKIDAR_USEPOLLING=true` — but polling wastes CPU and is still latency-bound.

**Location**: `packages/sandbox/src/esbuild-watcher.ts:120-141`

**Fix** (researched):
1. **Primary: Trigger rebuild in `write_scene_file` tool** — call `triggerRebuild()` explicitly after `writeFile()`. This is deterministic and doesn't depend on filesystem events. Already implemented.
2. **Fallback: `usePolling: true`** in chokidar config for safety (catches manual file edits). Set `interval: 2000` to minimize CPU.
3. **Long-term: Move workspace to WSL2 filesystem** (`/home/...` instead of `/mnt/c/...`) — inotify works natively there. Per Docker docs, this is the recommended approach.

---

## 4. MinIO Presigned URL Failure in Container (Low)

**Problem**: Asset sync uploads files to MinIO successfully but fails to generate presigned URLs: `connect ECONNREFUSED 127.0.0.1:9000`.

**Root Cause** (researched): The `getMinioUrlClient()` in `asset-sync.ts:34-46` rewrites `host.docker.internal` → `localhost` for browser-accessible URLs. But `presignedGetObject()` in the minio-js SDK actually [makes a network call to the endpoint](https://github.com/minio/minio-js/issues/514) to sign the URL — it's not just a local signing operation. Inside the container, `localhost:9000` resolves to the container itself, not the host where MinIO runs. Per the [MinIO Docker presigned URL guide](https://medium.com/@codyalexanderraymond/solving-presigned-url-issues-in-dockerized-development-with-minio-internal-dns-61a8b7c7c0ce), the fix requires two separate endpoint configurations: one for internal access (upload) and one for external URL generation.

**Impact**: `assets` map in manifest is empty (`assetCount: 0`).

**Location**: `packages/sandbox/src/asset-sync.ts:34-46`

**Fix** (researched):
1. **Use `MINIO_SERVER_URL` env var**: MinIO supports [setting `MINIO_SERVER_URL`](https://github.com/minio/minio/issues/10222) to control the base URL in presigned URLs. Set this to the browser-accessible URL (e.g., `http://localhost:9000`).
2. **Two MinIO clients with correct endpoints**: Keep `getMinioClient()` using `host.docker.internal` for uploads (container→host). For `getMinioUrlClient()`, use `host.docker.internal` too (since signing requires network access), then string-replace the hostname in the final URL to `localhost` for browser access.
3. **Or: Generate presigned URLs on the API server** (not inside the container) — the API server can reach MinIO at `localhost:9000` directly.

---

## 5. Esbuild Warnings on Scene Registry Imports (Low)

**Problem**: After rebuild, esbuild emits warnings for each scene:
```
Import "Scene9_CallToAction" will always be undefined because there is no matching export
```

**Root Cause** (researched): Per [esbuild issue #3271](https://github.com/evanw/esbuild/issues/3271), `import * as mod from "..."` creates a Module Namespace Exotic Object per the JS spec. When the registry code accesses `mod.SceneName`, esbuild knows at compile time that this named export doesn't exist (only `default` does), so it warns. The `||` fallback chain evaluates at runtime, but esbuild's static analysis correctly flags the dead branch.

**Location**: `packages/sandbox/src/scene-registry-generator.ts`

**Fix** (researched):
1. **Use default imports instead of wildcard**: Change `import * as mod from './scenes/X'` to `import X_default from './scenes/X'`. This directly imports the default export without creating a namespace object. Already implemented in the codebase fix.
2. **Alternative: Suppress with `--log-override:import-is-undefined=silent`** — but this hides real errors, not recommended.
3. **Convention**: All scenes MUST use `export default`. The CLAUDE.md in the workspace already documents this convention.

---

## 6. SSE Client Disconnects During Long Operations (Informational)

**Problem**: The SSE client disconnects mid-operation (observed at messageCount 608 in Session 1 and at completion of Session 3). The agent server logs: `"SSE client disconnected — orchestrator continues"`.

**Impact**: None — by design. The orchestrator continues running and pushes state via API callbacks (Redis). Frontend reconnects and sees the final state. But the user loses real-time streaming text during the disconnection window.

**Root Cause**: Browser/frontend SSE connection timeout, page navigation, or tab sleep.

**Note**: The disconnect-resilient design works correctly. The agent doesn't abort.

---

## 7. `add_item` Has No Type-Specific Data Validation (Critical)

**Problem**: The `add_item` MCP tool accepts any `data` object for any item type. Caption items require `data.words: CaptionWord[]` (per `captionItemDataV2Schema`), but the tool stores whatever the agent passes. When the orchestrator creates caption items with `data: { text: "..." }` instead of `data: { words: [...] }`, the player crashes at runtime: `Cannot read properties of undefined (reading 'map')`.

**Root Cause**: `packages/sandbox/src/tools/manifest-ops.ts:224-296` — `add_item` takes `data: object` and stores it as-is. The Zod schemas exist but are never enforced. This is the same class of bug as Issue #2. Per [Zod best practices](https://zod.dev/api#discriminated-unions), discriminated unions with `safeParse` are the standard pattern for validating polymorphic data at runtime.

**Crash Location**: `packages/sandbox/template/src/items/CaptionItem.tsx:33` — `data.words.filter(...)` where `data.words` is `undefined`.

**Fix** (researched):
1. **Type-discriminated validation in `add_item`**: Import the per-type Zod schemas from `@viona/shared/manifest-v2.js`. Build a `Record<string, ZodSchema>` map. Before storing, call `schema.safeParse(input.data)` — if it fails, return the Zod error formatted as a string so the agent can self-correct. Use `result.data` (with defaults applied) if it passes. Already implemented in the codebase fix.
2. **Defensive null checks in components**: `CaptionItem.tsx`: `if (!data.words || !Array.isArray(data.words)) return null;`. Already implemented.
3. **Update `add_item` tool description**: List required fields per type in the description so the agent knows what to pass.

---

## 8. No Pre-Completion Validation Gate (Critical — Architectural)

**Problem**: The orchestrator finishes without verifying that the workspace is in a working state. No TypeScript compilation check, no test render, no manifest schema validation. The user sees the broken result first.

**Root Cause**: The 7-agent architecture includes validation in subagent prompts (Animator runs `render_still`, Final Editor does QA), but the orchestrator bypassed all subagents (Issue #1). Even if subagents were used, there's no hard gate — validation is advisory, not enforced.

**What should happen before the orchestrator returns "done"**:
1. `tsc --noEmit` on the workspace — catches type errors, undefined imports
2. [`npx remotion still`](https://www.remotion.dev/docs/cli/still) on at least the first and last scene — catches runtime crashes (like the `.map()` error). The CLI renders a single frame as PNG: `npx remotion still entry.tsx CompositionId --frame=10 out.png`
3. Manifest schema validation via `manifestV2Schema.safeParse()` — catches missing/wrong fields

**Fix** (researched):
1. **New `validate_workspace` MCP tool**: Runs all 3 checks in sequence. Returns structured results: `{ tsc: pass/fail, renders: [{scene, pass/fail, error}], schema: pass/fail }`. Per [Remotion docs](https://www.remotion.dev/docs/troubleshooting/debug-failed-render), `render_still` exits non-zero on runtime errors — perfect for validation.
2. **Hard gate via SDK hooks**: Per [Claude Agent SDK hooks](https://platform.claude.com/docs/en/agent-sdk/hooks), use an `afterToolCall` hook to detect when the orchestrator tries to complete. If `validate_workspace` hasn't been called yet, inject a reminder. This is defense-in-depth beyond just prompt instructions.
3. **Post-orchestrator validation on the API server**: After the orchestrator finishes, the API reads the manifest from the container and runs `manifestV2Schema.safeParse()`. If it fails, re-invoke with the error list.

---

## 9. `update_manifest` Replaces Entire Manifest — Agent Wipes Own Work (Critical)

**Problem**: The `update_manifest` MCP tool replaces the entire manifest with whatever object is passed. The orchestrator called it with `{ assets: {} }` (likely intending a partial update), wiping all tracks, items, and timing data it had built up over 64 turns.

**Root Cause**: `packages/sandbox/src/tools/manifest-ops.ts:551` — `await writeFile(MANIFEST_PATH, JSON.stringify(input.manifest, null, 2))`. No merge, no safety check, no required fields validation.

**Impact**: Total data loss. All tracks, items, scene references, caption data, and timing — gone.

**Fix** (researched):
1. **Remove `update_manifest` entirely**: Force the agent to use granular tools (`add_item`, `update_item`, `add_track`, `update_caption_style`). No single tool call should be able to wipe the entire manifest. This is the safest option.
2. **If kept — backup before overwrite**: Per [write-file-atomic](https://www.npmjs.com/package/write-file-atomic) pattern, write to a temp file first, then rename. Also save `manifest-backup.json` before every full replace. Per [crash-safe JSON patterns](https://dev.to/constanta/crash-safe-json-at-scale-atomic-writes-recovery-without-a-db-3aic), keep a rolling `.bak` that survives write failures.
3. **If kept — validate input**: Require `version`, `tracks`, `items` fields. Reject if the new manifest has fewer items than the current one (likely an accidental wipe). Add a `force: true` flag to bypass this check if the agent explicitly intends to reduce items.

---

## 10. `syncAssets` Races With Manifest Lock — Concurrent Write Corruption (High)

**Problem**: `syncAssets()` in `asset-sync.ts:96-104` reads and writes `manifest.json` **outside** the `withManifestLock()` mutex that all other manifest tools use. Every esbuild rebuild calls `syncAssets()`. If the agent calls `add_item` while a rebuild is in progress:

1. `syncAssets` reads manifest (version A)
2. `add_item` reads + writes manifest (version B with new item)
3. `syncAssets` writes manifest (version A with updated assets) — **overwrites the new item silently**

**Root Cause** (researched): Classic [async read-modify-write race condition](https://nodejsdesignpatterns.com/blog/node-js-race-conditions/). While JavaScript is single-threaded, any `await` between read and write creates a window for interleaving. Per [async-mutex docs](https://www.npmjs.com/package/async-mutex), "the asynchronous nature of JavaScript's execution model allows for race conditions that require synchronization primitives."

**Locations**:
- Race window: `packages/sandbox/src/asset-sync.ts:96-104`
- Lock implementation: `packages/sandbox/src/tools/manifest-ops.ts:29-39`
- Trigger: `packages/sandbox/src/esbuild-watcher.ts:56` (`await syncAssets()` inside `doBuild()`)

**Fix** (researched):
1. **Export `withManifestLock` and use it in `syncAssets`**: Import the lock from `manifest-ops.ts`, wrap the read-modify-write in `syncAssets` with it. This ensures mutual exclusion with all manifest tools. Simple, minimal change.
2. **Alternative: In-memory assets map**: Have `syncAssets` update an in-memory `Map<string, string>` instead of writing to the file. The next `writeManifest()` call merges assets from this map. Eliminates the file-level race entirely.
3. **Alternative: Use [async-mutex](https://github.com/DirtyHairy/async-mutex) npm package**: Replace the hand-rolled promise-chain lock with a proper `Mutex` instance shared between `manifest-ops.ts` and `asset-sync.ts`. Cleaner API, supports timeout, reentrant variants.

---

## 11. Incorrect Spatial Layout — Horizontal Instead of Vertical Stack (Critical)

**Problem**: The preview shows the source video and animated scene placed **side-by-side horizontally** on a 1080x1920 portrait canvas. The correct layout is **vertically stacked** per the Layout Editor's own prompt.

**Evidence**: Screenshot shows the scene (dark blue with "scene not found" text) occupying the left ~50% and the source video (speaker in white shirt) occupying the right ~50%.

**Root Cause** (researched): The orchestrator bypassed the Layout Editor subagent (Issue #1). The Layout Editor prompt at `packages/sandbox/src/prompts/layout-editor/system.md` defines three display modes with **exact pixel values** for the 1080x1920 canvas:

- **Split-screen (default, 55/45)**: Scene at `{ x: 0, y: 0, width: 1080, height: 1056 }`, speaker at `{ x: 0, y: 1056, width: 1080, height: 864 }` — **vertical stack**
- **Fullscreen**: Scene fills entire canvas, speaker opacity: 0
- **Overlay**: Scene rendered at natural dimensions, never covering speaker's face (top 40%) or captions (bottom 15%)

The prompt loader injects `{{STACKED_VISUAL_HEIGHT}}` = `canvasHeight * 0.55` = 1056px. The orchestrator prompt says to use "vertical stacking" but doesn't include the pixel-level detail the Layout Editor has.

**Impact**: Even if all other bugs were fixed, the video would still be unwatchable.

**Fix** (researched):
1. **Fix Issue #1** — the Layout Editor subagent has all the layout knowledge and pixel-level conventions. It reads `speaker-grid.json` for face position, applies display mode per scene, and verifies with `render_still`.
2. **Add layout fallback in orchestrator prompt**: If the orchestrator ever does layout itself (e.g., Layout Editor fails), include the default split-screen transforms as a reference: scene top 55%, speaker bottom 45%.
3. **Validate layout in `validate_workspace` tool (Issue #8)**: Render a still and check that the speaker is visible and not cropped. A simple heuristic: if any visual item's transform puts it outside the canvas bounds, flag it.

---

## 12. Manifest Not Persisted to DB During Agent Run (High)

**Problem**: The agent modifies `manifest.json` inside the container via `add_item`/`add_track` tools, but these changes are **never synced back to the database** during the run. If the container dies or the manifest gets wiped (Issue #9), all agent work is lost.

**Root Cause** (researched): The checkpoint system (`manifest-checkpoint.ts`) POSTs to S3, and `syncManifestToDb()` only runs on suspend. Per [LangGraph's persistence pattern](https://docs.langchain.com/oss/python/langgraph/persistence), the industry standard for long-running agents is to "persist workflow state at every node transition" — if a workflow fails at step 7 of 10, it resumes from step 7. Per [AWS's durable agents guide](https://aws.amazon.com/blogs/database/build-durable-ai-agents-with-langgraph-and-amazon-dynamodb/), "with long-running tasks failing up to 30% of the time, proper checkpointing can save over 60% of wasted processing."

**Impact**: 64 turns of agent work irrecoverable after manifest wipe. The DB still had only the original 2 items (video + audio).

**Fix** (researched):
1. **Checkpoint manifest to DB on every N writes**: Add a write counter in `manifest-ops.ts`. Every 5th `writeManifest()` call, POST the manifest to the API's checkpoint endpoint which also calls `syncManifestToDb()`. Low overhead, high durability.
2. **Checkpoint on agent completion**: In the orchestrator callback (`agent-server.ts`), always `POST /checkpoint` with the final manifest before returning success. This guarantees the DB has the latest state.
3. **Use `write-file-atomic` for crash safety**: Per [write-file-atomic](https://github.com/npm/write-file-atomic), write manifest to a temp file + atomic rename. If the process crashes mid-write, the old manifest survives intact rather than being corrupted.
4. **Recovery fallback**: On container boot, if `manifest.json` is empty/corrupt, check S3 checkpoint first, then `manifest-original.json`. Log a warning so the user knows recovery happened.

---

## Summary Table

| # | Issue | Severity | Root Cause | Fix Effort |
|---|-------|----------|------------|------------|
| 1 | Orchestrator skips subagents | Critical | Execution tools in orchestrator's allowedTools | Medium (remove tools + permissionMode: dontAsk) |
| 2 | `data.src` vs `data.sceneFile` | Critical | No type-specific validation in add_item | Small (Zod safeParse + fallback) |
| 3 | Chokidar watcher broken on Windows | Medium | Docker Desktop 9P doesn't propagate inotify | Small (triggerRebuild in write_scene_file) |
| 4 | MinIO presigned URL failure | Low | URL client uses localhost inside container | Small (use host.docker.internal for signing) |
| 5 | Esbuild scene registry warnings | Low | Wildcard import on default-only modules | Trivial (use default import) |
| 6 | SSE disconnect during operations | Info | By design | None needed |
| 7 | `add_item` no data validation | Critical | Tool accepts any `data` object | Small (Zod safeParse per type) |
| 8 | No pre-completion validation gate | Critical | No tsc/render/schema check before done | Medium (new MCP tool + SDK hooks) |
| 9 | `update_manifest` wipes manifest | Critical | Full replace, no safety check | Small (remove tool entirely) |
| 10 | `syncAssets` races with manifest lock | High | No mutex on read-modify-write | Small (export + use withManifestLock) |
| 11 | Horizontal layout instead of vertical | Critical | Orchestrator skipped Layout Editor subagent | Depends on #1 (Layout Editor has exact pixel rules) |
| 12 | Manifest not synced to DB during run | High | Only checkpoints to S3, not DB | Small (checkpoint to DB every N writes) |

---

## Sources

- [Claude Agent SDK — Subagents](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Claude Agent SDK — Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [Claude Agent SDK — Hooks](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [Claude Agent SDK Best Practices](https://skywork.ai/blog/claude-agent-sdk-best-practices-ai-agents-2025/)
- [Docker Desktop — WSL2 Best Practices](https://docs.docker.com/desktop/features/wsl/best-practices/)
- [Docker for Windows — inotify not working (Issue #8479)](https://github.com/docker/for-win/issues/8479)
- [Chokidar Docker File Watching](https://syntackle.com/blog/the-issue-of-watching-file-changes-in-docker/)
- [MinIO Presigned URLs in Docker](https://medium.com/@codyalexanderraymond/solving-presigned-url-issues-in-dockerized-development-with-minio-internal-dns-61a8b7c7c0ce)
- [MinIO — Set default URL for presignedUrl (Issue #514)](https://github.com/minio/minio-js/issues/514)
- [Esbuild — import-is-undefined warning (Issue #3271)](https://github.com/evanw/esbuild/issues/3271)
- [Zod — Discriminated Unions](https://zod.dev/api#discriminated-unions)
- [Remotion — npx remotion still](https://www.remotion.dev/docs/cli/still)
- [Remotion — Debug Failed Renders](https://www.remotion.dev/docs/troubleshooting/debug-failed-render)
- [write-file-atomic (npm)](https://www.npmjs.com/package/write-file-atomic)
- [Crash-safe JSON at Scale](https://dev.to/constanta/crash-safe-json-at-scale-atomic-writes-recovery-without-a-db-3aic)
- [async-mutex (npm)](https://www.npmjs.com/package/async-mutex)
- [Node.js Race Conditions](https://nodejsdesignpatterns.com/blog/node-js-race-conditions/)
- [LangGraph — Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Durable AI Agents with DynamoDB](https://aws.amazon.com/blogs/database/build-durable-ai-agents-with-langgraph-and-amazon-dynamodb/)
