import { describe, it, expect } from 'vitest';
import { arrangementOutputSchema, type ArrangementInput, type ArrangementOutput } from './arrangement-types.js';

describe('arrangement types', () => {
  it('validates a well-formed ArrangementOutput', () => {
    const output: ArrangementOutput = {
      timelineItems: [
        { assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: 3000 },
        { assetId: 'a-2', trackIndex: 0, startMs: 3000, durationMs: 4000, sourceStartMs: 500, sourceDurationMs: 4000 },
      ],
      summary: 'Opened with the hook shot, then the product demo.',
    };
    const parsed = arrangementOutputSchema.parse(output);
    expect(parsed.timelineItems).toHaveLength(2);
    expect(parsed.summary).toBe('Opened with the hook shot, then the product demo.');
  });

  it('rejects negative durations', () => {
    expect(() => arrangementOutputSchema.parse({
      timelineItems: [{ assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: -100 }],
      summary: 's',
    })).toThrow();
  });

  it('rejects empty summary', () => {
    expect(() => arrangementOutputSchema.parse({
      timelineItems: [],
      summary: '',
    })).toThrow();
  });

  it('rejects negative trackIndex', () => {
    expect(() => arrangementOutputSchema.parse({
      timelineItems: [{ assetId: 'a-1', trackIndex: -1, startMs: 0, durationMs: 100 }],
      summary: 's',
    })).toThrow();
  });

  it('accepts ArrangementInput with required fields only (sockets undefined)', () => {
    const input: ArrangementInput = {
      prompt: 'Make it punchy',
      assets: [{ id: 'a-1', filename: 'x.mp4', mimeType: 'video/mp4' }],
      transcripts: [],
    };
    expect(input.visualAnalyses).toBeUndefined();
    expect(input.sceneBoundaries).toBeUndefined();
    expect(input.speakerDiarization).toBeUndefined();
    expect(input.highlights).toBeUndefined();
    expect(input.autoDescriptions).toBeUndefined();
  });
});
