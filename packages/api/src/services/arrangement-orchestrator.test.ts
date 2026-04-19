import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  buildInput: vi.fn(),
  runAgent: vi.fn(),
  persist: vi.fn().mockResolvedValue(undefined),
  insertPipeline: vi.fn().mockResolvedValue(undefined),
  addMessage: vi.fn().mockResolvedValue({ id: 'am-1' }),
  getOrCreateConversation: vi.fn(),
}));

vi.mock('./arrangement-input-builder.js', () => ({
  buildArrangementInput: spies.buildInput,
}));
vi.mock('../agent/arrangement-agent.js', () => ({
  runArrangementAgent: spies.runAgent,
}));
vi.mock('./arrangement-persister.js', () => ({
  persistArrangement: spies.persist,
}));
vi.mock('./pipeline-messages.js', () => ({
  insertPipelineMessage: spies.insertPipeline,
}));
vi.mock('../agent/conversation-store.js', () => ({
  getOrCreateConversation: spies.getOrCreateConversation,
  addMessage: spies.addMessage,
}));

import { computeArrangement } from './arrangement-orchestrator.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('computeArrangement', () => {
  it('happy path: emits arranging → arranged, persists, posts summary as assistant message', async () => {
    spies.getOrCreateConversation.mockResolvedValue({ id: 'c-1' });
    spies.buildInput.mockResolvedValueOnce({ prompt: 'x', assets: [], transcripts: [] });
    spies.runAgent.mockResolvedValueOnce({
      timelineItems: [
        { assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: 3000 },
        { assetId: 'a-2', trackIndex: 0, startMs: 3000, durationMs: 4000 },
      ],
      summary: 'first pass',
    });

    const result = await computeArrangement('p-1');

    // Event ordering: first call arranging, last call arranged
    expect(spies.insertPipeline).toHaveBeenNthCalledWith(1, expect.objectContaining({
      conversationId: 'c-1', projectId: 'p-1', eventType: 'arranging',
    }));
    expect(spies.insertPipeline).toHaveBeenLastCalledWith(expect.objectContaining({
      eventType: 'arranged', details: expect.objectContaining({ ok: true, itemCount: 2 }),
    }));
    // Persist called with the output
    expect(spies.persist).toHaveBeenCalledWith('p-1', expect.objectContaining({ summary: 'first pass' }));
    // Summary posted as assistant text message
    expect(spies.addMessage).toHaveBeenCalledWith('c-1', 'assistant', expect.arrayContaining([
      expect.objectContaining({ type: 'text', text: 'first pass' }),
    ]));
    expect(result.summary).toBe('first pass');
  });

  it('failure path: agent throws → emits arranged with ok:false + error; rethrows; does not persist or post summary', async () => {
    spies.getOrCreateConversation.mockResolvedValue({ id: 'c-1' });
    spies.buildInput.mockResolvedValueOnce({ prompt: 'x', assets: [], transcripts: [] });
    spies.runAgent.mockRejectedValueOnce(new Error('agent-fail'));

    await expect(computeArrangement('p-1')).rejects.toThrow('agent-fail');

    expect(spies.insertPipeline).toHaveBeenLastCalledWith(expect.objectContaining({
      eventType: 'arranged',
      details: expect.objectContaining({ ok: false, error: 'agent-fail' }),
    }));
    expect(spies.persist).not.toHaveBeenCalled();
    expect(spies.addMessage).not.toHaveBeenCalled();
  });

  it('failure path: persister throws → still emits arranged with ok:false; rethrows', async () => {
    spies.getOrCreateConversation.mockResolvedValue({ id: 'c-1' });
    spies.buildInput.mockResolvedValueOnce({ prompt: 'x', assets: [], transcripts: [] });
    spies.runAgent.mockResolvedValueOnce({
      timelineItems: [], summary: 's',
    });
    spies.persist.mockRejectedValueOnce(new Error('persist-fail'));

    await expect(computeArrangement('p-1')).rejects.toThrow('persist-fail');

    expect(spies.insertPipeline).toHaveBeenLastCalledWith(expect.objectContaining({
      eventType: 'arranged',
      details: expect.objectContaining({ ok: false, error: 'persist-fail' }),
    }));
  });
});
