# Sandbox Live Issues Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 13 issues discovered during live investigation of project `7ae7f428-711d-431e-a191-1cf421e7a4af` — covering theme selection, black frame renders, resource exhaustion, orchestrator behavior, and workspace hygiene.

**Architecture:** Issues are grouped into 7 independent tasks ordered by severity. Each task produces a self-contained, testable change. The theme fix spans API + sandbox. The render fix is prompt + orchestrator code. The resource fix adds a semaphore to the render tool. Orchestrator behavior fixes are prompt-only.

**Tech Stack:** TypeScript, Node.js, Docker, Remotion, Claude Agent SDK, MCP servers

**Issues document:** `docs/superpowers/issues/2026-03-24-sandbox-audit-fixes-validation.md`

---

### Task 1: Pass theme from API to sandbox init (LIVE-2, LIVE-11)

**Fixes:** LIVE-2 (theme always defaults to blackboard), LIVE-11 (no templates forked)

**Files:**
- Modify: `packages/api/src/sandbox/routes.ts:502-535` (buildInitData — add theme to initBody)
- Modify: `packages/api/src/sandbox/manager.ts:48-62` (InitData — add theme field)

- [ ] **Step 1: Add `theme` to InitData interface**

In `packages/api/src/sandbox/manager.ts`, add `theme` to the interface:

```typescript
export interface InitData {
  videoUrl?: string;
  audioUrl?: string;
  manifest?: unknown;
  transcript?: unknown;
  userBrief?: string;
  headTracking?: unknown;
  projectMeta?: {
    width: number;
    height: number;
    fps: number;
    durationMs: number;
  };
  theme?: string;
  [key: string]: unknown;
}
```

- [ ] **Step 2: Populate theme in buildInitData()**

In `packages/api/src/sandbox/routes.ts`, after the `initBody.projectMeta` block (around line 533), add:

```typescript
  // Add theme from video settings (orchestrator can override via user brief analysis)
  const videoSettings = (project.videoSettings as Record<string, unknown>) || {};
  initBody.theme = (videoSettings.theme as string) || undefined;
```

Note: We intentionally leave it as `undefined` (not defaulting to `'blackboard'`) so that if no theme is set in DB, workspace-init's default still applies. This separates "user chose blackboard" from "no theme selected".

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/sandbox/routes.ts packages/api/src/sandbox/manager.ts
git commit -m "fix: pass theme from videoSettings to sandbox init payload (LIVE-2)"
```

---

### Task 2: Make orchestrator detect theme from user brief (LIVE-2 continued)

**Fixes:** LIVE-2 (orchestrator should be smart enough to choose theme)

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md` (add theme detection in Phase 1)

- [ ] **Step 1: Add theme detection instruction to Phase 1**

In `packages/sandbox/src/prompts/orchestrator/system.md`, find the Phase 1 section (around line 75-90, the "Brief & Clarification" phase). After the existing Phase 1 instructions, add a theme detection block:

```markdown
#### Theme Detection

After reading the user brief, determine if the user is requesting a specific theme:
- If the brief mentions "magazine" (e.g., "use magazine animations", "magazine style") → the active theme is `magazine`
- If the brief mentions "blackboard" or "chalkboard" → the active theme is `blackboard`
- If no theme is mentioned → use the workspace's default theme (from `docs/guidelines/theme.md`)

If the detected theme differs from the workspace default, update the theme configuration:
1. Read `/workspace/docs/themes/themes.json` to get the theme config
2. Read the design system file for the detected theme (e.g., `/workspace/docs/themes/magazine/design-system.md`)
3. Write the design system to `/workspace/docs/guidelines/theme.md` (overwriting the default)
4. Tell subsequent agents (Planner, Setup Agent) to use the detected theme

Pass the detected theme slug to the Planner via the task prompt (e.g., "Theme: magazine").
```

- [ ] **Step 2: Update Phase 3 Planner dispatch to pass theme**

In the same file, find Phase 3 where the Planner is dispatched. Add to the Planner task prompt:

