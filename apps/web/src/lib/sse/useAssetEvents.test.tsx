import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const spies = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.stubGlobal('fetch', spies.fetch);
vi.mock('../auth', () => ({ getSessionToken: () => 'tok-1' }));

import { useAssetEvents } from './useAssetEvents';

beforeEach(() => { vi.clearAllMocks(); });

function streamFromLines(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
}

describe('useAssetEvents', () => {
  it('calls onEvent for each parsed SSE data frame', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      body: streamFromLines([
        'data: {"id":"e-1","type":"created","assetId":"a-1","userId":"u-1","projectId":null,"payload":{},"createdAt":"2026-04-20T00:00:00Z"}\n\n',
        'data: {"id":"e-2","type":"ready","assetId":"a-1","userId":"u-1","projectId":null,"payload":{},"createdAt":"2026-04-20T00:00:01Z"}\n\n',
      ]),
    });
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useAssetEvents({ enabled: true, onEvent }));
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'created', assetId: 'a-1' }));
    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'ready' }));
    unmount();
  });

  it('does not fetch when enabled=false', async () => {
    renderHook(() => useAssetEvents({ enabled: false, onEvent: vi.fn() }));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(spies.fetch).not.toHaveBeenCalled();
  });

  it('sends Bearer authorization header', async () => {
    spies.fetch.mockResolvedValueOnce({
      ok: true,
      body: streamFromLines([]),
    });
    renderHook(() => useAssetEvents({ enabled: true, onEvent: vi.fn(), apiBaseUrl: 'http://api' }));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(spies.fetch).toHaveBeenCalledWith(
      'http://api/asset-events',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }),
      }),
    );
  });
});
