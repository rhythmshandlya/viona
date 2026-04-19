import { describe, it, expect } from 'vitest';
import type { InferInsertModel } from 'drizzle-orm';
import { assets, assetProjectLinks, assetEvents } from './schema';

describe('asset schema types', () => {
  it('Asset insert type has userId, sha256, storageKey required', () => {
    type AssetInsert = InferInsertModel<typeof assets>;
    const row: AssetInsert = {
      userId: 'user-1',
      sha256: 'abc',
      storageKey: 'users/user-1/assets/abc',
      filename: 'x.mp4',
      mimeType: 'video/mp4',
      fileSize: 100,
      label: 'x.mp4',
      source: 'upload',
      status: 'uploading',
    };
    // Compile-time guard: sha256 is required.
    // @ts-expect-error sha256 is required on assets insert
    const missingSha: AssetInsert = {
      userId: 'user-1',
      storageKey: 'k',
      filename: 'f',
      mimeType: 'video/mp4',
      fileSize: 1,
      label: 'l',
      source: 'upload',
      status: 'uploading',
    };
    expect(row).toBeDefined();
    expect(missingSha).toBeDefined();
  });

  it('AssetProjectLink requires assetId and projectId', () => {
    type LinkInsert = InferInsertModel<typeof assetProjectLinks>;
    const row: LinkInsert = { assetId: 'a', projectId: 'p', addedVia: 'upload' };
    // Compile-time guard: projectId is required.
    // @ts-expect-error projectId is required on assetProjectLinks insert
    const missingProject: LinkInsert = { assetId: 'a', addedVia: 'upload' };
    expect(row).toBeDefined();
    expect(missingProject).toBeDefined();
  });

  it('AssetEvent accepts each expected type value', () => {
    type EventInsert = InferInsertModel<typeof assetEvents>;
    const types = [
      'created', 'ready', 'metadata_ready', 'transcript_ready',
      'linked', 'unlinked', 'renamed', 'deleted', 'failed',
    ] as const;
    for (const t of types) {
      const row: EventInsert = { assetId: 'a', userId: 'u', type: t, payload: {} };
      expect(row.type).toBe(t);
    }
    // Compile-time guard: type is required.
    // @ts-expect-error type is required on assetEvents insert
    const missingType: EventInsert = { assetId: 'a', userId: 'u', payload: {} };
    expect(missingType).toBeDefined();
  });
});
