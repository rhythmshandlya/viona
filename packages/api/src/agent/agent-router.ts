import { PassThrough } from 'stream';
import { FastifyInstance } from 'fastify';
import { eq, or, and } from 'drizzle-orm';
import { db, projects, transcripts, jobs, tracks, visuals, sandboxSessions } from '../db/index.js';
import { inArray, notInArray } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { redis, publishJobError } from '../services/redis.js';
import { releaseLock } from '../workspace/workspace-lock.js';
import { emitLockReleased } from '../workspace/workspace-ws.js';
import { proxyPromptWithIntercept, proxyCancelAgent } from '../sandbox/proxy.js';
import { sandboxManager } from '../sandbox/manager.js';
import { minioClient } from '../services/minio.js';
import { config } from '../config.js';
import {
  getOrCreateConversation,
  getConversationMessages,
  addMessage,
  updateMessageContent,
  getConversationWithMessages,
  deleteConversation,
  updateConversationSessionId,
} from './conversation-store.js';

// Per-project concurrent SSE stream counter
const activeStreams = new Map<string, number>();

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
    const session = await sandboxManager.getActiveSession(projectId);
    const agentUrl = session?.agentUrl as string | undefined;

    if (!session || !agentUrl) {
      // No sandbox available — send error via SSE so frontend handles it gracefully
      const errorStream = new PassThrough();
      reply
        .header('Content-Type', 'text/event-stream')
        .header('Cache-Control', 'no-cache')
        .header('Connection', 'keep-alive')
        .header('X-Accel-Buffering', 'no')
        .send(errorStream);

      errorStream.write(`event: error\ndata: ${JSON.stringify({ message: 'Sandbox not available. Please start the sandbox first.', recoverable: true })}\n\n`);
      errorStream.end();

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
    // If conversation has too many messages, start fresh to prevent context overflow
    const MAX_RESUME_MESSAGES = 40; // ~20 user + 20 assistant turns
    const shouldResume = conversation.sdkSessionId && storedMessages.length < MAX_RESUME_MESSAGES;

    if (conversation.sdkSessionId && !shouldResume) {
      fastify.log.info({ projectId, messageCount: storedMessages.length }, 'Skipping session resume — conversation too long');
    }

    const proxyBody = {
      prompt: userText,
      conversationHistory: storedMessages
        .slice(-20)  // Last 20 messages to prevent context overflow on non-resume
        .map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content :
            (m.content as Array<{ type: string; text?: string }>)
              .filter(b => b.type === 'text' && b.text)
              .map(b => b.text!)
              .join('\n'),
        })),
      projectContext,
      sessionId: shouldResume ? conversation.sdkSessionId : null,
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
            if (data.numTurns) {
              fastify.log.info({ projectId, numTurns: data.numTurns, cost: data.cost }, 'Agent turn completed');
            }
            // Final flush
            flushText();
            await updateMessageContent(assistantRow.id,
              contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: '' }]);
          },
          onWidget: (widget) => {
            flushText();
            contentBlocks.push({ type: 'widget', widget });
            // Persist immediately so widgets survive SSE disconnect + page refresh
            updateMessageContent(assistantRow.id, contentBlocks).catch(() => {});
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
            // Persist immediately so plan survives SSE disconnect
            updateMessageContent(assistantRow.id, contentBlocks).catch(() => {});
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

    // Read active task state from Redis (populated by sandbox HTTP callbacks)
    const [tasksRaw, busyRaw, planRaw] = await Promise.all([
      redis.get(`sandbox:tasks:${projectId}`).catch(() => null),
      redis.get(`sandbox:busy:${projectId}`).catch(() => null),
      redis.get(`sandbox:plan:${projectId}`).catch(() => null),
    ]);

    let activeTasks: unknown[] = [];
    let busy = false;
    if (tasksRaw) try { activeTasks = JSON.parse(tasksRaw); } catch { /* ignore */ }
    if (busyRaw) try { busy = JSON.parse(busyRaw).busy; } catch { /* ignore */ }

    let sandboxPlan: Record<string, unknown> | null = null;
    if (planRaw) try { sandboxPlan = JSON.parse(planRaw); } catch { /* ignore */ }

    // Backward compat: keep sandboxProgress/sandboxActivity as null
    const sandboxProgress = null;
    const sandboxActivity = null;

    if (!data) {
      return reply.send({
        conversationId: null,
        messages: [],
        activeJob: jobPayload,
        activeTasks,
        busy,
        sandboxPlan: sandboxPlan ?? undefined,
        sandboxProgress: sandboxProgress ?? undefined,
        sandboxActivity: sandboxActivity ?? undefined,
      });
    }

    return reply.send({
      ...data,
      activeJob: jobPayload,
      activeTasks,
      busy,
      sandboxPlan: sandboxPlan ?? undefined,
      sandboxProgress: sandboxProgress ?? undefined,
      sandboxActivity: sandboxActivity ?? undefined,
    });
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

  // ─── POST /projects/:id/agent/reset — full project reset ────────────────
  // Cancels agent, resets sandbox workspace, clears DB conversation + Redis state,
  // and returns the original creative brief so the frontend can re-send it.

  fastify.post<{ Params: { id: string } }>(
    '/projects/:id/agent/reset',
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

      // 1. Extract the creative brief (first non-hidden user message) before clearing
      let brief: string | null = null;
      const data = await getConversationWithMessages(projectId);
      if (data?.messages) {
        for (const msg of data.messages) {
          if (msg.role !== 'user') continue;
          const blocks = msg.content as Array<{ type: string; text?: string; hidden?: boolean }>;
          if (!Array.isArray(blocks)) continue;
          const textBlock = blocks.find(b => b.type === 'text' && b.text && !b.hidden);
          if (textBlock?.text) {
            brief = textBlock.text;
            break;
          }
        }
      }

      // 2. Cancel active BullMQ jobs
      const activeJobRows = await db.select().from(jobs).where(
        and(
          eq(jobs.projectId, projectId),
          or(eq(jobs.status, 'pending'), eq(jobs.status, 'processing')),
        ),
      );
      for (const job of activeJobRows) {
        await redis.publish('job:cancel', JSON.stringify({ jobId: job.id }));
        await db.update(jobs)
          .set({ status: 'cancelled', error: 'Reset by user' })
          .where(eq(jobs.id, job.id));
      }

      // 3. Destroy the sandbox entirely — container, volume, Redis keys
      // Next createSandbox() call will spin up a fresh container + re-init
      try {
        await sandboxManager.suspend(projectId, 'user');
      } catch (err) {
        fastify.log.warn({ err, projectId }, 'Sandbox suspend failed during reset');
      }

      // Clear backup + S3 checkpoint so the next acquire() does a fresh init
      // (not restore from dirty backup that suspend() just saved)
      await db.update(sandboxSessions)
        .set({ backupId: null })
        .where(eq(sandboxSessions.projectId, projectId))
        .catch(() => {});
      await minioClient.removeObject(
        config.storage.bucket,
        `checkpoints/${projectId}/manifest.json`,
      ).catch(() => {});

      // 4. Reset DB project state — remove agent-generated tracks/items/visuals
      // Keep only original tracks (video, audio, caption); cascade deletes their items
      const ORIGINAL_TRACK_TYPES = ['video', 'audio', 'caption'];
      await db.delete(tracks).where(
        and(
          eq(tracks.projectId, projectId),
          notInArray(tracks.type, ORIGINAL_TRACK_TYPES),
        ),
      );

      // Clear visuals table
      await db.delete(visuals).where(eq(visuals.projectId, projectId)).catch(() => {});

      // Reset project status back to ready
      await db.update(projects)
        .set({ status: 'ready' as any, outputKey: null })
        .where(eq(projects.id, projectId));

      // 5. Clear conversation in DB
      await deleteConversation(projectId);

      fastify.log.info({ projectId, hasBrief: !!brief }, 'Project reset complete');

      reply.send({ ok: true, brief });
    }
  );

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
      const session = await sandboxManager.getActiveSession(projectId);
      if (session) {
        const agentUrl = session.agentUrl as string | undefined;
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
