import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { eq, and, desc, sql, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projects, visuals, transcripts, jobs } from '../db/schema.js';
import { queueGenerateVisualsJob, queueEditVisualsJob, queuePlanVisualsJob } from '../services/queue.js';
import { nanoid } from 'nanoid';

const MCP_SERVER_NAME = 'creative-director';

// Tool names as Claude SDK will reference them: mcp__{server}__{tool}
export const TOOL_NAMES = [
  `mcp__${MCP_SERVER_NAME}__analyze_transcript`,
  `mcp__${MCP_SERVER_NAME}__get_current_visuals`,
  `mcp__${MCP_SERVER_NAME}__get_scene_details`,
  `mcp__${MCP_SERVER_NAME}__show_widget`,
  `mcp__${MCP_SERVER_NAME}__update_plan`,
  `mcp__${MCP_SERVER_NAME}__plan_visuals`,
  `mcp__${MCP_SERVER_NAME}__start_generation`,
  `mcp__${MCP_SERVER_NAME}__edit_visuals`,
];

// Tool executor context
export interface ToolContext {
  projectId: string;
  sendSSE: (event: string, data: unknown) => void;
  signal?: AbortSignal;
}

export function normalizeProgressMessage(jobType: string, percent: number, rawMessage?: string): string {
  // Pass through meaningful raw worker messages for all job types
  // Only fall back to generic phase messages when no useful raw message exists
  const hasRawMessage = rawMessage && !rawMessage.startsWith('Processing') && rawMessage.trim().length > 0;

  if (jobType === 'plan-visuals') {
    if (hasRawMessage) return rawMessage;
    if (percent < 20) return 'Setting up scene planning...';
    if (percent < 85) return 'Planning your scenes...';
    return 'Finalizing plan...';
  }
  if (jobType === 'edit-visuals') {
    if (hasRawMessage) return rawMessage;
    if (percent < 20) return 'Analyzing edit request...';
    if (percent < 85) return 'Editing visual...';
    return 'Validating changes...';
  }
  if (jobType === 'generate-visuals') {
    if (hasRawMessage) return rawMessage;
    if (percent < 15) return 'Preparing generation pipeline...';
    if (percent < 80) return `Generating visuals (${percent}%)...`;
    return 'Finishing up...';
  }
  return rawMessage || `Processing (${percent}%)...`;
}

export function derivePhase(jobType: string, percent: number): string {
  if (jobType === 'plan-visuals') {
    if (percent < 20) return 'preparing';
    if (percent < 88) return 'planning';
    return 'finalizing';
  }
  if (jobType === 'generate-visuals') {
    if (percent < 15) return 'preparing';
    if (percent < 85) return 'generating';
    if (percent < 95) return 'validating';
    return 'uploading';
  }
  if (jobType === 'edit-visuals') {
    if (percent < 20) return 'preparing';
    if (percent < 85) return 'editing';
    return 'validating';
  }
  return 'processing';
}

// Get average duration of recent completed jobs for a given type (for ETA estimation)
async function getAvgJobDurationMs(jobType: string): Promise<number | null> {
  try {
    const result = await db
      .select({
        avgMs: sql<number>`ROUND(AVG(EXTRACT(EPOCH FROM (${jobs.completedAt} - ${jobs.createdAt})) * 1000))`,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.type, jobType),
          eq(jobs.status, 'complete'),
          isNotNull(jobs.completedAt),
        ),
      )
      .limit(1);
    const avg = result[0]?.avgMs;
    return avg && avg > 0 ? avg : null;
  } catch {
    return null;
  }
}

