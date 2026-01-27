import { describe, it, expect } from 'vitest';

// Test the progress parsing logic used by runEnhancementScript
describe('enhance-audio progress parsing', () => {
  it('parses PROGRESS lines correctly', () => {
    const progressRegex = /^PROGRESS:(\d+)%:(.+)$/;

    const line1 = 'PROGRESS:15%:Running DeepFilterNet3';
    const match1 = line1.match(progressRegex);
    expect(match1).not.toBeNull();
    expect(match1![1]).toBe('15');
    expect(match1![2]).toBe('Running DeepFilterNet3');

    const line2 = 'PROGRESS:100%:Enhancement complete';
    const match2 = line2.match(progressRegex);
    expect(match2).not.toBeNull();
    expect(match2![1]).toBe('100');
    expect(match2![2]).toBe('Enhancement complete');
  });

  it('does not match non-progress lines', () => {
    const progressRegex = /^PROGRESS:(\d+)%:(.+)$/;

    expect('Some random output'.match(progressRegex)).toBeNull();
    expect('ERROR:something went wrong'.match(progressRegex)).toBeNull();
    expect(''.match(progressRegex)).toBeNull();
  });
});

describe('enhance-audio progress mapping', () => {
  it('maps Python progress (0-100) to job progress (15-75)', () => {
    const mapProgress = (percent: number) => 15 + Math.round(percent * 0.6);

    expect(mapProgress(0)).toBe(15);
    expect(mapProgress(50)).toBe(45);
    expect(mapProgress(100)).toBe(75);
  });
});
