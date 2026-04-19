import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';

const spies = vi.hoisted(() => ({
  getObject: vi.fn(),
}));

vi.mock('./minio.js', () => ({
  minioClient: { getObject: spies.getObject },
}));
vi.mock('../config.js', () => ({
  config: { storage: { bucket: 'viona' } },
}));

import { fetchTranscriptJson } from './transcript-fetch.js';

beforeEach(() => { vi.clearAllMocks(); });

function streamFrom(obj: unknown): Readable {
  const s = new Readable();
  s._read = () => {};
  s.push(JSON.stringify(obj));
  s.push(null);
  return s;
}

describe('fetchTranscriptJson', () => {
  it('returns parsed transcript with text + segments', async () => {
    spies.getObject.mockResolvedValueOnce(streamFrom({
      text: 'hello world',
      segments: [{ start: 0, end: 1, text: 'hello world' }],
    }));
    const out = await fetchTranscriptJson('users/u/derived/a/transcript.json');
    expect(out.text).toBe('hello world');
    expect(out.segments).toHaveLength(1);
    expect(spies.getObject).toHaveBeenCalledWith('viona', 'users/u/derived/a/transcript.json');
  });

  it('propagates MinIO errors', async () => {
    spies.getObject.mockRejectedValueOnce(new Error('no such key'));
    await expect(fetchTranscriptJson('bad/key')).rejects.toThrow('no such key');
  });

  it('throws on malformed JSON', async () => {
    const s = new Readable();
    s._read = () => {};
    s.push('not json');
    s.push(null);
    spies.getObject.mockResolvedValueOnce(s);
    await expect(fetchTranscriptJson('bad-json')).rejects.toThrow();
  });
});
