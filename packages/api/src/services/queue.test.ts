import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock bullmq + ioredis + config before importing the queue module. Each Queue
// created by queue.ts is captured so we can assert on its .name and .add calls.
const addSpy = vi.fn().mockResolvedValue({ id: 'j-1' });

vi.mock('bullmq', () => {
  // Must be a real constructor — queue.ts uses `new Queue(...)`.
  function Queue(this: { name: string; add: (...a: unknown[]) => unknown }, name: string) {
    this.name = name;
    this.add = (...a: unknown[]) => addSpy(...a);
  }
  return { Queue };
});

// queue.ts constructs `new Redis(config.redis.url)` for the job-cancel
// publisher at module load — stub it so tests don't open real connections.
vi.mock('ioredis', () => {
  function Redis(this: { publish: (...a: unknown[]) => Promise<number> }) {
    this.publish = async () => 1;
  }
  return { default: Redis };
});

vi.mock('../config.js', () => ({
  config: {
    redis: { url: 'redis://localhost:6379' },
  },
}));

// Import AFTER mocks.
import {
  queueAssetMetadataJob,
  assetMetadataQueue,
} from './queue.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assetMetadataQueue', () => {
  it('constructs a queue named "asset-metadata"', () => {
    expect(assetMetadataQueue.name).toBe('asset-metadata');
  });
});

describe('queueAssetMetadataJob', () => {
  it('adds the job to the queue with the expected name and payload', async () => {
    await queueAssetMetadataJob({ assetId: 'a-1' });
    expect(addSpy).toHaveBeenCalledWith(
      'asset-metadata',
      { assetId: 'a-1' },
      expect.objectContaining({ attempts: 3 }),
    );
  });
});
