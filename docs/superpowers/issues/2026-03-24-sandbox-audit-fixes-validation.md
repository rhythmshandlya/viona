# Sandbox Audit Fixes Validation — 2026-03-24

Live investigation of project `7ae7f428-711d-431e-a191-1cf421e7a4af` ("use magazine animations", Algeria exam cheating topic, blackboard theme).

Container: `sandbox-7ae7f428-711d-431e-a191-1cf421e7a4af` (healthy, `viona-sandbox:latest`)
Session: `2a8cbed7-328b-464a-927e-bd9228daf6be`

### Timeline
- **Phase 1 (Planning):** 9 min, $2.24, 55 tools, 19 turns — plan produced, widget shown for approval
- **Phase 2 (Post-approval):** Plan approved at 05:01. Setup Agent + Layout Editor completed. 7 Animator subagents dispatched in parallel. Pipeline actively running at 05:23+ with multiple `remotion still` renders.
- **Result so far:** 7 scene skeleton files written, 7 scene items in manifest, **all stills are black frames (34,418 bytes each)**, 0 templates forked

---

## LIVE-1: Pipeline stopped after Phase 3 — no scenes until plan approval (RESOLVED — by design)

**UPDATE:** After the user approved the plan (at 05:01), the pipeline resumed and dispatched Setup Agent, Layout Editor, and 7 Animator subagents in parallel. The Phase 3 stop was the expected plan approval checkpoint.

**Remaining concern:** The planning phase costs $2.24 and takes 9 minutes before any content is generated. The orchestrator micromanages after the Planner returns (see LIVE-5, LIVE-6).

---

## LIVE-2: Theme always defaults to blackboard — no selection mechanism (HIGH)

**Impact:** User prompt was "use magazine animations" but the workspace was initialized with `blackboard` theme. The Planner found no magazine templates: *"No matching scene templates found in registry."*

**Evidence — 3 layers of the same bug:**

1. **No theme selection UI** — the frontend has no widget/picker for theme selection before generation starts
2. **`buildInitData()` never sends `theme`** — `packages/api/src/sandbox/routes.ts` line 502-535 builds the init payload but never populates the `theme` field, even though `InitPayload` defines it
3. **Workspace-init defaults to blackboard** — `packages/sandbox/src/workspace-init.ts` line 432: `const activeTheme = payload.theme || 'blackboard'`

**Root cause trace:**
```
User types "use magazine animations"
→ Frontend creates project (no theme in video_settings)
→ API buildInitData() assembles payload (no theme field set)
→ Sandbox initWorkspace() defaults to blackboard
→ Planner searches for magazine templates with blackboard filter
→ 0 results → "All scenes will be built from scratch"
```

**Fix needed (multi-layer):**
1. **Orchestrator intelligence** — The orchestrator should be smart enough to detect theme intent from the user brief and either switch themes or search across themes. If the user says "use magazine animations", the orchestrator should override the default theme.
2. **`buildInitData()` should read theme** — Extract from `video_settings.theme` or default based on project context
3. **Future: Theme picker widget** — Show theme selection in the plan approval widget so users can confirm/change before generation starts

---

## LIVE-3: Workspace node_modules symlinks to sandbox deps (HIGH — CONFIRMED IN LIVE)

**Impact:** The running container has `/workspace/node_modules → /app/node_modules`. This means:
- **Zod 4.3.6** in workspace (Remotion requires 3.22.3 — will crash on render)
- **React 18.3.1** in workspace (template expects React 19.2.3)
- **TypeScript MISSING** — `npx tsc` downloads wrong package `tsc@2.0.4`

**Evidence:**
```
/workspace/node_modules -> /app/node_modules
Zod version: 4.3.6
React version: 18.3.1
tsc.js: MISSING
```

**Status:** Fix already applied locally (Dockerfile installs template deps separately, workspace-init changed symlink target to `/app/template/node_modules`). Needs image rebuild.

---

## LIVE-4: Shared prompt modules not copied to workspace (MEDIUM)

**Impact:** `/workspace/docs/shared/` directory exists but is EMPTY. All 4 copy attempts in workspace-init silently failed because the filenames are stale.

