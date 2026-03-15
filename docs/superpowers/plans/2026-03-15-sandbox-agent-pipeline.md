# Sandbox Agent Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sandbox agent a fully functional video editing agent that plans scenes, generates Remotion motion graphics, edits manifests, and refines — all conversationally.

**Architecture:** Orchestrator-worker pattern using Claude Agent SDK `query()`. One persistent orchestrator dispatches subagents (Planner, Animator, Researcher, Trimmer, Verifier, Healer) via the Agent tool. MCP servers provide manifest, scene, render, widget, asset, and viewport tools.

**Tech Stack:** TypeScript, Claude Agent SDK, Express, esbuild, Remotion, Zod, MCP servers (stdio + in-process SDK)

**Spec:** `docs/superpowers/specs/2026-03-15-sandbox-agent-pipeline-design.md`

---

## File Structure

### Files to Create
- `packages/sandbox/src/prompts/planner-system.md` — Scene planning subagent prompt
- `packages/sandbox/src/prompts/verifier-system.md` — Screenshot verification subagent prompt
- `packages/sandbox/src/prompts/healer-system.md` — TypeScript fixer subagent prompt
- `packages/sandbox/src/mcp-config.ts` — Stdio MCP server configuration builder (assets, viewport, freepik, better-icons)
- `packages/sandbox/src/tools/scene-registry.ts` — Scene registry generator utility

### Files to Modify
- `packages/sandbox/src/workspace-init.ts` — Extended InitPayload with transcript, brief, headTracking, projectMeta
- `packages/sandbox/src/prompts/prompt-loader.ts` — Extended PromptContext with briefSummary, hasHeadTracking, totalScenes, currentPhase
- `packages/sandbox/src/orchestrator.ts` — Add Planner, Verifier, Healer subagents; wire stdio MCP servers
- `packages/sandbox/src/mcp-servers.ts` — Export existing servers alongside new stdio config
- `packages/sandbox/src/agent-server.ts` — Enhanced /init handler, new /transcript endpoint
- `packages/sandbox/src/prompts/orchestrator-system.md` — Add Planner/Verifier/Healer dispatch rules, progress tracking
- `packages/sandbox/Dockerfile` — Add MCP server dist files, mcp-remote, better-icons
- `packages/api/src/sandbox/routes.ts` — Send transcript + brief + headTracking in init payload

### Files Unchanged (reference only)
- `packages/sandbox/src/prompts/animator-system.md` — Already battle-tested (60KB)
- `packages/sandbox/src/prompts/researcher-system.md` — Already written
- `packages/sandbox/src/prompts/trimmer-system.md` — Already written
- `packages/sandbox/src/tools/manifest-ops.ts` — Already complete
- `packages/sandbox/src/esbuild-watcher.ts` — Already handles scene rebuilds
- `packages/mcp-servers/` — Already built, just needs wiring

---

## Chunk 1: Foundation — Init Pipeline & Prompt Infrastructure

### Task 1: Extend InitPayload and workspace-init

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts:19-154`

- [ ] **Step 1: Read the current workspace-init.ts file**

Read `packages/sandbox/src/workspace-init.ts` to understand the current InitPayload and initWorkspace flow.

- [ ] **Step 2: Extend InitPayload interface**

At line 19, update the interface:

```typescript
export interface InitPayload {
  // Existing
  videoUrl?: string;
  audioUrl?: string;
  manifest: Record<string, unknown>;
  // New (all optional for backward compat)
  transcript?: {
    words: Array<{ word: string; start: number; end: number; confidence: number }>;
    text: string;
    segments: Array<{ start: number; end: number; text: string }>;
  };
  userBrief?: string;
  headTracking?: {
    speakerGrid: number[][];
    safePlacement: Array<{ x: number; y: number; width: number; height: number }>;
  };
  projectMeta?: {
    width: number;
    height: number;
    fps: number;
    durationMs: number;
  };
}
```

- [ ] **Step 3: Add transcript/brief/headTracking file writes to initWorkspace**

After the existing directory creation (line 80), add writes for the new data files:

```typescript
// Write transcript if provided
if (payload.transcript) {
  await fs.writeFile(
    path.join(WORKSPACE, 'docs', 'transcript.json'),
    JSON.stringify(payload.transcript, null, 2),
  );
}

