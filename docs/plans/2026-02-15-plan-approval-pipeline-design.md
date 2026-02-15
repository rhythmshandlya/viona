# Plan Approval Pipeline Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the visual generation pipeline so the Director's plan is shown to the user for approval before the Animator generates code.

**Architecture:** Add a `--phase` flag to the Python generator script to run Director and Animator independently. Introduce a `plan-visuals` BullMQ job for the Director phase. Store the plan in the DB so the chat agent can read and edit it. Show the plan in a collapsible widget. Only run the Animator after user approval.

**Tech Stack:** Python CLI (`claude_visual_generator.py`), BullMQ, PostgreSQL (Drizzle), Fastify, React (widget component)

---

## Context

The worker runs a two-phase visual generation pipeline:

1. **Director** (Sonnet) — Analyzes transcript, creates `scene_plan.md` (narrative reasoning) and `scenes.json` (structured scene data with frame-level timing, sync points, layouts).
2. **Animator** (Opus) — Reads the plan, generates Remotion TypeScript code scene-by-scene, validates, bundles.

Currently both phases run as a single Python subprocess spawned by one `generate-visuals` BullMQ job. The user never sees the Director's plan — it goes straight to code generation.

The user should see and approve the plan before committing to the expensive Animator phase. From the user's perspective, there is one agent — the chat agent handles plan presentation, edits, and approval seamlessly.

---

## 1. Job Pipeline Split

### Current

One job type: `generate-visuals` → Python subprocess runs Director + Animator → bundle.

### New

Two job types:

**`plan-visuals`** — Director phase only.
- Python subprocess with `--phase director`
- Creates `scene_plan.md` + `scenes.json` in workspace
- On completion, outputs `PLAN_READY:{json}` on stdout
- TypeScript processor parses this and stores it in the job's `planData` column
- Job completes

**`generate-visuals`** — Animator phase only (when called after plan approval).
- Python subprocess with `--phase animator`
- Reads existing `scene_plan.md` + `scenes.json` from workspace
- If files don't exist (workspace cleaned), TypeScript processor writes them from DB `planData` before spawning
- Same bundling, upload, DB storage as today
- No `--phase` flag (default) keeps current two-phase behavior for backwards compatibility

### DB Schema Change

Add `planData` jsonb column to the `jobs` table:

```typescript
planData: jsonb('plan_data').$type<{
  scenePlan: string;   // Full scene_plan.md markdown content
  scenes: object;      // Full scenes.json object
} | null>()
```

### Queue Changes

New queue and job data type in `packages/api/src/services/queue.ts`:

```typescript
export interface PlanVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic';
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
  styleGuide?: string;
}

export const planVisualsQueue = new Queue('plan-visuals', { connection });

export async function queuePlanVisualsJob(data: PlanVisualsJobData) {
  return planVisualsQueue.add('plan-visuals', data, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
  });
}
```

`GenerateVisualsJobData` gets an optional `planJobId` field so the Animator processor can read plan data from the planning job if workspace files are missing:

```typescript
export interface GenerateVisualsJobData {
  // ... existing fields ...
  planJobId?: string;  // ID of the plan-visuals job that created the plan
}
```

---

## 2. Python Script Changes

**File:** `packages/worker/src/agents/claude_visual_generator.py`

Add `--phase` CLI argument (argparse):
- `--phase director` — Runs `_run_director()` only. After completion, reads `scene_plan.md` and `scenes.json` from workspace, outputs `PLAN_READY:{json}` on stdout, exits 0.
- `--phase animator` — Runs `_run_animator()` only. Expects plan files to exist in workspace already.
- No flag — Current behavior (both phases sequentially).

Stdout protocol for `plan-visuals` jobs:

```
PROGRESS:15:Analyzing transcript...
PROGRESS:30:Planning scenes...
PROGRESS:50:Writing plan...
PLAN_READY:{"scenePlan":"# Scene Plan\n...","scenes":{"projectId":"...","scenes":[...]}}
```

The TypeScript processor parses `PLAN_READY:` lines the same way it currently parses `PROGRESS:` lines.

---

## 3. Worker Processor Changes

### New: `plan-visuals` processor

**File:** `packages/worker/src/processors/plan-visuals.ts`

Modeled after `generate-visuals.ts` but simpler:

1. Load project + transcript from DB
2. Create/clean workspace directory
3. Spawn Python with `--phase director` + same args (transcript, dimensions, style, etc.)
4. Parse `PROGRESS:` lines for progress updates
5. Parse `PLAN_READY:` line → extract JSON
6. Store `planData` in job record: `db.update(jobs).set({ planData, status: 'completed' })`
7. Publish job completion

### Modified: `generate-visuals` processor

