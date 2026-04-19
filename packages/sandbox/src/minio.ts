// packages/sandbox/src/minio.ts
//
// Shared MinIO client helper. Module-level singleton so tools can share the
// same connection pool. Env vars come from the sandbox launcher
// (see packages/api/src/sandbox/e2b.ts — MINIO_ENDPOINT, MINIO_PORT,
// MINIO_USE_SSL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET).
//
// checkpoint.ts has its own local getMinioClient() — leave it alone to avoid
// breaking a hot path; new code should import from this module.

import { Client } from 'minio';

let client: Client | null = null;

export function getMinioClient(): Client {
  if (client) return client;
  client = new Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : undefined,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
  });
  return client;
}

export const BUCKET = process.env.MINIO_BUCKET || 'viona';

/**
 * Lazy-initialized MinIO client proxy. Forwards property access to the
 * underlying singleton from getMinioClient(), so construction is deferred
 * until a method is actually called. Matches the `minioClient` shape used
 * by newer tools (register-asset).
 */
export const minioClient: Client = new Proxy({} as Client, {
  get(_target, prop: string | symbol) {
    const real = getMinioClient() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(real);
    }
    return value;
  },
});

/**
 * Returns the configured MinIO bucket, throwing if MINIO_BUCKET is not set.
 * Prefer this over the `BUCKET` constant in new code — it fails fast instead
 * of silently defaulting to 'viona' when config is missing.
 */
export function getBucket(): string {
  const b = process.env.MINIO_BUCKET;
  if (!b) throw new Error('MINIO_BUCKET env var not set');
  return b;
}
