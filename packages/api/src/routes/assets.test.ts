import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const presignMultipartSpy = vi.fn();
const presignDownloadSpy = vi.fn();
const createOrDedupSpy = vi.fn();
const getAssetByIdSpy = vi.fn();
const listUserAssetsSpy = vi.fn();
const updateAssetMetadataSpy = vi.fn();
const softDeleteSpy = vi.fn();
const queueMetadataSpy = vi.fn();
const linkAssetToProjectSpy = vi.fn();
const selectProjectOwnerSpy = vi.fn();

vi.mock('../services/minio.js', () => ({
  getPresignedMultipartUploadUrls: (...a: unknown[]) => presignMultipartSpy(...a),
  getPresignedDownloadUrl: (...a: unknown[]) => presignDownloadSpy(...a),
}));
vi.mock('../services/asset-service.js', () => ({
  createOrDedupAsset: (...a: unknown[]) => createOrDedupSpy(...a),
  getAssetById: (...a: unknown[]) => getAssetByIdSpy(...a),
  listUserAssets: (...a: unknown[]) => listUserAssetsSpy(...a),
  updateAssetMetadata: (...a: unknown[]) => updateAssetMetadataSpy(...a),
  softDeleteAsset: (...a: unknown[]) => softDeleteSpy(...a),
}));
vi.mock('../services/queue.js', () => ({
  queueAssetMetadataJob: (...a: unknown[]) => queueMetadataSpy(...a),
}));
vi.mock('../services/asset-link-service.js', () => ({
  linkAssetToProject: (...a: unknown[]) => linkAssetToProjectSpy(...a),
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

// Import after mocks are registered
import assetRoutes from './assets.js';

async function build() {
  const app = fastify();
  await app.register(assetRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /assets/upload-urls', () => {
  it('returns 200 with partUrls + staging storageKey under users/<userId>/assets/pending/', async () => {
    const expiresAt = new Date(Date.now() + 3600 * 1000);
    presignMultipartSpy.mockResolvedValueOnce({
      uploadId: 'up-abc',
      partUrls: [{ partNumber: 1, url: 'https://s3/part1' }],
      expiresAt,
    });
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/upload-urls',
      payload: {
        filename: 'hero.mp4',
        mimeType: 'video/mp4',
        fileSize: 1024,
        partCount: 1,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.uploadId).toBe('up-abc');
    expect(body.partUrls).toEqual([{ partNumber: 1, url: 'https://s3/part1' }]);
    expect(body.storageKey).toMatch(/^users\/u-1\/assets\/pending\/[^/]+\/hero\.mp4$/);
    expect(body.expiresAt).toBe(expiresAt.toISOString());
    // Verify passthrough to minio helper
    expect(presignMultipartSpy).toHaveBeenCalledTimes(1);
    expect(presignMultipartSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: 'uploads',
        partCount: 1,
        expirySeconds: 3600,
        key: body.storageKey,
      }),
    );
  });

  it('rejects partCount: 0 with 400 invalid_upload_request', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/upload-urls',
      payload: {
        filename: 'x.mp4',
        mimeType: 'video/mp4',
        fileSize: 10,
        partCount: 0,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_upload_request' });
    expect(presignMultipartSpy).not.toHaveBeenCalled();
  });

  it('rejects empty filename with 400 invalid_upload_request', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/upload-urls',
      payload: {
        filename: '',
        mimeType: 'video/mp4',
        fileSize: 10,
        partCount: 1,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_upload_request' });
    expect(presignMultipartSpy).not.toHaveBeenCalled();
  });

  it('rejects partCount > 10000 (S4)', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/upload-urls',
      payload: { filename: 'f.mp4', mimeType: 'video/mp4', fileSize: 100, partCount: 10001 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_upload_request');
    expect(presignMultipartSpy).not.toHaveBeenCalled();
  });

  it('accepts partCount at the 10000 boundary', async () => {
    presignMultipartSpy.mockResolvedValueOnce({
      uploadId: 'mp',
      partUrls: [],
      storageKey: 'k',
      expiresAt: new Date(),
    });
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/upload-urls',
      payload: { filename: 'f.mp4', mimeType: 'video/mp4', fileSize: 100, partCount: 10000 },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('POST /assets/register', () => {
  it('returns 200 with deduped: false and queues metadata job for new asset', async () => {
    selectProjectOwnerSpy.mockImplementationOnce(() => [{ userId: 'u-1' }]);
    createOrDedupSpy.mockResolvedValueOnce({
      asset: { id: 'asset-new', userId: 'u-1', sha256: 'abc' },
      deduped: false,
    });
    linkAssetToProjectSpy.mockResolvedValueOnce({ id: 'l-existing' });
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/register',
      payload: {
        storageKey: 'users/u-1/assets/pending/xyz/a.mp4',
        sha256: 'abc',
        filename: 'a.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
        projectId: 'p-1',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      asset: { id: 'asset-new', userId: 'u-1', sha256: 'abc' },
      deduped: false,
    });
    // createOrDedupAsset received the mapped payload with projectIdForEvent.
    expect(createOrDedupSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        sha256: 'abc',
        storageKey: 'users/u-1/assets/pending/xyz/a.mp4',
        filename: 'a.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
        projectIdForEvent: 'p-1',
      }),
    );
    // Metadata job queued exactly once with the new asset id.
    expect(queueMetadataSpy).toHaveBeenCalledTimes(1);
    expect(queueMetadataSpy).toHaveBeenCalledWith({ assetId: 'asset-new' });
  });

  it('returns 200 with deduped: true and does NOT queue metadata job', async () => {
    createOrDedupSpy.mockResolvedValueOnce({
      asset: { id: 'asset-existing', userId: 'u-1', sha256: 'abc' },
      deduped: true,
    });
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/register',
      payload: {
        storageKey: 'users/u-1/assets/pending/xyz/a.mp4',
        sha256: 'abc',
        filename: 'a.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().deduped).toBe(true);
    // Proof that dedup short-circuits the downstream metadata job.
    expect(queueMetadataSpy).not.toHaveBeenCalled();
  });

  it('returns 400 missing_required_fields when sha256 is missing', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/register',
      payload: {
        storageKey: 'users/u-1/assets/pending/xyz/a.mp4',
        filename: 'a.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'missing_required_fields' });
    expect(createOrDedupSpy).not.toHaveBeenCalled();
    expect(queueMetadataSpy).not.toHaveBeenCalled();
  });

  it('auto-links asset to project when projectId is in body (B1)', async () => {
    selectProjectOwnerSpy.mockImplementationOnce(() => [{ userId: 'u-1' }]);
    createOrDedupSpy.mockResolvedValueOnce({
      asset: { id: 'a-1', userId: 'u-1' },
      deduped: false,
    });
    linkAssetToProjectSpy.mockResolvedValueOnce({ id: 'l-1' });
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/register',
      payload: {
        storageKey: 'users/u-1/assets/pending/nano/f.mp4',
        sha256: 'abc',
        filename: 'f.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
        projectId: 'p-1',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(linkAssetToProjectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'a-1',
        projectId: 'p-1',
        userId: 'u-1',
        addedVia: 'upload',
      }),
    );
  });

  it('does NOT link when projectId omitted', async () => {
    createOrDedupSpy.mockResolvedValueOnce({
      asset: { id: 'a-2', userId: 'u-1' },
      deduped: false,
    });
    const app = await build();
    await app.inject({
      method: 'POST',
      url: '/assets/register',
      payload: {
        storageKey: 'users/u-1/assets/pending/nano/f.mp4',
        sha256: 'xyz',
        filename: 'f.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
      },
    });
    expect(linkAssetToProjectSpy).not.toHaveBeenCalled();
  });

  it('uses addedVia="chat" when source is chat (B1)', async () => {
    selectProjectOwnerSpy.mockImplementationOnce(() => [{ userId: 'u-1' }]);
    createOrDedupSpy.mockResolvedValueOnce({
      asset: { id: 'a-3', userId: 'u-1' },
      deduped: false,
    });
    linkAssetToProjectSpy.mockResolvedValueOnce({ id: 'l-2' });
    const app = await build();
    await app.inject({
      method: 'POST',
      url: '/assets/register',
      payload: {
        storageKey: 'users/u-1/assets/pending/nano/f.png',
        sha256: 'def',
        filename: 'f.png',
        mimeType: 'image/png',
        fileSize: 1,
        source: 'chat',
        projectId: 'p-1',
      },
    });
    expect(linkAssetToProjectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        addedVia: 'chat',
      }),
    );
  });

  it('rejects storageKey that does not match user-scoped pending path (S1)', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/register',
      payload: {
        storageKey: 'users/victim-id/assets/pending/nano/f.mp4', // wrong user
        sha256: 'abc',
        filename: 'f.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_storage_key');
    expect(createOrDedupSpy).not.toHaveBeenCalled();
  });

  it('rejects storageKey with path-traversal attempt (S1)', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/register',
      payload: {
        storageKey: 'arbitrary/other/bucket/path',
        sha256: 'abc',
        filename: 'f.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_storage_key');
  });

  it('returns 403 when body.projectId is not owned by caller (M3)', async () => {
    // Seed project owned by someone else.
    selectProjectOwnerSpy.mockImplementationOnce(() => [{ userId: 'other-user' }]);
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/register',
      payload: {
        storageKey: 'users/u-1/assets/pending/nano/f.mp4',
        sha256: 'abc',
        filename: 'f.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
        projectId: 'p-other',
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
    // The critical security property: no link row was ever created.
    expect(linkAssetToProjectSpy).not.toHaveBeenCalled();
    // And we short-circuited before inserting the asset row.
    expect(createOrDedupSpy).not.toHaveBeenCalled();
  });

  it('returns 403 when body.projectId does not exist (M3)', async () => {
    selectProjectOwnerSpy.mockImplementationOnce(() => []);
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/register',
      payload: {
        storageKey: 'users/u-1/assets/pending/nano/f.mp4',
        sha256: 'abc',
        filename: 'f.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
        projectId: 'p-missing',
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
    expect(linkAssetToProjectSpy).not.toHaveBeenCalled();
    expect(createOrDedupSpy).not.toHaveBeenCalled();
  });

  it('succeeds when body.projectId is owned by caller (M3)', async () => {
    selectProjectOwnerSpy.mockImplementationOnce(() => [{ userId: 'u-1' }]);
    createOrDedupSpy.mockResolvedValueOnce({
      asset: { id: 'a-1', userId: 'u-1' },
      deduped: false,
    });
    linkAssetToProjectSpy.mockResolvedValueOnce({ id: 'l-1' });
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/assets/register',
      payload: {
        storageKey: 'users/u-1/assets/pending/nano/f.mp4',
        sha256: 'abc',
        filename: 'f.mp4',
        mimeType: 'video/mp4',
        fileSize: 1,
        source: 'upload',
        projectId: 'p-1',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(linkAssetToProjectSpy).toHaveBeenCalled();
  });
});

describe('GET /assets', () => {
  it('returns 200 with { assets } array from listUserAssets (thumbnailUrl null when no thumbnailKey)', async () => {
    const rows = [
      { id: 'a1', userId: 'u-1', thumbnailKey: null },
      { id: 'a2', userId: 'u-1', thumbnailKey: null },
    ];
    listUserAssetsSpy.mockResolvedValueOnce(rows);
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/assets' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      assets: [
        { id: 'a1', userId: 'u-1', thumbnailKey: null, thumbnailUrl: null },
        { id: 'a2', userId: 'u-1', thumbnailKey: null, thumbnailUrl: null },
      ],
    });
    expect(listUserAssetsSpy).toHaveBeenCalledWith('u-1');
    expect(presignDownloadSpy).not.toHaveBeenCalled();
  });

  it('includes presigned thumbnailUrl when asset has thumbnailKey', async () => {
    const rows = [
      { id: 'a1', userId: 'u-1', thumbnailKey: 'thumbs/a1.jpg' },
      { id: 'a2', userId: 'u-1', thumbnailKey: null },
    ];
    listUserAssetsSpy.mockResolvedValueOnce(rows);
    presignDownloadSpy.mockResolvedValueOnce('https://s3/signed/thumb-a1?sig=abc');
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/assets' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.assets[0].thumbnailUrl).toBe('https://s3/signed/thumb-a1?sig=abc');
    expect(body.assets[1].thumbnailUrl).toBeNull();
    // presign helper called once with the thumbnailKey + 24h TTL.
    expect(presignDownloadSpy).toHaveBeenCalledTimes(1);
    expect(presignDownloadSpy).toHaveBeenCalledWith('uploads', 'thumbs/a1.jpg', 24 * 3600);
  });
});

