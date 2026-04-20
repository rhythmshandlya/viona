import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const spies = vi.hoisted(() => ({
  compute: vi.fn(),
  selectProjectOwner: vi.fn(),
  rateIncr: vi.fn(),
  rateExpire: vi.fn().mockResolvedValue(1),
}));

vi.mock('../services/arrangement-orchestrator.js', () => ({
  computeArrangement: spies.compute,
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (req: { user: { id: string } }) => {
    req.user = { id: 'u-1' } as unknown as never;
  },
}));
vi.mock('../services/redis.js', () => ({
  redis: {
    incr: spies.rateIncr,
    expire: spies.rateExpire,
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

beforeEach(() => {
  vi.clearAllMocks();
  // Default: rate limit allows the request (first call in window).
  spies.rateIncr.mockResolvedValue(1);
  spies.rateExpire.mockResolvedValue(1);
});

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

  it('returns 429 when user exceeds rate limit (arrangement compute)', async () => {
    seedProjectOwner('u-1');
    spies.rateIncr.mockResolvedValueOnce(3); // already over limit
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/projects/p-1/arrangement/compute' });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('rate_limited');
    expect(spies.compute).not.toHaveBeenCalled();
    // Ownership check must be skipped — fail-fast on rate limit saves a DB query.
    expect(spies.selectProjectOwner).not.toHaveBeenCalled();
  });

  it('allows first call and sets TTL', async () => {
    seedProjectOwner('u-1');
    spies.rateIncr.mockResolvedValueOnce(1);
    spies.compute.mockResolvedValueOnce({ timelineItems: [], summary: 'ok' });
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/projects/p-1/arrangement/compute' });
    expect(res.statusCode).toBe(200);
    expect(spies.rateIncr).toHaveBeenCalledWith('rate:arrangement:u-1');
    expect(spies.rateExpire).toHaveBeenCalledWith('rate:arrangement:u-1', 30);
  });

  it('does not set TTL on subsequent calls within the window', async () => {
    seedProjectOwner('u-1');
    spies.rateIncr.mockResolvedValueOnce(2); // second call within window
    spies.compute.mockResolvedValueOnce({ timelineItems: [], summary: 'ok' });
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/projects/p-1/arrangement/compute' });
    expect(res.statusCode).toBe(200);
    expect(spies.rateExpire).not.toHaveBeenCalled();
  });
});
