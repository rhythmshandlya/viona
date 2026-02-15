# Plan Approval Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split visual generation so the Director's plan is shown to the user for approval before the Animator runs.

**Architecture:** Add `--phase` flag to Python generator, new `plan-visuals` BullMQ job, store plan in DB, show in collapsible widget, run Animator only after approval.

**Tech Stack:** Python (argparse), BullMQ, PostgreSQL/Drizzle, Fastify, React/TypeScript

---

## Reference Files

- Design doc: `docs/plans/2026-02-15-plan-approval-pipeline-design.md`
- Python generator: `packages/worker/src/agents/claude_visual_generator.py` (argparse at line ~3107, `generate_two_phase` at ~2852, `_run_director` at ~2574, `_run_animator` at ~2727)
- Generate visuals processor: `packages/worker/src/processors/generate-visuals.ts` (`processGenerateVisualsJob` at line 317, `runClaudeCodeGenerator` at line 703)
- Worker entry: `packages/worker/src/index.ts` (worker registration at line 162)
- Queue definitions: `packages/api/src/services/queue.ts` (`GenerateVisualsJobData` at line 112, `queueGenerateVisualsJob` at line 123)
- DB schema: `packages/api/src/db/schema.ts` (`jobs` table at line 59)
- Agent tools: `packages/api/src/agent/agent-tools.ts` (`generate_visuals` tool at line 238, `propose_plan` tool at line 213)
- Agent system prompt: `packages/api/src/agent/agent-system-prompt.ts`
- ScenePlanCard widget: `apps/web/src/features/editor-v2/components/agent-widgets/ScenePlanCard.tsx`
- AIAssistantPanel: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` (WidgetBlock type at line 29, renderWidget at line 405)

---

### Task 1: Add `planData` column to `jobs` table

**Files:**
- Create: `packages/api/drizzle/0013_add_job_plan_data.sql`
- Modify: `packages/api/src/db/schema.ts:59-79`

**Step 1: Create migration file**

```sql
-- packages/api/drizzle/0013_add_job_plan_data.sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS plan_data JSONB;
```

**Step 2: Run migration**

Run: `cd packages/api && npx tsx src/db/migrate.ts`
If no migrate script exists, run directly: `psql $DATABASE_URL -f drizzle/0013_add_job_plan_data.sql`

**Step 3: Update Drizzle schema**

In `packages/api/src/db/schema.ts`, add `planData` to the `jobs` table definition, after the `logs` field (line 76):

```typescript
  logs: text('logs').array(),
  planData: jsonb('plan_data').$type<{
    scenePlan: string;
    scenes: Record<string, unknown>;
  } | null>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
```

**Step 4: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: Only the pre-existing `minio.ts` error.

**Step 5: Commit**

```bash
git add packages/api/drizzle/0013_add_job_plan_data.sql packages/api/src/db/schema.ts
git commit -m "feat: add planData column to jobs table"
```

---

### Task 2: Add `plan-visuals` queue and job type

**Files:**
- Modify: `packages/api/src/services/queue.ts:112-131`

**Step 1: Add PlanVisualsJobData interface and queue**

After the `queueGenerateVisualsJob` function (line 131), add:

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
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  });
}
```

**Step 2: Add `planJobId` to `GenerateVisualsJobData`**

At line 112, add `planJobId` to the existing interface:

```typescript
export interface GenerateVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic';
  layoutMode: VisualsLayoutMode;
  dimensions: VisualsDimensions;
  styleGuide?: string;
  planJobId?: string;  // ID of the plan-visuals job that created the plan
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add packages/api/src/services/queue.ts
git commit -m "feat: add plan-visuals queue and job type"
```

---

### Task 3: Add `--phase` flag to Python generator

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py:3107-3167`

**Step 1: Add `--phase` argument to argparse**

At line ~3124 (after the last `add_argument`), add:

```python
parser.add_argument("--phase", choices=["director", "animator"], default=None,
                    help="Run only a specific phase (director or animator). Default: both.")
