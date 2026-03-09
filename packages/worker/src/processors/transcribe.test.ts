import { describe, it, expect } from 'vitest';
import { mapWordTypeToOverrides } from './transcribe.js';

describe('mapWordTypeToOverrides', () => {
  it('returns power overrides for power words', () => {
    const result = mapWordTypeToOverrides('power');
    expect(result).not.toBeNull();
    expect(result!.scale).toBe(1.6);
    expect(result!.fontWeight).toBe(900);
    expect(result!.color).toBe('#ffffff');
    expect(result!.activeColor).toBe('#FFD400');
    expect(result!.textTransform).toBe('uppercase');
  });

  it('returns filler overrides for filler words', () => {
    const result = mapWordTypeToOverrides('filler');
    expect(result).not.toBeNull();
    expect(result!.scale).toBe(1.0);
    expect(result!.fontWeight).toBe(500);
    expect(result!.color).toBe('rgba(255,255,255,0.7)');
    expect(result!.activeColor).toBe('rgba(255,255,255,0.85)');
    expect(result!.textTransform).toBeUndefined();
  });

  it('returns null for medium words (use preset defaults)', () => {
    const result = mapWordTypeToOverrides('medium');
    expect(result).toBeNull();
  });
});
