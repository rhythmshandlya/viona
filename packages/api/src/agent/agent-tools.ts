import type Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projects, visuals, transcripts, jobs } from '../db/schema.js';
import { queueGenerateVisualsJob, queueEditVisualsJob } from '../services/queue.js';
import { nanoid } from 'nanoid';

// Tool definitions for Claude API
export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'analyze_transcript',
    description:
      'Read the transcript text and word-level timestamps for a specific time range of the video. Use this to understand what the user is explaining in a section before suggesting visuals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startMs: { type: 'number', description: 'Start time in milliseconds' },
        endMs: { type: 'number', description: 'End time in milliseconds' },
      },
      required: ['startMs', 'endMs'],
    },
  },
  {
    name: 'get_current_visuals',
    description:
      'Get a list of all existing visual scenes for this project, including their timing, descriptions, and IDs.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_scene_details',
    description:
      'Get detailed information about a specific scene, including its description, timing, and visual elements.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sceneId: { type: 'number', description: 'The scene number (1-indexed)' },
      },
      required: ['sceneId'],
    },
  },
  {
    name: 'show_widget',
    description:
      'Show an interactive widget in the chat for the user to make a selection. Use this to collect preferences like theme/style, layout mode, or confirmations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        kind: {
          type: 'string',
          enum: ['theme_picker', 'layout_picker', 'confirmation'],
          description: 'The type of widget to show',
        },
        message: {
          type: 'string',
          description: 'Optional message to display with the widget',
        },
      },
      required: ['kind'],
    },
  },
  {
    name: 'propose_plan',
    description:
      'Present a scene-by-scene visual plan for the user to approve or modify before generation begins. Each scene should have a time range and description of what will be visualized.',
    input_schema: {
      type: 'object' as const,
      properties: {
        scenes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              startMs: { type: 'number' },
              endMs: { type: 'number' },
              title: { type: 'string', description: 'Short scene title' },
              description: { type: 'string', description: 'What this scene will visualize' },
            },
            required: ['startMs', 'endMs', 'title', 'description'],
          },
        },
      },
      required: ['scenes'],
    },
  },
  {
    name: 'generate_visuals',
    description:
      'Start generating visuals using the approved plan. This triggers the generation pipeline. Only call this after the user has approved the plan and selected a theme and layout.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stylePreset: {
          type: 'string',
          enum: ['minimal', 'modern', 'playful', 'bold', 'classic'],
        },
        layoutMode: {
          type: 'string',
          enum: ['pip', 'split-horizontal', 'split-vertical'],
        },
        styleGuide: {
          type: 'string',
          description: 'Additional style guidance from the conversation',
        },
      },
      required: ['stylePreset', 'layoutMode'],
    },
  },
  {
    name: 'edit_visuals',
    description:
      'Make a targeted edit to existing visuals. Can target a specific scene or the entire composition. Use this when the user wants to change something about existing visuals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description: 'Description of the edit to make',
        },
        sceneId: {
          type: 'number',
          description: 'Target specific scene (1-indexed). Omit for auto-detection.',
        },
        elementName: {
          type: 'string',
          description: 'Target a specific element within a scene',
        },
      },
      required: ['prompt'],
    },
  },
];

// Tool executor context
interface ToolContext {
  projectId: string;
  sendSSE: (event: string, data: unknown) => void;
}

