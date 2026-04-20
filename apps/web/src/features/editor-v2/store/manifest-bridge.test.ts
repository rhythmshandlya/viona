/**
 * manifest-bridge tests — targeted at PR-D Task 7:
 * timeline items written by the arrangement subagent carry only
 * `data.assetId` (no `data.src`). The bridge must resolve those items
 * via `GET /projects/:id/assets` so the player can fetch the media.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  listProjectAssets: vi.fn(),
}));

vi.mock('@/lib/api/assets', () => ({
  AssetsApi: class {
    listProjectAssets = spies.listProjectAssets;
  },
}));

import { manifestToStore } from './manifest-bridge';

beforeEach(() => {
  vi.clearAllMocks();
});

// Minimal v2 manifest scaffold — one video track + one video item written by
// the arrangement subagent (data.assetId, no data.src).
function makeManifest(overrides: Record<string, unknown> = {}) {
  return {
    version: 2,
    fps: 30,
    durationMs: 10_000,
    canvas: { width: 1920, height: 1080 },
    tracks: [{ id: 't-video', type: 'video', name: 'video', position: 0 }],
    items: [
      {
        id: 'i-1',
        type: 'video',
        trackId: 't-video',
        startMs: 0,
        endMs: 5_000,
        data: {
          assetId: 'a-1',
          sourceStartMs: 0,
          sourceDurationMs: 5_000,
          source: 'arrangement_agent',
        },
      },
    ],
    assets: {},
    ...overrides,
  };
}

describe('manifestToStore — data.assetId resolution (PR-D Task 7)', () => {
  it('resolves data.assetId via listProjectAssets when data.src is absent', async () => {
    spies.listProjectAssets.mockResolvedValueOnce({
      assets: [
        {
          id: 'a-1',
          url: 'https://signed.example/video.mp4?sig=abc',
          thumbnailUrl: null,
          storageKey: 'k',
        },
      ],
    });

    const result = await manifestToStore(makeManifest(), {
      bundleUrl: '',
      compositionId: 'comp',
      projectId: 'p-1',
    });

    expect(spies.listProjectAssets).toHaveBeenCalledTimes(1);
    expect(spies.listProjectAssets).toHaveBeenCalledWith('p-1');
    // The critical property: the item's src now points at the presigned URL.
    const item = result.items['i-1'];
    expect(item.type).toBe('video');
    expect((item.data as { src: string }).src).toBe(
      'https://signed.example/video.mp4?sig=abc',
    );
  });

  it('does NOT call listProjectAssets when no item carries data.assetId', async () => {
    // Every item already has data.src — no resolution needed.
    const manifest = makeManifest({
      items: [
        {
          id: 'i-1',
          type: 'video',
          trackId: 't-video',
          startMs: 0,
          endMs: 5_000,
          data: {
            src: 'https://direct/video.mp4',
            width: 1920,
            height: 1080,
          },
        },
      ],
    });

    const result = await manifestToStore(manifest, {
      bundleUrl: '',
      compositionId: 'comp',
      projectId: 'p-1',
    });

    expect(spies.listProjectAssets).not.toHaveBeenCalled();
    expect((result.items['i-1'].data as { src: string }).src).toBe(
      'https://direct/video.mp4',
    );
  });

  it('skips listProjectAssets when projectId is omitted (legacy callers)', async () => {
    const result = await manifestToStore(makeManifest(), {
      bundleUrl: '',
      compositionId: 'comp',
      // no projectId
    });

    expect(spies.listProjectAssets).not.toHaveBeenCalled();
    // src stays empty — the asset is unresolvable without a projectId,
    // but we must NOT crash; the item still appears in the result.
    expect(result.items['i-1']).toBeDefined();
  });

  it('prefers caller-supplied assetUrlById over a network fetch', async () => {
    const result = await manifestToStore(makeManifest(), {
      bundleUrl: '',
      compositionId: 'comp',
      projectId: 'p-1',
      assetUrlById: { 'a-1': 'https://prefetched/video.mp4' },
    });

    expect(spies.listProjectAssets).not.toHaveBeenCalled();
    expect((result.items['i-1'].data as { src: string }).src).toBe(
      'https://prefetched/video.mp4',
    );
  });

  it('falls back to empty src (without throwing) when listProjectAssets fails', async () => {
    spies.listProjectAssets.mockRejectedValueOnce(new Error('network down'));
    // Silence the intentional console.warn noise.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await manifestToStore(makeManifest(), {
      bundleUrl: '',
      compositionId: 'comp',
      projectId: 'p-1',
    });

    expect(spies.listProjectAssets).toHaveBeenCalledTimes(1);
    expect(result.items['i-1']).toBeDefined();
    warn.mockRestore();
  });

  it('preserves data.src when BOTH assetId and src are present (src wins)', async () => {
    const manifest = makeManifest({
      items: [
        {
          id: 'i-1',
          type: 'video',
          trackId: 't-video',
          startMs: 0,
          endMs: 5_000,
          data: {
            assetId: 'a-1',
            src: 'https://already-resolved/video.mp4',
          },
        },
      ],
    });

    const result = await manifestToStore(manifest, {
      bundleUrl: '',
      compositionId: 'comp',
      projectId: 'p-1',
    });

    // No fetch needed since src is already set.
    expect(spies.listProjectAssets).not.toHaveBeenCalled();
    expect((result.items['i-1'].data as { src: string }).src).toBe(
      'https://already-resolved/video.mp4',
    );
  });
});