**Evidence:**
```
Container logs:
  "Shared module technical-rules.md not found — skipping"
  "Shared module motion-design-principles.md not found — skipping"
  "Shared module vocabulary.md not found — skipping"
  "Shared module quality-checklist.md not found — skipping"

Actual files at /app/dist/prompts/shared/:
  identity.xml, tool-usage.xml, manifest-tools.xml, quality-rules.xml, motion-design.xml
```

**Status:** Fix already applied locally (updated filenames + source path in workspace-init.ts). Needs image rebuild.

---

## LIVE-5: Orchestrator browses templates 8x individually (MEDIUM — CONFIRMED)

**Impact:** After Planner returned at msg 1202, the orchestrator called `browse_templates` 8 times in rapid succession (msg 1245-1263) with ~400ms between calls. This is the orchestrator repeating work the Planner already did.

**Evidence:**
```
1774327840581 browse_templates  msg 1245
1774327841475 browse_templates  msg 1248
1774327841895 browse_templates  msg 1251
1774327842372 browse_templates  msg 1254
1774327842814 browse_templates  msg 1257
1774327843322 browse_templates  msg 1260
1774327847198 browse_templates  msg 1263
```

**Root cause:** Orchestrator prompt doesn't instruct it to trust the Planner's template search results. It re-does the search itself before proceeding.

**Fix needed:**
1. Orchestrator prompt should say: "After Planner returns, read SCENE_PLAN.md — do NOT re-browse templates. The Planner already searched."
2. Or: add `list_templates` bulk tool so it's 1 call instead of 8

---

## LIVE-6: Orchestrator does manual Read/Write/Edit after Planner (MEDIUM)

**Impact:** After the Planner subagent returned, the orchestrator made 30+ sequential tool calls: reading SCENE_PLAN.md, reading the manifest, using Grep/Glob, writing and editing SCENE_PLAN.md, and validating the timeline. This is work the Planner should have completed, or that should be delegated to the Setup Agent.

**Evidence (tool calls after Planner at msg 1202):**
```
msg 1209-1278: 12x Read (SCENE_PLAN, manifest, templates, transcript)
msg 1281: Write (rewrote something)
msg 1284: validate_timeline
msg 1287-1305: 5x Read
msg 1290-1296: 3x Edit (edited SCENE_PLAN.md)
msg 1329: Read (last tool before 3000-msg gap)
```

The orchestrator is **micromanaging** — it should dispatch subagents and read only results, not re-do their work.

**Root cause:** Orchestrator `allowedTools` includes `Read`, `Write`, `Edit`, `Glob`, `Grep` — giving it the ability to do manual work instead of delegating.

**Fix options:**
1. Remove `Write` and `Edit` from orchestrator's `allowedTools` — force delegation
2. Add stronger prompt instruction: "After each subagent returns, read only the result summary. Do NOT edit files directly. Dispatch the next subagent."

---

## LIVE-7: Git dubious ownership in workspace (LOW)

**Impact:** Running `git` commands as root inside the container fails with `fatal: detected dubious ownership in repository at '/workspace'`. The workspace is owned by `sandbox:sandbox` but `docker exec` runs as root.

**Evidence:**
```bash
docker exec ... git log
# fatal: detected dubious ownership in repository at '/workspace'
```

**Status:** Non-blocking for pipeline (the sandbox process runs as `sandbox` user). Only affects debugging via `docker exec`. The `initGitRepo()` function correctly calls `git config --global --add safe.directory /workspace` but only for the `sandbox` user, not root.

---

## LIVE-8: generation-progress.json never updated (LOW)

**Impact:** The `generation-progress.json` file still shows `"phase": "initialized"` even though the orchestrator completed Phases 1-3. No code updates this file during the pipeline.

**Evidence:**
```json
{
  "phase": "initialized",
  "planApproved": false,
  "totalScenes": 0,
  "completedScenes": [],
  "lastError": null,
  "updatedAt": "2026-03-24T04:47:30.178Z"
}
```

**Root cause:** `generation-progress.json` is written during `initWorkspace()` but never updated by the orchestrator or any subagent. It's a dead file.

**Fix:** Either update it from `orchestrator.ts` at phase boundaries, or remove it if unused.

---

---

## LIVE-9: All render_still outputs are black frames (CRITICAL)

**Impact:** Every `remotion still` render produces a 34,418-byte black PNG regardless of frame number. The animators are writing scene code and validating with render_still, but the validation images are all black — the animators cannot see their own work.