// Execute a tool call and return the result as a JSON string
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  switch (toolName) {
    case 'analyze_transcript':
      return analyzeTranscript(
        ctx.projectId,
        toolInput as { startMs: number; endMs: number },
      );

    case 'get_current_visuals':
      return getCurrentVisuals(ctx.projectId);

    case 'get_scene_details':
      return getSceneDetails(
        ctx.projectId,
        toolInput as { sceneId: number },
      );

    case 'show_widget': {
      const { kind, message } = toolInput as { kind: string; message?: string };
      const widgetId = nanoid(8);
      ctx.sendSSE('widget', { id: widgetId, kind, message });
      return JSON.stringify({ widgetId, status: 'shown', waitingForUserResponse: true });
    }

    case 'propose_plan': {
      const { scenes } = toolInput as {
        scenes: Array<{ startMs: number; endMs: number; title: string; description: string }>;
      };
      const widgetId = nanoid(8);
      ctx.sendSSE('widget', {
        id: widgetId,
        kind: 'scene_plan',
        scenes,
        requiresApproval: true,
      });
      return JSON.stringify({ widgetId, status: 'shown', waitingForApproval: true });
    }

    case 'generate_visuals':
      return triggerGeneration(
        ctx.projectId,
        toolInput as {
          stylePreset: string;
          layoutMode: string;
          styleGuide?: string;
        },
        ctx,
      );

    case 'edit_visuals':
      return triggerEdit(
        ctx.projectId,
        toolInput as {
          prompt: string;
          sceneId?: number;
          elementName?: string;
        },
        ctx,
      );

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ─── Tool Implementations ────────────────────────────────────────────────────

async function analyzeTranscript(
  projectId: string,
  input: { startMs: number; endMs: number },
) {
  const transcript = await db.query.transcripts.findFirst({
    where: eq(transcripts.projectId, projectId),
  });

  if (!transcript || !transcript.words) {
    return JSON.stringify({
      error: 'No transcript available. The user needs to transcribe the video first.',
    });
  }

  const words = (
    transcript.words as Array<{ word: string; startMs: number; endMs: number }>
  ).filter((w) => w.startMs >= input.startMs && w.endMs <= input.endMs);

  const text = words.map((w) => w.word).join(' ');

  return JSON.stringify({
    text,
    wordCount: words.length,
    startMs: input.startMs,
    endMs: input.endMs,
    durationMs: input.endMs - input.startMs,
  });
}

async function getCurrentVisuals(projectId: string) {
  const visual = await db.query.visuals.findFirst({
    where: eq(visuals.projectId, projectId),
  });

  if (!visual || !visual.timestamps) {
    return JSON.stringify({ scenes: [], message: 'No visuals generated yet.' });
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

  return JSON.stringify({
    compositionId: visual.compositionId,
    sceneCount: scenes.length,
    scenes,
    stylePreset: visual.stylePreset,
  });
}

async function getSceneDetails(
  projectId: string,
  input: { sceneId: number },
) {
  const visual = await db.query.visuals.findFirst({
    where: eq(visuals.projectId, projectId),
  });

  if (!visual || !visual.timestamps) {
    return JSON.stringify({ error: 'No visuals found.' });
  }

  const timestamps = visual.timestamps as Array<{
    startMs: number;
    endMs: number;
    type: string;
    description: string;
    elements?: Array<{ id: string; name: string; type: string }>;
  }>;

  const scene = timestamps[input.sceneId - 1];
  if (!scene) {
    return JSON.stringify({
      error: `Scene ${input.sceneId} not found. There are ${timestamps.length} scenes.`,
    });
  }

  return JSON.stringify({
    sceneId: input.sceneId,
    ...scene,
  });
}

async function triggerGeneration(
  projectId: string,
  input: { stylePreset: string; layoutMode: string; styleGuide?: string },
  ctx: ToolContext,
) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return JSON.stringify({ error: 'Project not found.' });
  }

  // Calculate visual dimensions based on layout
  const canvasWidth =
    (project.videoSettings as Record<string, unknown>)?.canvasWidth as number | undefined ?? 1080;
  const canvasHeight =
    (project.videoSettings as Record<string, unknown>)?.canvasHeight as number | undefined ?? 1920;

  let dimensions = { width: canvasWidth, height: canvasHeight };
  if (input.layoutMode === 'split-horizontal') {
    dimensions = { width: Math.round(canvasWidth / 2), height: canvasHeight };
  } else if (input.layoutMode === 'split-vertical') {
    dimensions = { width: canvasWidth, height: Math.round(canvasHeight / 2) };
  }

  // Create job record
  const [job] = await db
    .insert(jobs)
    .values({
      projectId,
      type: 'generate-visuals',
      status: 'pending',
    })
    .returning();

  // Queue the job
  await queueGenerateVisualsJob({
    projectId,
    jobId: job.id,
    stylePreset: input.stylePreset as 'minimal' | 'modern' | 'playful' | 'bold' | 'classic',
    layoutMode: input.layoutMode as 'pip' | 'split-horizontal' | 'split-vertical',
    dimensions,
    styleGuide: input.styleGuide,
  });

  ctx.sendSSE('progress', { percent: 5, message: 'Starting visual generation...' });

  return JSON.stringify({
    jobId: job.id,
    status: 'queued',
    message: 'Visual generation started. Progress will stream in the chat.',
  });
}

async function triggerEdit(
  projectId: string,
  input: { prompt: string; sceneId?: number; elementName?: string },
  ctx: ToolContext,
) {
  const visual = await db.query.visuals.findFirst({
    where: eq(visuals.projectId, projectId),
  });

  if (!visual) {
    return JSON.stringify({ error: 'No visuals to edit. Generate visuals first.' });
  }

  // Create job record
  const [job] = await db
    .insert(jobs)
    .values({
      projectId,
      type: 'edit-visuals',
      status: 'pending',
    })
    .returning();

  // Queue the edit job
  await queueEditVisualsJob({
    projectId,
    jobId: job.id,
    compositionId: visual.compositionId,
    prompt: input.prompt,
    sceneId: input.sceneId,
    elementName: input.elementName,
  });

  ctx.sendSSE('progress', { percent: 5, message: 'Starting edit...' });

  return JSON.stringify({
    jobId: job.id,
    status: 'queued',
    message: 'Edit job started. Progress will stream in the chat.',
  });
}
