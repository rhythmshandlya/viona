import pg from 'pg';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { config } from '../config.js';
import { logger } from '../logger.js';

export async function runMigrations() {
  const pool = new pg.Pool({
    connectionString: config.database.url,
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();

  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get applied migrations
    const { rows: applied } = await client.query('SELECT name FROM _migrations');
    const appliedSet = new Set(applied.map(r => r.name));

    // Get migration files - resolve relative to this file's location
    // In dev (src/db/), ../../drizzle reaches packages/api/drizzle correctly.
    // In prod bundle (dist/), ../../drizzle goes too far up. Use ../drizzle instead.
    const currentDir = dirname(fileURLToPath(import.meta.url));
    let migrationsDir = join(currentDir, '../../drizzle');
    if (!existsSync(migrationsDir)) {
      migrationsDir = join(currentDir, '../drizzle');
    }
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    let applied_count = 0;
    for (const file of sqlFiles) {
      if (appliedSet.has(file)) {
        continue;
      }

      logger.info({ file }, 'Applying migration');
      const sql = await readFile(join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied_count++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    if (applied_count > 0) {
      logger.info({ count: applied_count }, 'Migrations applied');
    } else {
      logger.info({ total: sqlFiles.length }, 'Database up to date');
    }
  } finally {
    client.release();
    await pool.end();
  }
}
