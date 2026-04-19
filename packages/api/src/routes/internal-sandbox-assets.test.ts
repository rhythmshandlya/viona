import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const spies = vi.hoisted(() => ({
  listProjectAssets: vi.fn(),
  verifySecret: vi.fn(),
}));

vi.mock('../services/asset-link-service.js', () => ({
  listProjectAssets: spies.listProjectAssets,
}));
vi.mock('../sandbox/manager.js', () => ({
  sandboxManager: { verifySandboxSecret: spies.verifySecret },
}));

import internalSandboxAssetsRoutes from './internal-sandbox-assets.js';

async function build() {
  const app = fastify();
  await app.register(internalSandboxAssetsRoutes);
  return app;
}

beforeEach(() => { vi.clearAllMocks(); });

describe('GET /internal/sandbox/:sid/assets-manifest', () => {
  it('returns 401 when Bearer token missing', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/internal/sandbox/p-1/assets-manifest' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when secret mismatches', async () => {
    spies.verifySecret.mockResolvedValueOnce(false);
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/sandbox/p-1/assets-manifest',
      headers: { authorization: 'Bearer wrong' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns manifest JSON with no storageKey on success', async () => {
    spies.verifySecret.mockResolvedValueOnce(true);
    spies.listProjectAssets.mockResolvedValueOnce([
      { id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', storageKey: 'k1', fileSize: 1000, durationMs: 5000, width: 1920, height: 1080, userIntent: 'hook', userDescription: null, transcriptAssetId: 't-1' },
      { id: 'a-2', filename: 'logo.png', mimeType: 'image/png', storageKey: 'k2', fileSize: 500, durationMs: null, width: null, height: null, userIntent: null, userDescription: null, transcriptAssetId: null },
    ]);
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/sandbox/p-1/assets-manifest',
      headers: { authorization: 'Bearer good-secret' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.projectId).toBe('p-1');
    expect(typeof body.generatedAt).toBe('string');
    expect(body.assets).toHaveLength(2);
    expect(body.assets[0]).toMatchObject({
      id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4',
      sizeBytes: 1000, durationMs: 5000, width: 1920, height: 1080,
      userIntent: 'hook', transcriptAssetId: 't-1',
    });
    expect(body.assets[0].storageKey).toBeUndefined();
    expect(body.assets[1]).toMatchObject({ id: 'a-2', transcriptAssetId: null });
  });

  it('verifies the secret using the sandbox id from the path', async () => {
    spies.verifySecret.mockResolvedValueOnce(true);
    spies.listProjectAssets.mockResolvedValueOnce([]);
    const app = await build();
    await app.inject({
      method: 'GET',
      url: '/internal/sandbox/p-42/assets-manifest',
      headers: { authorization: 'Bearer token-xyz' },
    });
    expect(spies.verifySecret).toHaveBeenCalledWith('p-42', 'token-xyz');
  });
});