// Write user brief if provided
if (payload.userBrief) {
  await fs.writeFile(
    path.join(WORKSPACE, 'docs', 'user-brief.md'),
    payload.userBrief,
  );
}

// Write head-tracking data if provided
if (payload.headTracking) {
  await fs.writeFile(
    path.join(WORKSPACE, 'docs', 'speaker-grid.json'),
    JSON.stringify(payload.headTracking, null, 2),
  );
}

// Initialize generation progress file
await fs.writeFile(
  path.join(WORKSPACE, 'generation-progress.json'),
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

Also ensure `docs/` directory is created in the mkdir block (line 75-80). Add `'docs'` to the list.

- [ ] **Step 4: Verify the init flow works**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No type errors related to workspace-init.ts

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat(sandbox): extend InitPayload with transcript, brief, headTracking"
```

---

### Task 2: Extend PromptContext

**Files:**
- Modify: `packages/sandbox/src/prompts/prompt-loader.ts:53-71`

- [ ] **Step 1: Read current prompt-loader.ts**

Read `packages/sandbox/src/prompts/prompt-loader.ts` to understand the existing PromptContext and injectContext.

- [ ] **Step 2: Extend PromptContext interface**

Update the interface at line 53:

```typescript
export interface PromptContext {
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  durationMs: number;
  hasTranscript: boolean;
  theme?: string;
  projectType?: string;
  // New fields
  briefSummary?: string;
  hasHeadTracking?: boolean;
  totalScenes?: number;
  currentPhase?: string;
}
```

- [ ] **Step 3: Update injectContext to handle new fields**

Update the `injectContext` function to replace new template variables:

```typescript
export function injectContext(template: string, ctx: PromptContext): string {
  return template
    .replace(/\{\{canvasWidth\}\}/g, String(ctx.canvasWidth))
    .replace(/\{\{canvasHeight\}\}/g, String(ctx.canvasHeight))
    .replace(/\{\{fps\}\}/g, String(ctx.fps))
    .replace(/\{\{durationMs\}\}/g, String(ctx.durationMs))
    .replace(/\{\{hasTranscript\}\}/g, String(ctx.hasTranscript))
    .replace(/\{\{theme\}\}/g, ctx.theme || 'studio-dark')
    .replace(/\{\{projectType\}\}/g, ctx.projectType || 'general')
    .replace(/\{\{briefSummary\}\}/g, ctx.briefSummary || 'No brief provided')
    .replace(/\{\{hasHeadTracking\}\}/g, String(ctx.hasHeadTracking ?? false))
    .replace(/\{\{totalScenes\}\}/g, String(ctx.totalScenes ?? 0))
    .replace(/\{\{currentPhase\}\}/g, ctx.currentPhase || 'unknown');
}
```

- [ ] **Step 4: Type check**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/prompt-loader.ts
git commit -m "feat(sandbox): extend PromptContext with briefSummary, headTracking, phase fields"
```

---

### Task 3: Create scene-registry generator utility

**Files:**
- Create: `packages/sandbox/src/tools/scene-registry.ts`

- [ ] **Step 1: Read the existing esbuild-watcher.ts to understand how scene-registry.ts is currently generated**

Read `packages/sandbox/src/esbuild-watcher.ts` and search for `scene-registry` to understand the current generation pattern.

- [ ] **Step 2: Create the scene-registry generator**

```typescript
import { readdir, writeFile } from 'fs/promises';
import path from 'path';

const SCENES_DIR = '/workspace/src/scenes';
const REGISTRY_PATH = '/workspace/src/scene-registry.ts';

/**
 * Scan /workspace/src/scenes/ for Scene*.tsx files and regenerate
 * the scene-registry.ts barrel file that PlayerComposition imports.
 */
export async function regenerateSceneRegistry(): Promise<string[]> {
  let files: string[] = [];
  try {
    files = await readdir(SCENES_DIR);
  } catch {
    // scenes/ dir may not exist yet
  }

  const sceneFiles = files
    .filter((f) => /^Scene\d+\.tsx$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0], 10);
      const numB = parseInt(b.match(/\d+/)![0], 10);
      return numA - numB;
    });

  const imports = sceneFiles.map((f) => {
    const name = path.basename(f, '.tsx');
    return `export { default as ${name} } from './scenes/${name}';`;
  });

  const content = imports.length > 0
    ? `// Auto-generated by scene-registry generator. Do not edit.\n${imports.join('\n')}\n`
    : `// Auto-generated by scene-registry generator. Do not edit.\n// No scenes yet.\nexport {};\n`;

  await writeFile(REGISTRY_PATH, content, 'utf-8');
  return sceneFiles;
}
```

- [ ] **Step 3: Type check**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/tools/scene-registry.ts
git commit -m "feat(sandbox): add scene-registry generator utility"
```

