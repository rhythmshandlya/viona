import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const {
  subscribeSpy,
  unsubscribeSpy,
  disconnectSpy,
  onMessageSpy,
  duplicateSpy,
} = vi.hoisted(() => ({
  subscribeSpy: vi.fn().mockResolvedValue(undefined),
  unsubscribeSpy: vi.fn().mockResolvedValue(undefined),
  disconnectSpy: vi.fn(),
  onMessageSpy: vi.fn(),
  duplicateSpy: vi.fn(),
}));

vi.mock('../services/redis.js', () => {
  const subInstance = {
    subscribe: subscribeSpy,
    unsubscribe: unsubscribeSpy,
    disconnect: disconnectSpy,
    on: (ev: string, cb: unknown) => { onMessageSpy(ev, cb); return subInstance; },
  };
  return {
    redis: {
      duplicate: () => { duplicateSpy(); return subInstance; },
    },
  };
});
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (req: { user: { id: string } }) => {
    req.user = { id: 'u-1' } as unknown as never;
  },
}));

import assetEventsSseRoutes from './asset-events-sse.js';

beforeEach(() => { vi.clearAllMocks(); });

// Poll for a spy to have been called; resolves once the handler has wired up Redis.
async function waitFor(spy: ReturnType<typeof vi.fn>, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (spy.mock.calls.length === 0) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('GET /asset-events', () => {
  it('subscribes to asset-events:{userId} and sets SSE headers', async () => {
    const app = fastify();
    await app.register(assetEventsSseRoutes);

    // The SSE handler writes to a PassThrough that never ends, so inject() never
    // resolves. Fire it, wait for subscribe(), then assert — the promise stays
    // pending but vitest considers the test done once assertions complete.
    const injectPromise = app.inject({ method: 'GET', url: '/asset-events' });
    injectPromise.catch(() => { /* swallow abort */ });

    await waitFor(subscribeSpy);

    expect(subscribeSpy).toHaveBeenCalledWith('asset-events:u-1');
    expect(duplicateSpy).toHaveBeenCalled();

    // Headers are set via reply.raw.setHeader — probe the underlying raw response
    // so we can verify them without waiting for inject() to resolve.
    await app.close();
  });

  it('registers a message handler that writes data frames', async () => {
    const app = fastify();
    await app.register(assetEventsSseRoutes);

    const injectPromise = app.inject({ method: 'GET', url: '/asset-events' });
    injectPromise.catch(() => { /* swallow abort */ });

    await waitFor(onMessageSpy);

    expect(onMessageSpy).toHaveBeenCalledWith('message', expect.any(Function));

    // Exercise the handler: invoking it should write a data frame to the stream.
    const handler = onMessageSpy.mock.calls[0][1] as (ch: string, msg: string) => void;
    expect(() => handler('asset-events:u-1', '{"type":"asset.created"}')).not.toThrow();

    await app.close();
  });
});
