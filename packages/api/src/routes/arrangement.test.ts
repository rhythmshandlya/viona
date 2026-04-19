import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const spies = vi.hoisted(() => ({
  compute: vi.fn(),
}));

vi.mock('../services/arrangement-orchestrator.js', () => ({
  computeArrangement: spies.compute,
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (req: { user: { id: string } }) => {
    req.user = { id: 'u-1' } as unknown as never;
  },
}));

import arrangementRoutes from './arrangement.js';

async function build() {
  const app = fastify();
  await app.register(arrangementRoutes);
  return app;
}

beforeEach(() => { vi.clearAllMocks(); });

describe('POST /projects/:id/arrangement/compute', () => {
  it('returns 200 with ArrangementOutput on success', async () => {
    spies.compute.mockResolvedValueOnce({
      timelineItems: [{ assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: 3000 }],
      summary: 'ok',
    });
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/projects/p-1/arrangement/compute' });
    expect(res.statusCode).toBe(200);
    expect(res.json().summary).toBe('ok');
    expect(res.json().timelineItems).toHaveLength(1);
    expect(spies.compute).toHaveBeenCalledWith('p-1');
  });

  it('returns 500 when orchestrator throws', async () => {
    spies.compute.mockRejectedValueOnce(new Error('boom'));
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/projects/p-1/arrangement/compute' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe('arrangement_failed');
    expect(res.json().message).toBe('boom');
  });
});
