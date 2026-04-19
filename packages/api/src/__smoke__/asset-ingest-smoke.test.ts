import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { db } from '../db/index.js';
import { assets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';

const enabled = process.env.ASSET_SMOKE_ENABLED === '1';

describe.skipIf(!enabled)('asset ingest smoke', () => {
  it('POST /assets/register creates a new ready asset and dedups on repeat', async () => {
    const userId = `smoke-user-${Date.now()}`;
    const content = Buffer.from(`dummy-${Date.now()}`);
    const sha256 = createHash('sha256').update(content).digest('hex');
    const storageKey = `users/${userId}/assets/smoke/${sha256}.txt`;
    const port = config.port ?? 4000;

    const body = {
      storageKey, sha256, filename: 'smoke.txt',
      mimeType: 'text/plain', fileSize: content.length, source: 'upload',
    };
    // Use the dev-bypass auth path exposed by src/middleware/auth.ts.
    // In non-production (no RAILWAY_ENVIRONMENT), `Authorization: Bearer dev-bypass`
    // resolves to an existing user via getDevBypassUser()/getOrCreateDevUser().
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer dev-bypass',
    };

    // First call — new asset, deduped: false.
    const res1 = await fetch(`http://localhost:${port}/assets/register`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    expect(res1.status).toBe(200);
    const json1 = await res1.json() as { asset: { id: string; status: string }; deduped: boolean };
    expect(json1.deduped).toBe(false);
    const assetId = json1.asset.id;

    const [row] = await db.select().from(assets).where(eq(assets.id, assetId));
    expect(row).toBeDefined();
    expect(row.status).toBe('ready');
    expect(row.sha256).toBe(sha256);

    // Second call with same sha256 — dedup.
    const res2 = await fetch(`http://localhost:${port}/assets/register`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    expect(res2.status).toBe(200);
    const json2 = await res2.json() as { asset: { id: string }; deduped: boolean };
    expect(json2.deduped).toBe(true);
    expect(json2.asset.id).toBe(assetId);
  });
});