describe('GET /assets/:id', () => {
  it('returns 404 not_found when service returns null', async () => {
    getAssetByIdSpy.mockResolvedValueOnce(null);
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/assets/missing' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found' });
    expect(getAssetByIdSpy).toHaveBeenCalledWith('missing', 'u-1');
  });

  it('returns 200 with { asset } when owned by caller', async () => {
    const asset = { id: 'a1', userId: 'u-1', storageKey: 'k' };
    getAssetByIdSpy.mockResolvedValueOnce(asset);
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/assets/a1' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ asset });
  });
});

describe('GET /assets/:id/url', () => {
  it('returns 200 with { url, expiresAt } in the future', async () => {
    const asset = {
      id: 'a1',
      userId: 'u-1',
      storageKey: 'uploads/users/u-1/assets/pending/xyz/a.mp4',
    };
    getAssetByIdSpy.mockResolvedValueOnce(asset);
    presignDownloadSpy.mockResolvedValueOnce('https://s3/download?sig=abc');
    const app = await build();
    const before = Date.now();
    const res = await app.inject({ method: 'GET', url: '/assets/a1/url' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.url).toBe('https://s3/download?sig=abc');
    const expiresAtMs = Date.parse(body.expiresAt);
    // 24h TTL means expiresAt must be in the future (and within ~24h window).
    expect(expiresAtMs).toBeGreaterThan(before);
    expect(expiresAtMs).toBeGreaterThan(before + 23 * 3600 * 1000);
    // Passes raw storageKey (no prefix stripping) + 24h TTL to the minio helper.
    expect(presignDownloadSpy).toHaveBeenCalledWith(
      'uploads',
      'uploads/users/u-1/assets/pending/xyz/a.mp4',
      24 * 3600,
    );
  });

  it('returns 404 when service returns null', async () => {
    getAssetByIdSpy.mockResolvedValueOnce(null);
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/assets/missing/url' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found' });
    expect(presignDownloadSpy).not.toHaveBeenCalled();
  });
});