**Evidence:**
```
still-0.png:              34,418 bytes (05:12)  ← black
still-60.png:             34,418 bytes (05:04)  ← black
still-90.png:             34,418 bytes (05:05)  ← black
validate-still-86.png:    34,418 bytes (05:09)  ← black
```
All identical file sizes across different frames/times. Visual inspection confirms solid black.

**Root cause analysis:**
The `remotion still` commands in the process list are invoked **directly via Bash** (by the orchestrator/animators), NOT via the `render_still` MCP tool:
```
remotion still src/Root.tsx MainComposition /workspace/.build/still-50.png --frame=50
```
Note: **no `--props` flag**. The MCP `render_still` tool adds `--props=render-props.json` which bypasses the broken `calculateMetadata`, but direct Bash calls don't get this.

The `calculateMetadata` in `Root.tsx` calls `fetch(staticFile('manifest.json'))` which works (manifest.json exists as symlink in public/). However, the video `src: "source.mp4"` likely cannot be loaded by headless Chromium in the rendering context, producing black frames for the video layer. The scene overlays may render but are small (800x480 overlay on 1080x1920 canvas) and positioned at specific coordinates — at frame 0, Scene1 hasn't started its animation yet, so it appears transparent/invisible on the black background.

**Fix needed:**
1. Animators/orchestrator should use `render_still` MCP tool instead of direct `remotion still` Bash commands
2. Or: the `render_still` tool command should be the ONLY way to render stills (remove `Bash` from animator allowedTools, or add prompt instruction)
3. The render_still MCP tool's `--props` bypass DOES work — the problem is that it's not being used

---

## LIVE-10: Container resource exhaustion from parallel renders (HIGH)

**Impact:** Multiple concurrent `remotion still` processes overwhelm the container: **223% CPU, 2GB/3.8GB RAM, 447 PIDs**. Each render spawns a Chrome headless instance + esbuild bundler. Docker exec commands fail with "procReady not received" during peak load.

**Evidence:**
```
docker stats:
  CPU: 223.46%
  MEM: 1.964GiB / 3.829GiB (51%)
  PIDs: 447

Process list shows:
  5+ simultaneous remotion still processes
  5+ Chrome headless instances
  5+ esbuild workers
```

**Root cause:** 7 Animator subagents all dispatch render_still/Bash render commands concurrently. Each Remotion still render launches Chrome, which alone uses 200-300MB RAM and significant CPU. With 5+ running simultaneously, the container is at capacity.

**Fix needed:**
1. Rate-limit concurrent renders — use a semaphore/queue (max 2 concurrent renders)
2. Or: orchestrator should dispatch animators in batches of 2-3, not all 7 at once
3. Or: increase container resources (currently 4GB RAM is barely enough for 3 concurrent renders)

---

## LIVE-11: No templates forked — all scenes built from scratch (HIGH)

**Impact:** Despite 20+ magazine templates being available in the registry, zero templates were forked. All 7 scenes were written from scratch as skeleton placeholders. The scene code is basic placeholder text with minimal animation.

**Evidence:**
```
Scene1.tsx: 3,395 bytes — placeholder "EXTREME MEASURES" text with basic spring
Scene7.tsx: 6,952 bytes — most complex, has comparison layout
All scenes import from '../constants' and '../hooks/useScale'
No fork_template calls in the session
```

**Root cause:** LIVE-2 (theme mismatch). The `browse_templates` tool filters by the active theme. Since the workspace theme is `blackboard` but the user wanted `magazine`, no templates matched, so the Planner/Setup Agent decided to build everything from scratch.

**Impact chain:** LIVE-2 → LIVE-11 → poor visual quality (scenes are skeletons, not polished template-based animations)

---

## LIVE-12: Scene skeletons are placeholders, not production animations (MEDIUM)

**Impact:** The 7 scene files written by the Setup Agent are explicitly marked as "skeleton placeholder" code. They contain basic text rendering with spring/interpolate animations but lack the detailed multi-phase animations described in SCENE_PLAN.md.

**Evidence (Scene1.tsx):**
```tsx
{/* Placeholder text -- Animator will replace with full animation */}
```
The comments indicate these are intended as starting points for Animator subagents to flesh out. The animators ARE running (7 parallel), but whether they successfully replace these skeletons depends on the render_still validation (which produces black frames — LIVE-9).

