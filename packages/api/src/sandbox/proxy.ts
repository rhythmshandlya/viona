import type { FastifyRequest, FastifyReply } from 'fastify';
import { PassThrough, Readable } from 'stream';
import { logger } from '../logger.js';

/**
 * Proxy a GET request to the sandbox file server.
 * Streams response and forwards Range headers for video seeking.
 */
export async function proxyFileRequest(
  sandboxUrl: string,
  secret: string,
  path: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const url = `${sandboxUrl}${path}`;

  try {
    // Forward Range header for video seeking
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${secret}`,
    };
    const rangeHeader = request.headers.range;
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const res = await fetch(url, { headers });

    if (!res.ok && res.status !== 206) {
      reply.status(res.status).send({ error: `Sandbox returned ${res.status}` });
      return;
    }

    // Forward response headers
    const contentType = res.headers.get('content-type');
    if (contentType) reply.header('Content-Type', contentType);

    // Cache media files (video/audio/image) for the session to avoid re-fetching;
    // other files (JS bundles etc.) stay uncached so hot-reload works.
    const isMedia = contentType && /^(video|audio|image)\//.test(contentType);
    reply.header('Cache-Control', isMedia ? 'private, max-age=3600, immutable' : 'no-cache');
    reply.header('Accept-Ranges', 'bytes');

    const contentRange = res.headers.get('content-range');
    if (contentRange) reply.header('Content-Range', contentRange);

    const contentLength = res.headers.get('content-length');
    if (contentLength) reply.header('Content-Length', contentLength);

    // Stream response body via PassThrough
    if (res.body) {
      const passthrough = new PassThrough();
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      // Stop reading from sandbox if client disconnects
      passthrough.on('close', () => {
        if (reader) { reader.cancel().catch(() => {}); reader = null; }
      });
      passthrough.on('error', () => {
        if (reader) { reader.cancel().catch(() => {}); reader = null; }
      });

      reply.status(res.status).send(passthrough);

      reader = (res.body as ReadableStream).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (passthrough.destroyed) break;
          passthrough.write(value);
        }
      } finally {
        if (reader) { reader.cancel().catch(() => {}); }
        if (!passthrough.destroyed) { try { passthrough.end(); } catch { /* already ended */ } }
      }
    } else {
      reply.status(res.status).send('');
    }
  } catch (err: any) {
    logger.error({ err, url }, 'Proxy request failed');
    reply.status(502).send({ error: 'Sandbox unavailable' });
  }
}

/**
 * Forward a prompt to the sandbox agent server and stream SSE response back.
 * Uses PassThrough stream with reply.send() to preserve @fastify/cors headers.
 * (Do NOT use reply.raw.writeHead — it bypasses CORS middleware.)
 */
export async function proxyPrompt(
  agentUrl: string,
  secret: string,
  body: { prompt: string; conversationId?: string },
  reply: FastifyReply,
): Promise<void> {
  const url = `${agentUrl}/prompt`;
  const abortController = new AbortController();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
      signal: abortController.signal,
    });

    if (!res.ok) {
      reply.status(res.status).send({ error: `Agent returned ${res.status}` });
      return;
    }

    // Use PassThrough stream to forward SSE while preserving CORS headers
    const passthrough = new PassThrough();
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    // Cancel reader before aborting to prevent unhandled AbortError rejections
    const safeAbort = () => {
      if (reader) { reader.cancel().catch(() => {}); reader = null; }
      try { abortController.abort(); } catch { /* expected */ }
    };
    passthrough.on('close', safeAbort);
    passthrough.on('error', safeAbort);

    reply
      .header('Content-Type', 'text/event-stream')
      .header('Cache-Control', 'no-cache')
      .header('Connection', 'keep-alive')
      .header('X-Accel-Buffering', 'no')
      .send(passthrough);

    if (res.body) {
      reader = (res.body as ReadableStream).getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          let readResult: { done: boolean; value?: Uint8Array };
          try {
            readResult = await reader.read();
          } catch (readErr: any) {
            if (readErr.name === 'AbortError') break;
            throw readErr;
          }
          const { done, value } = readResult;
          if (done) break;
          if (!passthrough.destroyed) {
            passthrough.write(decoder.decode(value, { stream: true }));
          }
        }
      } finally {
        if (reader) { reader.cancel().catch(() => {}); }
        if (!passthrough.destroyed) { try { passthrough.end(); } catch { /* already ended */ } }
      }
    } else {
      passthrough.end();
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return; // client disconnect — expected
    logger.error({ err, url }, 'Prompt proxy failed');
    if (!reply.sent && !reply.raw.headersSent) {
      reply.status(502).send({ error: 'Sandbox agent unavailable' });
    }
  }
}

/**
 * Callbacks for intercepting SSE events as they flow through to the browser.
 * Used by the agent router to persist conversation messages in the DB.
 */
export interface InterceptCallbacks {
  onText?: (text: string) => void;
  onDone?: (data: { sessionId?: string; cost?: number; numTurns?: number }) => Promise<void>;
  onWidget?: (widget: Record<string, unknown>) => void;
  onProgress?: (progress: { phase: string; percent?: number; message: string; agentName?: string; trackName?: string; estimatedTimeRemaining?: number }) => void;
  onActivity?: (activity: { agent: string | null; action: string | null; phase?: string; startedAt?: number }) => void;
  onPlan?: (plan: { title: string; tasks: Array<{ id: string; title: string; status: string; agent?: string; subtasks?: Array<{ id: string; title: string; status: string; tools?: string[] }> }> }) => void;
  onError?: (error: string) => void;
}

/**
 * Forward a prompt to the sandbox agent server with SSE event interception.
 * Same streaming pattern as proxyPrompt, but also parses SSE events and
 * calls the appropriate callback for DB persistence. The raw SSE data
 * flows to the browser unchanged.
 */
export async function proxyPromptWithIntercept(
  agentUrl: string,
  secret: string,
  body: {
    prompt: string;
    conversationHistory: Array<{ role: string; content: string }>;
    projectContext: Record<string, unknown>;
    sessionId?: string | null;
    widgetResponse?: { widgetId: string; value: unknown };
    editingContext?: { type: string; itemId?: string; sceneId?: number };
  },
  reply: FastifyReply,
  callbacks: InterceptCallbacks,
  projectId?: string,
): Promise<void> {
  const url = `${agentUrl}/prompt`;
  const logCtx = { projectId, url };

  // AbortController to cancel the sandbox fetch when the frontend disconnects
  const abortController = new AbortController();

  try {
    logger.info(logCtx, 'Proxy: connecting to sandbox');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
      signal: abortController.signal,
    });

    if (!res.ok) {
      logger.warn({ ...logCtx, status: res.status }, 'Proxy: sandbox returned non-OK');

      if (res.status === 409) {
        // Agent busy — send as SSE error so frontend can show a friendly message
        const errorStream = new PassThrough();
        reply
          .header('Content-Type', 'text/event-stream')
          .header('Cache-Control', 'no-cache')
          .send(errorStream);
        errorStream.write(`event: error\ndata: ${JSON.stringify({ message: 'Agent is busy processing another request. Please wait.', busy: true, recoverable: true })}\n\n`);
        errorStream.end();
        return;
      }

      reply.status(res.status).send({ error: `Agent returned ${res.status}` });
      return;
    }

    const passthrough = new PassThrough();
    let clientAlive = true;
    let receivedDone = false;
    let eventCount = 0;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    // Track client disconnect to stop reading from sandbox.
    // Cancel the reader first so its pending read() resolves {done:true}
    // instead of rejecting with AbortError (which escapes as unhandled rejection).
    const safeAbort = () => {
      if (reader) {
        reader.cancel().catch(() => {});
        reader = null;
      }
      try { abortController.abort(); } catch { /* expected */ }
    };
    passthrough.on('close', () => {
      if (!clientAlive) return;
      clientAlive = false;
      logger.info(logCtx, 'Proxy: client disconnected (passthrough closed)');
      safeAbort();
    });
    passthrough.on('error', (err) => {
      clientAlive = false;
      logger.warn({ ...logCtx, err: err.message }, 'Proxy: passthrough error');
      safeAbort();
    });

    reply
      .header('Content-Type', 'text/event-stream')
      .header('Cache-Control', 'no-cache')
      .header('Connection', 'keep-alive')
      .header('X-Accel-Buffering', 'no')
      .send(passthrough);

    const writeSSE = (eventType: string, data: unknown, id?: string) => {
      if (!clientAlive || passthrough.destroyed) return;
      try {
        let sse = '';
        if (id) sse += `id: ${id}\n`;
        sse += `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        passthrough.write(sse);
      } catch {
        clientAlive = false;
        safeAbort();
      }
    };

    if (res.body) {
      reader = (res.body as ReadableStream).getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // --- Text dedup + monologue suppression ---
      let textBuffer = '';
      let lastToolEventTime = 0;
      let toolsUsedInTurn = false;
      let lastTextContent = '';
      let lastTextTime = 0;
      const MONOLOGUE_WINDOW_MS = 5000;
      const MONOLOGUE_CHAR_LIMIT = 500;

      const flushTextBuffer = () => {
        if (textBuffer) {
          writeSSE('text', { text: textBuffer });
          callbacks.onText?.(textBuffer);
          textBuffer = '';
        }
      };

      try {
        while (true) {
          let readResult: { done: boolean; value?: Uint8Array };
          try {
            readResult = await reader.read();
          } catch (readErr: any) {
            // reader.cancel() from safeAbort resolves with {done:true},
            // but abort() can still race and reject — treat as stream end.
            if (readErr.name === 'AbortError') break;
            throw readErr;
          }
          const { done, value } = readResult;
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          // Buffer and parse SSE events for interception + filtered forwarding
          buffer += chunk;
          const events = buffer.split('\n\n');
          // Last element is incomplete — keep it in the buffer
          buffer = events.pop() || '';

          for (const raw of events) {
            if (!raw.trim()) continue;
            try {
              let eventType = 'message';
              let dataStr = '';
              let eventId = '';

              for (const line of raw.split('\n')) {
                if (line.startsWith('event:')) {
                  eventType = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                  // Use newline separator for multi-line data (SSE spec)
                  dataStr += (dataStr ? '\n' : '') + line.slice(5).trim();
                } else if (line.startsWith('id:')) {
                  eventId = line.slice(3).trim();
                }
              }

              if (!dataStr) continue;
              const data = JSON.parse(dataStr);
              eventCount++;

              switch (eventType) {
                case 'text': {
                  const text = data.text ?? data;
                  if (typeof text !== 'string') break;

                  // Dedup: skip identical consecutive text chunks within 100ms.
                  // Catches transport-level duplication (SDK, proxy, network).
                  const now = Date.now();
                  if (text.length > 0 && text === lastTextContent && now - lastTextTime < 100) {
                    break;
                  }
                  lastTextContent = text;
                  lastTextTime = now;

                  // Monologue suppression: buffer text that arrives shortly after
                  // tool events (model reasoning between tool calls).
                  const timeSinceTool = now - lastToolEventTime;
                  if (toolsUsedInTurn && timeSinceTool < MONOLOGUE_WINDOW_MS && text.length < MONOLOGUE_CHAR_LIMIT) {
                    textBuffer += text;
                  } else {
                    if (textBuffer) {
                      writeSSE('text', { text: textBuffer + text }, eventId);
                      callbacks.onText?.(textBuffer + text);
                      textBuffer = '';
                    } else {
                      writeSSE('text', data, eventId);
                      callbacks.onText?.(text);
                    }
                  }
                  break;
                }
                case 'done': {
                  receivedDone = true;
                  flushTextBuffer();
                  // Reset monologue suppression so it doesn't carry over
                  toolsUsedInTurn = false;
                  lastToolEventTime = 0;
                  writeSSE('done', data, eventId);
                  try {
                    await callbacks.onDone?.(data);
                  } catch (err) {
                    logger.error({ err }, 'InterceptCallbacks.onDone failed');
                  }
                  break;
                }
                case 'widget':
                  writeSSE('widget', data, eventId);
                  callbacks.onWidget?.(data);
                  break;
                case 'progress': {
                  writeSSE('progress', data, eventId);
                  callbacks.onProgress?.(data);
                  break;
                }
                case 'activity': {
                  writeSSE('activity', data, eventId);
                  callbacks.onActivity?.(data);
                  break;
                }
                case 'tool_use':
                case 'tool_result':
                  lastToolEventTime = Date.now();
                  toolsUsedInTurn = true;
                  writeSSE(eventType, data, eventId);
                  callbacks.onActivity?.(data);
                  break;
                case 'error':
                  writeSSE('error', data, eventId);
                  callbacks.onError?.(data.message ?? data.error ?? String(data));
                  break;
                case 'agent_plan': {
                  writeSSE('agent_plan', data, eventId);
                  callbacks.onPlan?.(data);
                  break;
                }
                case 'task_started':
                case 'task_updated':
                case 'task_completed':
                  writeSSE(eventType, data, eventId);
                  break;
                default:
                  writeSSE(eventType, data, eventId);
                  break;
              }
            } catch {
              // Non-JSON or malformed event — forward raw to browser
              if (clientAlive && !passthrough.destroyed) {
                try { passthrough.write(raw + '\n\n'); } catch { clientAlive = false; }
              }
            }
          }
        }
      } finally {
        // Cancel sandbox reader if still open (e.g. client disconnected mid-stream)
        if (reader) {
          try { reader.cancel().catch(() => {}); } catch { /* already closed */ }
        }

        flushTextBuffer();

        // If sandbox stream ended without a done event, inject a synthetic error
        // so the frontend knows the connection was lost (not a clean finish)
        if (!receivedDone && clientAlive) {
          logger.warn({ ...logCtx, eventCount }, 'Proxy: sandbox stream ended without done event');
          writeSSE('error', { message: 'Connection to sandbox was interrupted. Your work may still be in progress.', recoverable: true });
        }

        logger.info({ ...logCtx, eventCount, receivedDone, clientAlive }, 'Proxy: stream ended');

        if (!passthrough.destroyed) {
          try { passthrough.end(); } catch { /* already ended */ }
        }
      }
    } else {
      logger.warn(logCtx, 'Proxy: sandbox returned empty response body');
      passthrough.end();
    }
  } catch (err: any) {
    // Don't log abort errors from client disconnect — that's expected
    if (err.name !== 'AbortError') {
      logger.error({ err, ...logCtx }, 'Proxy: relay failed');
    }
    // Guard against double-send: reply.sent covers normal sends,
    // reply.raw.headersSent covers streaming (where headers went out via passthrough)
    if (!reply.sent && !reply.raw.headersSent) {
      // Send as SSE recoverable error so frontend can retry via polling
      const errorStream = new PassThrough();
      reply
        .header('Content-Type', 'text/event-stream')
        .header('Cache-Control', 'no-cache')
        .header('Connection', 'keep-alive')
        .send(errorStream);
      try {
        errorStream.write(`event: error\ndata: ${JSON.stringify({ message: 'Connection to sandbox lost', recoverable: true })}\n\n`);
      } finally {
        errorStream.end();
      }
    }
  }
}

/**
 * Send a cancel request to the sandbox agent.
 */
export async function proxyCancelAgent(
  agentUrl: string,
  secret: string,
): Promise<void> {
  await fetch(`${agentUrl}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Forward a manifest operation to the sandbox.
 */
export async function proxyManifestOp(
  agentUrl: string,
  secret: string,
  method: 'GET' | 'PATCH',
  body?: object,
): Promise<{ status: number; data: any }> {
  const url = `${agentUrl}/manifest`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return { status: res.status, data: await res.json() };
}

/**
 * Send a reset request to the sandbox agent (clears workspace back to post-init state).
 */
export async function proxyResetSandbox(
  agentUrl: string,
  secret: string,
): Promise<void> {
  const res = await fetch(`${agentUrl}/reset`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Reset failed' }));
    throw new Error(body.error || `Sandbox reset returned ${res.status}`);
  }
}

/**
 * Forward a granular manifest operation to the sandbox.
 */
export async function proxyOps(
  agentUrl: string,
  secret: string,
  body: { tool: string; input: object },
): Promise<{ status: number; data: any }> {
  const url = `${agentUrl}/ops`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  return { status: res.status, data: await res.json() };
}
