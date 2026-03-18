// packages/sandbox/src/orchestrator.ts
//
// Core orchestrator module for the sandbox. Builds SDK query options with
// subagent definitions (5 agents: Trim Editor, Planner, Visual Editor, Animator, QC Reviewer),
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

// Local type aliases for discriminated union extraction — the SDK doesn't export these directly
type SDKAssistantMessage = Extract<SDKMessage, { type: 'assistant' }>;
import pino from 'pino';
import {
  addTask, updateTask, completeTask, appendText,
  finishJob,
} from './job-state.js';
import { flushCallbacks } from './api-callback.js';

const logger = pino({ name: 'orchestrator' });

// Inline type — avoids importing from @anthropic-ai/sdk which may not be directly installed
interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  delta: { type: string; text?: string };
}
import { assembleAgentPrompt, loadPrompt, injectContext, type PromptContext } from './prompts/prompt-loader.js';
import { allManifestTools } from './tools/manifest-ops.js';
import { writeSceneFileTool, deleteSceneFileTool } from './tools/scene-tools.js';
import { renderStillTool } from './tools/render-still.js';
import { triggerRebuildTool } from './tools/trigger-rebuild.js';
import { buildStdioMcpServers } from './mcp-config.js';

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
  onActivity?: (activity: {
    agent: string | null;
    action: string | null;
    phase?: string;
    startedAt?: number;
  }) => void;
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

const WIDGET_TOOL_NAMES = ['mcp__widgets__show_widget', 'mcp__widgets__report_progress', 'mcp__widgets__report_plan'];

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

