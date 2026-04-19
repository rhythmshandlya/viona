import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';

const spies = vi.hoisted(() => ({
  fetch: vi.fn(),
  access: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn().mockResolvedValue(undefined),
  createWriteStream: vi.fn(),
  pipeline: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal('fetch', spies.fetch);
vi.mock('node:fs/promises', () => ({
  access: spies.access,
  readFile: spies.readFile,
  mkdir: spies.mkdir,
}));
vi.mock('node:fs', () => ({
  createWriteStream: spies.createWriteStream,
}));
vi.mock('node:stream/promises', () => ({
  pipeline: spies.pipeline,
}));

import { readAssetTool } from './read-asset.js';

const WORKSPACE = '/workspace';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WORKSPACE_DIR = WORKSPACE;
  process.env.API_CALLBACK_URL = 'http://api:3000';
  process.env.SANDBOX_ID = 'p-1';
  process.env.SANDBOX_SECRET = 'secret';
});

describe('readAssetTool', () => {
  it('returns the cached path when the file exists', async () => {
    spies.readFile.mockResolvedValueOnce(JSON.stringify({
      projectId: 'p-1',
      assets: [{ id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', sizeBytes: 1000 }],
      generatedAt: 't',
    }));
    spies.access.mockResolvedValueOnce(undefined);  // file exists

    const result = await readAssetTool.execute({ id: 'a-1' });

    expect(result).toContain('/workspace/assets/a-1/hero.mp4');
    expect(spies.fetch).not.toHaveBeenCalled();
    expect(spies.pipeline).not.toHaveBeenCalled();
  });

  it('downloads + writes when cache miss', async () => {
    spies.readFile.mockResolvedValueOnce(JSON.stringify({
      projectId: 'p-1',
      assets: [{ id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', sizeBytes: 1000 }],
      generatedAt: 't',
    }));
    spies.access.mockRejectedValueOnce(new Error('ENOENT'));
    const body = Readable.from([Buffer.from('abc')]);
    spies.fetch.mockResolvedValueOnce({ ok: true, body });
    spies.createWriteStream.mockReturnValueOnce({ /* stub */ });

    const result = await readAssetTool.execute({ id: 'a-1' });

    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api:3000/internal/sandbox/p-1/asset/a-1/stream',
      expect.objectContaining({
        headers: { authorization: 'Bearer secret' },
      }),
    );
    expect(spies.mkdir).toHaveBeenCalledWith('/workspace/assets/a-1', { recursive: true });
    expect(spies.pipeline).toHaveBeenCalled();
    expect(result).toContain('/workspace/assets/a-1/hero.mp4');
  });

  it('returns an error string when asset id not in manifest', async () => {
    spies.readFile.mockResolvedValueOnce(JSON.stringify({
      projectId: 'p-1',
      assets: [],
      generatedAt: 't',
    }));
    const result = await readAssetTool.execute({ id: 'unknown' });
    expect(result.toLowerCase()).toContain('not found');
    expect(spies.fetch).not.toHaveBeenCalled();
  });

  it('returns an error when API stream returns non-2xx', async () => {
    spies.readFile.mockResolvedValueOnce(JSON.stringify({
      projectId: 'p-1',
      assets: [{ id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', sizeBytes: 1000 }],
      generatedAt: 't',
    }));
    spies.access.mockRejectedValueOnce(new Error('ENOENT'));
    spies.fetch.mockResolvedValueOnce({ ok: false, status: 500, body: null });

    const result = await readAssetTool.execute({ id: 'a-1' });
    expect(result.toLowerCase()).toContain('error');
    expect(result).toContain('500');
    expect(spies.pipeline).not.toHaveBeenCalled();
  });
});
