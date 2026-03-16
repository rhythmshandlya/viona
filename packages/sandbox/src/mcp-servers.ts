import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { allManifestTools } from './tools/manifest-ops.js';
import { writeSceneFileTool, deleteSceneFileTool } from './tools/scene-tools.js';
import { renderStillTool } from './tools/render-still.js';
import { triggerRebuildTool } from './tools/trigger-rebuild.js';
import { type WidgetCallbacks } from './tools/widget-tools.js';
import { computeEffectiveDimensions, buildAnimatorDispatchMessage, type SceneConfig } from './prompt-assembly.js';

/**
 * Convert a raw JSON schema property to a Zod type.
 * Handles string (with optional enum), number, boolean, object, and array.
 */
function jsonPropToZod(prop: any, isRequired: boolean): z.ZodTypeAny {
  let zodType: z.ZodTypeAny;

  switch (prop.type) {
    case 'string':
      zodType = prop.enum
        ? z.enum(prop.enum as [string, ...string[]])
        : z.string();
      break;
    case 'number':
      zodType = z.number();
      break;
    case 'boolean':
      zodType = z.boolean();
      break;
    case 'array':
      zodType = z.array(z.unknown());
      break;
    case 'object':
      zodType = z.record(z.unknown());
      break;
    default:
      zodType = z.unknown();
  }

  if (prop.description) {
    zodType = zodType.describe(prop.description);
  }

  if (!isRequired) {
    zodType = zodType.optional();
  }

  return zodType;
}

/**
 * Convert a raw JSON Schema input_schema to a Zod shape for the SDK's tool() function.
 */
function jsonSchemaToZodShape(schema: any): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const props = schema?.properties ?? {};
  const required: string[] = schema?.required ?? [];

  for (const [key, prop] of Object.entries(props)) {
    shape[key] = jsonPropToZod(prop as any, required.includes(key));
  }

  return shape;
}

/**
 * Wrap a sandbox tool object (with raw JSON schema + execute method) into an SDK tool() call.
 * Converts the tool's input_schema to a Zod shape so the LLM sees proper parameter definitions.
 */
function wrapTool(t: { name: string; description: string; input_schema?: any; execute: (input: any) => Promise<string> }) {
  const zodShape = t.input_schema ? jsonSchemaToZodShape(t.input_schema) : {};
  return tool(
    t.name,
    t.description,
    zodShape,
    async (input: Record<string, unknown>) => {
      const result = await t.execute(input);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );
}

/**
 * Create all MCP servers for the orchestrator SDK query.
 * Widget/progress servers need SSE callbacks to emit events to the client.
 */
export function createMcpServers(
  widgetCallbacks: WidgetCallbacks,
  pipelineCtx?: { canvasWidth: number; canvasHeight: number; fps: number; theme: string },
) {
  const manifestServer = createSdkMcpServer({
    name: 'manifest',
    tools: allManifestTools.map(wrapTool),
  });

  const scenesServer = createSdkMcpServer({
    name: 'scenes',
    tools: [wrapTool(writeSceneFileTool), wrapTool(deleteSceneFileTool)],
  });

  const renderServer = createSdkMcpServer({
    name: 'render',
    tools: [wrapTool(renderStillTool), wrapTool(triggerRebuildTool)],
  });

  const widgetServer = createSdkMcpServer({
    name: 'widgets',
    tools: [
      tool(
        'show_widget',
        'Show an interactive widget to the user in the chat panel. Use this to present choices, plans for approval, theme pickers, and confirmations. The widget appears inline in the conversation and the user can interact with it.',
        {
          kind: z.enum(['theme_picker', 'layout_picker', 'scene_plan', 'choice', 'confirmation']),
          id: z.string(),
          data: z.record(z.unknown()).optional(),
        },
        async (input) => {
          // Spread data to top level so frontend sees widget.scenes, not widget.data.scenes
          widgetCallbacks.onWidget({ kind: input.kind, id: input.id, ...input.data });
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({
              widgetId: input.id,
              status: 'shown',
              waitingForUserResponse: true,
            }) }],
          };
        },
      ),
      tool(
        'report_progress',
        'Report progress to the user during long-running operations. Shows a progress indicator with agent name, active track, and estimated time remaining.',
        {
          phase: z.string().describe('Pipeline phase: trimming, planning, editing, generating, reviewing, assembling, complete'),
          percent: z.number().describe('Progress percentage 0-100'),
          message: z.string().describe('Human-readable status message (Viona-centric, no internal agent names)'),
          agentName: z.string().optional().describe('Which agent is working: Editor, Planner, Animator, Reviewer'),
          trackName: z.string().optional().describe('Which track/region is being edited: Video, Overlay, Captions, Audio'),
          estimatedTimeRemaining: z.number().optional().describe('Estimated seconds remaining for current phase'),
        },
        async (input) => {
          widgetCallbacks.onProgress({
            phase: input.phase,
            percent: input.percent,
            message: input.message,
            agentName: input.agentName,
            trackName: input.trackName,
            estimatedTimeRemaining: input.estimatedTimeRemaining,
          });
          return { content: [{ type: 'text' as const, text: 'Progress reported.' }] };
        },
      ),
      tool(
        'build_animator_dispatch',
        'Build a formatted dispatch message for an Animator subagent. Call this BEFORE dispatching an Animator — it computes effective dimensions and formats the scene assignment. Pass the result as the Agent tool prompt.',
        {
          sceneName: z.string().describe('Human-readable scene name (e.g., "Hook Title")'),
          sceneFile: z.string().describe('PascalCase filename without extension (e.g., "HookTitle")'),
          displayMode: z.enum(['default', 'fullscreen', 'overlay']).describe('Layout mode for this scene'),
          splitRatio: z.number().optional().describe('Split ratio percentage for stacked mode (default: 55)'),
          sceneBrief: z.string().describe('Visual description from the plan'),
          syncPoints: z.array(z.object({
            frame: z.number(),
            action: z.string(),
          })).describe('Key transcript moments tied to frame numbers'),
          durationFrames: z.number().describe('Scene duration in frames'),
        },
        async (input) => {
          if (!pipelineCtx) {
            return { content: [{ type: 'text' as const, text: 'Error: pipeline context not available' }] };
          }
          const config: SceneConfig = {
            sceneName: input.sceneName,
            sceneFile: input.sceneFile,
            displayMode: input.displayMode,
            splitRatio: input.splitRatio ?? 55,
            sceneBrief: input.sceneBrief,
            syncPoints: input.syncPoints,
            durationFrames: input.durationFrames,
            canvasWidth: pipelineCtx.canvasWidth,
            canvasHeight: pipelineCtx.canvasHeight,
            fps: pipelineCtx.fps,
            theme: pipelineCtx.theme,
          };
          const msg = buildAnimatorDispatchMessage(config);
          return { content: [{ type: 'text' as const, text: msg }] };
        },
      ),
    ],
  });

  return {
    manifest: manifestServer,
    scenes: scenesServer,
    render: renderServer,
    widgets: widgetServer,
  };
}
