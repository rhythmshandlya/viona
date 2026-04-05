// packages/sandbox/src/orchestrator.ts
//
// Core orchestrator module for the sandbox. Builds SDK query options with
// subagent definitions (6 agents: Trim Editor, Planner, Setup Agent,
// Layout Editor, Animator, Final Editor), manages session resume,
// and streams events back to the caller via callbacks.
//
// Pipeline phases:
// 1. Brief & Clarification — Viona + user
// 2. Trimming — Trim Editor (fillers, silences, captions)
// 3. Planning — Planner (SCENE_PLAN.md with per-scene schema)
// 4. Setup — Setup Agent (constants, shared components)
// 5. Depth Assets — Poll segmentation until matte/fgr/bg ready
// 6. Layout — Layout Editor (timeline skeleton, depth compositing, transforms)
// 7. Animation — Animators in PARALLEL (one per scene)
// 8. Final Assembly — Final Editor (verify scenes, captions, validation)
// 9. Done

import { query, type SDKPartialAssistantMessage, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

// Local type aliases for discriminated union extraction — the SDK doesn't export these directly
type SDKAssistantMessage = Extract<SDKMessage, { type: 'assistant' }>;
import pino from 'pino';
import {
  addTask, updateTask, completeTask, appendText,
  finishJob, getJobState,
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
import { validateWorkspaceTool } from './tools/validate-workspace.js';
import { allTemplateTools, templateBrowseTools } from './tools/template-tools.js';
import { buildStdioMcpServers } from './mcp-config.js';
import { checkpoint } from './checkpoint.js';

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

// Read-only manifest tools for the orchestrator (Issue #1: prevent direct writes)
const MANIFEST_READ_TOOL_NAMES = allManifestTools
  .filter(t => t.name.startsWith('read_'))
  .map(t => `mcp__manifest__${t.name}`);

const SCENE_TOOL_NAMES = [
  `mcp__scenes__${writeSceneFileTool.name}`,
  `mcp__scenes__${deleteSceneFileTool.name}`,
];

const RENDER_TOOL_NAMES = [
  `mcp__render__${renderStillTool.name}`,
  `mcp__render__${triggerRebuildTool.name}`,
  `mcp__render__${validateWorkspaceTool.name}`,
];

const WIDGET_TOOL_NAMES = ['mcp__widgets__show_widget', 'mcp__widgets__report_progress', 'mcp__widgets__report_plan'];

const ASSET_TOOL_NAMES = [
  'mcp__assets__download_file',
  'mcp__assets__search_unsplash',
  'mcp__assets__search_pexels',
  'mcp__assets__download_stock_photo',
  'mcp__assets__get_speaker_position',
  'mcp__assets__auto_center_speaker',
  'mcp__assets__request_segmentation',
  'mcp__assets__check_segmentation_status',
  'mcp__assets__get_depth_compositing_info',
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
  'mcp__analysis__validate_animation_quality',
];

const TEMPLATE_BROWSE_TOOL_NAMES = templateBrowseTools.map(t => `mcp__templates__${t.name}`);
const TEMPLATE_TOOL_NAMES = allTemplateTools.map(t => `mcp__templates__${t.name}`);

const ANIMATOR_TOOL_NAMES = [
  'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'Skill',
  ...MANIFEST_READ_TOOL_NAMES,
  ...SCENE_TOOL_NAMES,
  ...RENDER_TOOL_NAMES,
  ...ASSET_TOOL_NAMES,
  ...VIEWPORT_TOOL_NAMES,
  ...ICON_TOOL_NAMES,
  ...FREEPIK_TOOL_NAMES,
  ...TEMPLATE_TOOL_NAMES,
];

// ---- Display labels for mechanical progress ----
// Maps internal MCP server names to user-facing agent/tool labels.

const MCP_SERVER_LABELS: Record<string, string> = {
  manifest: 'Editor',
  scenes: 'Animator',
  render: 'Renderer',
  widgets: 'Viona',
  assets: 'Viona',
  viewport: 'Viona',
  analysis: 'Viona',
  'better-icons': 'Animator',
  freepik: 'Animator',
  templates: 'Template Registry',
};

// Maps raw MCP tool names and built-in tools to user-friendly descriptions.
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // Manifest tools
  read_manifest: 'Reading timeline',
  add_track: 'Adding track',
  add_item: 'Adding to timeline',
  update_item: 'Updating timeline',
  delete_item: 'Removing from timeline',
  split_item: 'Splitting clip',
  move_item: 'Moving clip',
  update_track: 'Updating track',
  delete_track: 'Removing track',
  // Scene tools
  write_scene_file: 'Generating animation',
  delete_scene_file: 'Removing animation',
  // Render tools
  render_still: 'Rendering preview',
  trigger_rebuild: 'Rebuilding project',
  validate_workspace: 'Validating workspace',
  // Analysis tools
  analyze_transcript: 'Analyzing transcript',
  validate_timeline: 'Validating timeline',
  // Template tools
  browse_templates: 'Browsing templates',
  fork_template: 'Forking template',
  // Asset tools
  download_file: 'Downloading asset',
  search_unsplash: 'Searching photos',
  search_pexels: 'Searching stock footage',
  download_stock_photo: 'Downloading photo',
  get_speaker_position: 'Analyzing speaker position',
  auto_center_speaker: 'Centering speaker in frame',
  request_segmentation: 'Requesting speaker segmentation',
  check_segmentation_status: 'Checking segmentation status',
  get_depth_compositing_info: 'Checking depth compositing info',
  // Viewport tools
  get_scene_dimensions: 'Checking dimensions',
  validate_scene_code: 'Validating animation',
  submit_verdict: 'Reviewing scene',
  // Widget tools
  show_widget: 'Showing options',
  report_progress: 'Updating progress',
  report_plan: 'Updating plan',
  // Built-in tools
  Read: 'Reading file',
  Write: 'Writing file',
  Edit: 'Editing file',
  Glob: 'Searching files',
  Grep: 'Searching code',
  Bash: 'Running command',
  WebSearch: 'Searching web',
  WebFetch: 'Fetching page',
};

const SUBAGENT_LABELS: Record<string, string> = {
  trim_editor: 'Trim Editor',
  planner: 'Planner',
  setup_agent: 'Setup Agent',
  layout_editor: 'Layout Editor',
  animator: 'Animator',
  final_editor: 'Final Editor',
};

// ---- Build SDK query options ----

/**
 * Load all prompt files and construct the SDK query options object,
 * including subagent (Agent tool) definitions for the 6 pipeline agents:
 * Trim Editor, Planner, Setup Agent, Layout Editor, Animator, Final Editor.
 *
 * Prompts are assembled using the prompt-loader with research-backed
 * order: shared modules (cacheable) → agent system → examples → context → reminder.
 */
export async function buildOrchestratorOptions(
  ctx: PromptContext,
  mcpServers?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const [orchestratorPrompt, trimEditorPrompt, plannerPrompt, setupAgentPrompt, layoutEditorPrompt, animatorPrompt, finalEditorPrompt] =
    await Promise.all([
      loadPrompt('orchestrator/system'),
      assembleAgentPrompt('trim-editor', ctx),
      assembleAgentPrompt('planner', ctx),
      assembleAgentPrompt('setup-agent', ctx),
      assembleAgentPrompt('layout-editor', ctx),
      assembleAgentPrompt('animator', ctx),
      assembleAgentPrompt('final-editor', ctx),
    ]);

  const systemPrompt = injectContext(orchestratorPrompt, ctx);

  // ---- Orchestrator tool whitelist ----
  // These are the ONLY tools the orchestrator (main agent) may call.
  // Subagents are unrestricted (bypassPermissions) — their tool lists
  // in the AgentDefinition control availability; the PreToolUse hook
  // below enforces the orchestrator boundary.
  // Tools the orchestrator is DENIED — these cause it to do subagent work.
  // Everything else is allowed (bypassPermissions). The hook below enforces this.
  const ORCHESTRATOR_DENIED = new Set([
    // Template tools — Planner's job (Issue: orchestrator spends 2+ min browsing)
    // TEMPLATE_TOOL_NAMES is a superset of TEMPLATE_BROWSE_TOOL_NAMES
    ...TEMPLATE_TOOL_NAMES,
    // Scene file tools — Animator's job
    ...SCENE_TOOL_NAMES,
    // Manifest WRITE tools — Layout Editor's job (read-only tools are fine)
    ...MANIFEST_TOOL_NAMES.filter(t => !MANIFEST_READ_TOOL_NAMES.includes(t)),
  ]);

  return {
    model: 'opus',
    systemPrompt: {
      type: 'preset' as const,
      preset: 'claude_code' as const,
      append: systemPrompt,
    },
    cwd: '/workspace',
    settingSources: ['project'],
    permissionMode: 'bypassPermissions' as const,
    allowDangerouslySkipPermissions: true,
    // ---- Enforce orchestrator tool boundary via PreToolUse hook ----
    // SDK permission flow: hooks → deny → permissionMode → allow → canUseTool.
    // bypassPermissions approves everything at step 3, so allowedTools and
    // canUseTool are never reached. Hooks (step 1) are the ONLY way to block
    // tools under bypassPermissions without affecting subagents globally.
    //
    // Strategy: DENY-LIST instead of allow-list. The orchestrator can use most
    // tools (Read, Write, Bash, Glob, Grep, widgets, assets, analysis, render).
    // It is BLOCKED from template tools, scene file tools, and manifest write
    // tools — those are subagent responsibilities.
    //
    // The hook checks `agent_id` on the input: present = subagent (allow all),
    // absent = orchestrator (enforce deny list).
    hooks: {
      PreToolUse: [{
        hooks: [async (
          input: Record<string, unknown>,
          _toolUseID: string | undefined,
          _options: { signal: AbortSignal },
        ) => {
          const toolName = (input as any).tool_name as string | undefined;
          const agentId = (input as any).agent_id as string | undefined;

          // Subagent calls — unrestricted (AgentDefinition.tools controls availability)
          if (agentId) return {};

          // Orchestrator call — enforce deny list
          if (toolName && ORCHESTRATOR_DENIED.has(toolName)) {
            logger.warn({ tool: toolName }, 'Orchestrator tool blocked — must delegate to subagent');
            return {
              hookSpecificOutput: {
                hookEventName: 'PreToolUse' as const,
                permissionDecision: 'deny',
                permissionDecisionReason:
                  `The orchestrator cannot use ${toolName} directly. ` +
                  'Delegate this work to the appropriate subagent ' +
                  '(planner, setup_agent, animator, layout_editor, trim_editor, or final_editor).',
              },
            };
          }

          return {};
        }],
      }],
    },
    agents: {
      // ---- Trim Editor (Phase 2) ----
      trim_editor: {
        description: 'Trims fillers and silences, verifies audio/video marriage. No visual decisions.',
        prompt: trimEditorPrompt,
        tools: [
          'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
          ...MANIFEST_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
          ...ASSET_TOOL_NAMES,
          ...ANALYSIS_TOOL_NAMES,
        ],
        model: 'opus',
        maxTurns: 40,
        criticalSystemReminder_EXPERIMENTAL:
          'CRITICAL RULES:\n' +
          '- Use Read tool before editing any file. Use Edit for targeted changes, Write only for new files.\n' +
          '- Use Glob/Grep instead of find/grep via Bash.\n' +
          '- Audio and video items are MARRIED — every split/trim/remove must be applied to both.\n' +
          '- ALWAYS read the manifest (read_manifest) before making changes.\n' +
          '- After changes, use validate_timeline to verify manifest integrity.',
      },

      // ---- Planner (Phase 3) ----
      planner: {
        description: 'Analyzes transcript with editing style guide, designs spatial layout, creates SCENE_PLAN.md with per-scene entries (speaker layout, scene placement, transitions, animation brief).',
        prompt: plannerPrompt,
        tools: [
          'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
          ...MANIFEST_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
          ...ASSET_TOOL_NAMES,
          ...ANALYSIS_TOOL_NAMES,
          ...TEMPLATE_BROWSE_TOOL_NAMES,
        ],
        model: 'opus',
        maxTurns: 50,
        criticalSystemReminder_EXPERIMENTAL:
          'CRITICAL RULES:\n' +
          '- Use Read tool before editing any file. Use Edit for targeted changes, Write only for new files.\n' +
          '- Use Glob/Grep instead of find/grep via Bash.\n' +
          '- ALWAYS read the manifest and transcript before planning.\n' +
          '- Scene durations: min 210 frames, max 450 frames. Auto-split longer scenes at largest sync gap.\n' +
          '- Include self-verification table in SCENE_PLAN.md before writing scenes.json.',
      },

      // ---- Setup Agent (Phase 4) ----
      // No SCENE_TOOL_NAMES — this agent writes to src/components/ and src/constants.ts
      // via the Write tool, NOT to src/scenes/ (that's the animators' job).
      setup_agent: {
        description: 'Scaffolds shared workspace code — constants.ts (theme tokens), Background.tsx, plan-specific shared components, AND scene file skeletons with pre-filled DATA objects. Must complete before animators start.',
        prompt: setupAgentPrompt,
        tools: [
          'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
          ...MANIFEST_READ_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
          ...TEMPLATE_TOOL_NAMES,
        ],
        skills: ['remotion-best-practices'],
        model: 'opus',
        maxTurns: 40,
        criticalSystemReminder_EXPERIMENTAL:
          'CRITICAL RULES:\n' +
          '- Use Read tool before editing any file. Use Edit for targeted changes, Write only for new files.\n' +
          '- After writing .tsx files, ALWAYS call trigger_rebuild to verify compilation.\n' +
          '- Use render_still once to verify visual output after code changes. Max 1 render-fix cycle, then move on.',
      },

      // ---- Layout Editor (Phase 6) ----
      layout_editor: {
        description: 'Builds timeline skeleton from SCENE_PLAN.md with depth assets — cuts video for overlays/fullscreen, places bg images on V1, matte items on V3, scene items on V2/V4, applies transitions.',
        prompt: layoutEditorPrompt,
        tools: [
          'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
          ...MANIFEST_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
          ...ASSET_TOOL_NAMES,
          ...ANALYSIS_TOOL_NAMES,
        ],
        model: 'opus',
        maxTurns: 40,
        criticalSystemReminder_EXPERIMENTAL:
          'CRITICAL RULES:\n' +
          '- Use Read tool before editing any file. Use Edit for targeted changes, Write only for new files.\n' +
          '- Use Glob/Grep instead of find/grep via Bash.\n' +
          '- CUT video for overlay (READY) and fullscreen scenes (remove V0 segments). KEEP V0 for stacked and FAILED overlay.\n' +
          '- Audio on A0 is never deleted. Split audio at same timestamps as video, but never remove audio segments.\n' +
          '- For READY overlays: bg image on V1, matte item (fgrSrc + matteSrc) on V3, animation on V2 or V4.\n' +
          '- Track IDs are UUIDs returned by add_track — do NOT hardcode IDs like trk-V1.\n' +
          '- Call auto_center_speaker ONCE after all V0 cuts. Call get_speaker_position per overlay scene.\n' +
          '- All transitions are HARD CUTS — no opacity fades. Items appear at startMs, disappear at endMs.\n' +
          '- V1/V3: NO opacity keyframes (hard cuts). Only punch-in spatial keyframes allowed. V1 and V3 must have IDENTICAL base transforms and IDENTICAL punch-in keyframes.\n' +
          '- Scene keyframes must ONLY animate opacity — NEVER x, y, width, height, rotation.\n' +
          '- Scene items MUST have data.sceneFile (.tsx), data.displayMode, data.sceneName.\n' +
          '- ALWAYS read_manifest before and after major operations to verify state.',
      },

      // ---- Animator (Phase 7) ----
      // Full system prompt loaded from prompts/animator/system.md + reminder.md.
      // Per-scene context (brief, dimensions, display mode) is injected by Viona's dispatch message.
      animator: {
        description: 'Motion design engineer. Edits scene skeleton files (created by Setup Agent) to add dense, choreographed Remotion animations. Self-heals compilation errors.',
        prompt: animatorPrompt,
        tools: ANIMATOR_TOOL_NAMES,
        skills: ['remotion-best-practices'],
        model: 'opus',
        maxTurns: 60,
        criticalSystemReminder_EXPERIMENTAL:
          'CRITICAL RULES:\n' +
          '- Use Read tool before editing any file. Use Edit for targeted changes, Write only for new files.\n' +
          '- Templates are ALREADY FORKED by Setup Agent to src/components/templates/<slug>/. Do NOT call fork_template. Read the template\'s index.tsx and magazine/ shared library, then ADAPT its patterns (animations, textures, typography, effects) for your scene\'s unique concept and dimensions. Templates are starting points to manipulate, not finished layouts.\n' +
          '- After editing .tsx files, ALWAYS call trigger_rebuild. If compilation fails, read the error, fix it, rebuild again (max 2 retries).\n' +
          '- Do NOT call render_still — visual verification is handled by the orchestrator after all animators finish.\n' +
          '- ONE hero animation per scene — everything else supports it. Max 5 animated content elements.',
      },

      // ---- Final Editor (Phase 8) ----
      final_editor: {
        description: 'Applies caption styling, validates timeline and workspace (tsc + render). Does NOT re-read all scene files — Animators already verified them.',
        prompt: finalEditorPrompt,
        tools: [
          'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
          ...MANIFEST_TOOL_NAMES,
          ...RENDER_TOOL_NAMES,
          ...ASSET_TOOL_NAMES,
          ...ANALYSIS_TOOL_NAMES,
        ],
        model: 'opus',
        maxTurns: 25,
        criticalSystemReminder_EXPERIMENTAL:
          'CRITICAL RULES:\n' +
          '- Do NOT read individual scene files — Animators already verified them.\n' +
          '- Do NOT edit scene files or enter fix loops. Note issues in summary, then finish.\n' +
          '- Do NOT render stills manually — validate_workspace renders one per scene.\n' +
          '- Apply caption styling, run validate_timeline, run validate_workspace, report results. That is ALL.\n' +
          '- Keep this phase FAST. Max 6 tool calls: read_manifest, read SCENE_PLAN.md, update_caption_preset, validate_timeline, validate_workspace, done.',
      },
    },
    maxTurns: 60,
    includePartialMessages: true,
    thinking: { type: 'adaptive' as const },
    effort: 'max' as const,
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
  let subagentsDispatched = 0;
  const subagentTypesDispatched = new Set<string>();
  let lastActivityTime = Date.now();
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
  const subagentLabels = new Map<string, string>();  // tool_use_id → display label

  // Track active subagents (Task tools in-flight).
  // SDK v0.1.x does NOT surface subagent messages via onMessage — it only
  // shows the Task tool_use and then the tool_result. We use this to emit
  // the subagent label for the entire duration the Task is running.
  // Multiple subagents can run in parallel (e.g., parallel Animator dispatches).
  const activeSubagents = new Map<string, string>(); // tool_use_id → label
  // No queue needed — we match tool_result blocks by tool_use_id directly.

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
        //
        // IMPORTANT: SDK v0.1.x does NOT surface subagent messages through onMessage.
        // When the orchestrator dispatches a subagent via Task, the SDK only emits:
        //   1. assistant message with tool_use { name: 'Task', id: '...' }
        //   2. user message with tool_result (when the subagent finishes)
        // Individual tool calls made BY the subagent are NOT visible here.
        // We track "active subagent" state to attribute the Task duration to the right agent.
        if (message.type === 'assistant') {
          const assistantMsg = message as SDKAssistantMessage;
          const content = (assistantMsg as any).message?.content;

          // Check parent_tool_use_id for SDK versions that surface subagent messages (v0.2+)
          const parentId = (assistantMsg as any).parent_tool_use_id as string | undefined;
          const subagentLabel = parentId ? subagentLabels.get(parentId) : undefined;

          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'tool_use') {
                toolUses++;
                const toolName: string | undefined = block.name;
                logger.info({ tool: toolName, toolUseId: block.id, messageCount }, 'Tool use');

                // Resolve user-friendly tool name
                const rawTool = toolName?.startsWith('mcp__')
                  ? toolName.split('__').slice(2).join('__')
                  : toolName ?? 'working';
                const friendlyTool = TOOL_DISPLAY_NAMES[rawTool] ?? rawTool;

                if (toolName === 'Agent') {
                  // Orchestrator dispatching a subagent
                  const input = block.input as Record<string, unknown> | undefined;
                  const agentKey = (input?.subagent_type ?? input?.description ?? '') as string;
                  const label = SUBAGENT_LABELS[agentKey.toLowerCase()] ?? (agentKey || 'subagent');
                  logger.info({ subagentType: agentKey, label, toolUseId: block.id, prompt: (input?.prompt as string)?.substring(0, 200) }, 'Subagent dispatched');

                  // Mark this subagent as actively running (supports parallel dispatches)
                  activeSubagents.set(block.id, label);

                  emitActivity(label, 'Starting...', 'working');
                  emitProgress('working', `${label} starting`, label);
                  const subTaskId = addTask(label, 'Starting...', agentKey.toLowerCase());
                  subagentTaskIds.set(block.id, subTaskId);
                  subagentLabels.set(block.id, label);
                  subagentsDispatched++;
                  subagentTypesDispatched.add(agentKey.toLowerCase());
                } else if (subagentLabel) {
                  // Tool call from inside a subagent (SDK v0.2+ only)
                  emitActivity(subagentLabel, friendlyTool, 'working');
                  emitProgress('working', friendlyTool, subagentLabel);
                  const taskId = parentId ? subagentTaskIds.get(parentId) : undefined;
                  if (taskId) updateTask(taskId, friendlyTool);
                } else if (toolName?.startsWith('mcp__')) {
                  // Orchestrator-level MCP tool call
                  const server = toolName.split('__')[1];
                  const displayServer = MCP_SERVER_LABELS[server] ?? server;
                  emitActivity(displayServer, friendlyTool, 'working');
                  emitProgress('working', friendlyTool, displayServer);
                  if (vionaTaskId) updateTask(vionaTaskId, friendlyTool);
                } else if (toolName) {
                  // Orchestrator-level non-MCP tool call
                  emitActivity('Viona', friendlyTool, 'working');
                  emitProgress('working', friendlyTool, 'Viona');
                }
              }
            }
          }

          // NOTE: We do NOT clear subagent state here. Subagent completion is handled
          // by matching tool_result blocks to activeSubagents in the 'user' message handler below.
          // This supports parallel subagent dispatches where multiple Tasks are in-flight.
        }

        // --- Handle tool results (SDKUserMessage) ---
        // SDK v0.1.x sends tool results as user messages containing tool_result blocks.
        // Each block has a tool_use_id that matches the original tool_use dispatch.
        // We check each block against activeSubagents to detect subagent completion.
        if (message.type === 'user') {
          const userContent = (message as any).message?.content ?? (message as any).content;
          if (Array.isArray(userContent)) {
            for (const block of userContent) {
              if (block.type === 'tool_result' && block.tool_use_id) {
                const finishedLabel = activeSubagents.get(block.tool_use_id);
                if (finishedLabel) {
                  const taskId = subagentTaskIds.get(block.tool_use_id);
                  if (taskId) {
                    completeTask(taskId);
                    subagentTaskIds.delete(block.tool_use_id);
                  }
                  logger.info({ agent: finishedLabel, toolUseId: block.tool_use_id, messageCount }, 'Subagent completed');
                  emitActivity(finishedLabel, 'Done', 'complete');
                  emitProgress('working', `${finishedLabel} finished`, finishedLabel);
                  activeSubagents.delete(block.tool_use_id);
                  subagentLabels.delete(block.tool_use_id);

                  // Fire-and-forget checkpoint after subagent completes (mutex guards concurrency)
                  checkpoint().catch(err => {
                    logger.warn({ err, agent: finishedLabel }, 'Phase boundary checkpoint failed');
                  });
                }
              }
            }
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

          // If this progress is for an active subagent's Task, attribute to that agent
          const progressAgentLabel = activeSubagents.get(progress.tool_use_id);
          if (progressAgentLabel) {
            const elapsed = Math.round(progress.elapsed_time_seconds);
            const taskId = subagentTaskIds.get(progress.tool_use_id);
            if (taskId) updateTask(taskId, `Working... (${elapsed}s)`);
            emitActivity(progressAgentLabel, `Working... (${elapsed}s)`, 'working');
            emitProgress('working', `${progressAgentLabel} working (${elapsed}s)`, progressAgentLabel);
          } else if (vionaTaskId && progress.tool_name) {
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
        subagentsDispatched = 0;
        messageCount = 0;
        vionaTaskId = null;
        subagentTaskIds.clear();
        subagentLabels.clear();
        activeSubagents.clear();
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

    // Emit a persistent completion widget BEFORE done so it gets saved in message content.
    // Only emit if actual video generation happened (animator/final_editor ran),
    // not for plan-only or conversational turns.
    const VIDEO_PHASES = ['animator', 'final_editor', 'layout_editor', 'setup_agent'];
    const videoWorkDone = VIDEO_PHASES.some(p => subagentTypesDispatched.has(p));
    if (videoWorkDone) {
      const jobState = getJobState();
      callbacks.onWidget({
        kind: 'completion',
        id: `completion-${Date.now()}`,
        durationSeconds: elapsed,
        cost: lastResultCost,
        plan: jobState?.plan ?? undefined,
      });
    }

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