---

### Task 4: Update API routes to send transcript + brief in init payload

**Files:**
- Modify: `packages/api/src/sandbox/routes.ts:178-189`

- [ ] **Step 1: Read the sandbox routes file, focusing on the init section**

Read `packages/api/src/sandbox/routes.ts` lines 150-200 to understand the current init payload construction.

- [ ] **Step 2: Extend the init payload to include transcript, brief, headTracking, and projectMeta**

Find the section where the init body is constructed (around line 178-189) and extend it:

```typescript
const initBody: Record<string, unknown> = {
  videoUrl: project.videoKey,
  audioUrl: project.audioKey || undefined,
  manifest,
};

// Add transcript if available
if (project.transcript) {
  initBody.transcript = project.transcript;
}

// Add user brief if available (from project description or generation prompt)
if (project.description) {
  initBody.userBrief = project.description;
}

// Add head-tracking data if available
if (project.headTrackingData) {
  initBody.headTracking = project.headTrackingData;
}

// Add project metadata
initBody.projectMeta = {
  width: project.width || 1080,
  height: project.height || 1920,
  fps: project.fps || 30,
  durationMs: project.durationMs || 0,
};
```

Note: The exact field names on the `project` object may differ. Read the project query to find the correct column names for transcript data, description, and head tracking results.

- [ ] **Step 3: Type check**

Run: `cd packages/api && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/sandbox/routes.ts
git commit -m "feat(api): send transcript, brief, headTracking in sandbox init payload"
```

---

## Chunk 2: MCP Server Wiring

### Task 5: Create stdio MCP server configuration

**Files:**
- Create: `packages/sandbox/src/mcp-config.ts`

- [ ] **Step 1: Read the worker's MCP registry to understand the server definitions**

Read `packages/mcp-servers/mcp-servers.json` to see the server entries (assets, viewport, freepik, better-icons).

- [ ] **Step 2: Create the MCP config builder for the sandbox**

```typescript
/**
 * Build stdio MCP server configuration for the Agent SDK query() call.
 * These servers run as child processes alongside the in-process SDK MCP servers.
 */

const MCP_SERVERS_DIR = '/app/mcp-servers';
const MCP_REMOTE_PATH = '/app/node_modules/mcp-remote/dist/proxy.js';
const BETTER_ICONS_PATH = '/app/node_modules/better-icons/dist/index.js';
const WORKSPACE = '/workspace';

export function buildStdioMcpServers(): Record<string, unknown> {
  const servers: Record<string, unknown> = {};

  // Assets server — download files, search stock photos, speaker grid
  servers.assets = {
    command: 'node',
    args: [`${MCP_SERVERS_DIR}/asset-server.js`, '--workspace', WORKSPACE],
    env: {
      UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY || '',
      PEXELS_API_KEY: process.env.PEXELS_API_KEY || '',
    },
  };

  // Viewport server — scene dimensions, code validation
  servers.viewport = {
    command: 'node',
    args: [`${MCP_SERVERS_DIR}/viewport-server.js`, '--workspace', WORKSPACE],
  };

  // Freepik MCP proxy (only if API key is set)
  if (process.env.FREEPIK_API_KEY) {
    servers.freepik = {
      command: 'node',
      args: [
        MCP_REMOTE_PATH,
        'https://api.freepik.com/mcp',
        '--header',
        `x-freepik-api-key:${process.env.FREEPIK_API_KEY}`,
      ],
    };
  }

  // Better-Icons (Iconify) — no API key needed
  servers['better-icons'] = {
    command: 'node',
    args: [BETTER_ICONS_PATH],
  };

  return servers;
}
```

