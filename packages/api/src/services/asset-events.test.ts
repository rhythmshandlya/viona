import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPublish = vi.fn().mockResolvedValue(1);

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
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
      })),
    })),
  },
}));

vi.mock('./redis.js', () => ({
  redis: { publish: (...args: unknown[]) => mockPublish(...args) },
}));

beforeEach(() => {
  mockPublish.mockClear();
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
});