**Risk:** If animators can't see their renders (LIVE-9), they may accept skeleton quality as "good enough" or enter debugging loops trying to fix invisible renders.

---

## LIVE-13: SCENE_PLAN.md at wrong path — /workspace/docs/ not /workspace/ (LOW)

**Impact:** SCENE_PLAN.md is located at `/workspace/docs/SCENE_PLAN.md` but the orchestrator prompt and resetWorkspace() look for it at `/workspace/SCENE_PLAN.md`.

**Evidence:**
```
ls /workspace/SCENE_PLAN.md → NOT FOUND
ls /workspace/docs/SCENE_PLAN.md → 22,711 bytes
```

`resetWorkspace()` in workspace-init.ts line 612 deletes `/workspace/SCENE_PLAN.md` — which wouldn't clean the actual file at `/workspace/docs/SCENE_PLAN.md`.

**Fix:** Either move the Planner's output to `/workspace/SCENE_PLAN.md` or update `resetWorkspace()` and prompts to use `/workspace/docs/SCENE_PLAN.md`.

---

## Summary Table

| # | Issue | Severity | Category | Status |
|---|-------|----------|----------|--------|
| LIVE-1 | Pipeline stops at Phase 3 — plan approval checkpoint | RESOLVED | Pipeline flow | By design |
| LIVE-2 | Theme always defaults to blackboard — no selection mechanism | HIGH | Architecture | Open |
| LIVE-3 | Workspace gets sandbox deps (zod 4, react 18, no tsc) | HIGH | Docker/deps | Fix applied, needs rebuild |
| LIVE-4 | Shared modules not copied (stale filenames) | MEDIUM | workspace-init | Fix applied, needs rebuild |
| LIVE-5 | Orchestrator browses templates 8x after Planner | MEDIUM | Orchestrator behavior | Open |
| LIVE-6 | Orchestrator does 30+ manual file ops after Planner | MEDIUM | Orchestrator behavior | Open |
| LIVE-7 | Git dubious ownership on docker exec | LOW | Docker config | Non-blocking |
| LIVE-8 | generation-progress.json never updated | LOW | Dead code | Open |
| LIVE-9 | All render_still outputs are black frames | CRITICAL | Rendering | Open |
| LIVE-10 | Container resource exhaustion from parallel renders | HIGH | Docker/resources | Open |
| LIVE-11 | No templates forked — all scenes from scratch | HIGH | Theme routing | Caused by LIVE-2 |
| LIVE-12 | Scene skeletons are placeholders, not production animations | MEDIUM | Animation quality | In progress (animators running) |
| LIVE-13 | SCENE_PLAN.md at wrong path | LOW | File paths | Open |

## Fixes Already Applied (pending image rebuild)

- **LIVE-3:** Dockerfile installs template deps separately; workspace-init symlinks to `/app/template/node_modules`
- **LIVE-4:** workspace-init filenames updated to match actual XML files + correct source path

## Key Metrics

### Phase 1 (Planning — session 1)
| Metric | Value |
|--------|-------|
| Total cost | $2.24 |
| Duration | 542s (~9 min) |
| Tool calls | 55 |
| Subagents dispatched | 2 (Trim Editor, Planner) |
| browse_templates calls | 8 (all by orchestrator, post-Planner) |

### Phase 2 (Post-approval — session resumed)
| Metric | Value |
|--------|-------|
| Subagents dispatched | 4+ (Setup Agent, Layout Editor, 7 Animators) |
| Scene files | 7 (Scene1-Scene7.tsx) |
| Scene items in manifest | 7 |
| Templates forked | 0 |
| Stills rendered | 4+ (all 34,418 bytes — black) |
| Peak CPU | 223% |
| Peak RAM | 2GB / 3.8GB |
| Peak PIDs | 447 |

### Workspace state
| Metric | Value |
|--------|-------|
| Workspace tsc available | NO (old image) |
| Workspace zod version | 4.3.6 (should be 3.22.3) |
| Workspace react version | 18.3.1 (should be 19.2.3) |
| node_modules symlink | /app/node_modules (should be /app/template/node_modules) |
| Shared docs | EMPTY (old image) |
| Theme applied | blackboard (user wanted magazine) |
