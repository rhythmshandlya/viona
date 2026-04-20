import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const spies = vi.hoisted(() => ({
  loadComposition: vi.fn(),
  selectProjectOwner: vi.fn(),
}));

vi.mock('../services/composition-loader.js', () => ({
  loadComposition: spies.loadComposition,
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
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (req: { user: { id: string } }) => {
    req.user = { id: 'u-1' } as unknown as never;
  },
}));

import compositionRoutes from './composition.js';

beforeEach(() => { vi.clearAllMocks(); });

async function build() {
  const app = fastify();
  await app.register(compositionRoutes);
  return app;
}

function seedOwner(userId: string | null) {
  spies.selectProjectOwner.mockImplementationOnce(() => userId === null ? [] : [{ userId }]);
}

describe('GET /projects/:id/composition-v2', () => {
  it('returns 403 when caller does not own project', async () => {
    seedOwner('other-user');
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-1/composition-v2' });
    expect(res.statusCode).toBe(403);
    expect(spies.loadComposition).not.toHaveBeenCalled();
  });

  it('returns 403 when project does not exist', async () => {
    seedOwner(null);
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-missing/composition-v2' });
    expect(res.statusCode).toBe(403);
  });

  it('returns composition when owned', async () => {
    seedOwner('u-1');
    spies.loadComposition.mockResolvedValueOnce({
      tracks: [{ id: 't-1', position: 0 }],
      timelineItems: [],
      assets: {},
    });
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-1/composition-v2' });
    expect(res.statusCode).toBe(200);
    expect(res.json().tracks).toHaveLength(1);
    expect(spies.loadComposition).toHaveBeenCalledWith({ projectId: 'p-1', userId: 'u-1' });
  });
});