- [ ] **Step 3: Type check**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/mcp-config.ts
git commit -m "feat(sandbox): add stdio MCP server configuration for assets, viewport, freepik, icons"
```

---

### Task 6: Wire stdio MCP servers into orchestrator

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:64-128`
- Modify: `packages/sandbox/src/agent-server.ts:106`

- [ ] **Step 1: Read orchestrator.ts buildOrchestratorOptions and agent-server.ts /prompt handler**

Read both files to understand how MCP servers are currently passed.

- [ ] **Step 2: Import and merge stdio MCP config in orchestrator**

In `orchestrator.ts`, add import at top:
```typescript
import { buildStdioMcpServers } from './mcp-config.js';
```

In `buildOrchestratorOptions`, merge stdio servers with in-process SDK servers:

```typescript
// After existing mcpServers parameter handling (line 126):
const stdioServers = buildStdioMcpServers();
const allMcpServers = {
  ...(mcpServers || {}),
  ...stdioServers,
};
```

Replace `...(mcpServers ? { mcpServers } : {})` at line 126 with:
```typescript
mcpServers: allMcpServers,
```

- [ ] **Step 3: Add new MCP tool names to allowedTools**

Add tool name constants for the new stdio servers:

```typescript
const ASSET_TOOL_NAMES = [
  'mcp__assets__download_file',
  'mcp__assets__search_unsplash',
  'mcp__assets__search_pexels',
  'mcp__assets__download_stock_photo',
  'mcp__assets__get_speaker_grid',
];

const VIEWPORT_TOOL_NAMES = [
  'mcp__viewport__get_scene_dimensions',
  'mcp__viewport__validate_scene_code',
  'mcp__viewport__submit_verdict',
];

const ICON_TOOL_NAMES = [
  'mcp__better-icons__*',
];

const FREEPIK_TOOL_NAMES = [
  'mcp__freepik__*',
];
```

Add these to the `allowedTools` array in `buildOrchestratorOptions`:
```typescript
allowedTools: [
  'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
  'WebSearch', 'WebFetch', 'Agent', 'Skill',
  ...MANIFEST_TOOL_NAMES,
  ...SCENE_TOOL_NAMES,
  ...RENDER_TOOL_NAMES,
  ...WIDGET_TOOL_NAMES,
  ...ASSET_TOOL_NAMES,
  ...VIEWPORT_TOOL_NAMES,
  ...ICON_TOOL_NAMES,
  ...FREEPIK_TOOL_NAMES,
],
```

- [ ] **Step 4: Update subagent tool lists**

Update the `agents` object to give each subagent access to the appropriate new tools:

- **animator**: Add `...ASSET_TOOL_NAMES, ...VIEWPORT_TOOL_NAMES`
- **researcher**: Add `...ASSET_TOOL_NAMES, ...ICON_TOOL_NAMES, ...FREEPIK_TOOL_NAMES`
- **trimmer**: No changes needed

