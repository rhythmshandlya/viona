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

  it('also publishes composition_updated when eventType is "arranged" with ok:true', async () => {
    spies.addMessage.mockResolvedValueOnce({ id: 'm-1', conversationId: 'c-1', role: 'pipeline' });
    await insertPipelineMessage({
      conversationId: 'c-1', projectId: 'p-1',
      eventType: 'arranged',
      details: { ok: true, itemCount: 5 },
    });
    const payloads = spies.publish.mock.calls.map((c) => c[1] as string);
    const compositionPayload = payloads.find((p) => p.includes('"kind":"composition_updated"'));
    expect(compositionPayload).toBeDefined();
    expect(compositionPayload).toContain('"projectId":"p-1"');
    expect(compositionPayload).toContain('"itemCount":5');
    // Both envelopes land on the same conversation channel:
    const channels = spies.publish.mock.calls.map((c) => c[0]);
    expect(channels.filter((c) => c === 'conversation:p-1')).toHaveLength(2);  // pipeline_message + composition_updated
  });

  it('does NOT publish composition_updated on arranged with ok:false', async () => {
    spies.addMessage.mockResolvedValueOnce({ id: 'm-2', conversationId: 'c-1', role: 'pipeline' });
    await insertPipelineMessage({
      conversationId: 'c-1', projectId: 'p-1',
      eventType: 'arranged',
      details: { ok: false, error: 'boom' },
    });
    const payloads = spies.publish.mock.calls.map((c) => c[1] as string);
    const compositionPayload = payloads.find((p) => p.includes('"kind":"composition_updated"'));
    expect(compositionPayload).toBeUndefined();
  });

  it('does NOT publish composition_updated on unrelated event types', async () => {
    spies.addMessage.mockResolvedValueOnce({ id: 'm-3', conversationId: 'c-1', role: 'pipeline' });
    await insertPipelineMessage({
      conversationId: 'c-1', projectId: 'p-1',
      eventType: 'transcribed',
      details: { assetId: 'a-1', wordCount: 42 },
    });
    const payloads = spies.publish.mock.calls.map((c) => c[1] as string);
    const compositionPayload = payloads.find((p) => p.includes('"kind":"composition_updated"'));
    expect(compositionPayload).toBeUndefined();
  });
});
