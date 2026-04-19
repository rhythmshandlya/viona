import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPublish = vi.fn().mockResolvedValue(1);
const valuesSpy = vi.fn();

vi.mock('../db/index.js', () => {
  const insert = vi.fn(() => ({
    values: (...args: unknown[]) => {
      valuesSpy(...args);
      return {
        returning: vi.fn().mockResolvedValue([
          {
            id: 'event-1',
            assetId: 'a-1',
            userId: 'u-1',
            projectId: 'p-1',
            type: 'created',
            payload: { foo: 'bar' },
            createdAt: new Date('2026-04-19T00:00:00Z'),
          },
        ]),
      };
    },
  }));
  return { db: { insert } };
});

vi.mock('./redis.js', () => ({
  redis: { publish: (...args: unknown[]) => mockPublish(...args) },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// Import after mocks are registered
import { emitAssetEvent } from './asset-events.js';

describe('emitAssetEvent', () => {
  it('inserts a row and publishes to Redis channel keyed by userId', async () => {
    const result = await emitAssetEvent({
      assetId: 'a-1',
      userId: 'u-1',
      projectId: 'p-1',
      type: 'created',
      payload: { foo: 'bar' },
    });
    expect(result.id).toBe('event-1');
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'a-1',
        userId: 'u-1',
        projectId: 'p-1',
        type: 'created',
        payload: { foo: 'bar' },
      }),
    );
    expect(mockPublish).toHaveBeenCalledWith(
      'asset-events:u-1',
      expect.stringContaining('"type":"created"'),
    );
  });

  it('publishes to project channel when projectId is set', async () => {
    await emitAssetEvent({
      assetId: 'a-1',
      userId: 'u-1',
      projectId: 'p-1',
      type: 'linked',
      payload: {},
    });
    expect(mockPublish).toHaveBeenCalledWith(
      'asset-events:project:p-1',
      expect.any(String),
    );
  });

  it('does not publish to project channel when projectId is null', async () => {
    await emitAssetEvent({
      assetId: 'a-1',
      userId: 'u-1',
      projectId: null,
      type: 'deleted',
      payload: {},
    });
    const channels = mockPublish.mock.calls.map((c) => c[0]);
    expect(channels).toEqual(['asset-events:u-1']);
  });

  it('does not publish to project channel when projectId is undefined', async () => {
    await emitAssetEvent({
      assetId: 'a-1',
      userId: 'u-1',
      type: 'deleted',
      payload: {},
    });
    const channels = mockPublish.mock.calls.map((c) => c[0]);
    expect(channels).toEqual(['asset-events:u-1']);
  });
});