- [ ] **Step 5: Type check**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts packages/sandbox/src/agent-server.ts
git commit -m "feat(sandbox): wire stdio MCP servers (assets, viewport, freepik, icons) into orchestrator"
```

---

## Chunk 3: New Subagent Prompts

### Task 7: Write planner-system.md

**Files:**
- Create: `packages/sandbox/src/prompts/planner-system.md`

- [ ] **Step 1: Read the worker's Director prompt for reference**

Read `packages/worker/src/prompts/director/system.md` (29KB) and `packages/worker/src/prompts/director/display-mode-table.md` to understand the planning methodology.

- [ ] **Step 2: Write planner-system.md**

Adapt the Director prompt for conversational sandbox context. Key differences from worker Director:
- Receives context from orchestrator (not raw CLI args)
- Writes to `/workspace/docs/SCENE_PLAN.md` and `/workspace/scenes.json`
- Uses manifest v2 segment format
- Must include display mode assignments using `display-mode-table.md` rules
- Must include `[IMAGE: keyword]` tags for asset fetching
- Self-verification table before writing scenes.json

The prompt should include:
- Role: Scene planning specialist for video motion graphics
- Input context: transcript path, user brief path, canvas dimensions, fps, duration, head-tracking path
- Display mode rules (default 60-70%, fullscreen 1-3 moments, overlay for speaker credibility)
- Transition types (cut default, fade, zoom-in, zoom-out)
- scenes.json v2 spec with segments and beats
- Duration bounds: 210-450 frames per scene (7-15s at 30fps)
- Contiguity and coverage requirements
- Self-verification table requirement
- Output: SCENE_PLAN.md + scenes.json written to workspace

Write the full prompt (aim for 3-5KB, adapted from the 29KB Director prompt — shorter because the conversational context covers what the Director had to discover).

- [ ] **Step 3: Verify prompt loads**

Run: `cd packages/sandbox && node -e "const fs = require('fs'); console.log(fs.readFileSync('src/prompts/planner-system.md', 'utf-8').length)"`
Expected: Outputs a number (file size)

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/planner-system.md
git commit -m "feat(sandbox): add planner subagent system prompt"
```

---

### Task 8: Write verifier-system.md

**Files:**
- Create: `packages/sandbox/src/prompts/verifier-system.md`

- [ ] **Step 1: Read worker's verification prompts for reference**

Read `packages/worker/src/prompts/animator/verify.md` and `packages/worker/src/prompts/animator/scene-verify.md` for the verification methodology.

- [ ] **Step 2: Write verifier-system.md**

The Verifier subagent reviews rendered screenshots against the scene plan.

```markdown
# Scene Verifier

You verify that generated Remotion scenes match their planned descriptions by reviewing rendered screenshots.

## Workflow

1. Read the scene description from `/workspace/docs/SCENE_PLAN.md`
2. Use `mcp__render__render_still` to screenshot the scene at key frames
3. Use `mcp__viewport__get_scene_dimensions` to check effective dimensions
4. Use `mcp__viewport__validate_scene_code` for automated code checks
5. Compare visual output against plan description
6. Submit verdict via `mcp__viewport__submit_verdict`

## What to Check

### Visual Completeness
- All described elements are visible
- Text content matches plan (no placeholder text)
- Colors match plan description
- Layout matches display mode (default/fullscreen/overlay)

### Display Mode Compliance
- **default**: Speaker visible, visual in standard layout area
- **fullscreen**: No speaker visible, visual fills entire canvas, background present
- **overlay**: TRANSPARENT background (no solid colors), content only in safe zones (0-15% top, 58-85% lower-third), NO content in 15-58% speaker zone

### Animation Quality
- Elements are not frozen (breathing/idle animation expected)
- Entrances are visible in early frames
- No elements extending beyond canvas bounds
- No overlapping text/elements that reduce readability

### Technical Quality
- No TypeScript errors visible in render output
- No missing imports or undefined components
- interpolate() calls have proper clamping

## Verdict Format

Use `mcp__viewport__submit_verdict` with:
- `passed: true/false`
- `issues: string[]` — specific problems found
- `suggestions: string[]` — optional improvements

## Rules
- Max 2 fix rounds per scene. After 2 failures, accept with warning.
- Screenshot at frame 0 (initial state) and mid-scene (animations active).
- Be specific in issue descriptions — "title text is cut off at right edge" not "visual issues found".
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/verifier-system.md
git commit -m "feat(sandbox): add verifier subagent system prompt"
```

---

### Task 9: Write healer-system.md

**Files:**
- Create: `packages/sandbox/src/prompts/healer-system.md`

- [ ] **Step 1: Read worker's fix-template.md for reference**