```markdown
When dispatching the Planner, include the detected theme in the task prompt:
"Plan scenes for this video. Theme: {{detected_theme}}. Read /workspace/docs/guidelines/theme.md for design tokens."
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "feat: orchestrator detects theme from user brief (LIVE-2)"
```

---

### Task 3: Fix black frame renders — force render_still MCP tool usage (LIVE-9)

**Fixes:** LIVE-9 (all stills are black frames because animators use Bash instead of render_still MCP tool)

**Files:**
- Modify: `packages/sandbox/src/prompts/animator/system.md` (add explicit render_still instruction, ban Bash for rendering)
- Modify: `packages/sandbox/src/prompts/animator/reminder.md` (reinforce in reminder)
- Modify: `packages/sandbox/template/.claude/CLAUDE.md` (add render instruction)

- [ ] **Step 1: Keep Bash in Animator allowedTools but add prompt guardrails**

`Bash` must remain in `ANIMATOR_TOOL_NAMES` because animators legitimately need it for `npx tsc --noEmit --pretty false` (type-checking step documented in `packages/sandbox/src/prompts/animator/reminder.md` line 33). Instead of removing Bash, we fix the problem via prompt instructions.

No code change to `packages/sandbox/src/orchestrator.ts` in this step.

- [ ] **Step 2: Add render_still instruction to animator prompt**

In `packages/sandbox/src/prompts/animator/system.md`, find the rendering/validation section and add:

```markdown
### Rendering Stills

To verify your animation visually, use the `render_still` MCP tool — NEVER call `remotion still` via Bash.

```
render_still(frame: 50)  // ✅ correct — uses props bypass
```

```
Bash("npx remotion still ...")  // ❌ WRONG — produces black frames
```

The `render_still` tool passes the manifest via `--props` flag, which is required for headless rendering. Direct Bash calls to `remotion still` skip this and produce black frames.
```

- [ ] **Step 3: Add render instruction to animator reminder**

In `packages/sandbox/src/prompts/animator/reminder.md`, add:

```markdown
- ALWAYS use `render_still` MCP tool to render frames — NEVER use Bash to call remotion directly (it produces black frames)
```

- [ ] **Step 4: Add render instruction to workspace CLAUDE.md**

In `packages/sandbox/template/.claude/CLAUDE.md`, add near the dependency rules section:

```markdown
## Rendering
- ALWAYS use the `render_still` MCP tool to render frames
- NEVER call `remotion still` via Bash — it produces black frames because it skips the --props manifest bypass
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/animator/system.md packages/sandbox/src/prompts/animator/reminder.md packages/sandbox/template/.claude/CLAUDE.md
git commit -m "fix: force render_still MCP tool, ban Bash for rendering (LIVE-9)"
```

---

### Task 4: Add render concurrency limiter (LIVE-10)

**Fixes:** LIVE-10 (container resource exhaustion from 5+ parallel Chromium instances)

**Files:**
- Modify: `packages/sandbox/src/tools/render-still.ts` (add semaphore)

- [ ] **Step 1: Add a concurrency semaphore to render-still**

Replace the full file `packages/sandbox/src/tools/render-still.ts`:

