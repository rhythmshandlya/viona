import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const spies = vi.hoisted(() => ({
  compute: vi.fn(),
  selectProjectOwner: vi.fn(),
}));

vi.mock('../services/arrangement-orchestrator.js', () => ({
  computeArrangement: spies.compute,
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (req: { user: { id: string } }) => {
    req.user = { id: 'u-1' } as unknown as never;
  },
}));
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...a: unknown[]) => {
          spies.selectProjectOwner(...a);
          return Promise.resolve(spies.selectProjectOwner.mock.results.at(-1)?.value ?? []);
        },
      })),
    })),
  },
  projects: { id: 'projects.id', userId: 'projects.userId' },
}));

import arrangementRoutes from './arrangement.js';

async function build() {
  const app = fastify();
  await app.register(arrangementRoutes);
  return app;
}

function seedProjectOwner(userId: string | null) {
  if (userId === null) {
    spies.selectProjectOwner.mockReturnValueOnce([]);
  } else {
    spies.selectProjectOwner.mockReturnValueOnce([{ userId }]);
  }
}

beforeEach(() => { vi.clearAllMocks(); });

describe('POST /projects/:id/arrangement/compute', () => {
  it('returns 200 with ArrangementOutput on success', async () => {
    seedProjectOwner('u-1');
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
    seedProjectOwner('u-1');
    spies.compute.mockRejectedValueOnce(new Error('boom'));
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/projects/p-1/arrangement/compute' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe('arrangement_failed');
    expect(res.json().message).toBe('boom');
  });

  it('returns 403 when caller does not own the project', async () => {
    seedProjectOwner('other-user');
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/projects/p-1/arrangement/compute' });
    expect(res.statusCode).toBe(403);
    expect(spies.compute).not.toHaveBeenCalled();
  });

  it('returns 403 when project does not exist', async () => {
    seedProjectOwner(null);
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/projects/p-missing/arrangement/compute' });
    expect(res.statusCode).toBe(403);
  });
});
