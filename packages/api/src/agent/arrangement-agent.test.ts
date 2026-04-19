import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: spies.create };
    },
  };
});

import { runArrangementAgent } from './arrangement-agent.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('runArrangementAgent', () => {
  it('parses finalize_arrangement tool_use block from the response', async () => {
    spies.create.mockResolvedValueOnce({
      content: [{
        type: 'tool_use',
        name: 'finalize_arrangement',
        input: {
          timelineItems: [{ assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: 3000 }],
          summary: 'Opening on the hook.',
        },
      }],
    });
    const out = await runArrangementAgent({
      prompt: 'punchy',
      assets: [{ id: 'a-1', filename: 'x.mp4', mimeType: 'video/mp4' }],
      transcripts: [],
    });
    expect(out.timelineItems).toHaveLength(1);
    expect(out.summary).toBe('Opening on the hook.');
  });

  it('calls messages.create with system, tools, tool_choice', async () => {
    spies.create.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'finalize_arrangement', input: {
        timelineItems: [], summary: 'empty',
      }}],
    });
    await runArrangementAgent({ prompt: 'x', assets: [], transcripts: [] });
    expect(spies.create).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.stringContaining('Arrangement Agent'),
      tools: expect.arrayContaining([
        expect.objectContaining({ name: 'finalize_arrangement' }),
      ]),
      tool_choice: { type: 'tool', name: 'finalize_arrangement' },
    }));
  });

  it('throws if no finalize_arrangement tool_use is produced', async () => {
    spies.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I refuse.' }],
    });
    await expect(runArrangementAgent({ prompt: 'x', assets: [], transcripts: [] }))
      .rejects.toThrow(/finalize_arrangement/);
  });

  it('throws if tool input fails Zod validation', async () => {
    spies.create.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'finalize_arrangement', input: {
        timelineItems: [{ assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: -100 }],
        summary: 's',
      }}],
    });
    await expect(runArrangementAgent({ prompt: 'x', assets: [], transcripts: [] })).rejects.toThrow();
  });
});
