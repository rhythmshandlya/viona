import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  compute: vi.fn(),
}));

// Option A: worker-side orchestrator mirror. The processor delegates to
// `computeArrangement` which wires up the worker's mirrored DB + services.
vi.mock('../services/arrangement-orchestrator.js', () => ({
  computeArrangement: spies.compute,
}));

import { processArrangementJob } from './arrangement.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('processArrangementJob', () => {
  it('invokes computeArrangement with the projectId from job data', async () => {
    spies.compute.mockResolvedValueOnce({ timelineItems: [], summary: 's' });
    await processArrangementJob({ data: { projectId: 'p-1' } } as never);
    expect(spies.compute).toHaveBeenCalledWith('p-1');
  });

  it('propagates errors so BullMQ retries', async () => {
    spies.compute.mockRejectedValueOnce(new Error('boom'));
    await expect(
      processArrangementJob({ data: { projectId: 'p-1' } } as never),
    ).rejects.toThrow('boom');
  });
});
