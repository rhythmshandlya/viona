import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbUpdateSet = vi.fn();
const dbUpdateWhere = vi.fn();
const dbSelectWhere = vi.fn();
const emitEvent = vi.fn().mockResolvedValue(undefined);
const ffprobe = vi.fn();
const thumbnail = vi.fn();
const waveform = vi.fn();
const minioGet = vi.fn();
const minioPut = vi.fn();
const queueTranscribe = vi.fn();

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...a: unknown[]) => { dbSelectWhere(...a); return Promise.resolve((dbSelectWhere as unknown as { _result?: unknown[] })._result ?? []); },
      })),
    })),
    update: vi.fn(() => ({
      set: (...s: unknown[]) => { dbUpdateSet(...s); return {
        where: (...w: unknown[]) => { dbUpdateWhere(...w); return Promise.resolve(undefined); },
      }; },
    })),
  },
  assets: {},
}));
vi.mock('../services/asset-events.js', () => ({
  emitAssetEvent: (...a: unknown[]) => emitEvent(...a),
}));
vi.mock('../services/media.js', () => ({
  runFfprobe: (...a: unknown[]) => ffprobe(...a),
  runFfmpegThumbnail: (...a: unknown[]) => thumbnail(...a),
  runFfmpegWaveform: (...a: unknown[]) => waveform(...a),
}));
vi.mock('../services/asset-storage.js', () => ({
  downloadToTmp: (...a: unknown[]) => minioGet(...a),
  uploadFile: (...a: unknown[]) => minioPut(...a),
}));
vi.mock('../services/queue.js', () => ({
  queueTranscribeJob: (...a: unknown[]) => queueTranscribe(...a),
}));

import { processAssetMetadataJob } from './asset-metadata.js';

beforeEach(() => { vi.clearAllMocks(); });

function seedSelectResult(row: unknown) {
  (dbSelectWhere as unknown as { _result?: unknown[] })._result = row ? [row] : [];
}

describe('processAssetMetadataJob', () => {
  it('video: runs ffprobe, generates thumbnail + waveform, updates row, emits metadata_ready, queues transcribe', async () => {
    seedSelectResult({
      id: 'a-1', userId: 'u', storageKey: 'users/u/assets/a-1/v.mp4',
      mimeType: 'video/mp4', sha256: 'abc',
    });
    minioGet.mockResolvedValueOnce({ path: '/tmp/v.mp4', cleanup: vi.fn().mockResolvedValue(undefined) });
    ffprobe.mockResolvedValueOnce({ durationMs: 12000, width: 1920, height: 1080, audioChannels: 2 });
    thumbnail.mockResolvedValueOnce(Buffer.from('thumb'));
    waveform.mockResolvedValueOnce(Buffer.from('wave'));
    minioPut.mockResolvedValue('users/u/derived/abc/thumbnail.jpg');

    await processAssetMetadataJob({ data: { assetId: 'a-1' } } as never);

    expect(ffprobe).toHaveBeenCalledWith('/tmp/v.mp4');
    expect(thumbnail).toHaveBeenCalled();
    expect(waveform).toHaveBeenCalled();
    expect(dbUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      durationMs: 12000, width: 1920, height: 1080,
      thumbnailStatus: 'ready', waveformStatus: 'ready', transcriptStatus: 'pending',
    }));
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'a-1', userId: 'u', type: 'metadata_ready',
    }));
    expect(queueTranscribe).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'a-1' }));
  });

  it('image: generates thumbnail only, no waveform, no transcribe', async () => {
    seedSelectResult({
      id: 'a-2', userId: 'u', storageKey: 'k', mimeType: 'image/png', sha256: 'def',
    });
    minioGet.mockResolvedValueOnce({ path: '/tmp/i.png', cleanup: vi.fn().mockResolvedValue(undefined) });
    ffprobe.mockResolvedValueOnce({ durationMs: null, width: 800, height: 600, audioChannels: null });
    thumbnail.mockResolvedValueOnce(Buffer.from('t'));

    await processAssetMetadataJob({ data: { assetId: 'a-2' } } as never);

    expect(waveform).not.toHaveBeenCalled();
    expect(queueTranscribe).not.toHaveBeenCalled();
    expect(dbUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      thumbnailStatus: 'ready',
      waveformStatus: 'not_applicable',
      transcriptStatus: 'not_applicable',
    }));
  });

  it('audio: generates waveform only (no thumbnail), queues transcribe', async () => {
    seedSelectResult({
      id: 'a-3', userId: 'u', storageKey: 'k', mimeType: 'audio/mpeg', sha256: 'xyz',
    });
    minioGet.mockResolvedValueOnce({ path: '/tmp/a.mp3', cleanup: vi.fn().mockResolvedValue(undefined) });
    ffprobe.mockResolvedValueOnce({ durationMs: 8000, width: null, height: null, audioChannels: 2 });
    waveform.mockResolvedValueOnce(Buffer.from('w'));

    await processAssetMetadataJob({ data: { assetId: 'a-3' } } as never);

    expect(thumbnail).not.toHaveBeenCalled();
    expect(waveform).toHaveBeenCalled();
    expect(queueTranscribe).toHaveBeenCalled();
    expect(dbUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      thumbnailStatus: 'not_applicable',
      waveformStatus: 'ready',
      transcriptStatus: 'pending',
    }));
  });

  it('throws and emits failed event when ffprobe throws', async () => {
    seedSelectResult({
      id: 'a-4', userId: 'u', storageKey: 'k', mimeType: 'video/mp4', sha256: 'bad',
    });
    minioGet.mockResolvedValueOnce({ path: '/tmp/fail.mp4', cleanup: vi.fn().mockResolvedValue(undefined) });
    ffprobe.mockRejectedValueOnce(new Error('probe-fail'));

    await expect(processAssetMetadataJob({ data: { assetId: 'a-4' } } as never)).rejects.toThrow('probe-fail');
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'a-4', type: 'failed',
    }));
    expect(queueTranscribe).not.toHaveBeenCalled();
  });

  it('throws if asset row not found', async () => {
    seedSelectResult(null);
    await expect(processAssetMetadataJob({ data: { assetId: 'nope' } } as never)).rejects.toThrow(/not found/);
  });

  it('cleans up tmp directory on success', async () => {
    seedSelectResult({ id: 'a', userId: 'u', storageKey: 'k', mimeType: 'image/png', sha256: 'c' });
    const cleanup = vi.fn().mockResolvedValue(undefined);
    minioGet.mockResolvedValueOnce({ path: '/tmp/x.png', cleanup });
    ffprobe.mockResolvedValueOnce({ durationMs: null, width: 1, height: 1, audioChannels: null });
    thumbnail.mockResolvedValueOnce(Buffer.from('t'));
    await processAssetMetadataJob({ data: { assetId: 'a' } } as never);
    expect(cleanup).toHaveBeenCalled();
  });

  it('cleans up tmp directory on failure', async () => {
    seedSelectResult({ id: 'a', userId: 'u', storageKey: 'k', mimeType: 'video/mp4', sha256: 'c' });
    const cleanup = vi.fn().mockResolvedValue(undefined);
    minioGet.mockResolvedValueOnce({ path: '/tmp/x.mp4', cleanup });
    ffprobe.mockRejectedValueOnce(new Error('boom'));
    await expect(processAssetMetadataJob({ data: { assetId: 'a' } } as never)).rejects.toThrow('boom');
    expect(cleanup).toHaveBeenCalled();
  });
});
