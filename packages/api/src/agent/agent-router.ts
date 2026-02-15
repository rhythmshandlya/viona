import { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db, projects, transcripts, visuals, jobs } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config.js';
import { buildSystemPrompt } from './agent-system-prompt.js';
import { toolDefinitions, executeTool } from './agent-tools.js';
import {
  getOrCreateConversation,
  getConversationMessages,
  addMessage,
  getConversationWithMessages,
  deleteConversation,
} from './conversation-store.js';

// SSE helper — writes a server-sent event to the raw response
function sendSSE(raw: NodeJS.WritableStream, event: string, data: unknown) {
  raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Convert stored conversation messages to Claude API format
function toClaudeMessages(
  storedMessages: Array<{ role: string; content: unknown }>,
): Anthropic.MessageParam[] {
  return storedMessages.map((m) => {
    const contentBlocks = m.content as Array<{ type: string; text?: string; [key: string]: unknown }>;

    // Filter to only text blocks for the Claude API
    const textBlocks = contentBlocks.filter(
      (b): b is { type: 'text'; text: string } => b.type === 'text' && typeof b.text === 'string',
    );

    return {
      role: m.role as 'user' | 'assistant',
      content: textBlocks.length > 0 ? textBlocks : [{ type: 'text' as const, text: '' }],
    };
  });
}

// Poll a job until it completes or fails, streaming progress events
async function pollJobProgress(
  jobId: string,
  raw: NodeJS.WritableStream,
): Promise<void> {
  const POLL_INTERVAL_MS = 2000;
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const startTime = Date.now();

  while (Date.now() - startTime < TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, jobId),
    });

    if (!job) break;

    sendSSE(raw, 'progress', {
      percent: job.progress,
      message: job.progressMessage || `Processing... (${job.progress}%)`,
    });

    if (job.status === 'completed') {
      sendSSE(raw, 'progress', { percent: 100, message: 'Done!' });
      break;
    }

    if (job.status === 'failed') {
      sendSSE(raw, 'progress', {
        percent: job.progress,
        message: `Failed: ${job.error || 'Unknown error'}`,
      });
      break;
    }
  }
}

export async function agentRoutes(fastify: FastifyInstance) {
  // ─── POST /projects/:id/agent/chat — SSE streaming chat ──────────────────

  fastify.post('/projects/:id/agent/chat', { preHandler: authMiddleware }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };

    const body = request.body as {
      message: string;
      context?: {
        selectedTimeRange?: { startMs: number; endMs: number };
        selectedSceneId?: number;
        selectedElement?: { name: string; sceneId: number };
      };
      widgetResponse?: { widgetId: string; value: unknown };
    };

    // 1. Load the project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
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
    let userText = body.message;

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

    // Save the user message
    await addMessage(conversation.id, 'user', [{ type: 'text', text: userText }]);

    // 6. Set up SSE response headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Build Claude messages array from history + new user message
    const claudeMessages: Anthropic.MessageParam[] = [
      ...toClaudeMessages(storedMessages),
      { role: 'user', content: [{ type: 'text', text: userText }] },
    ];

    // 7. Agentic loop
    const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
    let fullAssistantContent: Anthropic.ContentBlock[] = [];
    let currentMessages = claudeMessages;

    try {
      let continueLoop = true;

      while (continueLoop) {
        // Stream Claude's response
        const stream = anthropic.messages.stream({
          model: config.anthropic.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: currentMessages,
          tools: toolDefinitions,
        });

        // Stream text chunks to the client
        stream.on('text', (text) => {
          sendSSE(reply.raw, 'text', { content: text });
        });

        // Wait for the complete response
        const finalMessage = await stream.finalMessage();
        const contentBlocks = finalMessage.content;

        // Accumulate assistant content
        fullAssistantContent = [...fullAssistantContent, ...contentBlocks];

        // Check if there are tool calls
        const toolUseBlocks = contentBlocks.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
        );

        if (toolUseBlocks.length === 0 || finalMessage.stop_reason === 'end_turn') {
          continueLoop = false;
          break;
        }

        // Execute each tool call and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolBlock of toolUseBlocks) {
          const result = await executeTool(
            toolBlock.name,
            toolBlock.input as Record<string, unknown>,
            {
              projectId,
              sendSSE: (event: string, data: unknown) => sendSSE(reply.raw, event, data),
            },
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: result,
          });

          // For generation/edit tools, poll job progress
          if (toolBlock.name === 'generate_visuals' || toolBlock.name === 'edit_visuals') {
            try {
              const parsed = JSON.parse(result);
              if (parsed.jobId) {
                await pollJobProgress(parsed.jobId, reply.raw);
              }
            } catch {
              // Couldn't parse — skip polling
            }
          }
        }

        // Append assistant response + tool results for next iteration
        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: contentBlocks },
          { role: 'user' as const, content: toolResults },
        ];
      }

      // 8. Save the full assistant response
      // Convert ContentBlocks to a storable format (only text blocks for storage)
      const storableContent = fullAssistantContent
        .filter((b) => b.type === 'text')
        .map((b) => ({ type: 'text', text: (b as Anthropic.TextBlock).text }));

      if (storableContent.length > 0) {
        await addMessage(conversation.id, 'assistant', storableContent);
      }

      // 9. Send done event
      sendSSE(reply.raw, 'done', { conversationId: conversation.id });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      fastify.log.error({ err }, 'Agent chat error');
      sendSSE(reply.raw, 'error', { message: errorMessage });
    } finally {
      reply.raw.end();
    }
  });

  // ─── GET /projects/:id/agent/conversation — get conversation history ─────

  fastify.get('/projects/:id/agent/conversation', { preHandler: authMiddleware }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };

    const data = await getConversationWithMessages(projectId);

    if (!data) {
      return reply.send({ conversationId: null, messages: [] });
    }

    return reply.send(data);
  });

  // ─── DELETE /projects/:id/agent/conversation — clear conversation ────────

  fastify.delete('/projects/:id/agent/conversation', { preHandler: authMiddleware }, async (request, reply) => {
    const { id: projectId } = request.params as { id: string };

    await deleteConversation(projectId);

    return reply.send({ success: true });
  });
}