const ANALYSIS_TOOL_NAMES = [
  'mcp__analysis__analyze_transcript',
  'mcp__analysis__validate_timeline',
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

// ---- Display labels for mechanical progress ----
// Maps internal MCP server names to user-facing agent/tool labels.

const MCP_SERVER_LABELS: Record<string, string> = {
  manifest: 'Visual Editor',
  scenes: 'Animator',
  render: 'Renderer',
  widgets: 'Viona',
  assets: 'Viona',
  viewport: 'QC Reviewer',
  analysis: 'Viona',
  'better-icons': 'Animator',
  freepik: 'Animator',
};

const SUBAGENT_LABELS: Record<string, string> = {
  planner: 'Planner',
  trim_editor: 'Trim Editor',
  visual_editor: 'Visual Editor',
  animator: 'Animator',
  qc_reviewer: 'QC Reviewer',
};

// ---- Build SDK query options ----

/**
 * Load all prompt files and construct the SDK query options object,
 * including subagent (Agent tool) definitions for the 5 pipeline agents:
 * Trim Editor, Planner, Visual Editor, Animator, QC Reviewer.
 *
 * Prompts are assembled using the new prompt-loader with research-backed
 * order: shared modules (cacheable) → agent system → examples → context → reminder.
 */
export async function buildOrchestratorOptions(
  ctx: PromptContext,
  mcpServers?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const [orchestratorPrompt, trimEditorPrompt, plannerPrompt, visualEditorPrompt, qcReviewerPrompt] =
    await Promise.all([
      loadPrompt('orchestrator/system'),
      assembleAgentPrompt('trim-editor', ctx),
      assembleAgentPrompt('planner', ctx),
      assembleAgentPrompt('visual-editor', ctx),
      assembleAgentPrompt('qc-reviewer', ctx),
    ]);

  const systemPrompt = injectContext(orchestratorPrompt, ctx);

  return {
    model: 'opus',
    systemPrompt: {
      type: 'preset' as const,
      preset: 'claude_code' as const,
      append: systemPrompt,
    },
    cwd: '/workspace',
    settingSources: ['project'],
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
      ...ANALYSIS_TOOL_NAMES,
    ],
    permissionMode: 'bypassPermissions' as const,
    allowDangerouslySkipPermissions: true,
    agents: {
      // ---- Trim Editor (Phase 2) ----
      // Transcript trimming, jump cut coverage, J/L-cuts, pacing, captions.
      trim_editor: {
        description: 'Trims transcript (fillers, silences, retakes), covers jump cuts with zoom punch-ins, applies J/L-cuts for smooth audio transitions, refines pacing, generates captions.',
        prompt: {
          type: 'preset' as const,
          preset: 'claude_code' as const,
          append: trimEditorPrompt,
        },
        tools: [
          'Read', 'Write', 'Glob', 'Grep', 'Bash',
          ...MANIFEST_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
          ...ASSET_TOOL_NAMES,
          ...ANALYSIS_TOOL_NAMES,
        ],
        model: 'opus',
        skills: ['cutting-and-pacing', 'transcript-analysis', 'transitions'],
      },

      // ---- Planner (Phase 3) ----
      // Transcript analysis, spatial layout, creative direction, display modes.
      planner: {
        description: 'Analyzes transcript, designs spatial layout with exact coordinates, assigns display modes, creates SCENE_PLAN.md with sync points and energy arc.',
        prompt: {
          type: 'preset' as const,
          preset: 'claude_code' as const,
          append: plannerPrompt,
        },
        tools: [
          'Read', 'Write', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
          ...MANIFEST_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
          ...ASSET_TOOL_NAMES,
          ...ANALYSIS_TOOL_NAMES,
        ],
        model: 'opus',
        skills: ['editorial-planning', 'visual-treatment-guide', 'narrative-structure', 'transcript-analysis'],
      },

      // ---- Visual Editor (Phases 4, 7) ----
      // Rough cut with zoom crops, B-roll, mockup placeholders (Phase 4).
      // Final assembly replacing mockups with scenes, transitions, caption styling (Phase 7).
      visual_editor: {
        description: 'Builds rough cut with zoom crops, B-roll, and mockup placeholders (Phase 4). Handles final assembly replacing mockups with scenes, transitions, caption styling (Phase 7).',
        prompt: {
          type: 'preset' as const,
          preset: 'claude_code' as const,
          append: visualEditorPrompt,
        },
        tools: [
          'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
          ...MANIFEST_TOOL_NAMES,
          ...SCENE_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
          ...ASSET_TOOL_NAMES,
          ...ICON_TOOL_NAMES,
          ...FREEPIK_TOOL_NAMES,
          ...ANALYSIS_TOOL_NAMES,
        ],
        model: 'opus',
        skills: ['cutting-and-pacing', 'transitions', 'lower-third-and-overlays', 'platform-optimization'],
      },

      // ---- Animator (Phase 5) ----
      // Per-scene .tsx generation. Prompt comes from prompt-assembly.ts ONLY.
      animator: {
        description: 'Writes Remotion .tsx scene files. Receives per-scene prompt with dimensions, brief, sync points. Self-heals compilation errors.',
        prompt: {
          type: 'preset' as const,
          preset: 'claude_code' as const,
          // Note: The actual animator prompt is built dynamically per-scene
          // via buildAnimatorPrompt() and passed as the dispatch message.
          // This base prompt is a fallback / minimal context.
          append: 'You are a Remotion motion graphics engineer. Wait for a scene assignment.',
        },
        tools: ANIMATOR_TOOL_NAMES,
        model: 'opus',
        skills: ['remotion-best-practices', 'framer-motion', 'motion-one', 'video-engagement'],
      },

      // ---- QC Reviewer (Phase 6, 7.5) ----
      // Per-scene review + full-timeline verification after assembly.
      qc_reviewer: {
        description: 'Reviews scene screenshots + code quality. After final assembly, runs full-timeline verification (gaps, sync, transitions). Returns pass/fail with actionable feedback.',
        prompt: {
          type: 'preset' as const,
          preset: 'claude_code' as const,
          append: qcReviewerPrompt,
        },
        tools: [
          'Read', 'Glob', 'Grep',
          ...RENDER_TOOL_NAMES,
          ...VIEWPORT_TOOL_NAMES,
          ...ANALYSIS_TOOL_NAMES,
        ],
        model: 'sonnet',
        skills: ['remotion-best-practices', 'motion-one', 'framer-motion'],
      },
    },
    maxTurns: 100,
    includePartialMessages: true,
    thinking: { type: 'adaptive' as const },
    env: {
      ...process.env,
      ENABLE_TOOL_SEARCH: 'false',
    },
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

  // Only inject conversation history as text when NOT resuming a session.
  // On resume the SDK already loads the full conversation from the persisted session,
  // so duplicating it in the prompt bloats context and confuses the model.
  if (!request.sessionId && request.conversationHistory.length > 0) {
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
  let messageCount = 0;
  let textChunks = 0;
  let toolUses = 0;
  let lastActivityTime = Date.now();
  let currentToolName: string | null = null;
  let lastResultCost: number | undefined;
  let lastResultTurns: number | undefined;

  // ---- Mechanical progress emitter ----
  // Emits lifecycle events so the frontend always has something to show,
  // regardless of whether the LLM calls report_progress.
  const emitProgress = (phase: string, message: string, agentName?: string) => {
    callbacks.onProgress({ phase, percent: 0, message, agentName });
  };
  const emitActivity = (agent: string | null, action: string | null, phase?: string) => {
    callbacks.onActivity?.({ agent, action, phase, startedAt: Date.now() });
  };

  let vionaTaskId: string | null = null;
  const subagentTaskIds = new Map<string, string>(); // tool_use_id → taskId

  async function processStream(iter: AsyncIterable<SDKMessage>): Promise<void> {
    for await (const message of iter) {
      if (abortController.signal.aborted) {
        logger.info('Orchestrator aborted by signal');
        break;
      }

      messageCount++;
      lastActivityTime = Date.now();

      // Capture session ID from the first message that carries one
      if (!capturedSessionId && message.session_id) {
        capturedSessionId = message.session_id;
        logger.info({ sessionId: capturedSessionId }, 'Session established');
        emitProgress('connecting', 'Session established', 'Viona');
      }

      // Log init message for session diagnostics (tool count, MCP server health)
      if ((message as any).type === 'system' && (message as any).subtype === 'init') {
        const init = message as Record<string, unknown>;
        const mcpServers = init.mcp_servers as Array<{ name: string; status: string }> | undefined;
        const failedServers = mcpServers?.filter(s => s.status !== 'connected') ?? [];

        logger.info({
          tools: (init.tools as any[])?.length ?? 0,
          mcpServers: mcpServers?.length ?? 0,
          failedMcpServers: failedServers.map(s => `${s.name}:${s.status}`),
          model: init.model,
          sessionId: init.session_id,
          permissionMode: init.permissionMode,
        }, 'SDK init message');

        if (failedServers.length > 0) {
          logger.warn({ failedServers }, 'Some MCP servers failed to connect');
        }
      }

      // Log and emit non-stream messages (tool use, tool result, agent dispatch, etc.)
      if (message.type !== 'stream_event') {

        // --- Handle complete assistant messages (tool_use detection) ---
        // SDK tool uses are content blocks INSIDE SDKAssistantMessage, not top-level messages.
        // SDKAssistantMessage.message.content[] contains { type: 'tool_use', name, id, input } blocks.
        if (message.type === 'assistant') {
          const assistantMsg = message as SDKAssistantMessage;
          const content = (assistantMsg as any).message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'tool_use') {
                toolUses++;
                const toolName: string | undefined = block.name;
                currentToolName = toolName ?? null;
                logger.info({ tool: toolName, toolUseId: block.id, messageCount }, 'Tool use');

                if (toolName?.startsWith('mcp__')) {
                  const parts = toolName.split('__');
                  const server = parts[1];
                  const tool = parts.slice(2).join('__');
                  const displayServer = MCP_SERVER_LABELS[server] ?? server;
                  emitActivity(displayServer, tool, 'working');
                  emitProgress('working', `${tool}`, displayServer);
                  if (vionaTaskId) updateTask(vionaTaskId, tool);
                } else if (toolName === 'Agent') {
                  const input = block.input as Record<string, unknown> | undefined;
                  const agentKey = (input?.subagent_type ?? input?.description ?? '') as string;
                  const label = SUBAGENT_LABELS[agentKey.toLowerCase()] ?? (agentKey || 'subagent');
                  emitActivity('Viona', `dispatching ${label}`, 'working');
                  emitProgress('working', `Dispatching ${label}`, 'Viona');
                  const subTaskId = addTask(label, 'Starting...', agentKey.toLowerCase());
                  subagentTaskIds.set(block.id, subTaskId);
                } else if (toolName) {
                  emitActivity('Viona', toolName, 'working');
                  emitProgress('working', toolName, 'Viona');
                }
              }
            }
          }

          // When we see a new assistant message at orchestrator level (no parent_tool_use_id),
          // all pending subagent tasks from the previous turn are done.
          const parentId = (assistantMsg as any).parent_tool_use_id;
          if (!parentId) {
            for (const [, taskId] of subagentTaskIds) {
              completeTask(taskId);
            }
            subagentTaskIds.clear();
          }
        }

        // --- Handle tool results (SDKUserMessage with tool_use_result) ---
        if (message.type === 'user') {
          if (currentToolName) {
            logger.info({ tool: currentToolName, messageCount }, 'Tool result');
            currentToolName = null;
          }
        }

        // --- SDK result message (end of query) — contains cost, turns, usage ---
        if (message.type === 'result') {
          const result = message as Record<string, unknown>;
          lastResultCost = result.total_cost_usd as number | undefined;
          lastResultTurns = result.num_turns as number | undefined;
          logger.info({
            messageCount,
            textChunks,
            toolUses,
            subtype: result.subtype,
            numTurns: result.num_turns,
            totalCostUsd: result.total_cost_usd,
            durationMs: result.duration_ms,
            durationApiMs: result.duration_api_ms,
            stopReason: result.stop_reason,
            sessionId: result.session_id,
            errors: (result as any).errors,
            permissionDenials: (result.permission_denials as any[])?.length ?? 0,
          }, 'SDK result message');
        }

        // --- Handle tool_progress for long-running tools ---
        if (message.type === 'tool_progress') {
          const progress = message as { tool_use_id: string; tool_name: string; elapsed_time_seconds: number };
          if (vionaTaskId && progress.tool_name) {
            updateTask(vionaTaskId, `${progress.tool_name} (${Math.round(progress.elapsed_time_seconds)}s)`);
          }
          if (progress.elapsed_time_seconds > 10) {
            logger.info({ tool: progress.tool_name, elapsed: progress.elapsed_time_seconds }, 'Long-running tool');
          }
        }

        // --- Log other message types for debugging ---
        if (!['stream_event', 'assistant', 'user', 'result', 'tool_progress'].includes(message.type)) {
          logger.debug({ type: message.type, messageCount }, 'SDK message');
        }
      }

      if (message.type === 'stream_event') {
        const partial = message as SDKPartialAssistantMessage;
        const evt = partial.event as ContentBlockDeltaEvent;

        if (evt?.type === 'content_block_delta') {
          const delta = evt.delta as { type: string; text?: string };
          if (delta.type === 'text_delta' && delta.text) {
            textChunks++;
            if (textChunks === 1) {
              emitActivity('Viona', 'responding', 'responding');
              emitProgress('responding', 'Responding...', 'Viona');
              if (!vionaTaskId) {
                vionaTaskId = addTask('Viona', 'Responding...');
              }
            }
            callbacks.onText(delta.text);
            appendText(delta.text);
          }
        }
      }
    }
  }

  // ---- Execute ----

  const startTime = Date.now();

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
      logger.info({ sessionId: request.sessionId }, 'Resuming session');
      emitProgress('connecting', 'Resuming session...', 'Viona');
      emitActivity('Viona', 'resuming session', 'connecting');
      try {
        const iter = query(buildQueryOpts(true));
        await processStream(iter);
      } catch (resumeErr) {
        // Resume failed — retry without resume (text-based history fallback)
        if (abortController.signal.aborted) throw resumeErr;

        logger.warn({ err: resumeErr instanceof Error ? resumeErr.message : String(resumeErr) }, 'Resume failed, retrying fresh');
        emitProgress('connecting', 'Resume failed, starting fresh...', 'Viona');
        // Reset all counters for the fresh attempt
        capturedSessionId = null;
        textChunks = 0;
        toolUses = 0;
        messageCount = 0;
        vionaTaskId = null;
        subagentTaskIds.clear();
        callbacks.onText(''); // Signal reset to caller

        const iter = query(buildQueryOpts(false));
        await processStream(iter);
      }
    } else {
      logger.info('Starting fresh session');
      emitProgress('connecting', 'Starting session...', 'Viona');
      emitActivity('Viona', 'starting session', 'connecting');
      const iter = query(buildQueryOpts(false));
      await processStream(iter);
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    // Health check: detect text-only responses that should have used tools
    const userPrompt = request.prompt.toLowerCase();
    const isActionable = userPrompt.includes('fix') || userPrompt.includes('error') ||
      userPrompt.includes('change') || userPrompt.includes('update') ||
      userPrompt.includes('add') || userPrompt.includes('remove') ||
      userPrompt.includes('edit') || userPrompt.includes('debug');

    if (isActionable && toolUses === 0 && textChunks > 50) {
      logger.warn({
        prompt: request.prompt.substring(0, 100),
        textChunks,
        toolUses,
        messageCount,
      }, 'Agent produced long text response without tool use for actionable request');
    }

    logger.info({ elapsed, messageCount, textChunks, toolUses, sessionId: capturedSessionId, cost: lastResultCost, turns: lastResultTurns }, 'Orchestrator completed');

    // Complete Viona's task and finish the job
    if (vionaTaskId) { completeTask(vionaTaskId); vionaTaskId = null; }
    const doneResult = { sessionId: capturedSessionId ?? undefined, cost: lastResultCost, numTurns: lastResultTurns };
    finishJob(doneResult);
    flushCallbacks();

    callbacks.onDone(doneResult);
  } catch (err) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, elapsed, messageCount, textChunks, toolUses }, 'Orchestrator failed');

    // Don't call failJob here — agent-server.ts handles it in its catch block
    // to avoid double error notification.
    callbacks.onError(message);
  }
}

// ---- Exported tool name lists (for agent-server MCP registration) ----

export { MANIFEST_TOOL_NAMES, SCENE_TOOL_NAMES, RENDER_TOOL_NAMES, WIDGET_TOOL_NAMES, ASSET_TOOL_NAMES, VIEWPORT_TOOL_NAMES };
