import { PassThrough } from 'stream';
import { FastifyInstance } from 'fastify';
import { eq, or, and } from 'drizzle-orm';
import { db, projects, transcripts, jobs } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { redis, publishJobError } from '../services/redis.js';
import { releaseLock } from '../workspace/workspace-lock.js';
import { emitLockReleased } from '../workspace/workspace-ws.js';
import { proxyPromptWithIntercept, proxyCancelAgent } from '../sandbox/proxy.js';
import { getActiveSession } from '../sandbox/routes.js';
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

    // 2. Gather project context for sandbox
    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.projectId, projectId),
    });

    const videoSettings = (project.videoSettings as Record<string, unknown>) || {};

    const projectContext = {
      canvasWidth: (videoSettings.canvasWidth as number) ?? 1080,
      canvasHeight: (videoSettings.canvasHeight as number) ?? 1920,
      fps: project.fps ?? 30,
      durationMs: project.durationMs,
      hasTranscript: !!transcript,
      theme: (videoSettings.theme as string) || 'studio-dark',
      projectType: project.projectType || 'video',
    };

    // 3. Get or create conversation
    const conversation = await getOrCreateConversation(projectId);

    // 4. Load previous messages (limit to last 50 for conversation context)
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

    // 6. Get sandbox connection for this project
    const session = await getActiveSession(projectId);
    const agentUrl = (session?.metadata as any)?.agentUrl as string | undefined;

    if (!session || !agentUrl) {
      // No sandbox available — send error via SSE so frontend handles it gracefully
      const sseStream = new PassThrough();
      reply
        .header('Content-Type', 'text/event-stream')
        .header('Cache-Control', 'no-cache')
        .header('Connection', 'keep-alive')
        .header('X-Accel-Buffering', 'no')
        .send(sseStream);

      const { sendSSE } = createSSEWriter(sseStream, projectId);
      sendSSE('error', { message: 'Sandbox not available. Please start the sandbox first.' });
      sseStream.end();

      // Decrement counter
      const c = activeStreams.get(projectId) || 1;
      if (c <= 1) activeStreams.delete(projectId);
      else activeStreams.set(projectId, c - 1);

      return;
    }

    // 7. Create assistant message row in DB immediately so it exists even if
    //    the user refreshes mid-stream. We'll update its content as we go.
    const assistantRow = await addMessage(conversation.id, 'assistant', []);

    // Track all content blocks (text + widgets) for persistence
    const contentBlocks: Array<{ type: string; [k: string]: unknown }> = [];
    let pendingText = '';

    // Flush accumulated text into a content block
    function flushText() {
      if (pendingText) {
        contentBlocks.push({ type: 'text', text: pendingText });
        pendingText = '';
      }
    }

    // Build the body to forward to sandbox
    const proxyBody = {
      prompt: userText,
      conversationHistory: storedMessages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content :
          (m.content as Array<{ type: string; text?: string }>)
            .filter(b => b.type === 'text' && b.text)
            .map(b => b.text!)
            .join('\n'),
      })),
      projectContext,
      sessionId: conversation.sdkSessionId,
      widgetResponse: body.widgetResponse,
      editingContext: body.context ? {
        type: body.context.selectedVisualItem ? 'visual' : 'general',
        sceneId: body.context.selectedSceneId,
      } : undefined,
    };

    // Note: proxyPromptWithIntercept sets up its own SSE headers and PassThrough,
    // so we don't set them here. But we need to handle the finally cleanup.

    try {
      fastify.log.info({ projectId }, 'Relaying prompt to sandbox agent...');

      await proxyPromptWithIntercept(
        agentUrl, session.sandboxSecret, proxyBody, reply,
        {
          onText: (text) => {
            pendingText += text;
          },
          onDone: async (data) => {
            if (data.sessionId) {
              await updateConversationSessionId(conversation.id, data.sessionId);
            }
            // Final flush
            flushText();
            await updateMessageContent(assistantRow.id,
              contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: '' }]);
          },
          onWidget: (widget) => {
            flushText();
            contentBlocks.push({ type: 'widget', widget });
          },
          onPlan: (plan) => {
            flushText();
            // Upsert: replace existing plan block or append new one
            const existingIdx = contentBlocks.findIndex((b: any) => b.type === 'plan');
            if (existingIdx >= 0) {
              contentBlocks[existingIdx] = { type: 'plan', plan };
            } else {
              contentBlocks.push({ type: 'plan', plan });
            }
          },
          onProgress: () => {
            // Progress is now handled via ProgressIndicator + Redis, not stored in message content
          },
          onError: (error) => {
            fastify.log.error({ error }, 'Sandbox orchestrator error');
          },
        },
        projectId,
      );
    } catch (err) {
      fastify.log.error({ err }, 'Agent chat relay error');
    } finally {
      // Decrement concurrent SSE counter
      const c = activeStreams.get(projectId) || 1;
      if (c <= 1) activeStreams.delete(projectId);
      else activeStreams.set(projectId, c - 1);

      // Release workspace lock if AI acquired it during this turn
      try {
        const released = await releaseLock(projectId, 'ai');
        if (released) {
          await emitLockReleased(projectId, { holder: 'ai' });
        }
      } catch (lockErr) {
        fastify.log.warn({ err: lockErr, projectId }, 'Failed to release AI lock after turn');
      }

      // Safety net: flush any remaining content on error paths
      try {
        flushText();
        await updateMessageContent(assistantRow.id,
          contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: '' }]);
      } catch { /* best-effort — primary save already happened in onDone */ }
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
    const STALE_JOB_MS = 5 * 60 * 1000;
    const activeJobRows = await db.select().from(jobs).where(
      and(
        eq(jobs.projectId, projectId),
        or(eq(jobs.status, 'pending'), eq(jobs.status, 'processing')),
      ),
    );
    const activeJobRow = activeJobRows[0];

    const activeJob = activeJobRow && isJobFresh(activeJobRow, STALE_JOB_MS) ? activeJobRow : null;

    const activeJobMeta = activeJob?.progressMeta as Record<string, unknown> | null;
    const jobPayload = activeJob
      ? {
          id: activeJob.id,
          type: activeJob.type,
          progress: activeJob.progress,
          message: activeJob.progressMessage || undefined,
          phase: activeJobMeta?.phase || undefined,
          phaseName: activeJobMeta?.phaseName || undefined,
          jobType: activeJob.type,
          progressMeta: activeJobMeta || undefined,
        }
      : null;

    // Fallback: check Redis for sandbox pipeline progress (not BullMQ job-based)
    let sandboxProgress: Record<string, unknown> | null = null;
    if (!activeJob) {
      try {
        const cached = await redis.get(`sandbox:progress:${projectId}`);
        if (cached) {
          sandboxProgress = JSON.parse(cached);
        }
      } catch { /* ignore */ }
    }

    let sandboxActivity: Record<string, unknown> | null = null;
    if (!activeJob) {
      try {
        const cachedActivity = await redis.get(`sandbox:activity:${projectId}`);
        if (cachedActivity) sandboxActivity = JSON.parse(cachedActivity);
      } catch { /* ignore */ }
    }

    let sandboxPlan: Record<string, unknown> | null = null;
    if (!activeJob) {
      try {
        const cachedPlan = await redis.get(`sandbox:plan:${projectId}`);
        if (cachedPlan) sandboxPlan = JSON.parse(cachedPlan);
      } catch { /* ignore */ }
    }

    if (!data) {
      return reply.send({ conversationId: null, messages: [], activeJob: jobPayload, sandboxProgress: sandboxProgress ?? undefined, sandboxActivity: sandboxActivity ?? undefined, sandboxPlan: sandboxPlan ?? undefined });
    }

    return reply.send({ ...data, activeJob: jobPayload, sandboxProgress: sandboxProgress ?? undefined, sandboxActivity: sandboxActivity ?? undefined, sandboxPlan: sandboxPlan ?? undefined });
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

  // ─── POST /projects/:id/agent/cancel — cancel active agent ──────────────

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

      // Forward cancel to sandbox
      const session = await getActiveSession(projectId);
      if (session) {
        const agentUrl = (session.metadata as any)?.agentUrl as string | undefined;
        if (agentUrl) {
          try {
            await proxyCancelAgent(agentUrl, session.sandboxSecret);
          } catch (err) {
            fastify.log.warn({ err, projectId }, 'Failed to forward cancel to sandbox');
          }
        }
      }

      // Also cancel any active BullMQ jobs (visual generation etc.)
      const activeJob = await db.query.jobs.findFirst({
        where: and(
          eq(jobs.projectId, projectId),
          or(eq(jobs.status, 'pending'), eq(jobs.status, 'processing')),
        ),
      });

      if (activeJob) {
        await redis.publish('job:cancel', JSON.stringify({ jobId: activeJob.id }));
        await db.update(jobs)
          .set({ status: 'cancelled', error: 'Cancelled by user' })
          .where(eq(jobs.id, activeJob.id));
        await publishJobError(activeJob.id, 'Cancelled by user');
      }

      reply.send({ ok: true, cancelledJobId: activeJob?.id ?? null });
    }
  );
}

// Check if a job is fresh enough to show progress for.
function isJobFresh(job: { status: string; createdAt: Date; completedAt: Date | null }, thresholdMs: number): boolean {
  if (job.completedAt) return false;
  const age = Date.now() - new Date(job.createdAt).getTime();
  if (job.status === 'pending') return age < Math.min(thresholdMs, 3 * 60 * 1000);
  return age < 15 * 60 * 1000;
}
