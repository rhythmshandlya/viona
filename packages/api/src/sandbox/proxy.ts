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
    reply.header('Cache-Control', 'no-cache');
    reply.header('Accept-Ranges', 'bytes');

    const contentRange = res.headers.get('content-range');
    if (contentRange) reply.header('Content-Range', contentRange);

    const contentLength = res.headers.get('content-length');
    if (contentLength) reply.header('Content-Length', contentLength);

    // Stream response body via PassThrough
    if (res.body) {
      const passthrough = new PassThrough();
      reply.status(res.status).send(passthrough);

      const reader = (res.body as ReadableStream).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          passthrough.write(value);
        }
      } finally {
        passthrough.end();
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

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      reply.status(res.status).send({ error: `Agent returned ${res.status}` });
      return;
    }

    // Use PassThrough stream to forward SSE while preserving CORS headers
    const passthrough = new PassThrough();

    reply
      .header('Content-Type', 'text/event-stream')
      .header('Cache-Control', 'no-cache')
      .header('Connection', 'keep-alive')
      .send(passthrough);

    if (res.body) {
      const reader = (res.body as ReadableStream).getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          passthrough.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        passthrough.end();
      }
    } else {
      passthrough.end();
    }
  } catch (err: any) {
    logger.error({ err, url }, 'Prompt proxy failed');
    if (!reply.sent) {
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
  onDone?: (data: { sessionId?: string; cost?: number }) => Promise<void>;
  onWidget?: (widget: Record<string, unknown>) => void;
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
): Promise<void> {
  const url = `${agentUrl}/prompt`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      reply.status(res.status).send({ error: `Agent returned ${res.status}` });
      return;
    }

    const passthrough = new PassThrough();

    reply
      .header('Content-Type', 'text/event-stream')
      .header('Cache-Control', 'no-cache')
      .header('Connection', 'keep-alive')
      .send(passthrough);

    if (res.body) {
      const reader = (res.body as ReadableStream).getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Write raw chunk to browser immediately
          passthrough.write(chunk);

          // Buffer and parse SSE events for interception
          buffer += chunk;
          const events = buffer.split('\n\n');
          // Last element is incomplete — keep it in the buffer
          buffer = events.pop() || '';

          for (const raw of events) {
            if (!raw.trim()) continue;
            try {
              let eventType = 'message';
              let dataStr = '';

              for (const line of raw.split('\n')) {
                if (line.startsWith('event:')) {
                  eventType = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                  dataStr += line.slice(5).trim();
                }
              }

              if (!dataStr) continue;
              const data = JSON.parse(dataStr);

              switch (eventType) {
                case 'text':
                  callbacks.onText?.(data.text ?? data);
                  break;
                case 'done':
                  // onDone is async (DB write) — fire and forget so we don't block the stream
                  callbacks.onDone?.(data).catch((err) =>
                    logger.error({ err }, 'InterceptCallbacks.onDone failed'),
                  );
                  break;
                case 'widget':
                  callbacks.onWidget?.(data);
                  break;
                case 'error':
                  callbacks.onError?.(data.message ?? data.error ?? String(data));
                  break;
              }
            } catch {
              // Non-JSON or malformed event — ignore, data still flows to browser
            }
          }
        }
      } finally {
        passthrough.end();
      }
    } else {
      passthrough.end();
    }
  } catch (err: any) {
    logger.error({ err, url }, 'Prompt proxy (intercept) failed');
    if (!reply.sent) {
      reply.status(502).send({ error: 'Sandbox agent unavailable' });
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
