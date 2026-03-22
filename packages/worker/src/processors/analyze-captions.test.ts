import { describe, it, expect } from 'vitest';
import { detectSpeakerEmphasis } from './analyze-captions';

const makeWord = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs });

describe('detectSpeakerEmphasis', () => {
  it('detects slow delivery', () => {
    const words = [
      makeWord('She', 0, 200),
      makeWord('built', 200, 400),
      makeWord('an', 400, 500),
      makeWord('empire', 500, 1100), // 600ms, ~3x avg
      makeWord('from', 1100, 1300),
      makeWord('nothing', 1300, 1500),
    ];
    const markers = detectSpeakerEmphasis(words);
    const slowMarkers = markers.filter(m => m.type === 'slow-delivery');
    expect(slowMarkers.some(m => m.wordIndex === 3)).toBe(true);
  });

  it('detects pause-before', () => {
    const words = [
      makeWord('She', 0, 200),
      makeWord('built', 200, 400),
      makeWord('empire', 900, 1100), // 500ms gap before
      makeWord('from', 1100, 1300),
    ];
    const markers = detectSpeakerEmphasis(words);
    const pauseMarkers = markers.filter(m => m.type === 'pause-before');
    expect(pauseMarkers.some(m => m.wordIndex === 2)).toBe(true);
  });

  it('detects pause-after', () => {
    const words = [
      makeWord('empire', 0, 200),
      makeWord('from', 800, 1000), // 600ms gap after empire
    ];
    const markers = detectSpeakerEmphasis(words);
    const pauseMarkers = markers.filter(m => m.type === 'pause-after');
    expect(pauseMarkers.some(m => m.wordIndex === 0)).toBe(true);
  });

  it('returns empty array for uniform speech', () => {
    const words = [
      makeWord('the', 0, 200),
      makeWord('cat', 200, 400),
      makeWord('sat', 400, 600),
      makeWord('down', 600, 800),
    ];
    const markers = detectSpeakerEmphasis(words);
    expect(markers.length).toBe(0);
  });

  it('assigns confidence based on deviation magnitude', () => {
    const words = [
      makeWord('a', 0, 100),
      makeWord('b', 100, 200),
      makeWord('c', 200, 300),
      makeWord('SLOW', 300, 900), // 600ms, 6x avg of 100ms
      makeWord('d', 900, 1000),
    ];
    const markers = detectSpeakerEmphasis(words);
    const slow = markers.find(m => m.wordIndex === 3 && m.type === 'slow-delivery');
    expect(slow).toBeDefined();
    expect(slow!.confidence).toBeGreaterThan(0.5);
  });
});
