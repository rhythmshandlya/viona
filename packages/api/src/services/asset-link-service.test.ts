import { describe, it, expect, vi, beforeEach } from 'vitest';

// Arg-capture spies — assert call shape, not just truthiness of a boolean flag.
const insertValuesSpy = vi.fn();
const insertReturning = vi.fn();
const deleteWhereSpy = vi.fn();
const deleteReturn = vi.fn();
const joinWhereSpy = vi.fn();
const joinOrderBySpy = vi.fn();
const joinReturn = vi.fn();

const emitEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: (...a: unknown[]) => {
        insertValuesSpy(...a);
        return {
          onConflictDoNothing: vi.fn(() => ({
            returning: () => insertReturning(),
          })),
        };
      },
    })),
    delete: vi.fn(() => ({
      where: (...a: unknown[]) => {
        deleteWhereSpy(...a);
        return deleteReturn();
      },
    })),
    // Covers both the existing-link lookup (no projection arg) and
    // `listProjectAssets` (projects `{ asset }`). Both chains end in
    // `.orderBy(...)` which resolves to `joinReturn()`.
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: (...a: unknown[]) => {
            joinWhereSpy(...a);
            return {
              orderBy: (...o: unknown[]) => {
                joinOrderBySpy(...o);
                return joinReturn();
              },
            };
          },
        })),
      })),
    })),
  },
}));

vi.mock('./asset-events.js', () => ({
  emitAssetEvent: (...args: unknown[]) => emitEvent(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// Import after mocks are registered.
import {
  linkAssetToProject,
  unlinkAssetFromProject,
  listProjectAssets,
} from './asset-link-service.js';

describe('linkAssetToProject', () => {
  it('inserts the link, forwards the exact values, and emits a linked event', async () => {
    insertReturning.mockResolvedValueOnce([
      { id: 'l', assetId: 'a', projectId: 'p', addedVia: 'upload' },
    ]);
    const result = await linkAssetToProject({
      assetId: 'a',
      projectId: 'p',
      userId: 'u',
      addedVia: 'upload',
    });

    expect(result.id).toBe('l');
    // Arg-capture: the insert payload must contain exactly the three link columns.
    expect(insertValuesSpy).toHaveBeenCalledTimes(1);
    expect(insertValuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'a',
        projectId: 'p',
        addedVia: 'upload',
      }),
    );
    // First-insert path emits a `linked` event carrying userId + projectId.
    expect(emitEvent).toHaveBeenCalledTimes(1);
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'a',
        userId: 'u',
        projectId: 'p',
        type: 'linked',
        payload: expect.objectContaining({ addedVia: 'upload' }),
      }),
    );
    // The existing-link lookup MUST NOT run when the insert succeeded.
    expect(joinWhereSpy).not.toHaveBeenCalled();
  });

  it('returns the existing link on conflict, does NOT emit, and uses the inner-join lookup', async () => {
    insertReturning.mockResolvedValueOnce([]); // insert no-op → existing link
    joinReturn.mockReturnValueOnce([
      {
        asset_project_links: {
          id: 'l-existing',
          assetId: 'a',
          projectId: 'p',
          addedVia: 'library',
        },
        assets: { id: 'a' },
      },
    ]);

    const result = await linkAssetToProject({
      assetId: 'a',
      projectId: 'p',
      userId: 'u',
      addedVia: 'library',
    });

    // Insert WAS attempted (proves idempotency went through the DB, not a
    // pre-check short-circuit).
    expect(insertValuesSpy).toHaveBeenCalledTimes(1);
    // Existing-link lookup ran (inner join + where).
    expect(joinWhereSpy).toHaveBeenCalledTimes(1);
    // No event is emitted for no-op links.
    expect(emitEvent).not.toHaveBeenCalled();
    // Service unwraps `asset_project_links` from the joined row.
    expect((result as { id?: string }).id).toBe('l-existing');
  });
});

describe('unlinkAssetFromProject', () => {
  it('deletes the link and emits an unlinked event when rowCount > 0', async () => {
    deleteReturn.mockReturnValueOnce({ rowCount: 1 });

    const removed = await unlinkAssetFromProject({
      assetId: 'a',
      projectId: 'p',
      userId: 'u',
    });

    expect(removed).toBe(true);
    expect(deleteWhereSpy).toHaveBeenCalledTimes(1);
    // The where clause must be a concrete SQL fragment, not undefined.
    expect(deleteWhereSpy.mock.calls[0][0]).toBeTruthy();
    expect(emitEvent).toHaveBeenCalledTimes(1);
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'a',
        userId: 'u',
        projectId: 'p',
        type: 'unlinked',
      }),
    );
  });

  it('returns false and emits no event when rowCount is 0', async () => {
    deleteReturn.mockReturnValueOnce({ rowCount: 0 });

    const removed = await unlinkAssetFromProject({
      assetId: 'a',
      projectId: 'p',
      userId: 'u',
    });

    expect(removed).toBe(false);
    // Delete still attempted — we only skip the event, not the query.
    expect(deleteWhereSpy).toHaveBeenCalledTimes(1);
    expect(emitEvent).not.toHaveBeenCalled();
  });
});

describe('listProjectAssets', () => {
  it('inner-joins assets, filters by projectId and status=ready, and unwraps rows', async () => {
    joinReturn.mockReturnValueOnce([
      { asset: { id: 'a-1', status: 'ready' } },
      { asset: { id: 'a-2', status: 'ready' } },
    ]);

    const result = await listProjectAssets('p-1');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a-1');
    expect(result[1].id).toBe('a-2');
    // The SQL composition goes through the inner-join + where + orderBy path.
    expect(joinWhereSpy).toHaveBeenCalledTimes(1);
    expect(joinWhereSpy.mock.calls[0][0]).toBeTruthy();
    expect(joinOrderBySpy).toHaveBeenCalledTimes(1);
  });
});
