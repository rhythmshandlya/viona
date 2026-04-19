import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const linkSpy = vi.fn();
const unlinkSpy = vi.fn();
const listSpy = vi.fn();
const getAssetSpy = vi.fn();

vi.mock('../services/asset-link-service.js', () => ({
  linkAssetToProject: (...a: unknown[]) => linkSpy(...a),
  unlinkAssetFromProject: (...a: unknown[]) => unlinkSpy(...a),
  listProjectAssets: (...a: unknown[]) => listSpy(...a),
}));
vi.mock('../services/asset-service.js', () => ({
  getAssetById: (...a: unknown[]) => getAssetSpy(...a),
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (req: { user: { id: string } }) => {
    req.user = { id: 'u-1' } as unknown as never;
  },
}));

import projectAssetRoutes from './project-assets.js';

async function build() {
  const app = fastify();
  await app.register(projectAssetRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /projects/:id/assets/link', () => {
  it('rejects linking an asset not owned by the user with 403', async () => {
    getAssetSpy.mockResolvedValueOnce(null);
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/projects/p-1/assets/link',
      payload: { assetId: 'a-1', addedVia: 'library' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
    expect(linkSpy).not.toHaveBeenCalled();
  });

  it('links an owned asset and returns 200 with link row', async () => {
    getAssetSpy.mockResolvedValueOnce({ id: 'a-1', userId: 'u-1' });
    linkSpy.mockResolvedValueOnce({
      id: 'l-1',
      assetId: 'a-1',
      projectId: 'p-1',
      addedVia: 'library',
    });
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/projects/p-1/assets/link',
      payload: { assetId: 'a-1', addedVia: 'library' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().link.id).toBe('l-1');
    expect(linkSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'a-1',
        projectId: 'p-1',
        userId: 'u-1',
        addedVia: 'library',
      }),
    );
  });
});

describe('DELETE /projects/:id/assets/:assetId', () => {
  it('rejects with 403 when asset not owned', async () => {
    getAssetSpy.mockResolvedValueOnce(null);
    const app = await build();
    const res = await app.inject({
      method: 'DELETE',
      url: '/projects/p-1/assets/a-1',
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
    expect(unlinkSpy).not.toHaveBeenCalled();
  });

  it('unlinks and returns ok:true when service returns true', async () => {
    getAssetSpy.mockResolvedValueOnce({ id: 'a-1', userId: 'u-1' });
    unlinkSpy.mockResolvedValueOnce(true);
    const app = await build();
    const res = await app.inject({
      method: 'DELETE',
      url: '/projects/p-1/assets/a-1',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(unlinkSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'a-1',
        projectId: 'p-1',
        userId: 'u-1',
      }),
    );
  });

  it('returns ok:false when the link did not exist', async () => {
    getAssetSpy.mockResolvedValueOnce({ id: 'a-1', userId: 'u-1' });
    unlinkSpy.mockResolvedValueOnce(false);
    const app = await build();
    const res = await app.inject({
      method: 'DELETE',
      url: '/projects/p-1/assets/a-1',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(false);
  });
});

describe('GET /projects/:id/assets', () => {
  it('returns all assets linked to the project', async () => {
    listSpy.mockResolvedValueOnce([{ id: 'a-1' }, { id: 'a-2' }]);
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-1/assets' });
    expect(res.statusCode).toBe(200);
    expect(res.json().assets).toHaveLength(2);
    expect(listSpy).toHaveBeenCalledWith('p-1');
  });
});