```

**Step 2: Add Director-only output logic**

In the `main()` function, after `generate_two_phase` is called (line ~3154-3164), replace the result handling with phase-aware logic. The key change: when `--phase director`, run only `_run_director()`, then read `scene_plan.md` and `scenes.json` from workspace, output `PLAN_READY:{json}` on stdout, and exit.

Find the section in `main()` where `generate_two_phase` is called (around line 3140-3167). Replace with:

```python
        if args.phase == "director":
            # Phase 1 only: run Director, output plan data
            generator = ClaudeVisualGenerator(
                workspace_path=args.workspace,
                project_id=args.project_id,
                bundle_output_dir=args.bundle_output,
                model=args.model,
                style_preset=args.style_preset,
                layout_mode=args.layout_mode,
            )

            # Format transcript with word timestamps
            formatted_transcript = generator._format_transcript_with_words(
                transcript_text, words, fps=args.fps
            )

            director_result = await generator._run_director(
                formatted_transcript=formatted_transcript,
                width=args.width,
                height=args.height,
                duration_frames=args.duration,
                fps=args.fps,
                style_preset=args.style_preset,
                layout_mode=args.layout_mode,
                style_guide=style_guide_text,
            )

            # Read generated plan files
            import os
            project_dir = os.path.join(args.workspace, "src", args.project_id)
            scene_plan_path = os.path.join(project_dir, "SCENE_PLAN.md")
            scenes_path = os.path.join(project_dir, "scenes.json")

            scene_plan_md = ""
            scenes_json = {}

            if os.path.exists(scene_plan_path):
                with open(scene_plan_path, "r", encoding="utf-8") as f:
                    scene_plan_md = f.read()

            if os.path.exists(scenes_path):
                with open(scenes_path, "r", encoding="utf-8") as f:
                    scenes_json = json.loads(f.read())

            plan_data = {"scenePlan": scene_plan_md, "scenes": scenes_json}
            print(f"PLAN_READY:{json.dumps(plan_data)}")
            sys.stdout.flush()

            print(json.dumps({"success": True, "phase": "director", "planReady": True}))
            sys.stdout.flush()

        elif args.phase == "animator":
            # Phase 2 only: run Animator (expects plan files to exist)
            generator = ClaudeVisualGenerator(
                workspace_path=args.workspace,
                project_id=args.project_id,
                bundle_output_dir=args.bundle_output,
                model=args.model,
                style_preset=args.style_preset,
                layout_mode=args.layout_mode,
            )

            animator_result = await generator._run_animator(
                width=args.width,
                height=args.height,
                duration_frames=args.duration,
                fps=args.fps,
            )

            # Run validation and bundling (same as existing two-phase)
            await generator._validate_and_bundle()

            result = {
                "success": True,
                "phase": "animator",
                "bundleUrl": f"/bundles/{args.project_id}/",
                "bundlePath": os.path.join(args.bundle_output, args.project_id),
                "filesWritten": animator_result.get("files_written", 0),
                "durationMs": int((time.time() - start_time) * 1000),
                "status": "completed"
            }
            print(json.dumps(result, indent=2))
            sys.stdout.flush()

        else:
            # Default: both phases (existing behavior)
            result = await generator.generate_two_phase(...)
            print(json.dumps(result, indent=2))
            sys.stdout.flush()
```

Note: The exact implementation depends on how `ClaudeVisualGenerator` is constructed and how `_validate_and_bundle()` works. The implementer should read the constructor (look for `__init__`) and the bundling section at the end of `generate_two_phase` to understand the exact initialization and post-processing needed. The key contract is:
- `--phase director` → creates `SCENE_PLAN.md` + `scenes.json` in `src/{projectId}/`, outputs `PLAN_READY:{json}` then a success JSON
- `--phase animator` → expects plan files to exist, generates code, validates, bundles, outputs result JSON
- No `--phase` → existing behavior unchanged

**Step 3: Verify Python script runs with `--help`**

Run: `cd packages/worker && python src/agents/claude_visual_generator.py --help`
Expected: Shows `--phase` in the help output.

**Step 4: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat: add --phase flag to Python visual generator"
```

---

### Task 4: Create `plan-visuals` worker processor

**Files:**
- Create: `packages/worker/src/processors/plan-visuals.ts`
- Modify: `packages/worker/src/index.ts:10,162-180`

**Step 1: Create the processor**

Create `packages/worker/src/processors/plan-visuals.ts`. Model it after `generate-visuals.ts` but simpler — no bundling, no S3 upload, no metadata extraction. Key differences:

1. Spawn Python with `--phase director` added to args
2. Parse `PLAN_READY:{json}` lines from stdout (in addition to `PROGRESS:` lines)
3. Store parsed `planData` in the job record
4. Mark job as completed

