import { PassThrough } from 'stream';
import { FastifyInstance } from 'fastify';
import { query, type SDKPartialAssistantMessage, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { BetaRawContentBlockDeltaEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import { eq, or, and } from 'drizzle-orm';
import { db, projects, transcripts, visuals, jobs } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import { redis, publishJobError } from '../services/redis.js';
import { buildSystemPrompt } from './agent-system-prompt.js';
import { createAgentMcpServer, TOOL_NAMES, derivePhase, normalizeProgressMessage } from './agent-tools.js';
import {
  getOrCreateConversation,
  getConversationMessages,
  addMessage,
  updateMessageContent,
  getConversationWithMessages,
  deleteConversation,
  updateConversationSessionId,
} from './conversation-store.js';

// Per-project event buffer for Last-Event-ID resumption
const EVENT_BUFFER_SIZE = 100;
interface EventBuffer {
  events: Array<{ id: number; event: string; data: string }>;
  lastUpdated: number;
}
const projectEventBuffers = new Map<string, EventBuffer>();

// Periodic sweep of stale event buffers
const MAX_EVENT_BUFFERS = 200; // Safety cap — at 50 users, max ~50 active
setInterval(() => {
  const now = Date.now();
  // Remove stale buffers (older than 5 minutes)
  for (const [key, buffer] of projectEventBuffers) {
    if (now - buffer.lastUpdated > 5 * 60 * 1000) {
      projectEventBuffers.delete(key);
    }
  }
  // If still over cap, evict oldest
  if (projectEventBuffers.size > MAX_EVENT_BUFFERS) {
    const sorted = [...projectEventBuffers.entries()]
      .sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
    const toRemove = sorted.slice(0, sorted.length - MAX_EVENT_BUFFERS);
    for (const [key] of toRemove) {
      projectEventBuffers.delete(key);
    }
  }
}, 60 * 1000); // Run every minute instead of every 5 minutes

// SSE helper — returns a closure that writes server-sent events with
// auto-incrementing IDs, basic backpressure awareness, and event buffering
// for Last-Event-ID resumption.
function createSSEWriter(stream: NodeJS.WritableStream, projectId: string) {
  let eventId = 0;
  let draining = true;
  stream.on('drain', () => { draining = true; });

  // Always create a fresh buffer — replaces any stale buffer from a prior stream
  const bufferObj: EventBuffer = { events: [], lastUpdated: Date.now() };
  projectEventBuffers.set(projectId, bufferObj);

  function sendSSE(event: string, data: unknown, skipBuffer = false) {
    if ((stream as any).destroyed) return;
    eventId++;
    const serialized = JSON.stringify(data);

    // Buffer for potential replay (skip for replayed events to prevent duplicates)
    if (!skipBuffer) {
      bufferObj.events.push({ id: eventId, event, data: serialized });
      bufferObj.lastUpdated = Date.now();
      if (bufferObj.events.length > EVENT_BUFFER_SIZE) bufferObj.events.shift();
    }

    try {
      const ok = (stream as any).write(`id: ${eventId}\nevent: ${event}\ndata: ${serialized}\n\n`);
      if (!ok) draining = false;
    } catch {
      // Stream closed — ignore
    }
  }

  return { sendSSE, bufferObj };
}

// Per-project concurrent SSE stream counter
const activeStreams = new Map<string, number>();

// Format stored messages into text for system prompt context
function formatConversationHistory(
  storedMessages: Array<{ role: string; content: unknown }>,
): string {
  if (storedMessages.length === 0) return '';

  const lines = storedMessages.map((m) => {
    const contentBlocks = m.content as Array<{ type: string; text?: string; widget?: { kind?: string; planJobId?: string }; response?: unknown }>;
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
        // Include widget responses so the agent knows what the user picked (for retry context)
        if (b.response !== undefined) {
          parts.push(`[User responded: ${JSON.stringify(b.response)}]`);
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

    // Validate context
    if (body.context?.selectedTimeRange) {
      const { startMs, endMs } = body.context.selectedTimeRange;
      if (typeof startMs !== 'number' || typeof endMs !== 'number' || startMs < 0 || endMs <= startMs || endMs > 24 * 60 * 60 * 1000) {
        return reply.code(400).send({ error: 'Invalid selectedTimeRange' });
      }
    }

    // 1. Load and validate the project BEFORE incrementing activeStreams
    //    (early returns must not leak the counter)
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    // Check project ownership
    if (project.userId && project.userId !== request.user?.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Concurrent SSE limit per project (after validation — no early returns past here)
    const currentCount = activeStreams.get(projectId) || 0;
    if (currentCount >= 2) {
      return reply.code(429).send({ error: 'Too many active AI sessions for this project. Please wait.' });
    }
    activeStreams.set(projectId, currentCount + 1);

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
      sourceWidth: project.sourceWidth ?? undefined,
      sourceHeight: project.sourceHeight ?? undefined,
    });

    // 3. Get or create conversation
    const conversation = await getOrCreateConversation(projectId);

    // 4. Load previous messages (limit to last 50 for system prompt context)
    const storedMessages = await getConversationMessages(conversation.id, 50);

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

    // Snapshot old event buffer BEFORE createSSEWriter replaces it with a fresh one
    const prevBuffer = projectEventBuffers.get(projectId);

    const { sendSSE, bufferObj: streamBufferObj } = createSSEWriter(sseStream, projectId);

    // Replay missed events if client reconnects with Last-Event-ID
    // Uses skipBuffer=true to prevent replayed events from being re-buffered
    // (which would cause duplicates on subsequent reconnections)
    const lastEventIdHeader = request.headers['last-event-id'];
    if (lastEventIdHeader && prevBuffer && prevBuffer.events.length > 0) {
      const lastId = parseInt(lastEventIdHeader as string, 10);
      if (!isNaN(lastId)) {
        const missed = prevBuffer.events.filter(e => e.id > lastId);
        for (const e of missed) {
          sendSSE(e.event, JSON.parse(e.data), true);
        }
      }
    }

    const conversationHistoryText = formatConversationHistory(storedMessages);

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
        sendSSE(event, data);
        // Capture widget events for persistence and save to DB
        if (event === 'widget') {
          flushText();
          contentBlocks.push({ type: 'widget', widget: data });
          persistContent();
        }
      },
      signal: abortController.signal,
      userMessage: userText,
    });

    // Periodically save accumulated content so refreshes don't lose text.
    // 2-second interval minimizes data loss on unexpected disconnections.
    const persistInterval = setInterval(() => {
      if (pendingText || contentBlocks.length > 0) {
        persistContent();
      }
    }, 2_000);

    // --- Stream processing helper ---
    // Extracted so we can call it for both the primary path and resume-fallback
    // without duplicating the for-await loop.
    let capturedSessionId: string | null = null;

    async function processStream(queryIterator: AsyncIterable<SDKMessage>) {
      let hasEmittedText = false;
      let lastEventWasToolUse = false;

      for await (const message of queryIterator) {
        // Capture session_id from the first message that carries one
        if (!capturedSessionId && message.session_id) {
          capturedSessionId = message.session_id;
        }

        if (message.type === 'stream_event') {
          const partial = message as SDKPartialAssistantMessage;
          const evt = partial.event as BetaRawContentBlockDeltaEvent;

          // Detect content block boundaries for turn separation
          const rawEvt = evt as { type: string; content_block?: { type: string } };
          if (rawEvt.type === 'content_block_start') {
            if (rawEvt.content_block?.type === 'tool_use') {
              lastEventWasToolUse = true;
            } else if (rawEvt.content_block?.type === 'text' && hasEmittedText && lastEventWasToolUse) {
              // New text block after a tool call — inject paragraph break
              sendSSE('text', { text: '\n\n' });
              pendingText += '\n\n';
            }
          }

          if (evt?.type === 'content_block_delta') {
            const delta = evt.delta as { type: string; text?: string };
            if (delta.type === 'text_delta' && delta.text) {
              sendSSE('text', { text: delta.text });
              pendingText += delta.text;
              hasEmittedText = true;
            }
          }
        }
      }
    }

    // --- Build SDK options ---
    const hasExistingSession = !!conversation.sdkSessionId;

    function buildQueryOptions(useResume: boolean) {
      const base = {
        mcpServers: { 'creative-director': mcpServer },
        allowedTools: TOOL_NAMES,
        includePartialMessages: true,
        permissionMode: 'bypassPermissions' as const,
        allowDangerouslySkipPermissions: true,
        model: config.anthropic.model,
        abortController,
        tools: [] as string[],
        maxTurns: 15,
        thinking: { type: 'adaptive' as const },
        persistSession: true,
        env: { ...process.env, CLAUDECODE: undefined },
        stderr: (data: string) => fastify.log.warn({ stderr: data }, 'SDK stderr'),
      };

      if (useResume && conversation.sdkSessionId) {
        // Resume: SDK replays full structured conversation history — no text blob needed
        return {
          ...base,
          systemPrompt: systemPrompt,
          resume: conversation.sdkSessionId,
        };
      }

      // First message or fallback: include conversation history as text
      return {
        ...base,
        systemPrompt: systemPrompt + conversationHistoryText,
      };
    }

    try {
      fastify.log.info({ projectId, hasExistingSession }, 'Starting SDK query...');

      if (hasExistingSession) {
        // Try to resume the existing session
        try {
          const iter = query({ prompt: userText, options: buildQueryOptions(true) });
          await processStream(iter);
        } catch (resumeErr) {
          // Resume failed (stale session, deleted file, etc.) — clear and retry without resume
          fastify.log.warn({ err: resumeErr, sessionId: conversation.sdkSessionId }, 'Session resume failed, falling back to text-based history');

          // Don't retry if client already disconnected
          if (abortController.signal.aborted) throw resumeErr;

          await updateConversationSessionId(conversation.id, null);
          capturedSessionId = null;

          // Tell frontend to clear any partial text from the failed attempt
          sendSSE('reset', {});

          // Reset content state for the retry
          contentBlocks.length = 0;
          pendingText = '';
          await updateMessageContent(assistantRow.id, []);

          const iter = query({ prompt: userText, options: buildQueryOptions(false) });
          await processStream(iter);
        }
      } else {
        // First message — no session to resume
        const iter = query({ prompt: userText, options: buildQueryOptions(false) });
        await processStream(iter);
      }

      // Save the captured session ID so future messages can resume
      if (capturedSessionId && capturedSessionId !== conversation.sdkSessionId) {
        await updateConversationSessionId(conversation.id, capturedSessionId);
      }

      // 8. Flush all pending content to DB before signalling completion
      flushText();
      try { await persistPromise; } catch { /* handled below */ }
      try {
        await updateMessageContent(assistantRow.id, contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: '' }]);
      } catch (saveErr) {
        fastify.log.error({ err: saveErr }, 'Failed to save assistant message before done');
      }

      // 9. Send done event — DB is now consistent, frontend can safely reload
      sendSSE('done', { conversationId: conversation.id });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      fastify.log.error({ err }, 'Agent chat error');

      // Provide user-friendly error messages for common SDK failures
      let errorMessage = rawMessage;
      if (rawMessage.includes('exited with code 1') || rawMessage.includes('process exited')) {
        errorMessage = 'AI assistant is temporarily unavailable. The server may need Claude credentials configured.';
      } else if (rawMessage.includes('authentication') || rawMessage.includes('unauthorized')) {
        errorMessage = 'AI assistant authentication failed. Please check server credentials.';
      }

      sendSSE('error', { message: errorMessage });
    } finally {
      clearInterval(heartbeat);
      clearInterval(persistInterval);

      // Decrement concurrent SSE counter
      const c = activeStreams.get(projectId) || 1;
      if (c <= 1) activeStreams.delete(projectId);
      else activeStreams.set(projectId, c - 1);

      // Clean up event buffer after 2 minutes (enough time for reconnection).
      // Only delete if it's still OUR buffer — a newer stream may have replaced it.
      setTimeout(() => {
        if (projectEventBuffers.get(projectId) === streamBufferObj) {
          projectEventBuffers.delete(projectId);
        }
      }, 2 * 60 * 1000);

      // Safety net: flush any remaining content on error paths
      // (happy path already persisted before 'done' event above)
      try {
        await persistPromise;
        flushText();
        await updateMessageContent(assistantRow.id, contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: '' }]);
      } catch { /* best-effort — primary save already happened on success path */ }

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
    if (project.userId && project.userId !== request.user?.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const data = await getConversationWithMessages(projectId);

    // Check for active jobs so frontend can restore progress bar after refresh.
    // Only return jobs updated in the last 5 minutes — older ones are likely stale
    // (e.g. worker crashed, server restarted). This prevents the "stuck in progress"
    // issue when reopening the editor.
    const STALE_JOB_MS = 5 * 60 * 1000;
    // Return any active job (including plan-visuals) so the frontend can restore
    // progress after refresh. The frontend uses the `jobType` field to decide
    // whether to subscribe to WebSocket (it skips plan-visuals to avoid false
    // "visuals ready" notifications).
    const activeJobRows = await db.select().from(jobs).where(
      and(
        eq(jobs.projectId, projectId),
        or(eq(jobs.status, 'pending'), eq(jobs.status, 'processing')),
      ),
    );
    const activeJobRow = activeJobRows[0];

    // Filter out stale/completed jobs — completed jobs or those older than threshold are ignored
    const activeJob = activeJobRow && isJobFresh(activeJobRow, STALE_JOB_MS) ? activeJobRow : null;

    const activeJobMeta = activeJob?.progressMeta as Record<string, unknown> | null;
    const jobPayload = activeJob
      ? {
          id: activeJob.id,
          type: activeJob.type,
          progress: activeJob.progress,
          message: normalizeProgressMessage(activeJob.type, activeJob.progress, activeJob.progressMessage || undefined),
          phase: activeJobMeta?.phase || derivePhase(activeJob.type, activeJob.progress),
          phaseName: activeJobMeta?.phaseName || undefined,
          jobType: activeJob.type,
          progressMeta: activeJobMeta || undefined,
        }
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
    if (project.userId && project.userId !== request.user?.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    await deleteConversation(projectId);

    return reply.send({ success: true });
  });

  // ─── POST /projects/:id/agent/cancel — cancel active agent job ──────────

  fastify.post<{ Params: { id: string } }>(
    '/projects/:id/agent/cancel',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const projectId = request.params.id;

      // Check project ownership
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      if (!project) return reply.code(404).send({ error: 'Project not found' });
      if (project.userId && project.userId !== request.user?.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // Find active job for this project
      const activeJob = await db.query.jobs.findFirst({
        where: and(
          eq(jobs.projectId, projectId),
          or(eq(jobs.status, 'pending'), eq(jobs.status, 'processing')),
        ),
      });

      if (activeJob) {
        // Publish cancel to Redis — worker picks this up via registerCancelHandler
        await redis.publish('job:cancel', JSON.stringify({ jobId: activeJob.id }));

        // Mark job as cancelled in DB
        await db.update(jobs)
          .set({ status: 'cancelled', error: 'Cancelled by user' })
          .where(eq(jobs.id, activeJob.id));

        // Notify WebSocket clients
        await publishJobError(activeJob.id, 'Cancelled by user');
      }

      reply.send({ ok: true, cancelledJobId: activeJob?.id ?? null });
    }
  );
}
