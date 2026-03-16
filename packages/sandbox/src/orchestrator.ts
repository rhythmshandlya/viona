// packages/sandbox/src/orchestrator.ts
//
// Core orchestrator module for the sandbox. Builds SDK query options with
// subagent definitions (6 agents: Planner, Editor, 3 Animator variants, Reviewer),
// manages session resume, and streams events back to the caller via callbacks.
//
// Pipeline phases:
// 1. Brainstorming — Viona + user
// 2. Transcript Cleanup — Editor (trim fillers, silences, add captions)
// 3. Planning — Planner (scene-by-scene plan with research)
// 4. Editor Pass 1 — rough cut + colored rect mockups
// 5. Animation Generation — setup + parallel Animators (self-healing)
// 6. Review — Reviewer checks each scene as it completes
// 7. Editor Pass 2 — final assembly (replace mockups, transitions, music)
// 8. Refinement — conversational editing via Viona

import { query, type SDKPartialAssistantMessage, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

// Inline type — avoids importing from @anthropic-ai/sdk which may not be directly installed
interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  delta: { type: string; text?: string };
}
import { loadPrompt, loadPromptWithShared, injectContext, type PromptContext } from './prompts/prompt-loader.js';
import { allManifestTools } from './tools/manifest-ops.js';
import { writeSceneFileTool, deleteSceneFileTool } from './tools/scene-tools.js';
import { renderStillTool } from './tools/render-still.js';
import { triggerRebuildTool } from './tools/trigger-rebuild.js';
import { buildStdioMcpServers } from './mcp-config.js';
import { buildAnimatorVariantPrompt } from './prompt-assembly.js';

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
  onProgress: (progress: {
    phase: string;
    percent: number;
    message: string;
    agentName?: string;
    trackName?: string;
    estimatedTimeRemaining?: number;
  }) => void;
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

const WIDGET_TOOL_NAMES = ['mcp__widgets__show_widget', 'mcp__widgets__report_progress', 'mcp__widgets__build_animator_dispatch'];

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

const ANIMATOR_TOOL_NAMES = [
  'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'Skill',
  ...MANIFEST_TOOL_NAMES,
  ...SCENE_TOOL_NAMES,
  ...RENDER_TOOL_NAMES,
  ...ASSET_TOOL_NAMES,
  ...VIEWPORT_TOOL_NAMES,
  ...ICON_TOOL_NAMES,
  ...FREEPIK_TOOL_NAMES,
];

// ---- Build SDK query options ----

/**
 * Load all prompt files and construct the SDK query options object,
 * including subagent (Agent tool) definitions for the 4 pipeline agents:
 * Planner, Editor, Animator, Reviewer.
 */