```typescript
// packages/worker/src/processors/plan-visuals.ts

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { writeFile, readdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';
import { db, projects, transcripts, jobs } from '../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError, registerCancelHandler, unregisterCancelHandler } from '../services/redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getWorkspacePath, createProjectDir } from '../workspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface PlanVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: string;
  layoutMode: string;
  dimensions: { width: number; height: number };
  styleGuide?: string;
}

export async function processPlanVisualsJob(job: Job<PlanVisualsJobData>) {
  const { projectId, jobId, stylePreset, layoutMode, dimensions, styleGuide } = job.data;
  const compositionId = `proj_${projectId.replace(/-/g, '_')}`;

  try {
    await db.update(jobs).set({ status: 'processing', progress: 0 }).where(eq(jobs.id, jobId));
    await publishJobProgress(jobId, 5, 'Loading project...');

    // Load project and transcript
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) throw new Error('Project not found');

    const transcript = await db.query.transcripts.findFirst({ where: eq(transcripts.projectId, projectId) });
    if (!transcript || !transcript.words) throw new Error('Project has no transcript');

    await publishJobProgress(jobId, 10, 'Preparing workspace...');

    // Clean old compositions and create project dir
    const workspacePath = getWorkspacePath();
    const srcDir = join(workspacePath, 'src');
    try {
      const entries = await readdir(srcDir);
      for (const entry of entries) {
        if (entry.startsWith('proj_') && entry !== compositionId) {
          await rm(join(srcDir, entry), { recursive: true, force: true });
        }
      }
    } catch { /* may not exist */ }

    createProjectDir(compositionId);

    await publishJobProgress(jobId, 15, 'Director analyzing transcript...');

    // Prepare transcript files
    const words = transcript.words as any[];
    const transcriptText = words.map((w: any) => w.word || w.text || '').join(' ');
    const transcriptPath = join(tmpdir(), `claude-transcript-${jobId}.txt`);
    await writeFile(transcriptPath, transcriptText, 'utf-8');

    const wordsPath = join(tmpdir(), `claude-words-${jobId}.json`);
    await writeFile(wordsPath, JSON.stringify(words), 'utf-8');

    let styleGuidePath: string | null = null;
    if (styleGuide?.trim()) {
      styleGuidePath = join(tmpdir(), `claude-styleguide-${jobId}.txt`);
      await writeFile(styleGuidePath, styleGuide, 'utf-8');
    }

    const durationFrames = Math.ceil(((project.durationMs || 60000) / 1000) * (project.fps || 30));

    // Spawn Python with --phase director
    const pythonPath = config.pythonPath;
    const agentScript = join(__dirname, '..', 'agents', 'claude_visual_generator.py');

    const args = [
      agentScript,
      '--workspace', workspacePath,
      '--project-id', compositionId,
      '--bundle-output', config.remotion.bundleOutputDir,
      '--transcript', transcriptPath,
      '--words-json', wordsPath,
      '--width', String(dimensions.width),
      '--height', String(dimensions.height),
      '--duration', String(durationFrames),
      '--fps', String(project.fps || 30),
      '--model', config.claudeAgent.model,
      '--style-preset', stylePreset,
      '--layout-mode', layoutMode,
      '--phase', 'director',
    ];
    if (styleGuidePath) args.push('--style-guide', styleGuidePath);

    const subprocess = spawn(pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });

    registerCancelHandler(jobId, () => subprocess.kill('SIGTERM'));

    let stdout = '';
    let stderr = '';
    let planData: { scenePlan: string; scenes: Record<string, unknown> } | null = null;

    subprocess.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stdout += text;

      for (const line of text.split('\n')) {
        const progressMatch = line.match(/^PROGRESS:(\d+):(.+)$/);
        if (progressMatch) {
          publishJobProgress(jobId, parseInt(progressMatch[1], 10), progressMatch[2]);
        }

        if (line.startsWith('PLAN_READY:')) {
          try {
            planData = JSON.parse(line.slice('PLAN_READY:'.length));
          } catch (e) {
            logger.error({ projectId, error: e }, 'Failed to parse PLAN_READY data');
          }
        }
      }
    });

    subprocess.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        subprocess.kill('SIGTERM');
        reject(new Error('Director phase timed out'));
      }, 600_000); // 10 min timeout for planning

      subprocess.on('close', (code) => {
        clearTimeout(timeout);
        code === 0 ? resolve() : reject(new Error(`Director exited with code ${code}: ${stderr.slice(-500)}`));
      });
      subprocess.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });

    unregisterCancelHandler(jobId);

    if (!planData) {
      throw new Error('Director completed but no PLAN_READY data received');
    }

    // Store plan data in job record
    await db.update(jobs).set({
      status: 'completed',
      progress: 100,
      progressMessage: 'Plan ready for approval',
      planData,
      completedAt: new Date(),
    }).where(eq(jobs.id, jobId));

    await publishJobComplete(jobId);

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ projectId, jobId, error }, 'Plan visuals job failed');
    await db.update(jobs).set({ status: 'failed', error: msg }).where(eq(jobs.id, jobId));
    await publishJobError(jobId, msg);
    throw error;
  }
}
```

