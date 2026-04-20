import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const spies = vi.hoisted(() => ({
  getComposition: vi.fn(),
  applyCompositionV2: vi.fn(),
  isAssetSystemV2: vi.fn(),
}));

vi.mock('@/lib/api/composition', () => ({
  CompositionApi: class {
    getComposition = spies.getComposition;
  },
}));
vi.mock('@/lib/feature-flags', () => ({
  isAssetSystemV2: spies.isAssetSystemV2,
}));
vi.mock('../store/use-editor-store', () => ({
  useApplyCompositionV2: () => spies.applyCompositionV2,
}));

import { useCompositionUpdates } from './useCompositionUpdates';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  spies.isAssetSystemV2.mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useCompositionUpdates refresh loop', () => {
  it('refetches + applies composition every 3h', async () => {
    spies.getComposition.mockResolvedValue({
      tracks: [{ id: 't', projectId: 'p', position: 0, type: 'video', name: 'T' }],
      timelineItems: [{ id: 'i', trackId: 't', type: 'video', startMs: 0, endMs: 1000, data: {} }],
      assets: {},
    });
    renderHook(() => useCompositionUpdates('p-1'));

    // Flush the initial-fetch effect's microtasks (no timer advance; avoids
    // re-firing the 3h interval in a loop).
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const initialCallCount = spies.getComposition.mock.calls.length;
    expect(initialCallCount).toBeGreaterThan(0);

    // Advance exactly 3h — interval fires once, flush its resolved fetch.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000);
    });

    expect(spies.getComposition.mock.calls.length).toBeGreaterThan(initialCallCount);
    expect(spies.applyCompositionV2).toHaveBeenCalled();
  });

  it('skips refresh when flag is off', async () => {
    spies.isAssetSystemV2.mockReturnValue(false);
    renderHook(() => useCompositionUpdates('p-1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000);
    });

    expect(spies.getComposition).not.toHaveBeenCalled();
  });

  it('does not apply empty compositions on refresh (guards legacy timeline)', async () => {
    spies.getComposition.mockResolvedValue({
      tracks: [],
      timelineItems: [],
      assets: {},
    });
    renderHook(() => useCompositionUpdates('p-1'));

    // Let initial fetch resolve (also returns empty so apply is skipped).
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    spies.applyCompositionV2.mockClear();

    // Trigger one periodic refresh.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000);
    });

    expect(spies.getComposition).toHaveBeenCalled();
    expect(spies.applyCompositionV2).not.toHaveBeenCalled();
  });
});
