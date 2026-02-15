import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
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
  `mcp__${MCP_SERVER_NAME}__propose_plan`,
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

// Poll a job until it completes or fails, calling sendSSE with progress
async function pollJobProgress(
  jobId: string,
  ctx: ToolContext,
): Promise<void> {
  const POLL_INTERVAL_MS = 2000;
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const startTime = Date.now();

  while (Date.now() - startTime < TIMEOUT_MS) {
    if (ctx.signal?.aborted) break;

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    if (ctx.signal?.aborted) break;

    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, jobId),
    });

    if (!job) break;

    ctx.sendSSE('progress', {
      percent: job.progress,
      message: job.progressMessage || `Processing... (${job.progress}%)`,
    });

    if (job.status === 'complete' || job.status === 'completed') {
      ctx.sendSSE('progress', { percent: 100, message: 'Done!' });
      break;
    }

    if (job.status === 'failed') {
      ctx.sendSSE('progress', {
        percent: job.progress,
        message: `Failed: ${job.error || 'Unknown error'}`,
      });
      break;
    }
  }

  if (Date.now() - startTime >= TIMEOUT_MS && !ctx.signal?.aborted) {
    ctx.sendSSE('progress', {
      percent: 0,
      message: 'Generation is taking longer than expected. Check back shortly.',
    });
  }
}

// Create an in-process MCP server with all Creative Director tools
export function createAgentMcpServer(ctx: ToolContext) {
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

          const words = (
            transcript.words as Array<{ word: string; startMs: number; endMs: number }>
          ).filter((w) => w.startMs >= startMs && w.endMs <= endMs);

          const text = words.map((w) => w.word).join(' ');

          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              text,
              wordCount: words.length,
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
        'Show an interactive widget in the chat for the user to make a selection. Use this to collect preferences like theme/style, layout mode, or confirmations.',
        {
          kind: z.enum(['theme_picker', 'layout_picker', 'confirmation']),
          message: z.string().optional(),
        },
        async ({ kind, message }) => {
          const widgetId = nanoid(8);
          ctx.sendSSE('widget', { id: widgetId, kind, message });
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ widgetId, status: 'shown', waitingForUserResponse: true }) }],
          };
        },
      ),

      tool(
        'propose_plan',
        'Present a scene-by-scene visual plan for the user to approve or modify before generation begins. Each scene should have a time range and description of what will be visualized.',
        {
          scenes: z.array(z.object({
            startMs: z.number(),
            endMs: z.number(),
            title: z.string(),
            description: z.string(),
          })),
        },
        async ({ scenes }) => {
          const widgetId = nanoid(8);
          ctx.sendSSE('widget', {
            id: widgetId,
            kind: 'scene_plan',
            scenes,
            requiresApproval: true,
          });
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ widgetId, status: 'shown', waitingForApproval: true }) }],
          };
        },
      ),

      tool(
        'plan_visuals',
        'Run the Director phase to create a scene-by-scene visual plan based on the transcript. This queues a planning job that analyzes the transcript and produces a detailed plan. The plan is then shown to the user as an interactive widget for approval before any generation begins. Only call this after the user has selected a theme and layout.',
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
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Project not found.' }) }],
            };
          }

          const canvasWidth =
            (project.videoSettings as Record<string, unknown>)?.canvasWidth as number | undefined ?? 1080;
          const canvasHeight =
            (project.videoSettings as Record<string, unknown>)?.canvasHeight as number | undefined ?? 1920;

          let dimensions = { width: canvasWidth, height: canvasHeight };
          if (layoutMode === 'split-horizontal') {
            dimensions = { width: Math.round(canvasWidth / 2), height: canvasHeight };
          } else if (layoutMode === 'split-vertical') {
            dimensions = { width: canvasWidth, height: Math.round(canvasHeight / 2) };
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
            stylePreset: stylePreset as 'minimal' | 'modern' | 'playful' | 'bold' | 'classic',
            layoutMode: layoutMode as 'pip' | 'split-horizontal' | 'split-vertical',
            dimensions,
            styleGuide,
          });

          ctx.sendSSE('progress', { percent: 5, message: 'Starting visual planning...' });

          // Poll job progress (blocks until complete)
          await pollJobProgress(job.id, ctx);

          // Read the completed job to get planData
          const completedJob = await db.query.jobs.findFirst({
            where: eq(jobs.id, job.id),
          });

          if (!completedJob || (completedJob.status !== 'complete' && completedJob.status !== 'completed') || !completedJob.planData) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({
                error: 'Planning failed or produced no plan data.',
                jobId: job.id,
                status: completedJob?.status ?? 'unknown',
              }) }],
            };
          }

          const planData = completedJob.planData as { scenePlan: string; scenes: Record<string, unknown> };
          const scenesObj = planData.scenes as Record<string, unknown>;
          const scenesArray = (scenesObj.scenes as Array<Record<string, unknown>>) || [];
          const widgetId = nanoid(8);

          ctx.sendSSE('widget', {
            id: widgetId,
            kind: 'scene_plan',
            scenes: scenesArray.map((s: any) => ({
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
              sceneCount: scenesArray.length,
            }) }],
          };
        },
      ),

      tool(
        'start_generation',
        'Start generating visuals from an approved plan. This takes the planJobId from a completed plan_visuals run and triggers the full generation pipeline. Only call this after the user has approved the plan. Pass the same stylePreset and layoutMode that were used in plan_visuals.',
        {
          planJobId: z.string(),
          stylePreset: z.enum(['minimal', 'modern', 'playful', 'bold', 'classic']),
          layoutMode: z.enum(['pip', 'split-horizontal', 'split-vertical']),
        },
        async ({ planJobId, stylePreset, layoutMode }) => {
          // Verify the plan job exists and is completed with planData
          const planJob = await db.query.jobs.findFirst({
            where: eq(jobs.id, planJobId),
          });

          if (!planJob) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Plan job not found.' }) }],
            };
          }

          if ((planJob.status !== 'complete' && planJob.status !== 'completed') || !planJob.planData) {
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

          const videoSettings = (project.videoSettings as Record<string, unknown>) || {};
          const canvasWidth = (videoSettings.canvasWidth as number | undefined) ?? 1080;
          const canvasHeight = (videoSettings.canvasHeight as number | undefined) ?? 1920;

          let dimensions = { width: canvasWidth, height: canvasHeight };
          if (layoutMode === 'split-horizontal') {
            dimensions = { width: Math.round(canvasWidth / 2), height: canvasHeight };
          } else if (layoutMode === 'split-vertical') {
            dimensions = { width: canvasWidth, height: Math.round(canvasHeight / 2) };
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
            stylePreset: stylePreset as 'minimal' | 'modern' | 'playful' | 'bold' | 'classic',
            layoutMode: layoutMode as 'pip' | 'split-horizontal' | 'split-vertical',
            dimensions,
            planJobId,
          });

          ctx.sendSSE('progress', { percent: 5, message: 'Starting visual generation from approved plan...' });

          // Poll job progress (blocks until complete)
          await pollJobProgress(job.id, ctx);

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
        'Make a targeted edit to existing visuals. Can target a specific scene or the entire composition. Use this when the user wants to change something about existing visuals.',
        {
          prompt: z.string(),
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
          });

          ctx.sendSSE('progress', { percent: 5, message: 'Starting edit...' });

          // Poll job progress (blocks until complete)
          await pollJobProgress(job.id, ctx);

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
