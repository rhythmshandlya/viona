import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.stubGlobal('fetch', spies.fetch);
vi.mock('../auth', () => ({ getSessionToken: () => 'tok-1' }));

import { CompositionApi } from './composition';

beforeEach(() => { vi.clearAllMocks(); });

describe('CompositionApi', () => {
  const api = new CompositionApi('http://api');

  it('GETs /api/projects/:id/composition-v2 with Bearer auth', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tracks: [], timelineItems: [], assets: {} }),
    });
    const result = await api.getComposition('p-1');
    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api/api/projects/p-1/composition-v2',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }) }),
    );
    expect(result.tracks).toEqual([]);
  });

  it('throws on non-2xx', async () => {
    spies.fetch.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'forbidden' });
    await expect(api.getComposition('p-1')).rejects.toThrow(/403/);
  });
});
