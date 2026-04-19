import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  fetch: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal('fetch', spies.fetch);
vi.mock('node:fs/promises', () => ({
  writeFile: spies.writeFile,
  mkdir: spies.mkdir,
}));

import { fetchAndWriteAssetsManifest } from './manifest.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('fetchAndWriteAssetsManifest', () => {
  it('fetches with Bearer auth and writes manifest to /workspace', async () => {
    const manifest = {
      projectId: 'p-1',
      assets: [{ id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', sizeBytes: 1000 }],
      generatedAt: '2026-04-20T00:00:00.000Z',
    };
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => manifest,
    });

    const out = await fetchAndWriteAssetsManifest({
      apiUrl: 'http://api:3000',
      sandboxId: 'p-1',
      secret: 's-xyz',
      workspaceRoot: '/workspace',
    });

    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api:3000/internal/sandbox/p-1/assets-manifest',
      expect.objectContaining({
        headers: { authorization: 'Bearer s-xyz' },
      }),
    );
    expect(spies.writeFile).toHaveBeenCalledWith(
      '/workspace/assets-manifest.json',
      expect.stringContaining('"id": "a-1"'),
      'utf8',
    );
    expect(out.projectId).toBe('p-1');
    expect(out.assets).toHaveLength(1);
  });

  it('throws when API returns non-2xx', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });
    await expect(fetchAndWriteAssetsManifest({
      apiUrl: 'http://api:3000',
      sandboxId: 'p-1',
      secret: 's',
      workspaceRoot: '/workspace',
    })).rejects.toThrow(/500/);
    expect(spies.writeFile).not.toHaveBeenCalled();
  });

  it('creates the workspace directory if missing (mkdir recursive)', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ projectId: 'p', assets: [], generatedAt: 't' }),
    });
    await fetchAndWriteAssetsManifest({
      apiUrl: 'http://api:3000', sandboxId: 'p', secret: 's', workspaceRoot: '/workspace',
    });
    expect(spies.mkdir).toHaveBeenCalledWith('/workspace', { recursive: true });
  });
});
