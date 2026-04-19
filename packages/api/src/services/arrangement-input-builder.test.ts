import { describe, it, expect, vi, beforeEach } from 'vitest';

const spies = vi.hoisted(() => ({
  listProjectAssets: vi.fn(),
  fetchTranscriptJson: vi.fn(),
  getOrCreateConversation: vi.fn(),
  getConversationMessages: vi.fn(),
  selectWhere: vi.fn(),
  whereReturn: vi.fn(),
}));

vi.mock('./asset-link-service.js', () => ({
  listProjectAssets: spies.listProjectAssets,
}));
vi.mock('./transcript-fetch.js', () => ({
  fetchTranscriptJson: spies.fetchTranscriptJson,
}));
vi.mock('../agent/conversation-store.js', () => ({
  getOrCreateConversation: spies.getOrCreateConversation,
  getConversationMessages: spies.getConversationMessages,
}));
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...a: unknown[]) => {
          spies.selectWhere(...a);
          return Promise.resolve(spies.whereReturn());
        },
      })),
    })),
  },
}));

import { buildArrangementInput } from './arrangement-input-builder.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildArrangementInput', () => {
  it('collects prompt, assets, and transcripts; normalizes seconds to ms', async () => {
    spies.getOrCreateConversation.mockResolvedValueOnce({ id: 'c-1' });
    spies.getConversationMessages.mockResolvedValueOnce([
      { id: 'm-0', role: 'pipeline', content: [{ type: 'pipeline_event', eventType: 'transcribing' }] },
      { id: 'm-1', role: 'user', content: [{ type: 'text', text: 'make it punchy' }] },
      { id: 'm-2', role: 'assistant', content: [{ type: 'text', text: 'ok' }] },
    ]);
    spies.listProjectAssets.mockResolvedValueOnce([
      { id: 'a-1', filename: 'intro.mp4', mimeType: 'video/mp4', durationMs: 5000, userIntent: 'hook', userDescription: null, transcriptAssetId: 't-1' },
      { id: 'a-2', filename: 'logo.png', mimeType: 'image/png', durationMs: null, userIntent: null, userDescription: 'brand logo', transcriptAssetId: null },
    ]);
    spies.whereReturn.mockReturnValueOnce([
      { id: 't-1', storageKey: 'users/u/derived/a-1/transcript.json', parentAssetIds: ['a-1'] },
    ]);
    spies.fetchTranscriptJson.mockResolvedValueOnce({
      text: 'hello world',
      segments: [{ start: 0, end: 1, text: 'hello world' }],
    });

    const input = await buildArrangementInput('p-1');

    expect(input.prompt).toBe('make it punchy');
    expect(input.assets).toHaveLength(2);
    expect(input.assets[0]).toMatchObject({
      id: 'a-1',
      filename: 'intro.mp4',
      mimeType: 'video/mp4',
      durationMs: 5000,
      userIntent: 'hook',
    });
    expect(input.assets[1]).toMatchObject({
      id: 'a-2',
      userDescription: 'brand logo',
    });
    expect(input.transcripts).toHaveLength(1);
    expect(input.transcripts[0].assetId).toBe('a-1');
    expect(input.transcripts[0].text).toBe('hello world');
    expect(input.transcripts[0].segments[0]).toMatchObject({ startMs: 0, endMs: 1000, text: 'hello world' });

    // Negative assertion: fetchTranscriptJson called exactly once (only for assets that have transcriptAssetId)
    expect(spies.fetchTranscriptJson).toHaveBeenCalledTimes(1);
    expect(spies.fetchTranscriptJson).toHaveBeenCalledWith('users/u/derived/a-1/transcript.json');
    // DB select issued once to fetch derived transcript rows.
    expect(spies.selectWhere).toHaveBeenCalledTimes(1);
  });

  it('returns empty prompt if no user messages exist', async () => {
    spies.getOrCreateConversation.mockResolvedValueOnce({ id: 'c-1' });
    spies.getConversationMessages.mockResolvedValueOnce([]);
    spies.listProjectAssets.mockResolvedValueOnce([]);
    const input = await buildArrangementInput('p-1');
    expect(input.prompt).toBe('');
    expect(input.assets).toEqual([]);
    expect(input.transcripts).toEqual([]);
    // No assets => no DB select for derived rows, no transcript fetch.
    expect(spies.selectWhere).not.toHaveBeenCalled();
    expect(spies.fetchTranscriptJson).not.toHaveBeenCalled();
  });

  it('skips transcripts that fail to fetch (continues without them)', async () => {
    spies.getOrCreateConversation.mockResolvedValueOnce({ id: 'c-1' });
    spies.getConversationMessages.mockResolvedValueOnce([
      { id: 'm-1', role: 'user', content: [{ type: 'text', text: 'x' }] },
    ]);
    spies.listProjectAssets.mockResolvedValueOnce([
      { id: 'a-1', filename: 'f.mp4', mimeType: 'video/mp4', durationMs: 1000, userIntent: null, userDescription: null, transcriptAssetId: 't-broken' },
    ]);
    spies.whereReturn.mockReturnValueOnce([
      { id: 't-broken', storageKey: 'missing/key', parentAssetIds: ['a-1'] },
    ]);
    spies.fetchTranscriptJson.mockRejectedValueOnce(new Error('no such key'));

    const input = await buildArrangementInput('p-1');
    expect(input.assets).toHaveLength(1);
    expect(input.transcripts).toHaveLength(0);
  });

  it('ignores non-text blocks when extracting prompt', async () => {
    spies.getOrCreateConversation.mockResolvedValueOnce({ id: 'c-1' });
    spies.getConversationMessages.mockResolvedValueOnce([
      { id: 'm-1', role: 'user', content: [{ type: 'widget', widget: { id: 'w-1' } }, { type: 'text', text: 'real prompt' }] },
    ]);
    spies.listProjectAssets.mockResolvedValueOnce([]);
    const input = await buildArrangementInput('p-1');
    expect(input.prompt).toBe('real prompt');
  });
});
