import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// jsdom 29 doesn't ship a DataTransfer constructor — minimal polyfill so the
// drag-data test can exercise the dragstart handler. Local to this file so we
// don't pollute global test-setup with editor-specific shims.
if (typeof globalThis.DataTransfer === 'undefined') {
  class DataTransferPolyfill {
    private store = new Map<string, string>();
    dropEffect = 'none';
    effectAllowed = 'all';
    files = [] as unknown as FileList;
    items = [] as unknown as DataTransferItemList;
    types: string[] = [];
    setData(format: string, data: string): void {
      this.store.set(format, data);
      if (!this.types.includes(format)) this.types.push(format);
    }
    getData(format: string): string {
      return this.store.get(format) ?? '';
    }
    clearData(format?: string): void {
      if (format) this.store.delete(format);
      else this.store.clear();
    }
    setDragImage(): void {}
  }
  // @ts-expect-error - polyfill for jsdom
  globalThis.DataTransfer = DataTransferPolyfill;
}

if (typeof globalThis.DragEvent === 'undefined') {
  class DragEventPolyfill extends Event {
    dataTransfer: DataTransfer | null;
    constructor(type: string, init: EventInit & { dataTransfer?: DataTransfer } = {}) {
      super(type, init);
      this.dataTransfer = init.dataTransfer ?? null;
    }
  }
  // @ts-expect-error - polyfill for jsdom
  globalThis.DragEvent = DragEventPolyfill;
}

const spies = vi.hoisted(() => ({
  listUserAssets: vi.fn(),
  listProjectAssets: vi.fn(),
  linkToProject: vi.fn(),
}));

vi.mock('@/lib/api/assets', () => ({
  AssetsApi: class {
    listUserAssets = spies.listUserAssets;
    listProjectAssets = spies.listProjectAssets;
    linkToProject = spies.linkToProject;
  },
}));

// Stub useAssetEvents so tests don't open real SSE streams.
vi.mock('@/lib/sse/useAssetEvents', () => ({
  useAssetEvents: vi.fn(),
}));

import { AssetsPanelV2 } from './AssetsPanelV2';
import { useAssetEvents as useAssetEventsMock } from '@/lib/sse/useAssetEvents';

beforeEach(() => { vi.clearAllMocks(); });

describe('AssetsPanelV2', () => {
  it('defaults to Project tab and renders linked assets', async () => {
    spies.listProjectAssets.mockResolvedValueOnce({
      assets: [{ id: 'a-1', filename: 'hero.mp4', label: 'hero.mp4', mimeType: 'video/mp4', status: 'ready' }],
    });
    render(<AssetsPanelV2 projectId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText(/hero\.mp4/i)).toBeInTheDocument();
    });
    expect(spies.listProjectAssets).toHaveBeenCalledWith('p-1');
  });

  // The Library tab was removed (collapsed into project-only view) because
  // it was meant for a future global-uploads surface that doesn't exist yet.
  // When that surface ships, re-add the tab + this test.

  it('sets drag data in application/x-project-asset format', async () => {
    spies.listProjectAssets.mockResolvedValueOnce({
      assets: [{ id: 'a-1', filename: 'hero.mp4', label: 'hero.mp4', mimeType: 'video/mp4', status: 'ready', durationMs: 5000 }],
    });
    render(<AssetsPanelV2 projectId="p-1" />);
    await waitFor(() => screen.getByText(/hero\.mp4/i));
    const tile = screen.getByTestId('asset-tile-a-1');
    const dt = new DataTransfer();
    const evt = new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true });
    tile.dispatchEvent(evt);
    const payload = dt.getData('application/x-project-asset');
    expect(payload).toContain('"id":"a-1"');
    expect(payload).toContain('"mimeType":"video/mp4"');
  });
});