```typescript
import { execFile } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const WORKSPACE = process.env.WORKSPACE_DIR || '/workspace';
const MAX_CONCURRENT_RENDERS = 2;

let activeRenders = 0;
const renderQueue: Array<{ resolve: () => void }> = [];

async function acquireRenderSlot(): Promise<void> {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders++;
    return;
  }
  return new Promise<void>((resolve) => {
    renderQueue.push({ resolve });
  });
}

function releaseRenderSlot(): void {
  activeRenders--;
  const next = renderQueue.shift();
  if (next) {
    activeRenders++;
    next.resolve();
  }
}

/**
 * Write a render-props.json file that includes the manifest.
 * Remotion's --props flag reads this file, bypassing calculateMetadata's
 * broken staticFile() fetch in headless CLI mode.
 */
function writeRenderProps(): string {
  const propsPath = join(WORKSPACE, '.build', 'render-props.json');
  mkdirSync(join(WORKSPACE, '.build'), { recursive: true });
  const manifestRaw = readFileSync(join(WORKSPACE, 'manifest.json'), 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  writeFileSync(propsPath, JSON.stringify({ manifest }));
  return propsPath;
}

export const renderStillTool = {
  name: 'render_still',
  description: 'Render a still frame at a specific time as a PNG image. Use this to verify visual output. Max 2 concurrent renders.',
  input_schema: {
    type: 'object' as const,
    properties: {
      frame: {
        type: 'number',
        description: 'The frame number to render',
      },
      compositionId: {
        type: 'string',
        description: 'The composition ID to render (default: "MainComposition")',
      },
    },
    required: ['frame'],
  },
  async execute(input: { frame: number; compositionId?: string }): Promise<string> {
    const compositionId = input.compositionId || 'MainComposition';
    const outputPath = join(WORKSPACE, '.build', `still-${input.frame}.png`);

    await acquireRenderSlot();
    try {
      let propsPath: string;
      try {
        propsPath = writeRenderProps();
      } catch (propsErr: any) {
        return `Cannot render: manifest.json not found or invalid. Ensure the manifest exists before rendering. (${propsErr.message})`;
      }

      const isLinux = process.platform === 'linux';
      const args = [
        'remotion', 'still',
        'src/Root.tsx',
        compositionId,
        outputPath,
        `--frame=${input.frame}`,
        `--props=${propsPath}`,
        ...(isLinux ? ['--gl=swangle'] : []),
      ];

      await execFileAsync('npx', args, {
        timeout: 90_000,
        cwd: WORKSPACE,
      });

      return `Still rendered at frame ${input.frame}: ${outputPath}`;
    } catch (err: any) {
      const output = (err.stdout || '') + (err.stderr || '');
      return `Failed to render still: ${err.message}\n${output.slice(0, 1000)}`;
    } finally {
      releaseRenderSlot();
    }
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/tools/render-still.ts
git commit -m "fix: add render concurrency limiter (max 2 parallel renders) (LIVE-10)"
```

---

### Task 5: Fix orchestrator post-Planner behavior (LIVE-5, LIVE-6)

**Fixes:** LIVE-5 (8x browse_templates after Planner), LIVE-6 (30+ manual file ops after Planner)

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md` (add post-Planner rules, fix SCENE_PLAN.md path references)

- [ ] **Step 1: Add explicit post-Planner instructions to orchestrator prompt**

In `packages/sandbox/src/prompts/orchestrator/system.md`, find Phase 3 (around line 102-117). After the Planner dispatch instructions, add:

```markdown
#### After Planner Returns

1. Read `docs/SCENE_PLAN.md` — verify it exists and has the expected scene count
2. Run the creative diversity check (scene type distribution, adjacent duplicates)
3. Show the `scene_plan` widget with the plan content
4. **STOP and wait for approval**

**DO NOT** do any of the following after the Planner returns:
- Do NOT call `browse_templates` — the Planner already searched and documented template matches
- Do NOT read individual template files — the Planner already reviewed them
- Do NOT edit or rewrite SCENE_PLAN.md — the Planner wrote it correctly
- Do NOT run validate_timeline — that's for Phase 5 (Layout Editor)
- Do NOT read the transcript — you already have the plan summary

Your only job between Planner and plan approval is: read the plan, check diversity, show the widget.
```

- [ ] **Step 2: Fix SCENE_PLAN.md path references in orchestrator prompt**

In `packages/sandbox/src/prompts/orchestrator/system.md`, search for all references to `SCENE_PLAN.md` and ensure they consistently say `docs/SCENE_PLAN.md` (the actual path the Planner writes to). This includes:
- Phase 3 references (around line 111): `Read SCENE_PLAN.md` → `Read docs/SCENE_PLAN.md`
- Any other mentions in the file

This ensures the orchestrator reads from the correct path after the Planner writes the plan.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "fix: prevent orchestrator from re-browsing templates and manual file ops (LIVE-5, LIVE-6)"
```

---

### Task 6: Fix SCENE_PLAN.md path and resetWorkspace cleanup (LIVE-13)

