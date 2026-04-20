import { describe, it, expect, vi, beforeEach } from 'vitest';

// db.select() is called 3 times per loadComposition; each time a different return.
// Dispatch by table identity via sentinel Symbol mocks. Both the sentinels and
// the spies must live inside vi.hoisted() because vi.mock() factories below are
// hoisted above normal top-level const declarations.
const { TRACKS, ITEMS, ASSETS, spies } = vi.hoisted(() => ({
  TRACKS: Symbol('tracks'),
  ITEMS: Symbol('timelineItems'),
  ASSETS: Symbol('assets'),
  spies: {
    selectTracks: vi.fn(),
    selectItems: vi.fn(),
    selectAssets: vi.fn(),
    getPresignedDownloadUrl: vi.fn(),
  },
}));

vi.mock('../db/schema.js', async () => {
  const actual = await vi.importActual<typeof import('../db/schema.js')>('../db/schema.js');
  return { ...actual, tracks: TRACKS as unknown as typeof actual.tracks,
    timelineItems: ITEMS as unknown as typeof actual.timelineItems,
    assets: ASSETS as unknown as typeof actual.assets };
});

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: (...a: unknown[]) => {
          if (table === TRACKS) return Promise.resolve(spies.selectTracks(...a));
          if (table === ITEMS) return Promise.resolve(spies.selectItems(...a));
          if (table === ASSETS) return Promise.resolve(spies.selectAssets(...a));
          return Promise.resolve([]);
        },
      })),
    })),
  },
}));

vi.mock('./minio.js', () => ({
  getPresignedDownloadUrl: spies.getPresignedDownloadUrl,
}));

import { loadComposition } from './composition-loader.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('loadComposition', () => {
  it('returns tracks + items + per-asset resolved URL map', async () => {
    spies.selectTracks.mockReturnValueOnce([
      { id: 't-0', projectId: 'p-1', position: 0, type: 'video', name: 'Track 1' },
    ]);
    spies.selectItems.mockReturnValueOnce([
      { id: 'i-1', trackId: 't-0', type: 'video', startMs: 0, endMs: 3000,
        data: { assetId: 'a-1', sourceStartMs: 0, sourceDurationMs: 3000, source: 'arrangement_agent' } },
    ]);
    spies.selectAssets.mockReturnValueOnce([
      { id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4', storageKey: 'users/u-1/assets/abc/hero.mp4',
        durationMs: 3000, width: 1920, height: 1080, thumbnailKey: 'users/u-1/derived/abc/thumbnail.jpg' },
    ]);
    spies.getPresignedDownloadUrl
      .mockReturnValueOnce('https://signed/hero.mp4')
      .mockReturnValueOnce('https://signed/thumb.jpg');

    const result = await loadComposition({ projectId: 'p-1', userId: 'u-1' });
    expect(result.tracks).toHaveLength(1);
    expect(result.timelineItems).toHaveLength(1);
    expect(result.assets['a-1']).toMatchObject({
      id: 'a-1', filename: 'hero.mp4', mimeType: 'video/mp4',
      durationMs: 3000, width: 1920, height: 1080,
      url: 'https://signed/hero.mp4', thumbnailUrl: 'https://signed/thumb.jpg',
    });
  });

  it('returns empty composition when project has no tracks', async () => {
    spies.selectTracks.mockReturnValueOnce([]);
    // items + assets queries should be short-circuited since no trackIds or assetIds
    const result = await loadComposition({ projectId: 'p-1', userId: 'u-1' });
    expect(result.tracks).toEqual([]);
    expect(result.timelineItems).toEqual([]);
    expect(result.assets).toEqual({});
    expect(spies.getPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('returns null thumbnailUrl for assets without a thumbnailKey', async () => {
    spies.selectTracks.mockReturnValueOnce([{ id: 't-0', projectId: 'p-1', position: 0, type: 'video', name: 'Track 1' }]);
    spies.selectItems.mockReturnValueOnce([
      { id: 'i-1', trackId: 't-0', type: 'video', startMs: 0, endMs: 3000, data: { assetId: 'a-1' } },
    ]);
    spies.selectAssets.mockReturnValueOnce([
      { id: 'a-1', filename: 'f.mp4', mimeType: 'video/mp4', storageKey: 'k',
        durationMs: null, width: null, height: null, thumbnailKey: null },
    ]);
    spies.getPresignedDownloadUrl.mockReturnValueOnce('https://signed/f.mp4');

    const result = await loadComposition({ projectId: 'p-1', userId: 'u-1' });
    expect(result.assets['a-1'].thumbnailUrl).toBeNull();
    expect(spies.getPresignedDownloadUrl).toHaveBeenCalledTimes(1);  // no thumbnail call
  });
});
