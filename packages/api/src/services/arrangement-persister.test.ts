import { describe, it, expect, vi, beforeEach } from 'vitest';

// Discriminate drizzle insert calls by table identity. Both the sentinel
// table objects AND the spy set must live inside `vi.hoisted()` because the
// `vi.mock(...)` factories below are hoisted to the top of the file, above
// any normal top-level `const` declarations. Referencing non-hoisted
// top-level bindings from a mock factory throws `ReferenceError: Cannot
// access 'X' before initialization` at mock-registration time.
const { TRACKS_TABLE, ITEMS_TABLE, spies } = vi.hoisted(() => ({
  TRACKS_TABLE: { __id: 'tracks' },
  ITEMS_TABLE: { __id: 'timelineItems' },
  spies: {
    // SELECT tracks WHERE projectId = ? → returning existing track rows.
    selectWhere: vi.fn(),
    selectReturn: vi.fn(),
    // INSERT tracks
    trackInsertValues: vi.fn(),
    trackInsertReturning: vi.fn(),
    // INSERT timelineItems
    itemInsertValues: vi.fn(),
    itemInsertReturning: vi.fn(),
  },
}));

vi.mock('../db/schema.js', () => ({
  tracks: TRACKS_TABLE,
  timelineItems: ITEMS_TABLE,
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ __eq: args }),
}));

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...a: unknown[]) => {
          spies.selectWhere(...a);
          return spies.selectReturn();
        },
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: (arg: unknown) => {
        if (table === TRACKS_TABLE) {
          spies.trackInsertValues(arg);
          return { returning: () => spies.trackInsertReturning() };
        }
        if (table === ITEMS_TABLE) {
          spies.itemInsertValues(arg);
          return { returning: () => spies.itemInsertReturning() };
        }
        throw new Error('Unexpected table passed to db.insert in test');
      },
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// Import after mocks are registered.
import { persistArrangement } from './arrangement-persister.js';
import type { ArrangementOutput } from '../agent/arrangement-types.js';

describe('persistArrangement', () => {
  it('creates missing tracks then inserts items referencing them', async () => {
    const projectId = 'proj-1';
    const output: ArrangementOutput = {
      summary: 'two-track arrangement',
      timelineItems: [
        { assetId: 'asset-a', trackIndex: 0, startMs: 0, durationMs: 1000 },
        { assetId: 'asset-b', trackIndex: 0, startMs: 1000, durationMs: 500, sourceStartMs: 200, sourceDurationMs: 500 },
        { assetId: 'asset-c', trackIndex: 1, startMs: 0, durationMs: 1500 },
      ],
    };

    // No existing tracks for this project.
    spies.selectReturn.mockResolvedValueOnce([]);

    // Each track insert returns its newly created row.
    spies.trackInsertReturning
      .mockResolvedValueOnce([{ id: 'track-0-id', position: 0 }])
      .mockResolvedValueOnce([{ id: 'track-1-id', position: 1 }]);

    // Item inserts return empty rows (we don't use them); just resolve.
    spies.itemInsertReturning.mockResolvedValue([{}]);

    await persistArrangement(projectId, output);

    // Two unique trackIndexes → two track inserts.
    expect(spies.trackInsertValues).toHaveBeenCalledTimes(2);
    const trackCalls = spies.trackInsertValues.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const positions = trackCalls.map((v) => v.position).sort();
    expect(positions).toEqual([0, 1]);
    for (const call of trackCalls) {
      expect(call.projectId).toBe(projectId);
      expect(call.type).toBe('video');
      expect(call.locked).toBe(false);
      expect(call.visible).toBe(true);
      expect(typeof call.name).toBe('string');
    }

    // Three arrangement items → three timelineItem inserts.
    expect(spies.itemInsertValues).toHaveBeenCalledTimes(3);
    const itemCalls = spies.itemInsertValues.mock.calls.map((c) => c[0] as Record<string, unknown>);

    // Each item must carry the asset reference in `data` with the source marker.
    for (const call of itemCalls) {
      expect(typeof call.trackId).toBe('string');
      expect(call.type).toBe('video');
      expect(typeof call.startMs).toBe('number');
      expect(typeof call.endMs).toBe('number');
      const data = call.data as Record<string, unknown>;
      expect(typeof data.assetId).toBe('string');
      expect(typeof data.sourceStartMs).toBe('number');
      expect(typeof data.sourceDurationMs).toBe('number');
      expect(data.source).toBe('arrangement_agent');
    }

    // Spot-check that endMs = startMs + durationMs for the third item.
    const thirdItem = itemCalls[2];
    expect(thirdItem.startMs).toBe(0);
    expect(thirdItem.endMs).toBe(1500);
    expect((thirdItem.data as Record<string, unknown>).assetId).toBe('asset-c');

    // Second item carries the provided sourceStartMs/sourceDurationMs, not defaults.
    const secondItem = itemCalls[1];
    const secondData = secondItem.data as Record<string, unknown>;
    expect(secondData.sourceStartMs).toBe(200);
    expect(secondData.sourceDurationMs).toBe(500);
  });

  it('reuses existing tracks by position instead of creating duplicates', async () => {
    const projectId = 'proj-2';
    const output: ArrangementOutput = {
      summary: 'single-track arrangement reusing existing',
      timelineItems: [
        { assetId: 'asset-x', trackIndex: 0, startMs: 0, durationMs: 2000 },
        { assetId: 'asset-y', trackIndex: 0, startMs: 2000, durationMs: 1000 },
      ],
    };

    // Existing tracks at positions 0 and 1 — arrangement only uses position 0.
    spies.selectReturn.mockResolvedValueOnce([
      { id: 'existing-track-0', position: 0 },
      { id: 'existing-track-1', position: 1 },
    ]);

    spies.itemInsertReturning.mockResolvedValue([{}]);

    await persistArrangement(projectId, output);

    // No new tracks should be created.
    expect(spies.trackInsertValues).not.toHaveBeenCalled();

    // Both items should be inserted, linked to the existing track at position 0.
    expect(spies.itemInsertValues).toHaveBeenCalledTimes(2);
    const itemCalls = spies.itemInsertValues.mock.calls.map((c) => c[0] as Record<string, unknown>);
    for (const call of itemCalls) {
      expect(call.trackId).toBe('existing-track-0');
    }
  });
});
