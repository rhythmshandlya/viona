import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  addMessage: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('../agent/conversation-store.js', () => ({
  addMessage: spies.addMessage,
}));
vi.mock('./redis.js', () => ({
  redis: { publish: spies.publish },
}));

import { insertPipelineMessage } from './pipeline-messages.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('insertPipelineMessage (worker)', () => {
  it('inserts a pipeline-role message with eventType + details in content', async () => {
    spies.addMessage.mockResolvedValueOnce({ id: 'm-1', conversationId: 'c-1', role: 'pipeline' });
    const result = await insertPipelineMessage({
      conversationId: 'c-1',
      projectId: 'p-1',
      eventType: 'transcribing',
      details: { assetId: 'a-1', filename: 'intro.mp4' },
    });
    expect(result.id).toBe('m-1');
    expect(spies.addMessage).toHaveBeenCalledWith(
      'c-1',
      'pipeline',
      expect.arrayContaining([
        expect.objectContaining({
          type: 'pipeline_event',
          eventType: 'transcribing',
          details: { assetId: 'a-1', filename: 'intro.mp4' },
        }),
      ]),
    );
  });

  it('publishes to conversation SSE channel with kind + eventType', async () => {
    spies.addMessage.mockResolvedValueOnce({ id: 'm-2', conversationId: 'c-1', role: 'pipeline' });
    await insertPipelineMessage({
      conversationId: 'c-1', projectId: 'p-1', eventType: 'transcribed', details: {},
    });
    expect(spies.publish).toHaveBeenCalledWith(
      'conversation:p-1',
      expect.stringContaining('"eventType":"transcribed"'),
    );
    const payload = spies.publish.mock.calls[0][1] as string;
    expect(payload).toContain('"kind":"pipeline_message"');
    expect(payload).toContain('"conversationId":"c-1"');
  });

  it('publishes exactly one envelope per call (no composition_updated mirror)', async () => {
    // PR-D Task 2: after removing the standalone arrangement processor + its
    // composition_updated mirror, every insertPipelineMessage call must produce
    // exactly one Redis publish. Regression-guards against a reintroduced
    // arrangement-side envelope.
    spies.addMessage.mockResolvedValueOnce({ id: 'm-3', conversationId: 'c-1', role: 'pipeline' });
    await insertPipelineMessage({
      conversationId: 'c-1', projectId: 'p-1', eventType: 'transcribed', details: { ok: true, itemCount: 5 },
    });
    expect(spies.publish).toHaveBeenCalledTimes(1);
    const payload = spies.publish.mock.calls[0][1] as string;
    expect(payload).toContain('"kind":"pipeline_message"');
    expect(payload).not.toContain('composition_updated');
  });
});
