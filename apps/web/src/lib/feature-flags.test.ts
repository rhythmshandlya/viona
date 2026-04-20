import { describe, it, expect } from 'vitest';
import { isAssetSystemV2 } from './feature-flags';

describe('isAssetSystemV2', () => {
  it('returns false when NEXT_PUBLIC_ASSET_SYSTEM_V2 is unset', () => {
    delete process.env.NEXT_PUBLIC_ASSET_SYSTEM_V2;
    expect(isAssetSystemV2()).toBe(false);
  });

  it('returns true when NEXT_PUBLIC_ASSET_SYSTEM_V2 === "true"', () => {
    process.env.NEXT_PUBLIC_ASSET_SYSTEM_V2 = 'true';
    expect(isAssetSystemV2()).toBe(true);
  });

  it('returns false for any other value', () => {
    process.env.NEXT_PUBLIC_ASSET_SYSTEM_V2 = '1';
    expect(isAssetSystemV2()).toBe(false);
    process.env.NEXT_PUBLIC_ASSET_SYSTEM_V2 = 'yes';
    expect(isAssetSystemV2()).toBe(false);
  });
});