// Poll a job until it completes or fails, calling sendSSE with progress
async function pollJobProgress(
  jobId: string,
  ctx: ToolContext,
  options?: { suppressJobId?: boolean; jobType?: string; initialPercent?: number },
): Promise<{ status: 'complete' | 'failed' | 'timeout' | 'aborted' | 'not_found' }> {
  const POLL_INTERVAL_MS = 2000;
  const TIMEOUT_MS = 50 * 60 * 1000; // 50 minutes — must exceed worker timeout (default 45 min)
  // If job progress hasn't changed in 10 minutes, consider it stalled.
  // Plan jobs update progress slowly (heartbeat crawl), and edit-visuals
  // may only update at 0% and 100%, so this must be generous.
  const STALL_TIMEOUT_MS = 10 * 60 * 1000;
  const startTime = Date.now();
  let lastProgress = -1;
  let lastProgressChangeTime = Date.now();
  // High-water mark: never send progress lower than previously sent.
  // Prevents the 5% → 0% regression when initial SSE fires at 5% but
  // first DB poll reads 0% before the worker starts.
  let highWaterMark = options?.initialPercent ?? 0;
  // When suppressJobId is true, we don't send jobId in progress events.
  // This prevents the frontend from tracking intermediate jobs (like plan-visuals)
  // via WebSocket, which would trigger a premature "visuals are ready" message.
  const sendJobId = options?.suppressJobId ? undefined : jobId;

  // Query historical average duration for time-based ETA
  const jt = options?.jobType || 'unknown';
  const avgDurationMs = await getAvgJobDurationMs(jt);

  while (Date.now() - startTime < TIMEOUT_MS) {
    if (ctx.signal?.aborted) return { status: 'aborted' };

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    if (ctx.signal?.aborted) return { status: 'aborted' };

    let job;
    try {
      job = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
      });
    } catch (dbErr) {
      // Transient DB failure — skip this poll, try again next iteration
      continue;
    }

    if (!job) {
      ctx.sendSSE('progress', {
        percent: 0,
        message: 'Job not found — it may have been deleted.',
        error: true,
        jobId: sendJobId,
      });
      return { status: 'not_found' };
    }

    // Track progress changes for stall detection
    if (job.progress !== lastProgress) {
      lastProgress = job.progress;
      lastProgressChangeTime = Date.now();
    }

    // Never send progress lower than previously sent (high-water mark)
    const effectivePercent = Math.max(job.progress, highWaterMark);
    highWaterMark = effectivePercent;
    ctx.sendSSE('progress', {
      percent: effectivePercent,
      message: normalizeProgressMessage(jt, effectivePercent, job.progressMessage || undefined),
      jobId: sendJobId,
      phase: derivePhase(jt, effectivePercent),
      jobType: jt,
      // Time-based ETA: send avg duration + job start time so frontend can compute remaining
      ...(avgDurationMs ? { avgDurationMs, jobStartedAt: job.createdAt.toISOString() } : {}),
    });

    if (job.status === 'complete') {
      ctx.sendSSE('progress', { percent: 100, message: 'Done!', jobId: sendJobId });
      return { status: 'complete' };
    }

    if (job.status === 'cancelled') {
      ctx.sendSSE('progress', {
        percent: job.progress,
        message: 'Cancelled by user',
        error: true,
        jobId: sendJobId,
      });
      return { status: 'failed' };
    }

    if (job.status === 'failed') {
      ctx.sendSSE('progress', {
        percent: job.progress,
        message: `Failed: ${job.error || 'Unknown error'}`,
        error: true,
        jobId: sendJobId,
      });
      return { status: 'failed' };
    }

    // Detect stalled jobs (no progress change for STALL_TIMEOUT_MS)
    if (Date.now() - lastProgressChangeTime > STALL_TIMEOUT_MS) {
      ctx.sendSSE('progress', {
        percent: job.progress,
        message: 'Job appears stalled — no progress updates received. The job may still complete in the background.',
        error: true,
        jobId: sendJobId,
      });
      return { status: 'timeout' };
    }
  }

  // Hard timeout — job is taking too long
  ctx.sendSSE('progress', {
    percent: lastProgress,
    message: 'Processing is taking longer than expected. The job continues in the background — check back in a moment.',
    error: true,
    jobId: sendJobId,
  });
  return { status: 'timeout' };
}

