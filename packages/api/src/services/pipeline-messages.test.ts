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

describe('insertPipelineMessage', () => {
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
      conversationId: 'c-1', projectId: 'p-1', eventType: 'arranging', details: {},
    });
    expect(spies.publish).toHaveBeenCalledWith(
      'conversation:p-1',
      expect.stringContaining('"eventType":"arranging"'),
    );
    const payload = spies.publish.mock.calls[0][1] as string;
    expect(payload).toContain('"kind":"pipeline_message"');
    expect(payload).toContain('"conversationId":"c-1"');
  });

  it('does NOT publish to conversation channel when projectId is omitted-shape: reject at type level', async () => {
    // projectId is required in the input — TS would catch, not runtime.
    // This test confirms publish is called exactly once per call, not twice.
    spies.addMessage.mockResolvedValueOnce({ id: 'm-3', conversationId: 'c-1', role: 'pipeline' });
    await insertPipelineMessage({
      conversationId: 'c-1', projectId: 'p-1', eventType: 'transcribing', details: {},
    });
    expect(spies.publish).toHaveBeenCalledTimes(1);
  });

  it('publishes exactly one envelope (pipeline_message) on arranged+ok:true', async () => {
    spies.addMessage.mockResolvedValueOnce({ id: 'm-1', conversationId: 'c-1', role: 'pipeline' });
    await insertPipelineMessage({
      conversationId: 'c-1', projectId: 'p-1',
      eventType: 'arranged',
      details: { ok: true, itemCount: 5 },
    });
    expect(spies.publish).toHaveBeenCalledTimes(1);
    const payload = spies.publish.mock.calls[0][1] as string;
    expect(payload).toContain('"kind":"pipeline_message"');
    expect(payload).not.toContain('composition_updated');
  });
});