Read `packages/worker/src/prompts/animator/fix-template.md` for the fix methodology.

- [ ] **Step 2: Write healer-system.md**

```markdown
# TypeScript Healer

You fix TypeScript compilation errors in Remotion scene files. You make minimal, targeted patches — never restructure or rewrite.

## Workflow

1. Read the TypeScript errors provided in your task prompt
2. Read the failing scene file(s) using `Read`
3. Identify the root cause of each error
4. Apply minimal fixes using `Edit`
5. Verify the fix doesn't break other scene files

## Common Remotion TypeScript Errors

### Missing imports
- `AbsoluteFill`, `useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring` from `remotion`
- `Sequence`, `Audio`, `Video`, `Img` from `remotion`

### interpolate() issues
- **CRITICAL**: Every `interpolate()` call MUST have BOTH `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'`
- `inputRange` MUST be strictly monotonically increasing (each value > previous)
- Bad: `[0, 1, 0.4]` — CRASHES at runtime
- Good: `[0, 15, 30]` — actual frame numbers

### useCurrentFrame() bug
- Inside a `<Sequence>`, `useCurrentFrame()` already returns 0-relative frames
- NEVER subtract scene start frame — it's already 0 at sequence start

### Type mismatches
- `style.fontSize` must be `number`, not `string`
- `style.opacity` must be `number` 0-1
- `spring()` config: `{ fps, frame, config: { damping, stiffness, mass } }`

## Rules
- Fix ONLY the reported errors. Do not refactor surrounding code.
- If a fix requires adding an import, add only that import.
- If a fix requires changing a type, use the narrowest correct type.
- Never delete scene logic to fix a type error — find the correct type.
- After fixing, list what you changed and why.
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/healer-system.md
git commit -m "feat(sandbox): add healer subagent system prompt"
```

---

## Chunk 4: Orchestrator Subagent Registration

### Task 10: Register new subagents in orchestrator

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:64-128`

- [ ] **Step 1: Read orchestrator.ts to understand current subagent registration**

Read `packages/sandbox/src/orchestrator.ts` lines 64-128 (buildOrchestratorOptions function).

- [ ] **Step 2: Add prompt loading for new subagents**

Update the `Promise.all` at lines 68-74 to load the new prompts:

```typescript
const [orchestratorPrompt, animatorPrompt, researcherPrompt, trimmerPrompt, plannerPrompt, verifierPrompt, healerPrompt] =
  await Promise.all([
    loadPrompt('orchestrator-system'),
    loadPromptWithShared('animator-system'),
    loadPrompt('researcher-system'),
    loadPrompt('trimmer-system'),
    loadPrompt('planner-system'),
    loadPrompt('verifier-system'),
    loadPrompt('healer-system'),
  ]);
```

- [ ] **Step 3: Add new subagent definitions to the agents object**

After the existing `trimmer` subagent (line 121), add:

```typescript
planner: {
  description: 'Analyzes transcript and creates a detailed scene-by-scene plan with timing, display modes, and visual descriptions. Outputs SCENE_PLAN.md and scenes.json.',
  prompt: injectContext(plannerPrompt, ctx),
  tools: [
    'Read', 'Write', 'Glob', 'Grep',
    ...MANIFEST_TOOL_NAMES,
  ],
  model: 'opus',
},
verifier: {
  description: 'Reviews rendered scene screenshots against the plan. Takes screenshots, checks display mode compliance, and submits pass/fail verdicts.',
  prompt: verifierPrompt,
  tools: [
    'Read', 'Glob', 'Grep',
    ...RENDER_TOOL_NAMES,
    ...VIEWPORT_TOOL_NAMES,
  ],
  model: 'sonnet',
},
healer: {
  description: 'Fixes TypeScript compilation errors in Remotion scene files. Makes minimal targeted patches to resolve tsc errors.',
  prompt: healerPrompt,
  tools: [
    'Read', 'Edit', 'Glob', 'Grep', 'Bash',
  ],
  model: 'sonnet',
},
```

- [ ] **Step 4: Export new tool name lists**

