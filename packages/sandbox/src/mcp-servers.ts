import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { allManifestTools } from './tools/manifest-ops.js';
import { writeSceneFileTool, deleteSceneFileTool } from './tools/scene-tools.js';
import { renderStillTool } from './tools/render-still.js';
import { triggerRebuildTool } from './tools/trigger-rebuild.js';
import { type WidgetCallbacks } from './tools/widget-tools.js';

/**
 * Wrap a sandbox tool object (with raw JSON schema + execute method) into an SDK tool() call.
 * We use z.object({}).passthrough() since our tools use raw JSON schema, not Zod.
 */
function wrapTool(t: { name: string; description: string; execute: (input: any) => Promise<string> }) {
  return tool(
    t.name,
    t.description,
    z.object({}).passthrough(),
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
export function createMcpServers(widgetCallbacks: WidgetCallbacks) {
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
        z.object({
          kind: z.enum(['theme_picker', 'layout_picker', 'scene_plan', 'choice', 'confirmation']),
          id: z.string(),
          data: z.record(z.unknown()).optional(),
        }),
        async (input) => {
          widgetCallbacks.onWidget({ ...input });
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
        'Report progress to the user during long-running operations like generating animations or processing sections. Shows a progress indicator in the chat.',
        z.object({
          phase: z.string(),
          percent: z.number(),
          message: z.string(),
        }),
        async (input) => {
          widgetCallbacks.onProgress(input);
          return { content: [{ type: 'text' as const, text: 'Progress reported.' }] };
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
