import { describe, it, expect } from 'vitest';
import { config } from './config.js';

describe('config.featureFlags', () => {
  it('exposes assetSystemV2 as a boolean', () => {
    expect(typeof config.featureFlags.assetSystemV2).toBe('boolean');
  });

  it('exposes analysisWorkers as a boolean, default false', () => {
    expect(typeof config.featureFlags.analysisWorkers).toBe('boolean');
    expect(config.featureFlags.analysisWorkers).toBe(process.env.ANALYSIS_WORKERS === 'true');
  });
});
