import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(),
  putObject: vi.fn(),
  fetch: vi.fn(),
}));

vi.stubGlobal('fetch', spies.fetch);
vi.mock('node:fs/promises', () => ({
  readFile: spies.readFile,
  stat: spies.stat,
}));
vi.mock('../minio.js', () => ({
  minioClient: { putObject: spies.putObject },
  getBucket: () => 'viona',
}));

import { registerAssetTool } from './register-asset.js';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_CALLBACK_URL = 'http://api:3000';
  process.env.SANDBOX_ID = 'p-1';
  process.env.SANDBOX_SECRET = 'secret';
});

describe('registerAssetTool', () => {
  it('hashes file, uploads to MinIO, calls register, returns asset id', async () => {
    spies.readFile.mockResolvedValueOnce(Buffer.from('content'));
    spies.stat.mockResolvedValueOnce({ size: 7 });
    spies.putObject.mockResolvedValueOnce(undefined);
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ asset: { id: 'a-new' }, deduped: false }),
    });

    const result = await registerAssetTool.execute({
      localPath: '/workspace/output/render.mp4',
      kind: 'generated',
      parentAssetIds: ['a-parent'],
      label: 'My render',
    });

    // Uploaded to MinIO
    expect(spies.putObject).toHaveBeenCalledWith(
      'viona',
      expect.stringMatching(/^sandbox\/p-1\/assets\/[0-9a-f]{64}\/render\.mp4$/),
      expect.any(Buffer),
      7,
      expect.objectContaining({ 'Content-Type': 'video/mp4' }),
    );
    // Called register endpoint
    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api:3000/internal/sandbox/p-1/asset/register',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          authorization: 'Bearer secret',
        }),
      }),
    );
    // Body includes all expected fields
    const callArgs = spies.fetch.mock.calls[0][1] as { body: string };
    const body = JSON.parse(callArgs.body);
    expect(body).toMatchObject({
      filename: 'render.mp4',
      mimeType: 'video/mp4',
      fileSize: 7,
      source: 'generated',
      parentAssetIds: ['a-parent'],
      label: 'My render',
    });
    expect(body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(body.storageKey).toContain('sandbox/p-1/assets/');

    expect(result).toContain('a-new');
  });

  it('returns error string when local file does not exist', async () => {
    spies.readFile.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const result = await registerAssetTool.execute({
      localPath: '/workspace/missing.mp4',
      kind: 'generated',
    });
    expect(result.toLowerCase()).toContain('error');
    expect(spies.putObject).not.toHaveBeenCalled();
    expect(spies.fetch).not.toHaveBeenCalled();
  });

  it('returns error when register endpoint returns non-2xx', async () => {
    spies.readFile.mockResolvedValueOnce(Buffer.from('x'));
    spies.stat.mockResolvedValueOnce({ size: 1 });
    spies.putObject.mockResolvedValueOnce(undefined);
    spies.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'db down',
    });
    const result = await registerAssetTool.execute({
      localPath: '/workspace/f.mp4',
      kind: 'generated',
    });
    expect(result.toLowerCase()).toContain('error');
    expect(result).toContain('500');
  });

  it('uses provided mimeType when given, else infers from extension', async () => {
    spies.readFile.mockResolvedValueOnce(Buffer.from('x'));
    spies.stat.mockResolvedValueOnce({ size: 1 });
    spies.putObject.mockResolvedValueOnce(undefined);
    spies.fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ asset: { id: 'a-1' }, deduped: true }),
    });
    await registerAssetTool.execute({
      localPath: '/workspace/f.webm',
      kind: 'derived',
      mimeType: 'video/quicktime',  // explicit override
    });
    const body = JSON.parse((spies.fetch.mock.calls[0][1] as { body: string }).body);
    expect(body.mimeType).toBe('video/quicktime');
  });
});