describe('AssetsPanelV2 tile rendering', () => {
  it('renders thumbnail img when thumbnailUrl is present', async () => {
    spies.listProjectAssets.mockResolvedValueOnce({
      assets: [{
        id: 'a-1', filename: 'hero.mp4', label: 'hero.mp4', mimeType: 'video/mp4',
        status: 'ready', durationMs: 5000,
        thumbnailUrl: 'https://signed/thumb.jpg',
      }],
    });
    render(<AssetsPanelV2 projectId="p-1" />);
    await waitFor(() => screen.getByText(/hero\.mp4/i));
    const tile = screen.getByTestId('asset-tile-a-1');
    const img = tile.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://signed/thumb.jpg');
  });

  it('renders MIME type placeholder when thumbnailUrl is null', async () => {
    spies.listProjectAssets.mockResolvedValueOnce({
      assets: [{
        id: 'a-2', filename: 'clip.wav', label: 'clip.wav', mimeType: 'audio/wav',
        status: 'ready', thumbnailUrl: null,
      }],
    });
    render(<AssetsPanelV2 projectId="p-1" />);
    await waitFor(() => screen.getByText(/clip\.wav/i));
    expect(screen.getByText('AUD')).toBeInTheDocument();
  });

  it('renders duration badge when durationMs is present', async () => {
    spies.listProjectAssets.mockResolvedValueOnce({
      assets: [{
        id: 'a-3', filename: 'hero.mp4', label: 'hero.mp4', mimeType: 'video/mp4',
        status: 'ready', durationMs: 15000, thumbnailUrl: null,
      }],
    });
    render(<AssetsPanelV2 projectId="p-1" />);
    await waitFor(() => expect(screen.getByText('0:15')).toBeInTheDocument());
  });

  it('does NOT render duration badge when durationMs is null/undefined', async () => {
    spies.listProjectAssets.mockResolvedValueOnce({
      assets: [{
        id: 'a-4', filename: 'static.png', label: 'static.png', mimeType: 'image/png',
        status: 'ready', durationMs: null, thumbnailUrl: null,
      }],
    });
    render(<AssetsPanelV2 projectId="p-1" />);
    await waitFor(() => screen.getByText(/static\.png/i));
    expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument();
  });
});

describe('AssetsPanelV2 SSE live refresh', () => {
  it('refetches when a "linked" event fires', async () => {
    // First fetch: empty. Second fetch (after event): 1 asset.
    spies.listProjectAssets
      .mockResolvedValueOnce({ assets: [] })
      .mockResolvedValueOnce({ assets: [{ id: 'a-new', filename: 'just-added.mp4', label: 'just-added.mp4', mimeType: 'video/mp4', status: 'ready' }] });

    let capturedOnEvent: ((e: { type: string }) => void) | null = null;
    (useAssetEventsMock as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce((opts: { onEvent: (e: { type: string }) => void }) => {
      capturedOnEvent = opts.onEvent;
    });

    render(<AssetsPanelV2 projectId="p-1" />);
    await waitFor(() => expect(spies.listProjectAssets).toHaveBeenCalledTimes(1));

    // Simulate an event callback.
    capturedOnEvent!({ type: 'linked' });

    await waitFor(() => expect(spies.listProjectAssets).toHaveBeenCalledTimes(2));
  });

  it('does not refetch on unrelated event types (e.g. failed)', async () => {
    spies.listProjectAssets.mockResolvedValue({ assets: [] });
    let capturedOnEvent: ((e: { type: string }) => void) | null = null;
    (useAssetEventsMock as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce((opts: { onEvent: (e: { type: string }) => void }) => {
      capturedOnEvent = opts.onEvent;
    });

    render(<AssetsPanelV2 projectId="p-1" />);
    await waitFor(() => expect(spies.listProjectAssets).toHaveBeenCalledTimes(1));

    capturedOnEvent!({ type: 'failed' });
    // Wait a tick; no new fetch should be triggered.
    await new Promise((r) => setTimeout(r, 30));
    expect(spies.listProjectAssets).toHaveBeenCalledTimes(1);
  });
});
