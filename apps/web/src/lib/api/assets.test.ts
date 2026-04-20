import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.stubGlobal('fetch', spies.fetch);
vi.mock('../auth', () => ({ getSessionToken: () => 'tok-1' }));

import { AssetsApi } from './assets';

beforeEach(() => { vi.clearAllMocks(); });

describe('AssetsApi', () => {
  const api = new AssetsApi('http://api');

  it('listUserAssets GETs /assets with bearer token', async () => {
    spies.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ assets: [{ id: 'a-1' }] }) });
    const result = await api.listUserAssets();
    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api/assets',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }) }),
    );
    expect(result.assets).toHaveLength(1);
  });

  it('registerAsset POSTs with sha256 + storageKey', async () => {
    spies.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ asset: { id: 'a-new' }, deduped: false }) });
    const res = await api.registerAsset({
      sha256: 'abc', storageKey: 'k', filename: 'f.mp4',
      mimeType: 'video/mp4', fileSize: 100, source: 'upload',
    });
    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api/assets/register',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('"sha256":"abc"') }),
    );
    expect(res.asset.id).toBe('a-new');
    expect(res.deduped).toBe(false);
  });

  it('getUploadUrls returns partUrls + storageKey', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadId: 'mp-1',
        partUrls: [{ partNumber: 1, url: 'https://s3/part1' }],
        storageKey: 'users/u/assets/pending/nano/f.mp4',
        expiresAt: '2026-04-20T00:00:00Z',
      }),
    });
    const res = await api.getUploadUrls({
      filename: 'f.mp4', mimeType: 'video/mp4', fileSize: 100, partCount: 1,
    });
    expect(res.partUrls).toHaveLength(1);
    expect(res.storageKey).toContain('pending');
  });

  it('linkToProject POSTs to /projects/:id/assets/link', async () => {
    spies.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ link: { id: 'l-1' } }) });
    await api.linkToProject('p-1', { assetId: 'a-1', addedVia: 'library' });
    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api/projects/p-1/assets/link',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws on non-2xx with status in message', async () => {
    spies.fetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' });
    await expect(api.listUserAssets()).rejects.toThrow(/500/);
  });
});