**Step 2: Register the worker in `packages/worker/src/index.ts`**

Add import at line 10:
```typescript
import { processPlanVisualsJob, PlanVisualsJobData } from './processors/plan-visuals.js';
```

After the generate-visuals worker registration (around line 180), add:

```typescript
  // Plan visuals worker - Director phase only
  const planVisualsWorker = new Worker<PlanVisualsJobData>(
    'plan-visuals',
    async (job) => {
      logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Processing plan-visuals job');
      await processPlanVisualsJob(job);
    },
    {
      connection,
      concurrency: 1,
      limiter: { max: 1, duration: 1000 },
    }
  );

  planVisualsWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Plan-visuals job completed');
  });

  planVisualsWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Plan-visuals job failed');
  });
```

**Step 3: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add packages/worker/src/processors/plan-visuals.ts packages/worker/src/index.ts
git commit -m "feat: add plan-visuals worker processor (Director phase only)"
```

---

### Task 5: Modify `generate-visuals` processor to support Animator-only mode

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals.ts:317-395,703-778`

**Step 1: Write plan files from DB before spawning Animator**

In `processGenerateVisualsJob`, after workspace preparation (around line 366) and before calling `runClaudeCodeGenerator` (line 381), add logic to write plan files from `planJobId`:

```typescript
    // If this is an Animator-only run (plan was created separately), ensure plan files exist
    if (job.data.planJobId) {
      const planJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.data.planJobId) });
      if (planJob?.planData) {
        const pd = planJob.planData as { scenePlan: string; scenes: Record<string, unknown> };
        const scenePlanPath = join(projectDir, 'SCENE_PLAN.md');
        const scenesJsonPath = join(projectDir, 'scenes.json');
        await writeFile(scenePlanPath, pd.scenePlan, 'utf-8');
        await writeFile(scenesJsonPath, JSON.stringify(pd.scenes, null, 2), 'utf-8');
        logger.info({ projectId }, 'Wrote plan files from DB for Animator phase');
      }
    }
```

**Step 2: Pass `--phase animator` when `planJobId` is present**

In `runClaudeCodeGenerator` (line 703), add `--phase animator` to args when `planJobId` is provided. Add `planJobId` to the `ClaudeCodeOptions` interface and pass it through:

In the options interface (around line 680):
```typescript
interface ClaudeCodeOptions {
  // ... existing fields ...
  planJobId?: string;
}
```

In the args array construction (around line 741-764), add:
```typescript
    if (options.planJobId) {
      args.push('--phase', 'animator');
    }
```

Pass `planJobId` from `processGenerateVisualsJob` to `runClaudeCodeGenerator`:
```typescript
    const claudeResult = await runClaudeCodeGenerator({
      // ... existing fields ...
      planJobId: job.data.planJobId,
    });
```

**Step 3: Verify TypeScript compiles**

Run: `cd packages/worker && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add packages/worker/src/processors/generate-visuals.ts
git commit -m "feat: support Animator-only mode in generate-visuals processor"
```

---

### Task 6: Update agent tools — split `generate_visuals` and add `start_generation`

**Files:**
- Modify: `packages/api/src/agent/agent-tools.ts:12-20,238-300`

**Step 1: Update TOOL_NAMES**

Replace `generate_visuals` with `plan_visuals` and add `start_generation`:

