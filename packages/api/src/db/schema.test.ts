import { describe, it, expect } from 'vitest';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
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
    expect(row.userId).toBe('user-1');
  });

  it('AssetProjectLink requires assetId and projectId', () => {
    type LinkInsert = InferInsertModel<typeof assetProjectLinks>;
    const row: LinkInsert = { assetId: 'a', projectId: 'p', addedVia: 'upload' };
    expect(row.assetId).toBe('a');
  });

  it('AssetEvent supports all event types', () => {
    type EventInsert = InferInsertModel<typeof assetEvents>;
    const row: EventInsert = {
      assetId: 'a', userId: 'u', type: 'created', payload: {},
    };
    expect(row.type).toBe('created');
  });
});
