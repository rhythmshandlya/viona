import { describe, it, expect } from 'vitest';
import { config } from './config.js';

describe('config.featureFlags', () => {
  it('exposes assetSystemV2 as a boolean', () => {
    expect(typeof config.featureFlags.assetSystemV2).toBe('boolean');
  });
});