```typescript
export const TOOL_NAMES = [
  `mcp__${MCP_SERVER_NAME}__analyze_transcript`,
  `mcp__${MCP_SERVER_NAME}__get_current_visuals`,
  `mcp__${MCP_SERVER_NAME}__get_scene_details`,
  `mcp__${MCP_SERVER_NAME}__show_widget`,
  `mcp__${MCP_SERVER_NAME}__propose_plan`,
  `mcp__${MCP_SERVER_NAME}__plan_visuals`,
  `mcp__${MCP_SERVER_NAME}__start_generation`,
  `mcp__${MCP_SERVER_NAME}__edit_visuals`,
];
```

**Step 2: Replace `generate_visuals` tool with `plan_visuals`**

Replace the `generate_visuals` tool (lines 238-300) with:

```typescript
      tool(
        'plan_visuals',
        'Create a visual plan for the project. This runs the Director phase which analyzes the transcript and creates a scene-by-scene plan. Call this after the user has selected a theme and layout. The plan will be shown to the user for approval before any code is generated.',
        {
          stylePreset: z.enum(['minimal', 'modern', 'playful', 'bold', 'classic']),
          layoutMode: z.enum(['pip', 'split-horizontal', 'split-vertical']),
          styleGuide: z.string().optional(),
        },
        async ({ stylePreset, layoutMode, styleGuide }) => {
          const project = await db.query.projects.findFirst({
            where: eq(projects.id, ctx.projectId),
          });

          if (!project) {
            return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Project not found.' }) }] };
          }

          const canvasWidth = (project.videoSettings as Record<string, unknown>)?.canvasWidth as number | undefined ?? 1080;
          const canvasHeight = (project.videoSettings as Record<string, unknown>)?.canvasHeight as number | undefined ?? 1920;

          let dimensions = { width: canvasWidth, height: canvasHeight };
          if (layoutMode === 'split-horizontal') {
            dimensions = { width: Math.round(canvasWidth / 2), height: canvasHeight };
          } else if (layoutMode === 'split-vertical') {
            dimensions = { width: canvasWidth, height: Math.round(canvasHeight / 2) };
          }

          const [job] = await db.insert(jobs).values({
            projectId: ctx.projectId,
            type: 'plan-visuals',
            status: 'pending',
          }).returning();

          await queuePlanVisualsJob({
            projectId: ctx.projectId,
            jobId: job.id,
            stylePreset: stylePreset as any,
            layoutMode: layoutMode as any,
            dimensions,
            styleGuide,
          });

          ctx.sendSSE('progress', { percent: 5, message: 'Director analyzing transcript...' });

          // Poll until Director completes
          await pollJobProgress(job.id, ctx);

          // Read plan data from completed job
          const completedJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) });
          const planData = completedJob?.planData as { scenePlan: string; scenes: Record<string, unknown> } | null;

          if (!planData || !planData.scenes) {
            return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Director failed to create a plan.' }) }] };
          }

          const scenesObj = planData.scenes as any;
          const scenes = scenesObj.scenes || [];

          // Send the plan as a widget for user approval
          const widgetId = nanoid(8);
          ctx.sendSSE('widget', {
            id: widgetId,
            kind: 'scene_plan',
            scenes: scenes.map((s: any) => ({
              startMs: Math.round((s.timestampRange?.[0] || 0) * 1000),
              endMs: Math.round((s.timestampRange?.[1] || 0) * 1000),
              title: s.name || `Scene ${s.id}`,
              description: s.visual || s.emotion || '',
            })),
            scenePlanMarkdown: planData.scenePlan,
            metadata: {
              primaryMetaphor: scenesObj.primaryMetaphor,
              colorPalette: scenesObj.colorPalette,
              totalScenes: scenesObj.totalScenes,
              durationSeconds: scenesObj.durationSeconds,
            },
            requiresApproval: true,
          });

          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              planJobId: job.id,
              widgetId,
              status: 'plan_shown',
              waitingForApproval: true,
              sceneCount: scenes.length,
            }) }],
          };
        },
      ),
```

**Step 3: Add `start_generation` tool**

After `plan_visuals`, add:

```typescript
      tool(
        'start_generation',
        'Start generating visuals using an approved plan. Call this only after the user has approved the scene plan from plan_visuals. Pass the planJobId from the plan_visuals result.',
        {
          planJobId: z.string(),
        },
        async ({ planJobId }) => {
          // Verify the plan job exists and completed
          const planJob = await db.query.jobs.findFirst({ where: eq(jobs.id, planJobId) });
          if (!planJob || planJob.status !== 'completed' || !planJob.planData) {
            return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Plan job not found or not completed. Run plan_visuals first.' }) }] };
          }

          const project = await db.query.projects.findFirst({
            where: eq(projects.id, ctx.projectId),
          });
          if (!project) {
            return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Project not found.' }) }] };
          }

          const canvasWidth = (project.videoSettings as Record<string, unknown>)?.canvasWidth as number | undefined ?? 1080;
          const canvasHeight = (project.videoSettings as Record<string, unknown>)?.canvasHeight as number | undefined ?? 1920;

          const [genJob] = await db.insert(jobs).values({
            projectId: ctx.projectId,
            type: 'generate-visuals',
            status: 'pending',
          }).returning();

          await queueGenerateVisualsJob({
            projectId: ctx.projectId,
            jobId: genJob.id,
            stylePreset: (project.videoSettings as any)?.stylePreset || 'modern',
            layoutMode: (project.videoSettings as any)?.layoutMode || 'pip',
            dimensions: { width: canvasWidth, height: canvasHeight },
            planJobId,
          });

          ctx.sendSSE('progress', { percent: 5, message: 'Starting visual generation...' });

          await pollJobProgress(genJob.id, ctx);

          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              jobId: genJob.id,
              status: 'completed',
              message: 'Visuals generated successfully.',
            }) }],
          };
        },
      ),
```

**Step 4: Add import for `queuePlanVisualsJob`**

At the top of `agent-tools.ts`, update the import from queue.ts:

```typescript
import { queueGenerateVisualsJob, queueEditVisualsJob, queuePlanVisualsJob } from '../services/queue.js';
```

**Step 5: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts
git commit -m "feat: split generate_visuals into plan_visuals + start_generation tools"
```

---

### Task 7: Update `ScenePlanCard` widget with collapsible full plan

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/agent-widgets/ScenePlanCard.tsx`
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:29-38,405-443`

**Step 1: Update `ScenePlanCard` component**

Rewrite `ScenePlanCard.tsx` to support `scenePlanMarkdown` and `metadata` props with a collapsible expanded view:

```tsx
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Scene {
  startMs: number;
  endMs: number;
  title: string;
  description: string;
}

interface PlanMetadata {
  primaryMetaphor?: string;
  colorPalette?: string;
  totalScenes?: number;
  durationSeconds?: number;
}