Before spawning the Python subprocess:
1. Check if `scene_plan.md` and `scenes.json` exist in workspace
2. If not, read `planData` from the associated plan job (via `planJobId`) and write the files to workspace
3. Spawn Python with `--phase animator`
4. Rest of the flow unchanged (metadata reading, asset extraction, bundling, upload)

---

## 4. Chat Agent Tool Changes

### Modified: `generate_visuals` tool

Renamed conceptually to "plan and generate." New behavior:

1. Queue `plan-visuals` job (not `generate-visuals`)
2. Poll job until complete (same `pollJobProgress` pattern)
3. Read `planData` from completed job record
4. Send a `propose_plan` widget via `ctx.sendSSE('widget', ...)` with the real Director plan data
5. Return `{ status: 'plan_shown', waitingForApproval: true, planJobId }`

The tool no longer triggers the Animator — it only plans.

### Modified: `propose_plan` tool

No longer creates its own plan. Instead, receives plan data from `generate_visuals` tool output (or from the chat agent when re-showing an edited plan). The widget payload includes:

```typescript
{
  id: widgetId,
  kind: 'scene_plan',
  scenes: scenesJson.scenes,  // Array of scene objects from scenes.json
  scenePlanMarkdown: planData.scenePlan,  // Full scene_plan.md content
  metadata: {
    primaryMetaphor: scenesJson.primaryMetaphor,
    colorPalette: scenesJson.colorPalette,
    totalScenes: scenesJson.totalScenes,
    durationSeconds: scenesJson.durationSeconds,
  },
  requiresApproval: true,
}
```

### New: `start_generation` tool

Called after user approves the plan:

1. Accepts `planJobId` (from the plan-visuals job) and optionally updated `planData` (if the chat agent edited scenes)
2. If plan was edited, updates the plan job's `planData` in DB
3. Queues `generate-visuals` job with `planJobId` reference
4. Polls until complete (same progress streaming)
5. Returns generation result

### Plan edits (no new tool needed)

When the user says "change scene 3 to show X," the chat agent:
1. Already has the `scenes.json` data from the plan
2. Modifies the relevant scene in memory
3. Calls `propose_plan` again with the updated data
4. On final approval, passes the edited plan to `start_generation`

---

## 5. Frontend Widget Changes

### Updated `ScenePlanCard` widget

**Data shape change:**

```typescript
interface ScenePlanWidgetData {
  id: string;
  kind: 'scene_plan';
  scenes: Array<{
    id: number;
    name: string;
    timestampRange: [number, number];
    visual: string;
    emotion: string;
    keySync?: { word: string; timestamp: number; visualEvent: string };
  }>;
  scenePlanMarkdown?: string;  // New: full scene_plan.md for expanded view
  metadata?: {
    primaryMetaphor?: string;
    colorPalette?: string;
    totalScenes?: number;
    durationSeconds?: number;
  };
  requiresApproval: boolean;
}
```

**Collapsed view (default):**
- Summary header: "{N} scenes, {duration}s, {colorPalette}"
- Primary metaphor line
- Compact scene list: scene name + time range + one-line visual description
- Approve / Reject buttons

**Expanded view (click "View full plan"):**
- Full `scene_plan.md` rendered as markdown (using existing `ReactMarkdown` + `remarkGfm`)
- Same approve/reject buttons at bottom

**WidgetBlock type update** in `AIAssistantPanel.tsx`:

Add `scenePlanMarkdown` and `metadata` to the widget interface to accommodate the new fields. The `normalizeContent` function already passes arrays through, so persisted widgets with these fields load correctly on refresh.

---

## 6. System Prompt Update

Update `agent-system-prompt.ts` behavior rules:

```
3. For new generation: gather preferences using widgets (theme, layout),
   then call generate_visuals to create a plan. Show the plan to the user
   and wait for approval. If the user requests changes, edit the plan and
   re-show it. Only call start_generation after the user approves.
```

---

## What Doesn't Change

- Director/Animator system prompts (content unchanged)
- Workspace file structure (`src/proj_xxx/`)
- Bundle compilation, upload, S3 storage
- Edit visuals flow (no plan step for edits)
- Frontend SSE parser, streaming, message types
- Conversation persistence
- Authentication, CORS, PassThrough streaming

---

## Error Handling

- **Director fails:** Chat agent shows error, user can retry `generate_visuals`
- **User abandons plan:** No Animator job queued — nothing wasted
- **Animator fails:** Same as today — error shown, can retry `start_generation`
- **Workspace cleaned between plan and generation:** Processor writes plan files from DB before spawning Animator
- **Plan job not found:** `start_generation` returns error, agent asks user to re-plan
