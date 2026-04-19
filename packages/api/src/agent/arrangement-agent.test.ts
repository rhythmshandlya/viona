import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: spies.query,
}));

import { runArrangementAgent } from './arrangement-agent.js';

beforeEach(() => { vi.clearAllMocks(); });

function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return { async *[Symbol.asyncIterator]() { for (const x of items) yield x; } };
}

describe('runArrangementAgent', () => {
  it('parses finalize_arrangement tool call from assistant message content', async () => {
    spies.query.mockReturnValueOnce(asyncIter([
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'finalize_arrangement', input: {
              timelineItems: [{ assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: 3000 }],
              summary: 'Opening on the hook.',
            }},
          ],
        },
      },
    ]));
    const out = await runArrangementAgent({
      prompt: 'punchy',
      assets: [{ id: 'a-1', filename: 'x.mp4', mimeType: 'video/mp4' }],
      transcripts: [],
    });
    expect(out.timelineItems).toHaveLength(1);
    expect(out.summary).toBe('Opening on the hook.');
  });

  it('throws if no finalize_arrangement tool call is produced', async () => {
    spies.query.mockReturnValueOnce(asyncIter([
      { type: 'assistant', message: { content: [{ type: 'text', text: 'I refuse.' }] } },
    ]));
    await expect(runArrangementAgent({ prompt: 'x', assets: [], transcripts: [] }))
      .rejects.toThrow(/finalize_arrangement/);
  });

  it('throws if tool input fails Zod validation (negative duration)', async () => {
    spies.query.mockReturnValueOnce(asyncIter([
      { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'finalize_arrangement', input: {
        timelineItems: [{ assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: -100 }],
        summary: 's',
      }}] } },
    ]));
    await expect(runArrangementAgent({ prompt: 'x', assets: [], transcripts: [] })).rejects.toThrow();
  });

  it('ignores intermediate system/user messages and text blocks, picks the tool call', async () => {
    spies.query.mockReturnValueOnce(asyncIter([
      { type: 'system', message: { content: [] } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'thinking...' }] } },
      { type: 'assistant', message: { content: [
        { type: 'text', text: 'here is my arrangement' },
        { type: 'tool_use', name: 'finalize_arrangement', input: {
          timelineItems: [],
          summary: 'empty project',
        }},
      ] } },
    ]));
    const out = await runArrangementAgent({ prompt: 'x', assets: [], transcripts: [] });
    expect(out.summary).toBe('empty project');
  });
});