// Map raw scenes.json scene objects to widget-friendly format
function mapScenesToWidget(
  scenesArray: Array<Record<string, unknown>>,
  svgOptions?: Record<string, Record<string, Array<{ id: string; name: string; thumbnailUrl: string }>>>,
) {
  return scenesArray.map((s: any) => {
    const sceneId = String(s.id ?? s.name ?? '');
    return {
      startMs: Math.round((s.timestampRange?.[0] || 0) * 1000),
      endMs: Math.round((s.timestampRange?.[1] || 0) * 1000),
      title: s.name || `Scene ${s.id}`,
      description: s.visual || s.emotion || '',
      emotion: s.emotion || '',
      keySync: s.keySync ? {
        word: s.keySync.word,
        timestamp: s.keySync.timestamp,
        visualEvent: s.keySync.visualEvent,
      } : undefined,
      buildsFrom: s.buildsFrom || null,
      connectsTo: s.connectsTo || null,
      layout: s.layout || null,
      frames: s.frames || null,
      icons: s.icons || [],
      svgOptions: svgOptions?.[sceneId] || undefined,
    };
  });
}

// Create an in-process MCP server with all Creative Director tools
export function createAgentMcpServer(ctx: ToolContext) {
  // Track whether plan_visuals was called in this turn — prevents the agent
  // from calling start_generation without user approval.
  let planShownThisTurn = false;

  return createSdkMcpServer({
    name: MCP_SERVER_NAME,
    tools: [
      tool(
        'analyze_transcript',
        'Read the transcript text and word-level timestamps for a specific time range of the video. Use this to understand what the user is explaining in a section before suggesting visuals.',
        { startMs: z.number(), endMs: z.number() },
        async ({ startMs, endMs }) => {
          const transcript = await db.query.transcripts.findFirst({
            where: eq(transcripts.projectId, ctx.projectId),
          });

          if (!transcript || !transcript.words) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({
                error: 'No transcript available. The user needs to transcribe the video first.',
              }) }],
            };
          }

          const allWords = transcript.words as Array<{ text: string; startMs: number; endMs: number }>;
          // Use overlap filter — include any word that touches the range
          const words = allWords.filter((w) => w.endMs > startMs && w.startMs < endMs);

          const text = words.map((w) => w.text).join(' ');

          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              text,
              wordCount: words.length,
              words: words.map((w) => ({ text: w.text, startMs: w.startMs, endMs: w.endMs })),
              startMs,
              endMs,
              durationMs: endMs - startMs,
            }) }],
          };
        },
      ),

      tool(
        'get_current_visuals',
        'Get a list of all existing visual scenes for this project, including their timing, descriptions, and IDs.',
        {},
        async () => {
          const visual = await db.query.visuals.findFirst({
            where: eq(visuals.projectId, ctx.projectId),
          });

          if (!visual || !visual.timestamps) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ scenes: [], message: 'No visuals generated yet.' }) }],
            };
          }

          const scenes = (
            visual.timestamps as Array<{
              startMs: number;
              endMs: number;
              type: string;
              description: string;
            }>
          ).map((s, i) => ({
            sceneId: i + 1,
            startMs: s.startMs,
            endMs: s.endMs,
            title: s.type,
            description: s.description,
          }));

          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              compositionId: visual.compositionId,
              sceneCount: scenes.length,
              scenes,
              stylePreset: visual.stylePreset,
            }) }],
          };
        },
      ),

      tool(
        'get_scene_details',
        'Get detailed information about a specific scene, including its description, timing, and visual elements.',
        { sceneId: z.number() },
        async ({ sceneId }) => {
          const visual = await db.query.visuals.findFirst({
            where: eq(visuals.projectId, ctx.projectId),
          });

          if (!visual || !visual.timestamps) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No visuals found.' }) }],
            };
          }

          const timestamps = visual.timestamps as Array<{
            startMs: number;
            endMs: number;
            type: string;
            description: string;
            elements?: Array<{ id: string; name: string; type: string }>;
          }>;

          const scene = timestamps[sceneId - 1];
          if (!scene) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({
                error: `Scene ${sceneId} not found. There are ${timestamps.length} scenes.`,
              }) }],
            };
          }

          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ sceneId, ...scene }) }],
          };
        },
      ),

      tool(
        'show_widget',
        'Show an interactive widget in the chat for the user to make a selection. Kinds: "theme_picker" for style selection, "layout_picker" for layout, "confirmation" for yes/no, "choice" for custom multiple-choice questions (provide options array with label + value). Always use "choice" when asking a question with clear options.',
        {
          kind: z.enum(['theme_picker', 'layout_picker', 'confirmation', 'choice']),
          message: z.string().optional(),
          options: z.array(z.object({
            label: z.string(),
            value: z.string(),
          })).optional().describe('Options for "choice" widget — each has a label and value'),
        },
        async ({ kind, message, options }) => {
          const widgetId = nanoid(8);
          ctx.sendSSE('widget', { id: widgetId, kind, message, options });
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ widgetId, status: 'shown', waitingForUserResponse: true }) }],
          };
        },
      ),

      tool(
        'update_plan',
        `Modify scenes in an existing plan and re-show the updated plan for approval.

Actions:
- "update" (default): Change a scene's visual/emotion/name.
- "split": Split a scene into two at a timestamp. Provide splitAtMs, firstHalf (name + visual), secondHalf (name + visual).
- "merge": Merge a scene with an adjacent scene. Provide mergeWithSceneId, mergedName, mergedVisual.
- "remove": Remove a scene entirely.

Pass the planJobId from plan_visuals. If omitted, uses the most recent plan.`,
        {
          planJobId: z.string().optional().describe('Plan job ID. If omitted, uses the most recent plan.'),
          sceneUpdates: z.array(z.object({
            sceneId: z.number().describe('1-indexed scene number'),
            action: z.enum(['update', 'split', 'merge', 'remove']).optional().default('update').describe('Action to perform'),
            // For "update"
            visual: z.string().optional().describe('New visual description'),
            emotion: z.string().optional().describe('New emotion/mood'),
            name: z.string().optional().describe('New scene title'),
            // For "split"
            splitAtMs: z.number().optional().describe('Timestamp (ms) to split at'),
            firstHalf: z.object({ name: z.string(), visual: z.string() }).optional().describe('First half after split'),
            secondHalf: z.object({ name: z.string(), visual: z.string() }).optional().describe('Second half after split'),
            // For "merge"
            mergeWithSceneId: z.number().optional().describe('Adjacent scene ID to merge with'),
            mergedName: z.string().optional().describe('Combined scene name'),
            mergedVisual: z.string().optional().describe('Combined visual description'),
          })).min(1, 'At least one scene update required').describe('Array of scene operations'),
        },
        async ({ planJobId, sceneUpdates }) => {
          // Resolve plan job
          let resolvedPlanJobId = planJobId;
          if (!resolvedPlanJobId) {
            const latestPlan = await db.query.jobs.findFirst({
              where: and(
                eq(jobs.projectId, ctx.projectId),
                eq(jobs.type, 'plan-visuals'),
              ),
              orderBy: desc(jobs.createdAt),
            });
            resolvedPlanJobId = latestPlan?.id;
          }

          if (!resolvedPlanJobId) {
            return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No plan found for this project. Run plan_visuals first.' }) }] };
          }

          const planJob = await db.query.jobs.findFirst({ where: eq(jobs.id, resolvedPlanJobId) });
          if (!planJob?.planData) {
            return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Plan job not found or has no plan data.' }) }] };
          }

          const planData = planJob.planData as { scenePlan: string; scenes: Record<string, unknown> };
          const scenesObj = planData.scenes as Record<string, unknown>;
          let scenesArray = (scenesObj.scenes as Array<Record<string, unknown>>) || [];

          const changeLog: string[] = [];

          // Process operations in reverse order so indices stay valid for removes/splits
          const sorted = [...sceneUpdates].sort((a, b) => b.sceneId - a.sceneId);

          for (const op of sorted) {
            const action = op.action || 'update';
            const idx = scenesArray.findIndex((s: any) => s.id === op.sceneId);

            if (idx === -1 && action !== 'update') {
              changeLog.push(`Scene ${op.sceneId} not found, skipped`);
              continue;
            }

            const scene = scenesArray[idx] as any;

            switch (action) {
              case 'update': {
                if (!scene) { changeLog.push(`Scene ${op.sceneId} not found`); break; }
                if (op.visual !== undefined) scene.visual = op.visual;
                if (op.emotion !== undefined) scene.emotion = op.emotion;
                if (op.name !== undefined) scene.name = op.name;
                changeLog.push(`Updated "${scene.name}"`);
                break;
              }

              case 'split': {
                if (!scene) break;
                const range = scene.timestampRange as [number, number];
                const splitAt = op.splitAtMs != null
                  ? op.splitAtMs / 1000
                  : (range[0] + range[1]) / 2; // Default: midpoint

                if (splitAt <= range[0] || splitAt >= range[1]) {
                  changeLog.push(`Split point out of range for Scene ${op.sceneId}, skipped`);
                  break;
                }

                const first: Record<string, unknown> = {
                  ...scene,
                  id: scene.id,
                  name: op.firstHalf?.name || `${scene.name} (Part 1)`,
                  visual: op.firstHalf?.visual || scene.visual,
                  timestampRange: [range[0], splitAt],
                };

                const second: Record<string, unknown> = {
                  ...scene,
                  id: scene.id + 1,
                  name: op.secondHalf?.name || `${scene.name} (Part 2)`,
                  visual: op.secondHalf?.visual || scene.visual,
                  timestampRange: [splitAt, range[1]],
                  emotion: scene.emotion,
                };

                // Replace the original scene with both halves
                scenesArray.splice(idx, 1, first, second);
                changeLog.push(`Split "${scene.name}" into "${first.name}" and "${second.name}"`);
                break;
              }

              case 'merge': {
                if (!scene || !op.mergeWithSceneId) {
                  changeLog.push(`Merge requires mergeWithSceneId for Scene ${op.sceneId}`);
                  break;
                }
                const otherIdx = scenesArray.findIndex((s: any) => s.id === op.mergeWithSceneId);
                if (otherIdx === -1) {
                  changeLog.push(`Merge target Scene ${op.mergeWithSceneId} not found`);
                  break;
                }
                const other = scenesArray[otherIdx] as any;
                const rangeA = scene.timestampRange as [number, number];
                const rangeB = other.timestampRange as [number, number];

                const merged: Record<string, unknown> = {
                  ...scene,
                  name: op.mergedName || `${scene.name} + ${other.name}`,
                  visual: op.mergedVisual || `${scene.visual}; ${other.visual}`,
                  timestampRange: [Math.min(rangeA[0], rangeB[0]), Math.max(rangeA[1], rangeB[1])],
                };

                // Remove both, insert merged at the earlier position
                const minIdx = Math.min(idx, otherIdx);
                scenesArray = scenesArray.filter((_: any, i: number) => i !== idx && i !== otherIdx);
                scenesArray.splice(minIdx, 0, merged);
                changeLog.push(`Merged "${scene.name}" and "${other.name}" into "${merged.name}"`);
                break;
              }

              case 'remove': {
                if (!scene) break;
                scenesArray.splice(idx, 1);
                changeLog.push(`Removed "${scene.name}"`);
                break;
              }
            }
          }

          // Re-index scene IDs sequentially
          scenesArray.forEach((s: any, i: number) => { s.id = i + 1; });

          // Rebuild markdown from scenes
          const updatedMarkdown = scenesArray.map((s: any) => {
            const startS = (s.timestampRange?.[0] ?? 0).toFixed(1);
            const endS = (s.timestampRange?.[1] ?? 0).toFixed(1);
            return `### Scene ${s.id}: ${s.name} (${startS}s – ${endS}s)\n**Visual**: ${s.visual || ''}\n**Emotion**: ${s.emotion || ''}`;
          }).join('\n\n');

          // Save updated plan back to DB
          const updatedPlanData = {
            scenePlan: updatedMarkdown,
            scenes: { ...scenesObj, scenes: scenesArray, totalScenes: scenesArray.length },
          };
          await db.update(jobs).set({ planData: updatedPlanData }).where(eq(jobs.id, resolvedPlanJobId));

          // Re-send widget with updated data
          const widgetId = nanoid(8);
          ctx.sendSSE('widget', {
            id: widgetId,
            kind: 'scene_plan',
            planJobId: resolvedPlanJobId,
            scenes: mapScenesToWidget(scenesArray),
            scenePlanMarkdown: updatedMarkdown,
            metadata: {
              primaryMetaphor: scenesObj.primaryMetaphor,
              colorPalette: scenesObj.colorPalette,
              totalScenes: scenesArray.length,
              durationSeconds: scenesObj.durationSeconds,
              visualContinuity: scenesObj.visualContinuity,
            },
            requiresApproval: true,
          });

          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              planJobId: resolvedPlanJobId,
              widgetId,
              status: 'plan_updated',
              changes: changeLog,
              sceneCount: scenesArray.length,
              waitingForApproval: true,
            }) }],
          };
        },
      ),

      tool(
        'plan_visuals',
        'Run the Director phase to create a scene-by-scene visual plan based on the transcript. This queues a planning job that analyzes the transcript and produces a detailed plan. The plan is then shown to the user as an interactive widget for approval before any generation begins. Only call this after the user has selected a theme and layout.',
        {
          stylePreset: z.enum(['minimal', 'modern', 'playful', 'bold', 'classic', 'studio']),
          layoutMode: z.enum(['pip', 'split-horizontal', 'split-vertical']),
          styleGuide: z.string().optional(),
        },
        async ({ stylePreset, layoutMode, styleGuide }) => {
          const project = await db.query.projects.findFirst({
            where: eq(projects.id, ctx.projectId),
          });

          if (!project) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Project not found.' }) }],
            };
          }

          const isAudioProject = (project.projectType || 'video') === 'audio';
          const canvasWidth =
            (project.videoSettings as Record<string, unknown>)?.canvasWidth as number | undefined ?? 1080;
          const canvasHeight =
            (project.videoSettings as Record<string, unknown>)?.canvasHeight as number | undefined ?? 1920;

          // Audio projects always use full canvas (no split/PiP with video)
          let dimensions = { width: canvasWidth, height: canvasHeight };
          if (!isAudioProject) {
            if (layoutMode === 'split-horizontal') {
              dimensions = { width: Math.round(canvasWidth / 2), height: canvasHeight };
            } else if (layoutMode === 'split-vertical') {
              dimensions = { width: canvasWidth, height: Math.round(canvasHeight / 2) };
            }
          }

          const [job] = await db
            .insert(jobs)
            .values({
              projectId: ctx.projectId,
              type: 'plan-visuals',
              status: 'pending',
            })
            .returning();

          await queuePlanVisualsJob({
            projectId: ctx.projectId,
            jobId: job.id,
            stylePreset: stylePreset as 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'studio',
            layoutMode: isAudioProject ? 'pip' : layoutMode as 'pip' | 'split-horizontal' | 'split-vertical',
            dimensions,
            styleGuide,
            sourceWidth: project.sourceWidth,
            sourceHeight: project.sourceHeight,
          });

          ctx.sendSSE('progress', { percent: 5, message: 'Starting visual planning...' });

          // Poll job progress (blocks until complete)
          // suppressJobId: plan-visuals is an intermediate step — don't let the frontend
          // track this job via WebSocket (which would trigger "visuals are ready" on completion)
          const pollResult = await pollJobProgress(job.id, ctx, { suppressJobId: true, jobType: 'plan-visuals', initialPercent: 5 });

          if (pollResult.status === 'aborted') {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Planning was cancelled.' }) }],
            };
          }

          if (pollResult.status === 'timeout') {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({
                error: 'Planning is taking longer than expected. The job is still running in the background — the plan will appear when you refresh the page.',
                jobId: job.id,
              }) }],
            };
          }

          // Read the completed job to get planData
          const completedJob = await db.query.jobs.findFirst({
            where: eq(jobs.id, job.id),
          });

          if (!completedJob || completedJob.status !== 'complete' || !completedJob.planData) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({
                error: 'Planning failed or produced no plan data.',
                jobId: job.id,
                status: completedJob?.status ?? 'unknown',
              }) }],
            };
          }

          const planData = completedJob.planData as { scenePlan: string; scenes: Record<string, unknown>; svgOptions?: Record<string, Record<string, Array<{ id: string; name: string; thumbnailUrl: string }>>> };
          const scenesObj = planData.scenes as Record<string, unknown>;
          const scenesArray = (scenesObj.scenes as Array<Record<string, unknown>>) || [];
          const widgetId = nanoid(8);

          ctx.sendSSE('widget', {
            id: widgetId,
            kind: 'scene_plan',
            planJobId: job.id,
            scenes: mapScenesToWidget(scenesArray, planData.svgOptions),
            scenePlanMarkdown: planData.scenePlan,
            metadata: {
              primaryMetaphor: scenesObj.primaryMetaphor,
              colorPalette: scenesObj.colorPalette,
              totalScenes: scenesObj.totalScenes,
              durationSeconds: scenesObj.durationSeconds,
              visualContinuity: scenesObj.visualContinuity,
            },
            requiresApproval: true,
          });

          planShownThisTurn = true;

          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              planJobId: job.id,
              widgetId,
              status: 'plan_shown',
              waitingForApproval: true,
              sceneCount: scenesArray.length,
              instruction: 'STOP HERE. The plan is now shown to the user. Do NOT call start_generation. End your response and wait for the user to approve or edit the plan.',
            }) }],
          };
        },
      ),

      tool(
        'start_generation',
        'Start generating visuals from an approved plan. This takes the planJobId from a completed plan_visuals run and triggers the full generation pipeline. Only call this after the user has approved the plan. Pass the same stylePreset and layoutMode that were used in plan_visuals.',
        {
          planJobId: z.string(),
          stylePreset: z.enum(['minimal', 'modern', 'playful', 'bold', 'classic', 'studio']),
          layoutMode: z.enum(['pip', 'split-horizontal', 'split-vertical']),
        },
        async ({ planJobId, stylePreset, layoutMode }) => {
          // Hard gate: refuse if plan was just shown this turn (user hasn't had a chance to approve)
          if (planShownThisTurn) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({
                error: 'Cannot start generation yet. The plan was just shown to the user and requires their approval first. End your response now and wait for the user to approve or request changes.',
              }) }],
            };
          }

          // Verify the plan job exists and is completed with planData
          const planJob = await db.query.jobs.findFirst({
            where: eq(jobs.id, planJobId),
          });

          if (!planJob) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Plan job not found.' }) }],
            };
          }

          if (planJob.status !== 'complete' || !planJob.planData) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({
                error: 'Plan job is not completed or has no plan data.',
                planJobStatus: planJob.status,
              }) }],
            };
          }

          // Read canvas dimensions from the project
          const project = await db.query.projects.findFirst({
            where: eq(projects.id, ctx.projectId),
          });

          if (!project) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Project not found.' }) }],
            };
          }

          const isAudioProject = (project.projectType || 'video') === 'audio';
          const videoSettings = (project.videoSettings as Record<string, unknown>) || {};
          const canvasWidth = (videoSettings.canvasWidth as number | undefined) ?? 1080;
          const canvasHeight = (videoSettings.canvasHeight as number | undefined) ?? 1920;

          // Audio projects always use full canvas (no split/PiP with video)
          let dimensions = { width: canvasWidth, height: canvasHeight };
          if (!isAudioProject) {
            if (layoutMode === 'split-horizontal') {
              dimensions = { width: Math.round(canvasWidth / 2), height: canvasHeight };
            } else if (layoutMode === 'split-vertical') {
              dimensions = { width: canvasWidth, height: Math.round(canvasHeight / 2) };
            }
          }

          const [job] = await db
            .insert(jobs)
            .values({
              projectId: ctx.projectId,
              type: 'generate-visuals',
              status: 'pending',
            })
            .returning();

          await queueGenerateVisualsJob({
            projectId: ctx.projectId,
            jobId: job.id,
            stylePreset: stylePreset as 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'studio',
            layoutMode: isAudioProject ? 'pip' : layoutMode as 'pip' | 'split-horizontal' | 'split-vertical',
            dimensions,
            planJobId,
          });

          ctx.sendSSE('progress', { percent: 5, message: 'Starting visual generation from approved plan...', jobId: job.id });

          // Poll job progress (blocks until complete)
          await pollJobProgress(job.id, ctx, { jobType: 'generate-visuals', initialPercent: 5 });

          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              jobId: job.id,
              status: 'queued',
              message: 'Visual generation started from approved plan. Progress will stream in the chat.',
            }) }],
          };
        },
      ),

      tool(
        'edit_visuals',
        'Make a targeted edit to existing visuals. Can target a specific scene or the entire composition. Use this when the user wants to change something about existing visuals. Write a detailed prompt that explains WHAT the user wants changed and WHY — include what the speaker is saying in that section so the editor understands the content context.',
        {
          prompt: z.string().describe('Detailed edit instructions including: what to change, what the speaker is saying in the relevant section, and what the visuals should convey'),
          sceneId: z.number().optional(),
          elementName: z.string().optional(),
        },
        async ({ prompt, sceneId, elementName }) => {
          const visual = await db.query.visuals.findFirst({
            where: eq(visuals.projectId, ctx.projectId),
          });

          if (!visual) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No visuals to edit. Generate visuals first.' }) }],
            };
          }

          // Fetch transcript for full context — word-level timestamps so the editor
          // can precisely align animations to what's being said
          let transcriptText: string | undefined;
          try {
            const transcript = await db.query.transcripts.findFirst({
              where: eq(transcripts.projectId, ctx.projectId),
            });
            if (transcript?.words) {
              const words = transcript.words as Array<{ text: string; startMs: number; endMs: number }>;
              // Format as sentence-like chunks with precise word timing
              const segments: string[] = [];
              let currentSegment: Array<{ text: string; startMs: number; endMs: number }> = [];
              let segmentStart = 0;
              for (let i = 0; i < words.length; i++) {
                if (currentSegment.length === 0) segmentStart = words[i].startMs;
                currentSegment.push(words[i]);
                // Break into ~3-second segments for more precise timing
                if (words[i].endMs - segmentStart >= 3000 || i === words.length - 1) {
                  const startSec = (segmentStart / 1000).toFixed(1);
                  const endSec = (words[i].endMs / 1000).toFixed(1);
                  const sentence = currentSegment.map(w => w.text).join(' ');
                  segments.push(`[${startSec}s – ${endSec}s] ${sentence}`);
                  currentSegment = [];
                }
              }
              transcriptText = segments.join('\n');
            }
          } catch {
            // Transcript unavailable — not critical
          }

          // Fetch scene plan (timestamps from visuals record)
          let scenePlan: string | undefined;
          if (visual.timestamps) {
            try {
              scenePlan = JSON.stringify(visual.timestamps, null, 2);
            } catch {
              // Not critical
            }
          }

          const [job] = await db
            .insert(jobs)
            .values({
              projectId: ctx.projectId,
              type: 'edit-visuals',
              status: 'pending',
            })
            .returning();

          await queueEditVisualsJob({
            projectId: ctx.projectId,
            jobId: job.id,
            compositionId: visual.compositionId,
            prompt,
            sceneId,
            elementName,
            transcript: transcriptText,
            scenePlan,
          });

          ctx.sendSSE('progress', { percent: 5, message: 'Starting edit...', jobId: job.id });

          // Poll job progress (blocks until complete)
          await pollJobProgress(job.id, ctx, { jobType: 'edit-visuals', initialPercent: 5 });

          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              jobId: job.id,
              status: 'queued',
              message: 'Edit job started. Progress will stream in the chat.',
            }) }],
          };
        },
      ),
    ],
  });
}