interface ScenePlanCardProps {
  scenes: Scene[];
  scenePlanMarkdown?: string;
  metadata?: PlanMetadata;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
  approved?: boolean;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ScenePlanCard({
  scenes,
  scenePlanMarkdown,
  metadata,
  onApprove,
  onReject,
  disabled,
  approved,
}: ScenePlanCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2 border border-[var(--editor-border-subtle)] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--editor-bg-hover)] border-b border-[var(--editor-border-subtle)]">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-[var(--editor-text-primary)]">Scene Plan</span>
            <span className="text-xs text-[var(--editor-text-muted)] ml-2">{scenes.length} scenes</span>
            {metadata?.durationSeconds && (
              <span className="text-xs text-[var(--editor-text-muted)] ml-1">
                &middot; {Math.round(metadata.durationSeconds)}s
              </span>
            )}
          </div>
        </div>
        {metadata?.primaryMetaphor && (
          <div className="text-xs text-[var(--editor-text-secondary)] mt-1 italic">
            {metadata.primaryMetaphor}
          </div>
        )}
        {metadata?.colorPalette && (
          <div className="text-[10px] text-[var(--editor-text-muted)] mt-0.5">
            {metadata.colorPalette}
          </div>
        )}
      </div>

      {/* Scene list (always visible) */}
      <div className="divide-y divide-[var(--editor-border-subtle)]">
        {scenes.map((scene, i) => (
          <div key={i} className="px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-[var(--editor-text-muted)]">
                {formatTime(scene.startMs)} - {formatTime(scene.endMs)}
              </span>
              <span className="text-sm font-medium text-[var(--editor-text-primary)]">{scene.title}</span>
            </div>
            <div className="text-xs text-[var(--editor-text-secondary)] line-clamp-2">{scene.description}</div>
          </div>
        ))}
      </div>

      {/* Expandable full plan */}
      {scenePlanMarkdown && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-3 py-1.5 flex items-center justify-center gap-1 text-xs text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)] bg-[var(--editor-bg-hover)] border-t border-[var(--editor-border-subtle)] transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide full plan' : 'View full plan'}
          </button>
          {expanded && (
            <div className="px-3 py-3 border-t border-[var(--editor-border-subtle)] max-h-80 overflow-y-auto">
              <div className="prose-agent text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {scenePlanMarkdown}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </>
      )}

      {/* Approve / Reject */}
      {!disabled && approved === undefined && (
        <div className="px-3 py-2 bg-[var(--editor-bg-hover)] border-t border-[var(--editor-border-subtle)] flex gap-2">
          <button
            onClick={onApprove}
            className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-md transition-colors"
          >
            Approve &amp; Generate
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1.5 border border-[var(--editor-border-subtle)] hover:border-[var(--editor-border-default)] text-[var(--editor-text-secondary)] text-sm rounded-md transition-colors"
          >
            Revise
          </button>
        </div>
      )}
      {approved === true && (
        <div className="px-3 py-2 bg-green-500/10 border-t border-green-500/20 text-green-600 text-xs text-center">
          Plan approved
        </div>
      )}
      {approved === false && (
        <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/20 text-amber-600 text-xs text-center">
          Revision requested
        </div>
      )}
    </div>
  );
}
```

**Step 2: Update `WidgetBlock` type in `AIAssistantPanel.tsx`**

At line 29, update the `widget` interface to include the new fields:

```typescript
interface WidgetBlock {
  type: 'widget';
  widget: {
    id: string;
    kind: string;
    message?: string;
    scenes?: Array<{ startMs: number; endMs: number; title: string; description: string }>;
    scenePlanMarkdown?: string;
    metadata?: { primaryMetaphor?: string; colorPalette?: string; totalScenes?: number; durationSeconds?: number };
    requiresApproval?: boolean;
  };
  response?: unknown;
}
```

**Step 3: Update `renderWidget` to pass new props**

In `renderWidget` (line ~428), update the `scene_plan` case:

```typescript
      case 'scene_plan':
        return (
          <ScenePlanCard
            scenes={widget.scenes || []}
            scenePlanMarkdown={widget.scenePlanMarkdown}
            metadata={widget.metadata}
            onApprove={() => handleWidgetResponse(widget.id, { approved: true })}
            onReject={() => handleWidgetResponse(widget.id, { approved: false })}
            disabled={hasResponded || isStreaming}
            approved={
              hasResponded
                ? typeof response === 'object' && response !== null && 'approved' in response
                  ? (response as { approved: boolean }).approved
                  : undefined
                : undefined
            }
          />
        );
```

**Step 4: Verify frontend compiles**

Run: `cd apps/web && npx next build` or just check that the dev server has no errors.

**Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/components/agent-widgets/ScenePlanCard.tsx apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx
git commit -m "feat: update ScenePlanCard widget with collapsible full plan view"
```

---

### Task 8: Update agent system prompt

**Files:**
- Modify: `packages/api/src/agent/agent-system-prompt.ts:35-42`

**Step 1: Update behavior rules**

Replace rule 3 (line 38):

From:
```
3. For new generation: gather preferences using widgets (theme, layout), then propose a scene plan. Wait for approval before generating.
```

To:
```
3. For new generation: gather preferences using widgets (theme, layout), then call plan_visuals to create a Director plan. The plan will be shown automatically for user approval. If the user wants changes, edit the plan description and re-show it via propose_plan. Only call start_generation after the user explicitly approves the plan.
```

**Step 2: Commit**

```bash
git add packages/api/src/agent/agent-system-prompt.ts
git commit -m "feat: update system prompt for plan approval workflow"
```

---

## Execution Order

Tasks 1-2 are independent (DB + queue). Task 3 is independent (Python). Task 4 depends on 1+2 (uses planData column and queue). Task 5 depends on 2+3 (uses planJobId and --phase flag). Task 6 depends on 1+2 (uses queue and DB). Task 7 is independent (frontend). Task 8 is independent (prompt text).

Recommended order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

## Testing

After all tasks:
1. Start API + Worker + Frontend
2. Open editor, send "Generate full visuals" to the agent
3. Agent should ask for theme + layout (widgets)
4. Select theme/layout → agent calls `plan_visuals`
5. Progress shows "Director analyzing transcript..."
6. Plan widget appears with scene cards + "View full plan" expander
7. Click "Approve & Generate" → agent calls `start_generation`
8. Animator generates code, bundles, visuals appear in editor
9. Test "Revise" flow: reject plan, type feedback, agent should re-show modified plan
