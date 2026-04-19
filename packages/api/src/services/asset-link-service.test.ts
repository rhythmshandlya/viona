import { describe, it, expect, vi, beforeEach } from 'vitest';

// Arg-capture spies — assert call shape, not just truthiness of a boolean flag.
const insertValuesSpy = vi.fn();
const insertReturning = vi.fn();
const deleteWhereSpy = vi.fn();
const deleteReturningReturn = vi.fn();
// Two select paths now:
//   1. `listProjectAssets` / legacy joined reads: .innerJoin().where().orderBy()
//   2. Ownership lookup + conflict-path re-read:  .where().limit()
const joinWhereSpy = vi.fn();
const joinOrderBySpy = vi.fn();
const joinReturn = vi.fn();
const whereSpy = vi.fn();
const whereLimitReturn = vi.fn();

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
    // Delete now uses `.returning()` (Drizzle-idiomatic) instead of a driver-
    // specific `rowCount`. The chain is: delete → where → returning → rows[].
    delete: vi.fn(() => ({
      where: (...a: unknown[]) => {
        deleteWhereSpy(...a);
        return {
          returning: () => deleteReturningReturn(),
        };
      },
    })),
    // Supports BOTH select shapes:
    //   - .from(...).where(...).limit(...)           → ownership + conflict re-read
    //   - .from(...).innerJoin(...).where(...).orderBy(...) → listProjectAssets
    // Each path has its own spy pair so tests can assert the exact chain used.
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...a: unknown[]) => {
          whereSpy(...a);
          return {
            limit: () => whereLimitReturn(),
          };
        },
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
    // First select call: ownership lookup succeeds.
    whereLimitReturn.mockReturnValueOnce([{ id: 'a' }]);
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
    // Only the ownership lookup runs on the where+limit path — the conflict
    // re-read must NOT fire when the insert succeeded.
    expect(whereSpy).toHaveBeenCalledTimes(1);
    // Joined lookup (inner-join path) is reserved for listProjectAssets and
    // must not run here.
    expect(joinWhereSpy).not.toHaveBeenCalled();
  });

  it('returns the existing link on conflict, does NOT emit, and uses the where+limit lookup', async () => {
    // Ownership ok → insert no-ops → re-read returns the existing link.
    whereLimitReturn
      .mockReturnValueOnce([{ id: 'a' }]) // ownership
      .mockReturnValueOnce([
        { id: 'l-existing', assetId: 'a', projectId: 'p', addedVia: 'library' },
      ]); // existing link
    insertReturning.mockResolvedValueOnce([]); // insert no-op → existing link

    const result = await linkAssetToProject({
      assetId: 'a',
      projectId: 'p',
      userId: 'u',
      addedVia: 'library',
    });

    // Insert WAS attempted (proves idempotency went through the DB, not a
    // pre-check short-circuit).
    expect(insertValuesSpy).toHaveBeenCalledTimes(1);
    // Two where+limit calls: ownership check, then existing-link re-read.
    expect(whereSpy).toHaveBeenCalledTimes(2);
    // The inner-join path is NOT used on the conflict branch anymore — the
    // join was dead code and has been removed.
    expect(joinWhereSpy).not.toHaveBeenCalled();
    // No event is emitted for no-op links.
    expect(emitEvent).not.toHaveBeenCalled();
    // Service returns the plain link row (no asset_project_links unwrap needed).
    expect((result as { id?: string }).id).toBe('l-existing');
  });

  it('throws and does not insert or emit when the asset is not owned by the user', async () => {
    // Ownership lookup returns empty → caller is not the owner.
    whereLimitReturn.mockReturnValueOnce([]);

    await expect(
      linkAssetToProject({
        assetId: 'a',
        projectId: 'p',
        userId: 'u',
        addedVia: 'upload',
      }),
    ).rejects.toThrow(/not found or not owned/);

    // Neither the insert nor the event should have been attempted.
    expect(insertValuesSpy).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });
});

describe('unlinkAssetFromProject', () => {
  it('deletes the link and emits an unlinked event when a row is returned', async () => {
    deleteReturningReturn.mockReturnValueOnce([{ id: 'l-1' }]);

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

  it('returns false and emits no event when no rows are returned', async () => {
    deleteReturningReturn.mockReturnValueOnce([]);

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
    // The where+limit path is NOT used by listProjectAssets.
    expect(whereSpy).not.toHaveBeenCalled();
  });
});