Update the export at the bottom of orchestrator.ts:

```typescript
export { MANIFEST_TOOL_NAMES, SCENE_TOOL_NAMES, RENDER_TOOL_NAMES, WIDGET_TOOL_NAMES, ASSET_TOOL_NAMES, VIEWPORT_TOOL_NAMES };
```

- [ ] **Step 5: Type check**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat(sandbox): register planner, verifier, healer subagents in orchestrator"
```

---

### Task 11: Extend orchestrator system prompt

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md`

- [ ] **Step 1: Read the current orchestrator-system.md**

Read `packages/sandbox/src/prompts/orchestrator-system.md` to understand the current structure (1406 lines).

- [ ] **Step 2: Add Planner subagent dispatch rules**

Find the section that describes subagent dispatch (search for "animator" or "Agent" references). Add a section for the Planner:

```markdown
## Planner Subagent

When you have enough context to plan the visual story (user brief understood, style preferences gathered, key moments identified), dispatch the **planner** subagent.

**When to dispatch:**
- User has provided their brief/description
- You've asked any clarifying questions and received answers
- You know: style preference, tone, key moments to emphasize

**Task prompt should include:**
- Path to transcript: `/workspace/docs/transcript.json`
- Path to user brief: `/workspace/docs/user-brief.md`
- Path to head-tracking data: `/workspace/docs/speaker-grid.json` (if exists)
- Canvas: {{canvasWidth}}x{{canvasHeight}} at {{fps}}fps, {{durationMs}}ms total
- Style/tone preferences gathered from conversation
- Any specific moments the user wants to highlight

**After Planner returns:**
- Read `/workspace/docs/SCENE_PLAN.md` and `/workspace/scenes.json`
- Present the plan to the user via `show_widget` with kind: `scene_plan`
- Wait for user approval before proceeding to execution
```

- [ ] **Step 3: Add Verifier and Healer dispatch rules**

```markdown
## Verifier Subagent

After each scene is generated by the Animator, dispatch the **verifier** to review the rendered output.

**Task prompt should include:**
- Which scene number to verify
- The scene description from SCENE_PLAN.md
- The expected display mode (default/fullscreen/overlay)

**After Verifier returns:**
- If passed: move to next scene
- If failed with issues: dispatch **healer** to fix, then re-verify (max 2 rounds)

## Healer Subagent

When TypeScript compilation fails or the Verifier reports code issues, dispatch the **healer**.

**Task prompt should include:**
- The specific error messages (from tsc output or Verifier verdict)
- The scene file path(s) that need fixing

**After Healer returns:**
- Re-run `tsc --noEmit` via Bash to verify the fix
- If still failing: retry healer once more, then warn the user
```

- [ ] **Step 4: Add progress tracking protocol**

```markdown
## Progress Tracking

After completing each major step, update `/workspace/generation-progress.json`:
- After planning: set `phase: "planned"`, `planApproved: false`, `totalScenes: N`
- After plan approval: set `planApproved: true`
- After each scene: add scene number to `completedScenes`, update `currentScene`
- After TS verification: set `tsVerified: true`
- On errors: set `lastError` with description

Read this file at the start of each turn to recover state after context compaction.
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md
git commit -m "feat(sandbox): add planner/verifier/healer dispatch rules to orchestrator prompt"
```

---

## Chunk 5: Docker Image & Integration

### Task 12: Update Dockerfile

**Files:**
- Modify: `packages/sandbox/Dockerfile`

- [ ] **Step 1: Read current Dockerfile**

Read `packages/sandbox/Dockerfile` to understand the current build stages.

- [ ] **Step 2: Add MCP server files and dependencies**

In the build stage, add:
```dockerfile
# Copy MCP server compiled files
COPY packages/mcp-servers/dist/ /app/mcp-servers/
```

In the production stage, add npm packages for MCP:
```dockerfile
# Install MCP dependencies (use node directly, not .CMD shims)
RUN npm install -g mcp-remote better-icons
```

