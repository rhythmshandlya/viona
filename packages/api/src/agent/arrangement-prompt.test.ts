import { describe, it, expect } from 'vitest';
import { buildArrangementSystemPrompt, FINALIZE_ARRANGEMENT_TOOL } from './arrangement-prompt.js';

describe('buildArrangementSystemPrompt', () => {
  it('embeds prompt, asset list with durations+intents, and transcripts', () => {
    const sys = buildArrangementSystemPrompt({
      prompt: 'fun vibe',
      assets: [
        { id: 'a-1', filename: 'i.mp4', mimeType: 'video/mp4', durationMs: 5000, userIntent: 'hook' },
        { id: 'a-2', filename: 'logo.png', mimeType: 'image/png' },
      ],
      transcripts: [{ assetId: 'a-1', text: 'hi there', segments: [{ startMs: 0, endMs: 1000, text: 'hi' }] }],
    });
    expect(sys).toContain('fun vibe');
    expect(sys).toContain('a-1');
    expect(sys).toContain('i.mp4');
    expect(sys).toContain('5s');  // duration rendered
    expect(sys).toContain('hook'); // intent rendered
    expect(sys).toContain('hi there');
    // Absent sockets: should NOT mention them as available
    expect(sys).not.toContain('visualAnalyses available');
    expect(sys).not.toContain('sceneBoundaries available');
    expect(sys).not.toContain('speakerDiarization available');
    expect(sys).not.toContain('highlights available');
    expect(sys).not.toContain('autoDescriptions available');
  });

  it('uses a placeholder sentence when prompt is empty', () => {
    const sys = buildArrangementSystemPrompt({ prompt: '', assets: [], transcripts: [] });
    expect(sys.toLowerCase()).toContain('empty');
  });

  it('turns on each socket clause when populated', () => {
    const sys = buildArrangementSystemPrompt({
      prompt: 'x', assets: [], transcripts: [],
      visualAnalyses: [{ assetId: 'a-1', labels: ['cat', 'sky'] }],
      sceneBoundaries: [{ assetId: 'a-1', cuts: [1000, 2500] }],
      speakerDiarization: [{ assetId: 'a-1', segments: [{ speakerId: 'S1', startMs: 0, endMs: 1000 }] }],
      highlights: [{ assetId: 'a-1', scores: [{ startMs: 0, endMs: 500, score: 0.9 }] }],
      autoDescriptions: [{ assetId: 'a-1', description: 'cat walks over a fence' }],
    });
    expect(sys).toContain('visualAnalyses available');
    expect(sys).toContain('sceneBoundaries available');
    expect(sys).toContain('speakerDiarization available');
    expect(sys).toContain('highlights available');
    expect(sys).toContain('autoDescriptions available');
    expect(sys).toContain('cat walks over a fence');
  });
});

describe('FINALIZE_ARRANGEMENT_TOOL', () => {
  it('declares name + description + JSON schema for timelineItems and summary', () => {
    expect(FINALIZE_ARRANGEMENT_TOOL.name).toBe('finalize_arrangement');
    expect(FINALIZE_ARRANGEMENT_TOOL.description).toBeTruthy();
    const schema = FINALIZE_ARRANGEMENT_TOOL.input_schema;
    expect(schema.type).toBe('object');
    expect(schema.properties.timelineItems).toBeDefined();
    expect(schema.properties.summary).toBeDefined();
    expect(schema.required).toEqual(expect.arrayContaining(['timelineItems', 'summary']));
  });

  it('requires assetId/trackIndex/startMs/durationMs on each timeline item', () => {
    const items = FINALIZE_ARRANGEMENT_TOOL.input_schema.properties.timelineItems;
    expect(items.type).toBe('array');
    expect(items.items.required).toEqual(expect.arrayContaining(['assetId', 'trackIndex', 'startMs', 'durationMs']));
  });
});
