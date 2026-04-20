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

  it('switches to Library tab and fetches user-scoped assets', async () => {
    spies.listProjectAssets.mockResolvedValueOnce({ assets: [] });
    spies.listUserAssets.mockResolvedValueOnce({
      assets: [{ id: 'a-2', filename: 'library-clip.mp4', label: 'library-clip.mp4', mimeType: 'video/mp4', status: 'ready' }],
    });
    render(<AssetsPanelV2 projectId="p-1" />);
    await userEvent.click(screen.getByRole('tab', { name: /library/i }));
    await waitFor(() => {
      expect(screen.getByText(/library-clip\.mp4/i)).toBeInTheDocument();
    });
  });

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
