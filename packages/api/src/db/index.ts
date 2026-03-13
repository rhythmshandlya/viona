import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';
import * as schema from './schema.js';

const pool = new pg.Pool({
  connectionString: config.database.url,
  max: 25,                      // 50 users × ~0.5 active queries each
  min: 2,                       // Keep 2 warm connections
  idleTimeoutMillis: 30_000,    // Close idle connections after 30s
  connectionTimeoutMillis: 10_000, // Fail fast if pool exhausted
});

export const db = drizzle(pool, { schema });

export * from './schema.js';