export async function buildOrchestratorOptions(
  ctx: PromptContext,
  mcpServers?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const [orchestratorPrompt, animatorPrompt, editorPrompt, plannerPrompt, reviewerPrompt] =
    await Promise.all([
      loadPrompt('orchestrator-system'),
      loadPromptWithShared('animator-system'),
      loadPrompt('editor-system'),
      loadPromptWithShared('planner-system'),
      loadPromptWithShared('reviewer-system'),
    ]);

  const systemPrompt = injectContext(orchestratorPrompt, ctx);

  const animatorBaseInjected = injectContext(animatorPrompt, ctx);

  // Build per-display-mode Animator variants — code assembles layered prompts
  const variantCtx = {
    canvasWidth: ctx.canvasWidth,
    canvasHeight: ctx.canvasHeight,
    theme: ctx.theme ?? 'studio-dark',
  };
  const [animatorStackedPrompt, animatorFullscreenPrompt, animatorOverlayPrompt] =
    await Promise.all([
      buildAnimatorVariantPrompt('default', animatorBaseInjected, variantCtx),
      buildAnimatorVariantPrompt('fullscreen', animatorBaseInjected, variantCtx),
      buildAnimatorVariantPrompt('overlay', animatorBaseInjected, variantCtx),
    ]);

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
      ...ASSET_TOOL_NAMES,
      ...VIEWPORT_TOOL_NAMES,
      ...ICON_TOOL_NAMES,
      ...FREEPIK_TOOL_NAMES,
    ],
    permissionMode: 'bypassPermissions' as const,
    allowDangerouslySkipPermissions: true,
    agents: {
      // ---- Planner ----
      // Analyzes transcript, does research (WebSearch/WebFetch), produces
      // SCENE_PLAN.md + scenes.json. Research is part of planning — no
      // separate Researcher agent.
      planner: {
        description: 'Analyzes transcript and creates a detailed scene-by-scene plan with timing, display modes, visual descriptions, and meaningful scene file names. Also researches web content, screenshots, and supporting materials. Outputs SCENE_PLAN.md and scenes.json.',
        prompt: injectContext(plannerPrompt, ctx),
        tools: [
          'Read', 'Write', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
          ...MANIFEST_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
          ...ASSET_TOOL_NAMES,
        ],
        model: 'opus',
      },

      // ---- Editor ----
      // Handles three phases:
      // Phase 2: Transcript cleanup (trim fillers/silences via manifest ops)
      //          + add captions from post-trim transcript
      // Phase 4: Rough cut (splits, zoom crops, B-roll, mockup rects)
      // Phase 7: Final assembly (replace mockups, transitions, music, captions)
      editor: {
        description: 'Professional video editor. Handles transcript trimming (fillers, silences via manifest ops), rough cut with zoom crops and mockup placeholders, and final assembly with transitions, captions, and music. Re-dispatched per phase — reads workspace state.',
        prompt: injectContext(editorPrompt, ctx),
        tools: [
          'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
          ...MANIFEST_TOOL_NAMES,
          ...SCENE_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
          ...ASSET_TOOL_NAMES,
          ...ICON_TOOL_NAMES,
          ...FREEPIK_TOOL_NAMES,
        ],
        model: 'opus',
      },

      // ---- Animator variants ----
      // 3 display-mode-specific agents with layered prompts assembled by code.
      // Each has the same tools but different system prompts with mode-specific rules.
      'animator-stacked': {
        description: 'Writes Remotion .tsx scene files for STACKED (default) display mode. Scene renders in the visual panel above the speaker. Self-heals compilation errors.',
        prompt: animatorStackedPrompt,
        tools: ANIMATOR_TOOL_NAMES,
        model: 'opus',
      },

      'animator-fullscreen': {
        description: 'Writes Remotion .tsx scene files for FULLSCREEN display mode. Scene fills the entire canvas, speaker hidden. Animated background required. Self-heals compilation errors.',
        prompt: animatorFullscreenPrompt,
        tools: ANIMATOR_TOOL_NAMES,
        model: 'opus',
      },

      'animator-overlay': {
        description: 'Writes Remotion .tsx scene files for OVERLAY display mode. Transparent background, content in safe zones only (top strip 0-15%, lower third 58-85%). Max 2 elements. Self-heals compilation errors.',
        prompt: animatorOverlayPrompt,
        tools: ANIMATOR_TOOL_NAMES,
        model: 'opus',
      },

      // ---- Reviewer ----
      // Checks each scene after the Animator completes. Renders stills,
      // validates against plan, checks display mode compliance. Returns
      // pass/fail with actionable feedback. Reviews happen as each scene
      // completes — not after all Animators finish.
      reviewer: {
        description: 'Reviews rendered scene screenshots against the plan. Checks composition, readability, display mode compliance. Returns pass/fail verdict with actionable feedback. Reviews each scene as its Animator completes.',
        prompt: injectContext(reviewerPrompt, ctx),
        tools: [
          'Read', 'Glob', 'Grep',
          ...RENDER_TOOL_NAMES,
          ...VIEWPORT_TOOL_NAMES,
        ],
        model: 'sonnet',
      },
    },
    maxTurns: 100,
    includePartialMessages: true,
    thinking: { type: 'adaptive' as const },
    persistSession: true,
    mcpServers: {
      ...(mcpServers || {}),
      ...buildStdioMcpServers(),
    },
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
        const evt = partial.event as ContentBlockDeltaEvent;

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

export { MANIFEST_TOOL_NAMES, SCENE_TOOL_NAMES, RENDER_TOOL_NAMES, WIDGET_TOOL_NAMES, ASSET_TOOL_NAMES, VIEWPORT_TOOL_NAMES };
