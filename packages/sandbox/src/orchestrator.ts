// packages/sandbox/src/orchestrator.ts
//
// Core orchestrator module for the sandbox. Builds SDK query options with
// subagent definitions, manages session resume, and streams events back
// to the caller via callbacks.

import { query, type SDKPartialAssistantMessage, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { BetaRawContentBlockDeltaEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import { loadPrompt, loadPromptWithShared, injectContext, type PromptContext } from './prompts/prompt-loader.js';
import { allManifestTools } from './tools/manifest-ops.js';
import { writeSceneFileTool, deleteSceneFileTool } from './tools/scene-tools.js';
import { renderStillTool } from './tools/render-still.js';
import { triggerRebuildTool } from './tools/trigger-rebuild.js';

// ---- Public interfaces ----

export interface OrchestratorRequest {
  prompt: string;
  conversationHistory: Array<{ role: string; content: string }>;
  projectContext: PromptContext;
  sessionId?: string | null;
  widgetResponse?: { widgetId: string; value: unknown };
  editingContext?: { type: string; itemId?: string; sceneId?: number };
}

export interface OrchestratorCallbacks {
  onText: (text: string) => void;
  onWidget: (widget: Record<string, unknown>) => void;
  onProgress: (progress: { phase: string; percent: number; message: string }) => void;
  onDone: (result: { sessionId?: string; cost?: number }) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

// ---- Tool name registries ----
// These match the MCP server names used in agent-server.ts registration.

const MANIFEST_TOOL_NAMES = allManifestTools.map(t => `mcp__manifest__${t.name}`);

const SCENE_TOOL_NAMES = [
  `mcp__scenes__${writeSceneFileTool.name}`,
  `mcp__scenes__${deleteSceneFileTool.name}`,
];

const RENDER_TOOL_NAMES = [
  `mcp__render__${renderStillTool.name}`,
  `mcp__render__${triggerRebuildTool.name}`,
];

const WIDGET_TOOL_NAMES = ['mcp__widgets__show_widget', 'mcp__widgets__report_progress'];

// ---- Build SDK query options ----

/**
 * Load all prompt files and construct the SDK query options object,
 * including subagent (Agent tool) definitions for animator, researcher,
 * and trimmer.
 */
export async function buildOrchestratorOptions(
  ctx: PromptContext,
  mcpServers?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const [orchestratorPrompt, animatorPrompt, researcherPrompt, trimmerPrompt] =
    await Promise.all([
      loadPrompt('orchestrator-system'),
      loadPromptWithShared('animator-system'),
      loadPrompt('researcher-system'),
      loadPrompt('trimmer-system'),
    ]);

  const systemPrompt = injectContext(orchestratorPrompt, ctx);

  return {
    model: 'opus',
    systemPrompt,
    allowedTools: [
      'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
      'WebSearch', 'WebFetch', 'Agent', 'Skill',
      ...MANIFEST_TOOL_NAMES,
      ...SCENE_TOOL_NAMES,
      ...RENDER_TOOL_NAMES,
      ...WIDGET_TOOL_NAMES,
    ],
    permissionMode: 'bypassPermissions' as const,
    allowDangerouslySkipPermissions: true,
    agents: {
      animator: {
        description: 'Writes Remotion .tsx scene files for animation sections.',
        prompt: injectContext(animatorPrompt, ctx),
        tools: [
          'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'Skill',
          ...MANIFEST_TOOL_NAMES,
          ...SCENE_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
        ],
        model: 'opus',
      },
      researcher: {
        description: 'Finds web content, captures screenshots, downloads stock images.',
        prompt: injectContext(researcherPrompt, ctx),
        tools: [
          'Read', 'Write', 'Bash', 'WebSearch', 'WebFetch',
          ...MANIFEST_TOOL_NAMES,
        ],
        model: 'sonnet',
      },
      trimmer: {
        description: 'Detects silence, filler words, and dead air in audio tracks.',
        prompt: injectContext(trimmerPrompt, ctx),
        tools: [
          'Read', 'Write', 'Bash', 'Grep',
          ...MANIFEST_TOOL_NAMES,
        ],
        model: 'sonnet',
      },
    },
    maxTurns: 100,
    includePartialMessages: true,
    thinking: { type: 'adaptive' as const },
    persistSession: true,
    ...(mcpServers ? { mcpServers } : {}),
  };
}

// ---- Run orchestrator ----

/**
 * Execute a full orchestrator turn: build the prompt, call the SDK,
 * and stream events back via callbacks. Handles session resume with
 * automatic fallback on failure.
 */
export async function runOrchestrator(
  request: OrchestratorRequest,
  callbacks: OrchestratorCallbacks,
  mcpServers?: Record<string, unknown>,
): Promise<void> {
  const options = await buildOrchestratorOptions(request.projectContext, mcpServers);

  // ---- Assemble user message ----

  let userMessage = request.prompt;

  if (request.widgetResponse) {
    const { widgetId, value } = request.widgetResponse;
    userMessage = `[User responded to widget "${widgetId}": ${JSON.stringify(value)}]\n\n${userMessage}`.trim();
  }

  if (request.editingContext) {
    userMessage = `[Editing context: ${JSON.stringify(request.editingContext)}]\n\n${userMessage}`.trim();
  }

  if (request.conversationHistory.length > 0) {
    const historyText = request.conversationHistory
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');
    userMessage = `<conversation_history>\n${historyText}\n</conversation_history>\n\n${userMessage}`;
  }

  // ---- Stream processing ----

  const abortController = new AbortController();

  // Forward external abort signal
  if (callbacks.signal) {
    if (callbacks.signal.aborted) {
      callbacks.onError('Aborted before start');
      return;
    }
    callbacks.signal.addEventListener('abort', () => abortController.abort(), { once: true });
  }

  let capturedSessionId: string | null = null;

  async function processStream(iter: AsyncIterable<SDKMessage>): Promise<void> {
    for await (const message of iter) {
      if (abortController.signal.aborted) break;

      // Capture session ID from the first message that carries one
      if (!capturedSessionId && message.session_id) {
        capturedSessionId = message.session_id;
      }

      if (message.type === 'stream_event') {
        const partial = message as SDKPartialAssistantMessage;
        const evt = partial.event as BetaRawContentBlockDeltaEvent;

        if (evt?.type === 'content_block_delta') {
          const delta = evt.delta as { type: string; text?: string };
          if (delta.type === 'text_delta' && delta.text) {
            callbacks.onText(delta.text);
          }
        }
      }
    }
  }

  // ---- Execute ----

  try {
    const buildQueryOpts = (useResume: boolean): { prompt: string; options: Record<string, unknown> } => {
      const opts = { ...options, abortController };

      if (useResume && request.sessionId) {
        return {
          prompt: userMessage,
          options: { ...opts, resume: request.sessionId },
        };
      }

      return { prompt: userMessage, options: opts };
    };

    if (request.sessionId) {
      // Attempt session resume first
      try {
        const iter = query(buildQueryOpts(true));
        await processStream(iter);
      } catch (resumeErr) {
        // Resume failed — retry without resume (text-based history fallback)
        if (abortController.signal.aborted) throw resumeErr;

        capturedSessionId = null;
        callbacks.onText(''); // Signal reset to caller

        const iter = query(buildQueryOpts(false));
        await processStream(iter);
      }
    } else {
      const iter = query(buildQueryOpts(false));
      await processStream(iter);
    }

    callbacks.onDone({
      sessionId: capturedSessionId ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks.onError(message);
  }
}

// ---- Exported tool name lists (for agent-server MCP registration) ----

export { MANIFEST_TOOL_NAMES, SCENE_TOOL_NAMES, RENDER_TOOL_NAMES, WIDGET_TOOL_NAMES };