Add `unzip` to the apt-get install list (for Freepik ZIP extraction):
```dockerfile
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    python3 \
    unzip \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 3: Add environment variable documentation**

Add a comment block:
```dockerfile
# Environment variables for MCP servers (optional):
# FREEPIK_API_KEY — Freepik icon/illustration search
# PEXELS_API_KEY — Pexels stock photo search
# UNSPLASH_ACCESS_KEY — Unsplash stock photo search
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/Dockerfile
git commit -m "feat(sandbox): add MCP server deps and asset tools to Docker image"
```

---

### Task 13: Wire scene-registry regeneration into esbuild watcher

**Files:**
- Modify: `packages/sandbox/src/esbuild-watcher.ts`

- [ ] **Step 1: Read esbuild-watcher.ts to find where scene-registry is currently handled**

Read `packages/sandbox/src/esbuild-watcher.ts` and find the scene-registry generation logic.

- [ ] **Step 2: Import and use the new regenerateSceneRegistry utility**

Add import:
```typescript
import { regenerateSceneRegistry } from './tools/scene-registry.js';
```

Replace any inline scene-registry generation with a call to `regenerateSceneRegistry()` in the build function (before the esbuild step).

- [ ] **Step 3: Type check and test build**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/esbuild-watcher.ts
git commit -m "refactor(sandbox): use shared scene-registry generator in esbuild watcher"
```

---

## Chunk 6: End-to-End Smoke Test

### Task 14: Manual integration test

- [ ] **Step 1: Build the sandbox package**

Run: `cd packages/sandbox && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Verify all prompts load**

Run a quick Node.js check that all 7 prompts load:
```bash
cd packages/sandbox && node -e "
const { loadPrompt, loadPromptWithShared } = require('./dist/prompts/prompt-loader.js');
Promise.all([
  loadPrompt('orchestrator-system'),
  loadPromptWithShared('animator-system'),
  loadPrompt('researcher-system'),
  loadPrompt('trimmer-system'),
  loadPrompt('planner-system'),
  loadPrompt('verifier-system'),
  loadPrompt('healer-system'),
]).then(prompts => {
  prompts.forEach((p, i) => console.log('Prompt', i, ':', p.length, 'chars'));
  console.log('All prompts loaded successfully');
}).catch(err => console.error('FAILED:', err));
"
```
Expected: 7 prompts loaded with character counts

- [ ] **Step 3: Verify orchestrator options build**

```bash
cd packages/sandbox && node -e "
const { buildOrchestratorOptions } = require('./dist/orchestrator.js');
const ctx = { canvasWidth: 1080, canvasHeight: 1920, fps: 30, durationMs: 60000, hasTranscript: true };
buildOrchestratorOptions(ctx).then(opts => {
  console.log('Agents:', Object.keys(opts.agents));
  console.log('Tools:', opts.allowedTools.length, 'tools');
  console.log('MCP servers:', Object.keys(opts.mcpServers || {}));
  console.log('Build succeeded');
}).catch(err => console.error('FAILED:', err));
"
```
Expected: Agents list includes planner, verifier, healer. MCP servers include assets, viewport, better-icons.

- [ ] **Step 4: Commit all remaining changes**

```bash
git add -A
git commit -m "feat(sandbox): complete sandbox agent pipeline foundation"
```

---

## Summary

| Chunk | Tasks | What It Delivers |
|-------|-------|-----------------|
| 1: Foundation | 1-4 | Extended init payload, prompt context, scene-registry utility, API wiring |
| 2: MCP Wiring | 5-6 | Stdio MCP servers (assets, viewport, freepik, icons) connected to orchestrator |
| 3: Subagent Prompts | 7-9 | Planner, Verifier, Healer system prompts written |
| 4: Orchestrator Registration | 10-11 | New subagents registered, orchestrator prompt extended with dispatch rules |
| 5: Docker & Integration | 12-13 | Docker image updated, scene-registry wired |
| 6: Smoke Test | 14 | Build verification, prompt loading, orchestrator options check |

**After this plan:** The sandbox agent has all 6 subagents wired, all MCP tools connected, and all prompts loaded. The next step would be testing the full conversation flow end-to-end with a real video project.
