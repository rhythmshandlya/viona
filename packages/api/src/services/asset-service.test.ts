import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectWhere = vi.fn();
const insertReturning = vi.fn();
const updateReturning = vi.fn();
const emitEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: (...a: unknown[]) => selectWhere(...a) })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: (...a: unknown[]) => insertReturning(...a) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: (...a: unknown[]) => updateReturning(...a) })),
      })),
    })),
  },
}));

vi.mock('./asset-events.js', () => ({
  emitAssetEvent: (...args: unknown[]) => emitEvent(...args),
}));

beforeEach(() => {
  selectWhere.mockReset();
  insertReturning.mockReset();
  updateReturning.mockReset();
  emitEvent.mockClear();
});

// Import after mocks are registered
import {
  createOrDedupAsset,
  getAssetById,
  softDeleteAsset,
} from './asset-service.js';

describe('createOrDedupAsset', () => {
  it('returns existing asset if (userId, sha256) already exists', async () => {
    selectWhere.mockResolvedValueOnce([{ id: 'existing', sha256: 'abc', userId: 'u' }]);
    const result = await createOrDedupAsset({
      userId: 'u',
      sha256: 'abc',
      storageKey: 'k',
      filename: 'a.mp4',
      mimeType: 'video/mp4',
      fileSize: 1,
      source: 'upload',
    });
    expect(result.deduped).toBe(true);
    expect(result.asset.id).toBe('existing');
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('inserts and emits created event when new', async () => {
    selectWhere.mockResolvedValueOnce([]);
    insertReturning.mockResolvedValueOnce([
      {
        id: 'new',
        sha256: 'abc',
        userId: 'u',
        status: 'ready',
        mimeType: 'video/mp4',
        filename: 'a.mp4',
        source: 'upload',
      },
    ]);
    const result = await createOrDedupAsset({
      userId: 'u',
      sha256: 'abc',
      storageKey: 'k',
      filename: 'a.mp4',
      mimeType: 'video/mp4',
      fileSize: 1,
      source: 'upload',
    });
    expect(result.deduped).toBe(false);
    expect(result.asset.id).toBe('new');
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'new',
        userId: 'u',
        type: 'created',
      }),
    );
  });
});

describe('getAssetById', () => {
  it('returns null if asset does not belong to user', async () => {
    selectWhere.mockResolvedValueOnce([{ id: 'a', userId: 'other' }]);
    const result = await getAssetById('a', 'u');
    expect(result).toBeNull();
  });

  it('returns asset if owned by user', async () => {
    selectWhere.mockResolvedValueOnce([{ id: 'a', userId: 'u' }]);
    const result = await getAssetById('a', 'u');
    expect(result?.id).toBe('a');
  });
});

describe('softDeleteAsset', () => {
  it('sets status to deleted and emits deleted event', async () => {
    updateReturning.mockResolvedValueOnce([{ id: 'a', userId: 'u', status: 'deleted' }]);
    await softDeleteAsset('a', 'u');
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'a',
        userId: 'u',
        type: 'deleted',
      }),
    );
  });
});
