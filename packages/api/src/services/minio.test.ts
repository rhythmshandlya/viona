import { describe, it, expect, vi, beforeEach } from 'vitest';

const initiateSpy = vi.fn();
const presignedUrlSpy = vi.fn();

vi.mock('minio', () => {
  class MockClient {
    initiateNewMultipartUpload = (...a: unknown[]) => { initiateSpy(...a); return Promise.resolve('upload-id-1'); };
    presignedUrl = (...a: unknown[]) => { presignedUrlSpy(...a); return Promise.resolve('https://mock/part'); };
    presignedPutObject = vi.fn().mockResolvedValue('https://mock/put');
    presignedGetObject = vi.fn().mockResolvedValue('https://mock/get');
  }
  return { Client: MockClient };
});

// Import AFTER vi.mock so the Client is the mock class.
import { getPresignedMultipartUploadUrls } from './minio.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('getPresignedMultipartUploadUrls', () => {
  it('initiates multipart and returns one URL per part', async () => {
    const result = await getPresignedMultipartUploadUrls({
      prefix: 'uploads', key: 'users/u-1/assets/abc/video.mp4', partCount: 3,
    });
    expect(result.uploadId).toBe('upload-id-1');
    expect(result.partUrls).toHaveLength(3);
    expect(result.partUrls.map((p) => p.partNumber)).toEqual([1, 2, 3]);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(initiateSpy).toHaveBeenCalledTimes(1);
    expect(presignedUrlSpy).toHaveBeenCalledTimes(3);
    // First call's (verb, bucket, key, expiry, extra) — verify PUT + uploadId + partNumber.
    const [verb, , , , extra] = presignedUrlSpy.mock.calls[0];
    expect(verb).toBe('PUT');
    expect(extra).toMatchObject({ uploadId: 'upload-id-1', partNumber: '1' });
  });

  it('honors custom expirySeconds in returned expiresAt window', async () => {
    const before = Date.now();
    const result = await getPresignedMultipartUploadUrls({
      prefix: 'uploads', key: 'k', partCount: 1, expirySeconds: 60,
    });
    const after = Date.now();
    const expMs = result.expiresAt.getTime();
    expect(expMs).toBeGreaterThanOrEqual(before + 60_000);
    expect(expMs).toBeLessThanOrEqual(after + 60_000);
  });

  it('prepends the prefix to the bucket key passed through to MinIO', async () => {
    await getPresignedMultipartUploadUrls({
      prefix: 'uploads', key: 'foo/bar.mp4', partCount: 1,
    });
    const [, , fullKey] = presignedUrlSpy.mock.calls[0];
    // Must include the 'uploads/' prefix from PREFIXES; do NOT hardcode the bucket name.
    expect(typeof fullKey).toBe('string');
    expect(fullKey.endsWith('foo/bar.mp4')).toBe(true);
    expect(fullKey.startsWith('uploads/')).toBe(true);
  });
});
