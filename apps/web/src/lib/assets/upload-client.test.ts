import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  getUploadUrls: vi.fn(),
  registerAsset: vi.fn(),
  fetch: vi.fn(),
}));

vi.stubGlobal('fetch', spies.fetch);
vi.mock('@/lib/api/assets', () => ({
  AssetsApi: class {
    getUploadUrls = spies.getUploadUrls;
    registerAsset = spies.registerAsset;
  },
}));

import { uploadAndRegister } from './upload-client';

beforeEach(() => { vi.clearAllMocks(); });

describe('uploadAndRegister', () => {
  it('presigns, PUTs to S3, registers with sha256', async () => {
    spies.getUploadUrls.mockResolvedValueOnce({
      uploadId: 'mp-1',
      partUrls: [{ partNumber: 1, url: 'https://s3/put' }],
      storageKey: 'users/u/assets/pending/nano/f.png',
      expiresAt: 't',
    });
    spies.fetch.mockResolvedValueOnce({ ok: true, status: 200 });
    spies.registerAsset.mockResolvedValueOnce({
      asset: { id: 'a-new' }, deduped: false,
    });

    const file = new File([new Uint8Array([1, 2, 3])], 'f.png', { type: 'image/png' });
    const res = await uploadAndRegister({
      file,
      source: 'chat',
      userIntent: 'use at end',
      projectId: 'p-1',
    });

    expect(spies.getUploadUrls).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'f.png', mimeType: 'image/png', fileSize: 3, partCount: 1,
    }));
    expect(spies.fetch).toHaveBeenCalledWith('https://s3/put', expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
    }));
    expect(spies.registerAsset).toHaveBeenCalledWith(expect.objectContaining({
      storageKey: 'users/u/assets/pending/nano/f.png',
      filename: 'f.png',
      source: 'chat',
      userIntent: 'use at end',
      projectId: 'p-1',
    }));
    expect((spies.registerAsset.mock.calls[0][0] as { sha256: string }).sha256)
      .toMatch(/^[0-9a-f]{64}$/);
    expect(res.asset.id).toBe('a-new');
  });

  it('throws if S3 PUT fails', async () => {
    spies.getUploadUrls.mockResolvedValueOnce({
      uploadId: 'mp-1',
      partUrls: [{ partNumber: 1, url: 'https://s3/put' }],
      storageKey: 'k', expiresAt: 't',
    });
    spies.fetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const file = new File([new Uint8Array([1])], 'f.png', { type: 'image/png' });
    await expect(uploadAndRegister({ file, source: 'chat' })).rejects.toThrow(/403/);
    expect(spies.registerAsset).not.toHaveBeenCalled();
  });
});