describe('PATCH /assets/:id', () => {
  it('returns 200 with updated asset and passes { label: "new" } to service', async () => {
    const updated = { id: 'a1', userId: 'u-1', label: 'new' };
    updateAssetMetadataSpy.mockResolvedValueOnce(updated);
    const app = await build();
    const res = await app.inject({
      method: 'PATCH',
      url: '/assets/a1',
      payload: { label: 'new' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ asset: updated });
    expect(updateAssetMetadataSpy).toHaveBeenCalledWith(
      'a1',
      'u-1',
      { label: 'new' },
    );
  });

  it('returns 404 when service returns null', async () => {
    updateAssetMetadataSpy.mockResolvedValueOnce(null);
    const app = await build();
    const res = await app.inject({
      method: 'PATCH',
      url: '/assets/a1',
      payload: { label: 'new' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found' });
  });
});

describe('DELETE /assets/:id', () => {
  it('returns 200 { ok: true } when service returns true', async () => {
    softDeleteSpy.mockResolvedValueOnce(true);
    const app = await build();
    const res = await app.inject({ method: 'DELETE', url: '/assets/a1' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(softDeleteSpy).toHaveBeenCalledWith('a1', 'u-1');
  });

  it('returns 404 when service returns false', async () => {
    softDeleteSpy.mockResolvedValueOnce(false);
    const app = await build();
    const res = await app.inject({ method: 'DELETE', url: '/assets/missing' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found' });
  });
});
