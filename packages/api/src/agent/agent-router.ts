import { PassThrough } from 'stream';
import { FastifyInstance } from 'fastify';
import { query, type SDKPartialAssistantMessage } from '@anthropic-ai/claude-agent-sdk';
import type { BetaRawContentBlockDeltaEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import { eq, or, and } from 'drizzle-orm';
import { db, projects, transcripts, visuals, jobs } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import { buildSystemPrompt } from './agent-system-prompt.js';
import { createAgentMcpServer, TOOL_NAMES } from './agent-tools.js';
import {
  getOrCreateConversation,
  getConversationMessages,
  addMessage,
  updateMessageContent,
  getConversationWithMessages,
  deleteConversation,
} from './conversation-store.js';

// SSE helper — writes a server-sent event to a writable stream
function sendSSE(stream: NodeJS.WritableStream, event: string, data: unknown) {
  stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Format stored messages into text for system prompt context
function formatConversationHistory(
  storedMessages: Array<{ role: string; content: unknown }>,
): string {
  if (storedMessages.length === 0) return '';

  const lines = storedMessages.map((m) => {
    const contentBlocks = m.content as Array<{ type: string; text?: string; widget?: { kind?: string; planJobId?: string } }>;
    const parts: string[] = [];

    for (const b of contentBlocks) {
      if (b.type === 'text' && typeof b.text === 'string') {
        parts.push(b.text);
      } else if (b.type === 'widget' && b.widget) {
        // Include key widget info so the agent can reference planJobId etc.
        if (b.widget.kind === 'scene_plan' && b.widget.planJobId) {
          parts.push(`[Shown scene plan widget — planJobId: ${b.widget.planJobId}]`);
        } else if (b.widget.kind) {
          parts.push(`[Shown ${b.widget.kind} widget]`);
        }
      }
    }

    return `[${m.role}]: ${parts.join('\n')}`;
  });

  return '\n\nCONVERSATION HISTORY:\n' + lines.join('\n\n');
}

// Check if a job is fresh enough to show progress for.
// Jobs with completedAt are definitively done — never treat them as active.
// Pending jobs older than 3 min are likely orphaned (worker should pick up fast).
// Processing jobs older than 15 min are likely stalled.
function isJobFresh(job: { status: string; createdAt: Date; completedAt: Date | null }, thresholdMs: number): boolean {
  if (job.completedAt) return false;
  const age = Date.now() - new Date(job.createdAt).getTime();
  if (job.status === 'pending') return age < Math.min(thresholdMs, 3 * 60 * 1000);
  return age < 15 * 60 * 1000; // 15 min for processing jobs
}

export async function agentRoutes(fastify: FastifyInstance) {
  // ─── POST /projects/:id/agent/chat — SSE streaming chat ──────────────────

  fastify.post('/projects/:id/agent/chat', {
    preHandler: authMiddleware,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };

    // Validate request body
    const body = request.body as {
      message?: string;
      context?: {
        selectedTimeRange?: { startMs: number; endMs: number };
        selectedSceneId?: number;
        selectedElement?: { name: string; sceneId: number };
        selectedVisualItem?: { id: string; description: string };
      };
      widgetResponse?: { widgetId: string; value: unknown };
    };

    // Allow empty message when a widgetResponse is present (e.g. theme picker selection)
    const hasWidgetResponse = body.widgetResponse && typeof body.widgetResponse === 'object';
    const message = body.message ?? '';
    if (typeof message !== 'string' || message.length > 10000 || (!message && !hasWidgetResponse)) {
      return reply.code(400).send({
        error: 'message is required and must be a string under 10,000 characters.',
      });
    }

    // 1. Load the project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    // Check project ownership
    if (project.userId && project.userId !== (request as any).user?.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // 2. Gather context for system prompt
    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.projectId, projectId),
    });

    const visual = await db.query.visuals.findFirst({
      where: eq(visuals.projectId, projectId),
    });

    const videoSettings = (project.videoSettings as Record<string, unknown>) || {};

    const systemPrompt = buildSystemPrompt({
      projectId,
      title: project.title,
      projectType: project.projectType || 'video',
      canvasWidth: (videoSettings.canvasWidth as number) ?? 1080,
      canvasHeight: (videoSettings.canvasHeight as number) ?? 1920,
      durationMs: project.durationMs,
      fps: project.fps ?? 30,
      hasTranscript: !!transcript,
      hasVisuals: !!visual,
      sceneCount: visual?.timestamps ? (visual.timestamps as unknown[]).length : 0,
    });

    // 3. Get or create conversation
    const conversation = await getOrCreateConversation(projectId);

    // 4. Load previous messages
    const storedMessages = await getConversationMessages(conversation.id);

    // 5. Build user message with optional context metadata
    let userText = message;

    if (body.widgetResponse) {
      userText += `\n\n[Widget response: ${JSON.stringify(body.widgetResponse)}]`;
    }

    if (body.context?.selectedTimeRange) {
      const { startMs, endMs } = body.context.selectedTimeRange;
      userText += `\n\n[Selected time range: ${startMs}ms – ${endMs}ms]`;
    }

    if (body.context?.selectedSceneId !== undefined) {
      userText += `\n\n[Selected scene: ${body.context.selectedSceneId}]`;
    }

    if (body.context?.selectedElement) {
      const { name, sceneId } = body.context.selectedElement;
      userText += `\n\n[Selected element: "${name}" in scene ${sceneId}]`;
    }

    if (body.context?.selectedVisualItem) {
      userText += `\n\n[Editing visuals: user selected the visual track]`;
    }

    // Save the user message — mark as hidden if it's an internal/system message
    // (init greet, widget responses) so it doesn't show up on reload
    const isHiddenMessage = message.startsWith('[Start the conversation') || !!body.widgetResponse;
    await addMessage(conversation.id, 'user', [{ type: 'text', text: userText, hidden: isHiddenMessage || undefined }]);

    // Persist widget response on the original assistant message's widget block
    // so it survives page refresh (widget shows as already-responded)
    if (body.widgetResponse) {
      const { widgetId, value } = body.widgetResponse;
      // Find the most recent assistant message containing this widget
      const allMessages = await getConversationMessages(conversation.id);
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const m = allMessages[i];
        if (m.role !== 'assistant') continue;
        const blocks = m.content as Array<{ type: string; widget?: { id: string }; response?: unknown }>;
        if (!Array.isArray(blocks)) continue;
        const widgetIdx = blocks.findIndex((b) => b.type === 'widget' && b.widget?.id === widgetId);
        if (widgetIdx >= 0) {
          blocks[widgetIdx] = { ...blocks[widgetIdx], response: value };
          await updateMessageContent(m.id, blocks);
          break;
        }
      }
    }

    // 6. Set up SSE response via PassThrough stream
    // Using reply.send(stream) keeps Fastify's full plugin pipeline (including
    // @fastify/cors) intact — unlike reply.hijack() which bypasses it entirely.
    const sseStream = new PassThrough();

    reply
      .header('Content-Type', 'text/event-stream')
      .header('Cache-Control', 'no-cache')
      .header('Connection', 'keep-alive')
      .header('X-Accel-Buffering', 'no')
      .send(sseStream);

    // Keep only recent messages for context
    const recentMessages = storedMessages.slice(-50);
    const conversationHistoryText = formatConversationHistory(recentMessages);

    // 7. Create MCP server and run SDK query
    const abortController = new AbortController();
    request.raw.on('close', () => {
      abortController.abort();
    });

    // Heartbeat to prevent idle connection drops (SDK subprocess startup can be slow)
    const heartbeat = setInterval(() => {
      if (!sseStream.destroyed) sseStream.write(':\n\n');
    }, 15_000);

    // Track all content blocks (text + widgets) for persistence
    const contentBlocks: Array<{ type: string; [k: string]: unknown }> = [];
    let pendingText = '';

    // Create assistant message row in DB immediately so it exists even if
    // the user refreshes mid-stream. We'll update its content as we go.
    const assistantRow = await addMessage(conversation.id, 'assistant', []);

    // Flush accumulated text into a content block
    function flushText() {
      if (pendingText) {
        contentBlocks.push({ type: 'text', text: pendingText });
        pendingText = '';
      }
    }

    // Persist current content to DB (queued to avoid race conditions)
    let persistPromise: Promise<void> = Promise.resolve();
    function persistContent() {
      // Chain saves sequentially — if one is in-flight, the next one queues behind it.
      // This prevents concurrent writes that could lose data.
      persistPromise = persistPromise.then(async () => {
        try {
          flushText();
          if (contentBlocks.length > 0) {
            await updateMessageContent(assistantRow.id, [...contentBlocks]);
          }
        } catch {
          // Non-critical — final save in `finally` will catch up
        }
      });
    }

    const mcpServer = createAgentMcpServer({
      projectId,
      sendSSE: (event, data) => {
        sendSSE(sseStream, event, data);
        // Capture widget events for persistence and save to DB
        if (event === 'widget') {
          flushText();
          contentBlocks.push({ type: 'widget', widget: data });
          persistContent();
        }
      },
      signal: abortController.signal,
    });

    // Periodically save accumulated content so refreshes don't lose text.
    // 2-second interval minimizes data loss on unexpected disconnections.
    const persistInterval = setInterval(() => {
      if (pendingText || contentBlocks.length > 0) {
        persistContent();
      }
    }, 2_000);

    try {
      fastify.log.info({ projectId }, 'Starting SDK query...');
      for await (const message of query({
        prompt: userText,
        options: {
          mcpServers: { 'creative-director': mcpServer },
          allowedTools: TOOL_NAMES,
          systemPrompt: systemPrompt + conversationHistoryText,
          includePartialMessages: true,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          model: config.anthropic.model,
          settingSources: ['user'],
          abortController,
          tools: [],
          maxTurns: 10,
          thinking: { type: 'disabled' },
          persistSession: false,
          env: { ...process.env, CLAUDECODE: undefined },
          stderr: (data: string) => fastify.log.warn({ stderr: data }, 'SDK stderr'),
        },
      })) {
        if (message.type === 'stream_event') {
          const partial = message as SDKPartialAssistantMessage;
          const evt = partial.event as BetaRawContentBlockDeltaEvent;
          if (evt?.type === 'content_block_delta') {
            const delta = evt.delta as { type: string; text?: string };
            if (delta.type === 'text_delta' && delta.text) {
              sendSSE(sseStream, 'text', { text: delta.text });
              pendingText += delta.text;
            }
          }
        }
      }

      // 8. Send done event
      sendSSE(sseStream, 'done', { conversationId: conversation.id });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      fastify.log.error({ err }, 'Agent chat error');
      sendSSE(sseStream, 'error', { message: errorMessage });
    } finally {
      clearInterval(heartbeat);
      clearInterval(persistInterval);

      // Wait for any in-flight persistence to finish before the final save
      try { await persistPromise; } catch { /* already handled */ }

      // Final save — update the assistant row with all accumulated content.
      try {
        flushText();
        await updateMessageContent(assistantRow.id, contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: '' }]);
      } catch (saveErr) {
        fastify.log.error({ err: saveErr }, 'Failed to save assistant message');
      }

      sseStream.end();
    }
  });

  // ─── GET /projects/:id/agent/conversation — get conversation history ─────

  fastify.get('/projects/:id/agent/conversation', { preHandler: authMiddleware }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };

    // Check project ownership
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    if (project.userId && project.userId !== (request as any).user?.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const data = await getConversationWithMessages(projectId);

    // Check for active jobs so frontend can restore progress bar after refresh.
    // Only return jobs updated in the last 5 minutes — older ones are likely stale
    // (e.g. worker crashed, server restarted). This prevents the "stuck in progress"
    // issue when reopening the editor.
    const STALE_JOB_MS = 5 * 60 * 1000;
    const activeJobRow = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.projectId, projectId),
        or(eq(jobs.status, 'pending'), eq(jobs.status, 'processing')),
      ),
    });

    // Filter out stale/completed jobs — completed jobs or those older than threshold are ignored
    const activeJob = activeJobRow && isJobFresh(activeJobRow, STALE_JOB_MS) ? activeJobRow : null;

    const jobPayload = activeJob
      ? { id: activeJob.id, type: activeJob.type, progress: activeJob.progress, message: activeJob.progressMessage }
      : null;

    if (!data) {
      return reply.send({ conversationId: null, messages: [], activeJob: jobPayload });
    }

    return reply.send({ ...data, activeJob: jobPayload });
  });

  // ─── DELETE /projects/:id/agent/conversation — clear conversation ────────

  fastify.delete('/projects/:id/agent/conversation', { preHandler: authMiddleware }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };

    // Check project ownership
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    if (project.userId && project.userId !== (request as any).user?.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    await deleteConversation(projectId);

    return reply.send({ success: true });
  });
}
