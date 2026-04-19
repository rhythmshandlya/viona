import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectWhereSpy = vi.fn();
const insertValuesSpy = vi.fn();
const updateSetSpy = vi.fn();
const updateWhereSpy = vi.fn();

const selectWhereReturn = vi.fn();
const insertReturning = vi.fn();
const updateReturning = vi.fn();
const emitEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...a: unknown[]) => {
          selectWhereSpy(...a);
          // The returned object supports both `await where(...)` (thenable,
          // used by `getAssetById` / `createOrDedupAsset`) and
          // `.orderBy().limit()` (used by `listUserAssets`). Both resolve to
          // the same `selectWhereReturn()` value.
          return {
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => selectWhereReturn()),
            })),
            then: (resolve: (v: unknown) => unknown) =>
              resolve(selectWhereReturn()),
          } as unknown as Promise<unknown>;
        },
      })),
    })),
    insert: vi.fn(() => ({
      values: (...a: unknown[]) => {
        insertValuesSpy(...a);
        return {
          returning: () => insertReturning(),
        };
      },
    })),
    update: vi.fn(() => ({
      set: (...s: unknown[]) => {
        updateSetSpy(...s);
        return {
          where: (...w: unknown[]) => {
            updateWhereSpy(...w);
            return {
              returning: () => updateReturning(),
            };
          },
        };
      },
    })),
  },
}));

vi.mock('./asset-events.js', () => ({
  emitAssetEvent: (...args: unknown[]) => emitEvent(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// Import after mocks are registered
import {
  createOrDedupAsset,
  getAssetById,
  softDeleteAsset,
  updateAssetMetadata,
} from './asset-service.js';

describe('createOrDedupAsset', () => {
  it('returns existing asset if (userId, sha256) already exists', async () => {
    selectWhereReturn.mockReturnValueOnce([
      { id: 'existing', sha256: 'abc', userId: 'u' },
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
    expect(result.deduped).toBe(true);
    expect(result.asset.id).toBe('existing');
    expect(emitEvent).not.toHaveBeenCalled();
    // Short-circuit proof: we queried, but never inserted.
    expect(selectWhereSpy).toHaveBeenCalled();
    expect(insertValuesSpy).not.toHaveBeenCalled();
  });

  it('inserts and emits created event when new', async () => {
    selectWhereReturn.mockReturnValueOnce([]);
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
    // Verify the insert payload: correct fields AND the `label ?? filename`
    // fallback at asset-service.ts:53 (no explicit `label` in input, so it
    // should fall back to the filename `a.mp4`).
    expect(insertValuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u',
        sha256: 'abc',
        status: 'ready',
        label: 'a.mp4',
      }),
    );
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
    selectWhereReturn.mockReturnValueOnce([{ id: 'a', userId: 'other' }]);
    const result = await getAssetById('a', 'u');
    expect(result).toBeNull();
  });

  it('returns asset if owned by user', async () => {
    selectWhereReturn.mockReturnValueOnce([{ id: 'a', userId: 'u' }]);
    const result = await getAssetById('a', 'u');
    expect(result?.id).toBe('a');
  });
});

describe('updateAssetMetadata', () => {
  it('returns null and emits no event when row missing or wrong owner', async () => {
    updateReturning.mockResolvedValueOnce([]);
    const result = await updateAssetMetadata('a', 'u', { label: 'new' });
    expect(result).toBeNull();
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('updates and emits renamed event on success', async () => {
    updateReturning.mockResolvedValueOnce([
      { id: 'a', userId: 'u', label: 'new' },
    ]);
    await updateAssetMetadata('a', 'u', { label: 'new', userDescription: null });
    expect(updateSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'new', userDescription: null }),
    );
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'a',
        userId: 'u',
        type: 'renamed',
      }),
    );
  });
});

describe('softDeleteAsset', () => {
  it('sets status to deleted and emits deleted event', async () => {
    updateReturning.mockResolvedValueOnce([
      { id: 'a', userId: 'u', status: 'deleted' },
    ]);
    await softDeleteAsset('a', 'u');
    expect(updateSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'deleted' }),
    );
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'a',
        userId: 'u',
        type: 'deleted',
      }),
    );
  });

  it('returns false and emits no event when row missing or wrong owner', async () => {
    updateReturning.mockResolvedValueOnce([]);
    const ok = await softDeleteAsset('a', 'u');
    expect(ok).toBe(false);
    expect(emitEvent).not.toHaveBeenCalled();
  });
});