**Fixes:** LIVE-13 (SCENE_PLAN.md at wrong path)

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts:612` (fix resetWorkspace path)
- Modify: `packages/sandbox/src/prompts/planner/system.md` (confirm output path)

- [ ] **Step 1: Fix resetWorkspace to clean docs/SCENE_PLAN.md**

In `packages/sandbox/src/workspace-init.ts`, find the `resetWorkspace()` function (around line 612). Change:

```typescript
  await rm(join(WORKSPACE, 'SCENE_PLAN.md'), { force: true });
```

to:

```typescript
  // Clean plan from both possible locations
  await rm(join(WORKSPACE, 'SCENE_PLAN.md'), { force: true });
  await rm(join(WORKSPACE, 'docs', 'SCENE_PLAN.md'), { force: true });
```

- [ ] **Step 2: Verify Planner output path**

Read `packages/sandbox/src/prompts/planner/system.md` and confirm that the Planner is instructed to write to `docs/SCENE_PLAN.md`. If it says `SCENE_PLAN.md` (root), update to `docs/SCENE_PLAN.md` to match observed behavior. If it already says `docs/SCENE_PLAN.md`, no change needed.

Also check `packages/sandbox/src/prompts/orchestrator/system.md` Phase 3 references — ensure they say `docs/SCENE_PLAN.md`.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts packages/sandbox/src/prompts/planner/system.md packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "fix: clean SCENE_PLAN.md from docs/ in resetWorkspace (LIVE-13)"
```

---

### Task 7: Remove dead generation-progress.json (LIVE-8)

**Fixes:** LIVE-8 (generation-progress.json never updated)

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts:512-525` (remove progress file creation)
- Modify: `packages/sandbox/src/workspace-init.ts:614-625` (remove progress file reset)

- [ ] **Step 1: Remove generation-progress.json from initWorkspaceInDir**

In `packages/sandbox/src/workspace-init.ts`, find the progress file initialization (around line 512-525). Remove the entire block:

```typescript
  // Initialize generation progress file
  await writeFile(
    join(baseDir, 'generation-progress.json'),
    JSON.stringify({
      phase: 'initialized',
      planApproved: false,
      totalScenes: 0,
      completedScenes: [],
      failedScenes: [],
      currentScene: null,
      tsVerified: false,
      lastError: null,
      updatedAt: new Date().toISOString(),
    }, null, 2),
  );
```

- [ ] **Step 2: Remove generation-progress.json from resetWorkspace**

In the same file's `resetWorkspace()` function (around line 614-625), remove the progress file rewrite block:

```typescript
  await writeFile(
    join(WORKSPACE, 'generation-progress.json'),
    JSON.stringify({
      phase: 'initialized',
      planApproved: false,
      ...
    }, null, 2),
  );
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "chore: remove dead generation-progress.json (LIVE-8)"
```

---

## Issues NOT addressed in this plan

| Issue | Reason |
|-------|--------|
| LIVE-1 | Resolved — plan approval checkpoint is by design |
| LIVE-3 | Already fixed locally — needs Docker image rebuild only |
| LIVE-4 | Already fixed locally — needs Docker image rebuild only |
| LIVE-7 | Non-blocking — only affects `docker exec` debugging as root |
| LIVE-12 | Depends on LIVE-9 fix — once animators can see renders, skeleton quality resolves itself |

## Docker Rebuild Required

After all tasks are committed, rebuild the sandbox image to pick up:
- Tasks 1-7 code changes (this plan)
- Previously applied LIVE-3 fix (Dockerfile template deps)
- Previously applied LIVE-4 fix (shared module filenames)

```bash
docker build -t viona-sandbox:latest -f packages/sandbox/Dockerfile .
```

---

## Dependency Graph

```
Task 1 (theme in API) ──→ Task 2 (orchestrator theme detection) ──→ independent
Task 3 (render_still fix) ──→ Task 4 (render concurrency) ──→ independent
Task 5 (orchestrator behavior) ──→ independent
Task 6 (SCENE_PLAN path) ──→ independent
Task 7 (dead file cleanup) ──→ independent
```

Tasks 1→2 must be sequential. Tasks 3→4 should be sequential (semaphore depends on forcing MCP tool usage). Tasks 5, 6, 7 are fully independent of each other and of Tasks 1-4.
