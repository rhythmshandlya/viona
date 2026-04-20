import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const linkSpy = vi.fn();
const unlinkSpy = vi.fn();
const listSpy = vi.fn();
const getAssetSpy = vi.fn();
const presignDownloadSpy = vi.fn();
const selectProjectOwnerSpy = vi.fn();

vi.mock('../services/asset-link-service.js', () => ({
  linkAssetToProject: (...a: unknown[]) => linkSpy(...a),
  unlinkAssetFromProject: (...a: unknown[]) => unlinkSpy(...a),
  listProjectAssets: (...a: unknown[]) => listSpy(...a),
}));
vi.mock('../services/asset-service.js', () => ({
  getAssetById: (...a: unknown[]) => getAssetSpy(...a),
}));
vi.mock('../services/minio.js', () => ({
  getPresignedDownloadUrl: (...a: unknown[]) => presignDownloadSpy(...a),
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
          const rows = selectProjectOwnerSpy(...a);
          return Promise.resolve(rows ?? []);
        },
      })),
    })),
  },
  projects: { id: 'projects.id', userId: 'projects.userId' },
}));

import projectAssetRoutes from './project-assets.js';

async function build() {
  const app = fastify();
  await app.register(projectAssetRoutes);
  return app;
}

function seedProjectOwner(userId: string | null) {
  // null = project not found; otherwise row with userId
  selectProjectOwnerSpy.mockImplementationOnce(() => (userId === null ? [] : [{ userId }]));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /projects/:id/assets/link', () => {
  it('rejects linking an asset not owned by the user with 403', async () => {
    seedProjectOwner('u-1');
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
    seedProjectOwner('u-1');
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
    seedProjectOwner('u-1');
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
    seedProjectOwner('u-1');
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
    seedProjectOwner('u-1');
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
  it('returns all assets linked to the project (thumbnailUrl null when no thumbnailKey)', async () => {
    seedProjectOwner('u-1');
    listSpy.mockResolvedValueOnce([
      { id: 'a-1', thumbnailKey: null },
      { id: 'a-2', thumbnailKey: null },
    ]);
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-1/assets' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.assets).toHaveLength(2);
    expect(body.assets[0].thumbnailUrl).toBeNull();
    expect(body.assets[1].thumbnailUrl).toBeNull();
    expect(listSpy).toHaveBeenCalledWith('p-1');
    expect(presignDownloadSpy).not.toHaveBeenCalled();
  });

  it('includes presigned thumbnailUrl when asset has thumbnailKey', async () => {
    seedProjectOwner('u-1');
    listSpy.mockResolvedValueOnce([
      { id: 'a-1', thumbnailKey: 'thumbs/a1.jpg' },
      { id: 'a-2', thumbnailKey: null },
    ]);
    presignDownloadSpy.mockResolvedValueOnce('https://s3/signed/thumb-a1?sig=abc');
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-1/assets' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.assets[0].thumbnailUrl).toBe('https://s3/signed/thumb-a1?sig=abc');
    expect(body.assets[1].thumbnailUrl).toBeNull();
    expect(presignDownloadSpy).toHaveBeenCalledTimes(1);
    expect(presignDownloadSpy).toHaveBeenCalledWith('uploads', 'thumbs/a1.jpg', 24 * 3600);
  });
});

describe('ownership enforcement (S3/S6)', () => {
  it('GET /projects/:id/assets returns 403 when user does not own the project', async () => {
    seedProjectOwner('other-user');
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-1/assets' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('GET /projects/:id/assets returns 403 when project not found', async () => {
    seedProjectOwner(null);
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-missing/assets' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('GET /projects/:id/assets returns 200 when user owns the project', async () => {
    seedProjectOwner('u-1');
    listSpy.mockResolvedValueOnce([]);
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/projects/p-1/assets' });
    expect(res.statusCode).toBe(200);
  });

  it('DELETE /projects/:id/assets/:assetId returns 403 when user does not own the project', async () => {
    seedProjectOwner('other-user');
    const app = await build();
    const res = await app.inject({ method: 'DELETE', url: '/projects/p-1/assets/a-1' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
    expect(unlinkSpy).not.toHaveBeenCalled();
    expect(getAssetSpy).not.toHaveBeenCalled();
  });

  it('POST /projects/:id/assets/link returns 403 when user does not own the project', async () => {
    seedProjectOwner('other-user');
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/projects/p-1/assets/link',
      payload: { assetId: 'a-1', addedVia: 'library' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
    expect(linkSpy).not.toHaveBeenCalled();
    expect(getAssetSpy).not.toHaveBeenCalled();
  });
});
